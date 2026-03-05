import { z } from "zod";
import type { BillingoClient } from "../billingo-client.js";

export function registerUtilTools(
  server: { tool: Function },
  client: BillingoClient,
) {
  server.tool(
    "check_tax_number",
    "Adószám ellenőrzése a NAV rendszerében. Visszaadja a cég nevét és címét ha érvényes.",
    {
      tax_number: z.string().regex(/^\d{8,11}(-\d-\d{2})?$/, "Érvénytelen adószám formátum").describe("Ellenőrizendő adószám (8 számjegy, pl. 12345678)"),
    },
    async ({ tax_number }: { tax_number: string }) => {
      const result = await client.get(`/utils/check-tax-number/${tax_number}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_currency_rates",
    "Aktuális MNB árfolyamok lekérése",
    {
      from: z.string().default("HUF").describe("Forrás pénznem"),
      to: z.string().describe("Cél pénznem (pl. EUR, USD)"),
      date: z.string().optional().describe("Dátum (YYYY-MM-DD), alapértelmezett: mai nap"),
    },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/currencies", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "list_document_blocks",
    "Dokumentum blokkok (számlatömbök) listázása. Számla létrehozásához szükséges a block_id.",
    {},
    async () => {
      const result = await client.get("/document-blocks");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
