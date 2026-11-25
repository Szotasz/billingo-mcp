import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import type { BillingoClient } from "../billingo-client.js";
import { ConfirmationStore, confirmationIdSchema, withConfirmation } from "../confirm.js";
import { namedLine } from "../summaries.js";

export function registerProductTools(
  server: McpServer,
  client: BillingoClient,
  store: ConfirmationStore = new ConfirmationStore(),
) {
  server.registerTool(
    "list_products",
    {
      description: "Termékek/szolgáltatások listázása",
      inputSchema: z.object({
        page: z.number().default(1).describe("Oldalszám"),
        per_page: z.number().default(25).describe("Elemek száma oldalanként"),
        query: z.string().optional().describe("Keresés termék név alapján"),
      }),
      annotations: { title: "List Products", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/products", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "get_product",
    {
      description: "Termék adatainak lekérése ID alapján",
      inputSchema: z.object({
        product_id: z.number().describe("A termék ID-ja"),
      }),
      annotations: { title: "Get Product", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ product_id }: { product_id: number }) => {
      const result = await client.get(`/products/${product_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "create_product",
    {
      description: "Új termék/szolgáltatás létrehozása",
      inputSchema: z.object({
        name: z.string().describe("Termék neve"),
        comment: z.string().optional().describe("Megjegyzés"),
        currency: z.string().default("HUF").describe("Pénznem"),
        vat: z.string().default("27%").describe("ÁFA kulcs (pl. '27%', '18%', '5%', 'AM', 'EU', 'AAM', stb.)"),
        unit_price: z.number().describe("Egységár"),
        unit_price_type: z.enum(["gross", "net"]).default("net").describe("Ár típusa (nettó vagy bruttó)"),
        unit: z.string().default("db").describe("Mennyiségi egység"),
        general_ledger_number: z.string().optional().describe("Főkönyvi szám"),
        general_ledger_taxcode: z.string().optional().describe("Főkönyvi adókód"),
        entitlement: z.string().optional().describe("Jogcím"),
      }),
      annotations: { title: "Create Product", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/products", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "update_product",
    {
      description: "Termék adatainak módosítása",
      inputSchema: z.object({
        product_id: z.number().describe("A termék ID-ja"),
        name: z.string().optional().describe("Termék neve"),
        comment: z.string().optional().describe("Megjegyzés"),
        currency: z.string().optional().describe("Pénznem"),
        vat: z.string().optional().describe("ÁFA kulcs"),
        unit_price: z.number().optional().describe("Egységár"),
        unit_price_type: z.enum(["gross", "net"]).optional().describe("Ár típusa"),
        unit: z.string().optional().describe("Mennyiségi egység"),
        general_ledger_number: z.string().optional().describe("Főkönyvi szám"),
        general_ledger_taxcode: z.string().optional().describe("Főkönyvi adókód"),
        entitlement: z.string().optional().describe("Jogcím"),
      }),
      annotations: { title: "Update Product", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: { product_id: number; [key: string]: unknown }) => {
      const { product_id, ...body } = params;
      const result = await client.put(`/products/${product_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "delete_product",
    {
      description: "Termék törlése",
      inputSchema: z.object({
        product_id: z.number().describe("A termék ID-ja"),
        confirmation_id: confirmationIdSchema,
      }),
      annotations: { title: "Delete Product", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withConfirmation<{ product_id: number }>({
      server,
      store,
      tool: "delete_product",
      describe: async ({ product_id }) => `Termék törlése, visszavonhatatlan:\n${await namedLine(client, "Termék", `/products/${product_id}`, product_id)}`,
      run: async ({ product_id }) => {
        await client.delete(`/products/${product_id}`);
        return { content: [{ type: "text" as const, text: `Termék ${product_id} sikeresen törölve.` }] };
      },
    }),
  );
}
