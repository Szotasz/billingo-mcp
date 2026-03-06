import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillingoClient } from "./billingo-client.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerPartnerTools } from "./tools/partners.js";
import { registerProductTools } from "./tools/products.js";
import { registerBankAccountTools } from "./tools/bank-accounts.js";
import { registerSpendingTools } from "./tools/spending.js";
import { registerDocumentExportTools } from "./tools/document-export.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerUtilTools } from "./tools/utils.js";

export const configSchema = z.object({
  BILLINGO_API_KEY: z.string().describe("Billingo API v3 key (get it from app.billingo.hu/api-key)"),
});

type SmitheryConfig = z.infer<typeof configSchema>;

function getApiKey(config?: Partial<SmitheryConfig>): string {
  const key = config?.BILLINGO_API_KEY || process.env.BILLINGO_API_KEY;
  if (!key) throw new Error("Missing required config: BILLINGO_API_KEY");
  return key;
}

export default function createServer({ config }: { config: Partial<SmitheryConfig> }) {
  const server = new McpServer({
    name: "billingo",
    version: "1.0.0",
    description: "MCP server for the Billingo invoicing API v3. Create, manage, and download invoices, manage partners, products, expenses, and more.",
    websiteUrl: "https://github.com/Szotasz/billingo-mcp",
  });

  const client = new BillingoClient(getApiKey(config));

  registerDocumentTools(server, client);
  registerPartnerTools(server, client);
  registerProductTools(server, client);
  registerBankAccountTools(server, client);
  registerSpendingTools(server, client);
  registerDocumentExportTools(server, client);
  registerOrganizationTools(server, client);
  registerUtilTools(server, client);

  server.prompt(
    "list-invoices",
    "List recent invoices with optional filters",
    {
      type: z.enum(["invoice", "proforma", "draft"]).optional().describe("Document type filter"),
      status: z.enum(["paid", "outstanding", "expired"]).optional().describe("Payment status filter"),
    },
    ({ type, status }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `List my recent ${type || ""} invoices${status ? ` with status ${status}` : ""} using list_documents. Show them in a table with document number, date, partner name, amount, and payment status.`,
        },
      }],
    })
  );

  server.prompt(
    "check-tax-number",
    "Verify a Hungarian tax number via NAV",
    {
      taxNumber: z.string().describe("8-digit Hungarian tax number"),
    },
    ({ taxNumber }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Check the tax number ${taxNumber} using check_tax_number. Show the company name and validity status.`,
        },
      }],
    })
  );

  server.prompt(
    "exchange-rates",
    "Get current MNB exchange rates",
    {
      from: z.string().default("EUR").describe("Source currency code"),
      to: z.string().default("HUF").describe("Target currency code"),
    },
    ({ from, to }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Get the current exchange rate from ${from} to ${to} using get_currency_rates.`,
        },
      }],
    })
  );

  return server.server;
}

export function createSandboxServer() {
  return createServer({
    config: {
      BILLINGO_API_KEY: "sandbox",
    },
  });
}
