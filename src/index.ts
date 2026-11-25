import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { BillingoClient } from "./billingo-client.js";
import { ConfirmationStore } from "./confirm.js";
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
  // One store for the two-step confirmations of this server (clients without elicitation).
  const confirmations = new ConfirmationStore();

  registerDocumentTools(server, client, confirmations);
  registerPartnerTools(server, client, confirmations);
  registerProductTools(server, client, confirmations);
  registerBankAccountTools(server, client, confirmations);
  registerSpendingTools(server, client, confirmations);
  registerDocumentExportTools(server, client);
  registerOrganizationTools(server, client);
  registerUtilTools(server, client);

  server.registerPrompt(
    "list-invoices",
    {
      description: "List recent invoices with optional filters",
      argsSchema: z.object({
        type: z.enum(["invoice", "proforma", "draft"]).optional().describe("Document type filter"),
        status: z.enum(["paid", "outstanding", "expired"]).optional().describe("Payment status filter"),
      }),
    },
    ({ type, status }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `List my recent ${type || ""} invoices${status ? ` with status ${status}` : ""} using list_documents. Show them in a table with document number, date, partner name, amount, and payment status.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "check-tax-number",
    {
      description: "Verify a Hungarian tax number via NAV",
      argsSchema: z.object({
        taxNumber: z.string().describe("8-digit Hungarian tax number"),
      }),
    },
    ({ taxNumber }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Check the tax number ${taxNumber} using check_tax_number. Show the company name and validity status.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "exchange-rates",
    {
      description: "Get current MNB exchange rates",
      argsSchema: z.object({
        from: z.string().default("EUR").describe("Source currency code"),
        to: z.string().default("HUF").describe("Target currency code"),
      }),
    },
    ({ from, to }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Get the current exchange rate from ${from} to ${to} using get_currency_rates.`,
        },
      }],
    }),
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
