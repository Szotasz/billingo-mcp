import { z } from "zod";
import { paymentMethodSchema } from "./payment-methods.js";
import { McpServer } from "@modelcontextprotocol/server";
import type { BillingoClient } from "../billingo-client.js";
import { ConfirmationStore, confirmationIdSchema, withConfirmation } from "../confirm.js";
import { namedLine } from "../summaries.js";

const SpendingItemSchema = z.object({
  description: z.string().describe("Tétel leírása"),
  net_unit_amount: z.number().describe("Nettó egységár"),
  quantity: z.number().describe("Mennyiség"),
  unit: z.string().default("db").describe("Mennyiségi egység"),
  vat_amount: z.number().describe("ÁFA összeg"),
  category: z.string().optional().describe("Kategória"),
  gross_amount: z.number().optional().describe("Bruttó összeg"),
  account_number: z.string().optional().describe("Főkönyvi szám"),
});

export function registerSpendingTools(
  server: McpServer,
  client: BillingoClient,
  store: ConfirmationStore = new ConfirmationStore(),
) {
  server.registerTool(
    "list_spending",
    {
      description: "Költségek listázása szűrőkkel",
      inputSchema: z.object({
        page: z.number().default(1).describe("Oldalszám"),
        per_page: z.number().default(25).describe("Elemek száma oldalanként"),
        spending_date_from: z.string().optional().describe("Kezdő dátum (YYYY-MM-DD)"),
        spending_date_to: z.string().optional().describe("Vég dátum (YYYY-MM-DD)"),
        payment_status: z.enum(["paid", "outstanding", "expired"]).optional().describe("Fizetési státusz"),
        category: z.string().optional().describe("Kategória szűrő"),
        q: z.string().optional().describe("Keresés"),
      }),
      annotations: { title: "List Spending", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/spending", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "get_spending",
    {
      description: "Költség adatainak lekérése ID alapján",
      inputSchema: z.object({
        spending_id: z.number().describe("A költség ID-ja"),
      }),
      annotations: { title: "Get Spending", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ spending_id }: { spending_id: number }) => {
      const result = await client.get(`/spending/${spending_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "create_spending",
    {
      description: "Új költség rögzítése",
      inputSchema: z.object({
        partner_id: z.number().optional().describe("Partner ID"),
        spending_date: z.string().describe("Költség dátuma (YYYY-MM-DD)"),
        due_date: z.string().describe("Fizetési határidő (YYYY-MM-DD)"),
        paid_at: z.string().optional().describe("Fizetés dátuma (YYYY-MM-DD)"),
        currency: z.string().default("HUF").describe("Pénznem"),
        conversion_rate: z.number().optional().describe("Árfolyam"),
        category: z.string().optional().describe("Kategória"),
        comment: z.string().optional().describe("Megjegyzés"),
        invoice_number: z.string().optional().describe("Számlaszám"),
        payment_method: paymentMethodSchema.describe("Fizetési mód"),
        items: z.array(SpendingItemSchema).describe("Tételek"),
      }),
      annotations: { title: "Create Spending", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/spending", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "update_spending",
    {
      description: "Költség módosítása",
      inputSchema: z.object({
        spending_id: z.number().describe("A költség ID-ja"),
        partner_id: z.number().optional().describe("Partner ID"),
        spending_date: z.string().optional().describe("Költség dátuma (YYYY-MM-DD)"),
        due_date: z.string().optional().describe("Fizetési határidő (YYYY-MM-DD)"),
        paid_at: z.string().optional().describe("Fizetés dátuma (YYYY-MM-DD)"),
        currency: z.string().optional().describe("Pénznem"),
        conversion_rate: z.number().optional().describe("Árfolyam"),
        category: z.string().optional().describe("Kategória"),
        comment: z.string().optional().describe("Megjegyzés"),
        invoice_number: z.string().optional().describe("Számlaszám"),
        payment_method: paymentMethodSchema.optional().describe("Fizetési mód"),
        items: z.array(SpendingItemSchema).optional().describe("Tételek"),
      }),
      annotations: { title: "Update Spending", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: { spending_id: number; [key: string]: unknown }) => {
      const { spending_id, ...body } = params;
      const result = await client.put(`/spending/${spending_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "delete_spending",
    {
      description: "Költség törlése",
      inputSchema: z.object({
        spending_id: z.number().describe("A költség ID-ja"),
        confirmation_id: confirmationIdSchema,
      }),
      annotations: { title: "Delete Spending", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withConfirmation<{ spending_id: number }>({
      server,
      store,
      tool: "delete_spending",
      describe: async ({ spending_id }) => `Költség törlése, visszavonhatatlan:\n${await namedLine(client, "Költség", `/spending/${spending_id}`, spending_id)}`,
      run: async ({ spending_id }) => {
        await client.delete(`/spending/${spending_id}`);
        return { content: [{ type: "text" as const, text: `Költség ${spending_id} sikeresen törölve.` }] };
      },
    }),
  );
}
