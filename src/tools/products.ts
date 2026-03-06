import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";

export function registerProductTools(
  server: McpServer,
  client: BillingoClient,
) {
  server.tool(
    "list_products",
    "Termékek/szolgáltatások listázása",
    {
      page: z.number().default(1).describe("Oldalszám"),
      per_page: z.number().default(25).describe("Elemek száma oldalanként"),
      query: z.string().optional().describe("Keresés termék név alapján"),
    },
    { title: "List Products", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/products", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_product",
    "Termék adatainak lekérése ID alapján",
    {
      product_id: z.number().describe("A termék ID-ja"),
    },
    { title: "Get Product", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ product_id }: { product_id: number }) => {
      const result = await client.get(`/products/${product_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_product",
    "Új termék/szolgáltatás létrehozása",
    {
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
    },
    { title: "Create Product", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/products", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_product",
    "Termék adatainak módosítása",
    {
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
    },
    { title: "Update Product", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (params: { product_id: number; [key: string]: unknown }) => {
      const { product_id, ...body } = params;
      const result = await client.put(`/products/${product_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_product",
    "Termék törlése",
    {
      product_id: z.number().describe("A termék ID-ja"),
    },
    { title: "Delete Product", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ product_id }: { product_id: number }) => {
      await client.delete(`/products/${product_id}`);
      return { content: [{ type: "text" as const, text: `Termék ${product_id} sikeresen törölve.` }] };
    },
  );
}
