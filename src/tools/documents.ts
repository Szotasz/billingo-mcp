import { z } from "zod";
import { paymentMethodSchema } from "./payment-methods.js";
import { resolve, dirname } from "node:path";
import { access, constants } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";
import { ConfirmationStore, confirmationIdSchema, withConfirmation } from "../confirm.js";
import { documentLine, itemLines, partnerLine, totals, type ItemLike } from "../summaries.js";

async function validateOutputPath(outputPath: string): Promise<string> {
  const resolved = resolve(outputPath);
  // Prevent writing outside user's home directory
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  if (!resolved.startsWith(home + "/") && !resolved.startsWith("/tmp/")) {
    throw new Error(`Output path must be within home directory (${home}) or /tmp`);
  }
  // Ensure parent directory exists
  try {
    await access(dirname(resolved), constants.W_OK);
  } catch {
    throw new Error(`Parent directory does not exist or is not writable: ${dirname(resolved)}`);
  }
  return resolved;
}

const DocumentItemSchema = z.object({
  product_id: z.number().optional(),
  comment: z.string().optional(),
  name: z.string().optional(),
  unit_price: z.number(),
  unit_price_type: z.enum(["gross", "net"]).default("net"),
  quantity: z.number(),
  unit: z.string().default("db"),
  vat: z.string().default("27%"),
  entitlement: z.string().optional(),
});

