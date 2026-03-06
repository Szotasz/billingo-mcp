import { z } from "zod";
import { resolve, dirname } from "node:path";
import { access, constants } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";

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
) {
  server.tool(
    "list_documents",
    "Számlák/bizonylatok listázása szűrőkkel",
    {
      page: z.number().default(1).describe("Oldalszám"),
      per_page: z.number().default(25).describe("Elemek száma oldalanként (max 100)"),
      block_id: z.number().optional().describe("Számlatömb ID"),
      partner_id: z.number().optional().describe("Partner ID"),
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).optional().describe("Fizetési mód"),
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
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).describe("Fizetési mód"),
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
    },
    { title: "Create Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/documents", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cancel_document",
    "Számla sztornózása",
    {
      document_id: z.number().describe("A sztornózandó dokumentum ID-ja"),
    },
    { title: "Cancel Document", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.post(`/documents/${document_id}/cancel`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_draft",
    "Piszkozat számla törlése (csak draft típusra működik)",
    {
      document_id: z.number().describe("A törlendő piszkozat ID-ja"),
    },
    { title: "Delete Draft", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      await client.delete(`/documents/${document_id}`);
      return { content: [{ type: "text" as const, text: `Piszkozat ${document_id} sikeresen törölve.` }] };
    },
  );

  server.tool(
    "create_from_proforma",
    "Díjbekérőből (proforma) számla készítése",
    {
      document_id: z.number().describe("A proforma dokumentum ID-ja"),
    },
    { title: "Create From Proforma", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.post(`/documents/${document_id}/create-from-proforma`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_from_draft",
    "Piszkozatból végleges számla készítése",
    {
      document_id: z.number().describe("A piszkozat dokumentum ID-ja"),
    },
    { title: "Create From Draft", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      const result = await client.put(`/documents/${document_id}/create-from-draft`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_modification_document",
    "Módosító bizonylat készítése egy meglévő számlához",
    {
      document_id: z.number().describe("Az eredeti dokumentum ID-ja"),
      items: z.array(DocumentItemSchema).describe("Módosító tételek"),
      fulfillment_date: z.string().describe("Teljesítés dátuma (YYYY-MM-DD)"),
      due_date: z.string().describe("Fizetési határidő (YYYY-MM-DD)"),
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).describe("Fizetési mód"),
    },
    { title: "Create Modification Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (params: { document_id: number; items: unknown[]; fulfillment_date: string; due_date: string; payment_method: string }) => {
      const { document_id, ...body } = params;
      const result = await client.post(`/documents/${document_id}/create-modification-document`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
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
    },
    { title: "Send Document", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ document_id, emails }: { document_id: number; emails?: string[] }) => {
      const body = emails && emails.length > 0 ? { emails } : undefined;
      const result = await client.post(`/documents/${document_id}/send`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
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
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).describe("Fizetési mód"),
    },
    { title: "Update Payment", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (params: { document_id: number; date: string; price: number; payment_method: string }) => {
      const { document_id, ...body } = params;
      const result = await client.put(`/documents/${document_id}/payments`, [body]);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_payment",
    "Fizetési előzmény törlése",
    {
      document_id: z.number().describe("A dokumentum ID-ja"),
    },
    { title: "Delete Payment", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ document_id }: { document_id: number }) => {
      await client.delete(`/documents/${document_id}/payments`);
      return { content: [{ type: "text" as const, text: `Fizetési előzmények törölve a ${document_id} dokumentumhoz.` }] };
    },
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
