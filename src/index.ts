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
import { registerPrompts } from "./prompts.js";

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

  registerPrompts(server);

  return server.server;
}

export function createSandboxServer() {
  return createServer({
    config: {
      BILLINGO_API_KEY: "sandbox",
    },
  });
}
