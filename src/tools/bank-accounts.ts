import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import type { BillingoClient } from "../billingo-client.js";
import { ConfirmationStore, confirmationIdSchema, withConfirmation } from "../confirm.js";
import { namedLine } from "../summaries.js";

export function registerBankAccountTools(
  server: McpServer,
  client: BillingoClient,
  store: ConfirmationStore = new ConfirmationStore(),
) {
  server.registerTool(
    "list_bank_accounts",
    {
      description: "Bankszámlák listázása",
      inputSchema: z.object({}),
      annotations: { title: "List Bank Accounts", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async () => {
      const result = await client.get("/bank-accounts");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "get_bank_account",
    {
      description: "Bankszámla adatainak lekérése ID alapján",
      inputSchema: z.object({
        bank_account_id: z.number().describe("A bankszámla ID-ja"),
      }),
      annotations: { title: "Get Bank Account", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ bank_account_id }: { bank_account_id: number }) => {
      const result = await client.get(`/bank-accounts/${bank_account_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "create_bank_account",
    {
      description: "Új bankszámla hozzáadása",
      inputSchema: z.object({
        name: z.string().describe("Bankszámla neve"),
        account_number: z.string().describe("Számlaszám"),
        account_number_iban: z.string().optional().describe("IBAN szám"),
        swift: z.string().optional().describe("SWIFT/BIC kód"),
        currency: z.string().default("HUF").describe("Pénznem"),
      }),
      annotations: { title: "Create Bank Account", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/bank-accounts", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "update_bank_account",
    {
      description: "Bankszámla adatainak módosítása",
      inputSchema: z.object({
        bank_account_id: z.number().describe("A bankszámla ID-ja"),
        name: z.string().optional().describe("Bankszámla neve"),
        account_number: z.string().optional().describe("Számlaszám"),
        account_number_iban: z.string().optional().describe("IBAN szám"),
        swift: z.string().optional().describe("SWIFT/BIC kód"),
        currency: z.string().optional().describe("Pénznem"),
      }),
      annotations: { title: "Update Bank Account", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: { bank_account_id: number; [key: string]: unknown }) => {
      const { bank_account_id, ...body } = params;
      const result = await client.put(`/bank-accounts/${bank_account_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "delete_bank_account",
    {
      description: "Bankszámla törlése",
      inputSchema: z.object({
        bank_account_id: z.number().describe("A bankszámla ID-ja"),
        confirmation_id: confirmationIdSchema,
      }),
      annotations: { title: "Delete Bank Account", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withConfirmation<{ bank_account_id: number }>({
      server,
      store,
      tool: "delete_bank_account",
      describe: async ({ bank_account_id }) => `Bankszámla törlése, visszavonhatatlan:\n${await namedLine(client, "Bankszámla", `/bank-accounts/${bank_account_id}`, bank_account_id)}`,
      run: async ({ bank_account_id }) => {
        await client.delete(`/bank-accounts/${bank_account_id}`);
        return { content: [{ type: "text" as const, text: `Bankszámla ${bank_account_id} sikeresen törölve.` }] };
      },
    }),
  );
}
