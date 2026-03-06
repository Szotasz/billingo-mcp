import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";

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
) {
  server.tool(
    "list_spending",
    "Költségek listázása szűrőkkel",
    {
      page: z.number().default(1).describe("Oldalszám"),
      per_page: z.number().default(25).describe("Elemek száma oldalanként"),
      spending_date_from: z.string().optional().describe("Kezdő dátum (YYYY-MM-DD)"),
      spending_date_to: z.string().optional().describe("Vég dátum (YYYY-MM-DD)"),
      payment_status: z.enum(["paid", "outstanding", "expired"]).optional().describe("Fizetési státusz"),
      category: z.string().optional().describe("Kategória szűrő"),
      q: z.string().optional().describe("Keresés"),
    },
    { title: "List Spending", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/spending", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_spending",
    "Költség adatainak lekérése ID alapján",
    {
      spending_id: z.number().describe("A költség ID-ja"),
    },
    { title: "Get Spending", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ spending_id }: { spending_id: number }) => {
      const result = await client.get(`/spending/${spending_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_spending",
    "Új költség rögzítése",
    {
      partner_id: z.number().optional().describe("Partner ID"),
      spending_date: z.string().describe("Költség dátuma (YYYY-MM-DD)"),
      due_date: z.string().describe("Fizetési határidő (YYYY-MM-DD)"),
      paid_at: z.string().optional().describe("Fizetés dátuma (YYYY-MM-DD)"),
      currency: z.string().default("HUF").describe("Pénznem"),
      conversion_rate: z.number().optional().describe("Árfolyam"),
      category: z.string().optional().describe("Kategória"),
      comment: z.string().optional().describe("Megjegyzés"),
      invoice_number: z.string().optional().describe("Számlaszám"),
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).describe("Fizetési mód"),
      items: z.array(SpendingItemSchema).describe("Tételek"),
    },
    { title: "Create Spending", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/spending", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_spending",
    "Költség módosítása",
    {
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
      payment_method: z.enum(["artutalas", "cash", "bankcard", "paypal", "szep_card", "coupon", "elore_utalas", "payoneer", "paylike", "barion", "ep_kartya", "compensation", "utalvany", "online_bankcard"]).optional().describe("Fizetési mód"),
      items: z.array(SpendingItemSchema).optional().describe("Tételek"),
    },
    { title: "Update Spending", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (params: { spending_id: number; [key: string]: unknown }) => {
      const { spending_id, ...body } = params;
      const result = await client.put(`/spending/${spending_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_spending",
    "Költség törlése",
    {
      spending_id: z.number().describe("A költség ID-ja"),
    },
    { title: "Delete Spending", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ spending_id }: { spending_id: number }) => {
      await client.delete(`/spending/${spending_id}`);
      return { content: [{ type: "text" as const, text: `Költség ${spending_id} sikeresen törölve.` }] };
    },
  );
}
