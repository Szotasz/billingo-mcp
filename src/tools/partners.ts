import { z } from "zod";
import type { BillingoClient } from "../billingo-client.js";

const AddressSchema = z.object({
  country_code: z.string().default("HU").describe("Országkód (ISO 3166-1 alpha-2)"),
  post_code: z.string().describe("Irányítószám"),
  city: z.string().describe("Város"),
  address: z.string().describe("Utca, házszám"),
});

export function registerPartnerTools(
  server: { tool: Function },
  client: BillingoClient,
) {
  server.tool(
    "list_partners",
    "Partnerek listázása szűrőkkel",
    {
      page: z.number().default(1).describe("Oldalszám"),
      per_page: z.number().default(25).describe("Elemek száma oldalanként"),
      query: z.string().optional().describe("Keresés név, adószám vagy e-mail alapján"),
    },
    async (params: Record<string, unknown>) => {
      const result = await client.get("/partners", params as Record<string, string | number | boolean | undefined>);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_partner",
    "Partner adatainak lekérése ID alapján",
    {
      partner_id: z.number().describe("A partner ID-ja"),
    },
    async ({ partner_id }: { partner_id: number }) => {
      const result = await client.get(`/partners/${partner_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "create_partner",
    "Új partner (ügyfél/szállító) létrehozása",
    {
      name: z.string().describe("Partner neve"),
      address: AddressSchema.describe("Partner címe"),
      emails: z.array(z.string()).optional().describe("E-mail címek"),
      taxcode: z.string().optional().describe("Adószám"),
      iban: z.string().optional().describe("IBAN bankszámlaszám"),
      swift: z.string().optional().describe("SWIFT/BIC kód"),
      account_number: z.string().optional().describe("Bankszámlaszám"),
      phone: z.string().optional().describe("Telefonszám"),
      general_ledger_number: z.string().optional().describe("Főkönyvi szám"),
      tax_type: z.enum(["NO_TAX_NUMBER", "HAS_TAX_NUMBER", "TAXPAYER"]).optional().describe("Adó típus"),
      custom_billing_settings: z.object({
        payment_method: z.string().optional(),
        document_form: z.string().optional(),
        due_days: z.number().optional(),
        document_currency: z.string().optional(),
        template_language_code: z.string().optional(),
        discount: z.object({
          type: z.enum(["percent", "amount"]).optional(),
          value: z.number().optional(),
        }).optional(),
      }).optional().describe("Egyéni számlázási beállítások"),
      group_member_tax_number: z.string().optional().describe("Csoportos adószám"),
    },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/partners", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_partner",
    "Partner adatainak módosítása",
    {
      partner_id: z.number().describe("A partner ID-ja"),
      name: z.string().optional().describe("Partner neve"),
      address: AddressSchema.optional().describe("Partner címe"),
      emails: z.array(z.string()).optional().describe("E-mail címek"),
      taxcode: z.string().optional().describe("Adószám"),
      iban: z.string().optional().describe("IBAN bankszámlaszám"),
      swift: z.string().optional().describe("SWIFT/BIC kód"),
      account_number: z.string().optional().describe("Bankszámlaszám"),
      phone: z.string().optional().describe("Telefonszám"),
      general_ledger_number: z.string().optional().describe("Főkönyvi szám"),
      tax_type: z.enum(["NO_TAX_NUMBER", "HAS_TAX_NUMBER", "TAXPAYER"]).optional().describe("Adó típus"),
    },
    async (params: { partner_id: number; [key: string]: unknown }) => {
      const { partner_id, ...body } = params;
      const result = await client.put(`/partners/${partner_id}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_partner",
    "Partner törlése",
    {
      partner_id: z.number().describe("A partner ID-ja"),
    },
    async ({ partner_id }: { partner_id: number }) => {
      await client.delete(`/partners/${partner_id}`);
      return { content: [{ type: "text" as const, text: `Partner ${partner_id} sikeresen törölve.` }] };
    },
  );
}
