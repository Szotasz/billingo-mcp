import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";

export function registerBankAccountTools(
  server: McpServer,
  client: BillingoClient,
) {
  server.tool(
    "list_bank_accounts",
    "Bankszámlák listázása",
    {},
    { title: "List Bank Accounts", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async () => {
      const result = await client.get("/bank-accounts");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_bank_account",
    "Bankszámla adatainak lekérése ID alapján",
    {
      bank_account_id: z.number().describe("A bankszámla ID-ja"),
    },
    { title: "Get Bank Account", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ bank_account_id }: { bank_account_id: number }) => {
      const result = await client.get(`/bank-accounts/${bank_account_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_bank_account",
    "Új bankszámla hozzáadása",
    {
      name: z.string().describe("Bankszámla neve"),
      account_number: z.string().describe("Számlaszám"),
      account_number_iban: z.string().optional().describe("IBAN szám"),
      swift: z.string().optional().describe("SWIFT/BIC kód"),
      currency: z.string().default("HUF").describe("Pénznem"),
    },
    { title: "Create Bank Account", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/bank-accounts", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_bank_account",
    "Bankszámla adatainak módosítása",
    {
      bank_account_id: z.number().describe("A bankszámla ID-ja"),
      name: z.string().optional().describe("Bankszámla neve"),
      account_number: z.string().optional().describe("Számlaszám"),
      account_number_iban: z.string().optional().describe("IBAN szám"),
      swift: z.string().optional().describe("SWIFT/BIC kód"),
      currency: z.string().optional().describe("Pénznem"),
    },
    { title: "Update Bank Account", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (params: { bank_account_id: number; [key: string]: unknown }) => {
      const { bank_account_id, ...body } = params;
      const result = await client.put(`/bank-accounts/${bank_account_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_bank_account",
    "Bankszámla törlése",
    {
      bank_account_id: z.number().describe("A bankszámla ID-ja"),
    },
    { title: "Delete Bank Account", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ bank_account_id }: { bank_account_id: number }) => {
      await client.delete(`/bank-accounts/${bank_account_id}`);
      return { content: [{ type: "text" as const, text: `Bankszámla ${bank_account_id} sikeresen törölve.` }] };
    },
  );
}