export function registerDocumentTools(
  server: McpServer,
  client: BillingoClient,
  store: ConfirmationStore = new ConfirmationStore(),
) {
  const confirm = <A extends Record<string, unknown>>(tool: string, describe: (a: A) => Promise<string> | string, run: (a: A) => Promise<{ content: Array<{ type: "text"; text: string }> }>, needed?: (a: A) => boolean) =>
    withConfirmation<A>({ server, store, tool, describe, run, needed });

  server.tool(
    "list_documents",
    "Számlák/bizonylatok listázása szűrőkkel",
    {
      page: z.number().default(1).describe("Oldalszám"),
      per_page: z.number().default(25).describe("Elemek száma oldalanként (max 100)"),
      block_id: z.number().optional().describe("Számlatömb ID"),
      partner_id: z.number().optional().describe("Partner ID"),
      payment_method: paymentMethodSchema.optional().describe("Fizetési mód"),
      payment_status: z.enum(["paid", "outstanding", "expired"]).optional().describe("Fizetési státusz"),
      start_date: z.string().optional().describe("Kezdő dátum (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Vég dátum (YYYY-MM-DD)"),
      start_number: z.string().optional().describe("Kezdő sorszám"),
      end_number: z.string().optional().describe("Vég sorszám"),
      type: z.enum(["draft", "proforma", "invoice", "advance", "receipt", "waybill", "offer"]).optional().describe("Bizonylat típusa"),
      query: z.string().optional().describe("Keresés szöveg"),
    },
    { title: "List Documents", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/documents", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_document",
    "Számla/bizonylat részleteinek lekérése ID alapján",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
    },
    { title: "Get Document", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.get(`/documents/${document_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_document",
    "Új számla/bizonylat létrehozása. A type mező határozza meg a bizonylat típusát (invoice, proforma, draft, stb.).",
    {
      partner_id: z.number().describe("Partner ID"),
      block_id: z.number().describe("Számlatömb ID"),
      type: z.enum(["draft", "proforma", "invoice", "advance", "receipt", "waybill", "offer"]).describe("Bizonylat típusa"),
      fulfillment_date: z.string().describe("Teljesítés dátuma (YYYY-MM-DD)"),
      due_date: z.string().describe("Fizetési határidő (YYYY-MM-DD)"),
      payment_method: paymentMethodSchema.describe("Fizetési mód"),
      language: z.enum(["hu", "en", "de", "fr", "hr", "it", "ro", "sk", "es"]).default("hu").describe("Nyelv"),
      currency: z.string().default("HUF").describe("Pénznem (pl. HUF, EUR, USD)"),
      conversion_rate: z.number().optional().describe("Átváltási árfolyam (ha nem HUF)"),
      electronic: z.boolean().default(false).describe("Elektronikus számla"),
      paid: z.boolean().default(false).describe("Fizetve státusz"),
      items: z.array(DocumentItemSchema).describe("Tételek listája"),
      comment: z.string().optional().describe("Megjegyzés"),
      settings: z.object({
        mediated_service: z.boolean().optional(),
        without_financial_fulfillment: z.boolean().optional(),
        online_payment: z.string().optional(),
        round: z.enum(["none", "one", "five", "ten"]).optional(),
        place_id: z.number().optional(),
      }).optional().describe("Számla beállítások"),
      emails: z.array(z.string()).optional().describe("E-mail címek küldéshez"),
      document_notification: z.boolean().default(false).describe("Értesítés küldése a partnernek"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Create Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    confirm<Record<string, unknown>>(
      "create_document",
      async (a) => {
        const items = a.items as ItemLike[];
        const currency = String(a.currency ?? "HUF");
        const t = totals(items);
        const emails = (a.emails as string[] | undefined) ?? [];
        return [
          `Bizonylat kiállítása (${a.type}), visszavonni csak sztornóval lehet.`,
          await partnerLine(client, a.partner_id as number),
          `Számlatömb: #${a.block_id}; teljesítés: ${a.fulfillment_date}; határidő: ${a.due_date}`,
          `Fizetési mód: ${a.payment_method}; fizetve: ${a.paid ? "igen" : "nem"}; pénznem: ${currency}; nyelv: ${a.language}`,
          "Tételek:",
          ...itemLines(items, currency),
          `Összesen: nettó ${t.net}, áfa ${t.vat}, bruttó ${t.gross} ${currency} (a végösszeget a Billingo kerekíti)`,
          emails.length || a.document_notification ? `E-mail: ${emails.length ? emails.join(", ") : "a partner e-mail címére"}` : "E-mail: nem megy ki",
        ].join("\n");
      },
      async (params) => {
        const { confirmation_id: _c, ...body } = params;
        const result = await client.post("/documents", body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
      (a) => a.type !== "draft",
    ),
  );

  server.tool(
    "cancel_document",
    "Számla sztornózása",
    {
      document_id: z.number().describe("A sztornózandó dokumentum ID-ja"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Cancel Document", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    confirm<{ document_id: number }>(
      "cancel_document",
      async ({ document_id }) => `Sztornó, visszavonhatatlan, a NAV felé is kimegy:\n${await documentLine(client, document_id)}`,
      async ({ document_id }) => {
        const result = await client.post(`/documents/${document_id}/cancel`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "delete_draft",
    "Piszkozat számla törlése (csak draft típusra működik)",
    {
      document_id: z.number().describe("A törlendő piszkozat ID-ja"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Delete Draft", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    confirm<{ document_id: number }>(
      "delete_draft",
      async ({ document_id }) => `Piszkozat törlése, visszavonhatatlan:\n${await documentLine(client, document_id)}`,
      async ({ document_id }) => {
        await client.delete(`/documents/${document_id}`);
        return { content: [{ type: "text" as const, text: `Piszkozat ${document_id} sikeresen törölve.` }] };
      },
    ),
  );

  server.tool(
    "create_from_proforma",
    "Díjbekérőből (proforma) számla készítése",
    {
      document_id: z.number().describe("A proforma dokumentum ID-ja"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Create From Proforma", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    confirm<{ document_id: number }>(
      "create_from_proforma",
      async ({ document_id }) => `Díjbekérőből végleges számla kiállítása, visszavonni csak sztornóval lehet:\n${await documentLine(client, document_id)}`,
      async ({ document_id }) => {
        const result = await client.post(`/documents/${document_id}/create-from-proforma`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "create_from_draft",
    "Piszkozatból végleges számla készítése",
    {
      document_id: z.number().describe("A piszkozat dokumentum ID-ja"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Create From Draft", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    confirm<{ document_id: number }>(
      "create_from_draft",
      async ({ document_id }) => `Piszkozatból végleges számla kiállítása, visszavonni csak sztornóval lehet:\n${await documentLine(client, document_id)}`,
      async ({ document_id }) => {
        const result = await client.put(`/documents/${document_id}/create-from-draft`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "create_modification_document",
    "Módosító bizonylat készítése egy meglévő számlához",
    {
      document_id: z.number().describe("Az eredeti dokumentum ID-ja"),
      items: z.array(DocumentItemSchema).describe("Módosító tételek"),
      fulfillment_date: z.string().describe("Teljesítés dátuma (YYYY-MM-DD)"),
      due_date: z.string().describe("Fizetési határidő (YYYY-MM-DD)"),
      payment_method: paymentMethodSchema.describe("Fizetési mód"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Create Modification Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    confirm<{ document_id: number; items: ItemLike[]; fulfillment_date: string; due_date: string; payment_method: string; confirmation_id?: string }>(
      "create_modification_document",
      async (a) => {
        const t = totals(a.items);
        return [
          "Módosító bizonylat kiállítása, visszavonni csak sztornóval lehet.",
          `Eredeti: ${await documentLine(client, a.document_id)}`,
          `Teljesítés: ${a.fulfillment_date}; határidő: ${a.due_date}; fizetési mód: ${a.payment_method}`,
          "Módosító tételek:",
          ...itemLines(a.items, ""),
          `A módosító tételek összesen: nettó ${t.net}, áfa ${t.vat}, bruttó ${t.gross}`,
        ].join("\n");
      },
      async (params) => {
        const { document_id, confirmation_id: _c, ...body } = params;
        const result = await client.post(`/documents/${document_id}/create-modification-document`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "copy_document",
    "Számla másolása (új számla készítése egy meglévő alapján)",
    {
      document_id: z.number().describe("A másolandó dokumentum ID-ja"),
    },
    { title: "Copy Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.post(`/documents/${document_id}/copy`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "download_document",
    "Számla PDF letöltése és mentése a megadott útvonalra",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
      output_path: z.string().describe("Fájl mentési útvonal (pl. /tmp/szamla.pdf)"),
    },
    { title: "Download Document", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ document_id, output_path }: { document_id: number; output_path: string }) => {
      const safePath = await validateOutputPath(output_path);
      const { data } = await client.requestBinary("GET", `/documents/${document_id}/download`, "application/pdf");
      const fs = await import("node:fs/promises");
      await fs.writeFile(safePath, data);
      return { content: [{ type: "text" as const, text: `PDF mentve: ${safePath} (${data.length} bytes)` }] };
    },
  );

  server.tool(
    "get_document_public_url",
    "Nyilvános letöltési link generálása egy számlához",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
    },
    { title: "Get Document Public URL", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.get(`/documents/${document_id}/public-url`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "send_document",
    "Számla küldése e-mailben a partnernek vagy megadott címekre",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
      emails: z.array(z.string()).optional().describe("E-mail címek (ha üres, a partner e-mail címére megy)"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Send Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    confirm<{ document_id: number; emails?: string[]; confirmation_id?: string }>(
      "send_document",
      async ({ document_id, emails }) =>
        `Bizonylat kiküldése e-mailben, a levél nem hívható vissza:\n${await documentLine(client, document_id)}\nCímzett: ${emails && emails.length > 0 ? emails.join(", ") : "a partner e-mail címe"}`,
      async ({ document_id, emails }) => {
        const body = emails && emails.length > 0 ? { emails } : undefined;
        const result = await client.post(`/documents/${document_id}/send`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "get_payment",
    "Számla fizetési előzményeinek lekérése",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
    },
    { title: "Get Payment", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.get(`/documents/${document_id}/payments`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_payment",
    "Fizetés rögzítése egy számlához",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
      date: z.string().describe("Fizetés dátuma (YYYY-MM-DD)"),
      price: z.number().describe("Fizetett összeg"),
      payment_method: paymentMethodSchema.describe("Fizetési mód"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Update Payment", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    confirm<{ document_id: number; date: string; price: number; payment_method: string; confirmation_id?: string }>(
      "update_payment",
      async (a) =>
        `Fizetés rögzítése a számlához:\n${await documentLine(client, a.document_id)}\nDátum: ${a.date}; összeg: ${a.price}; fizetési mód: ${a.payment_method}`,
      async (params) => {
        const { document_id, confirmation_id: _c, ...body } = params;
        const result = await client.put(`/documents/${document_id}/payments`, [body]);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
    ),
  );

  server.tool(
    "delete_payment",
    "Fizetési előzmény törlése",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
      confirmation_id: confirmationIdSchema,
    },
    { title: "Delete Payment", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    confirm<{ document_id: number }>(
      "delete_payment",
      async ({ document_id }) => `Az összes fizetési előzmény törlése:\n${await documentLine(client, document_id)}`,
      async ({ document_id }) => {
        await client.delete(`/documents/${document_id}/payments`);
        return { content: [{ type: "text" as const, text: `Fizetési előzmények törölve a ${document_id} dokumentumhoz.` }] };
      },
    ),
  );

  server.tool(
    "get_online_szamla_status",
    "NAV Online Számla státusz lekérése egy számlához",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
    },
    { title: "Get Online Szamla Status", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.get(`/documents/${document_id}/online-szamla`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
