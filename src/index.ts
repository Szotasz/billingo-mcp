#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BillingoClient } from "./billingo-client.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerPartnerTools } from "./tools/partners.js";
import { registerProductTools } from "./tools/products.js";
import { registerBankAccountTools } from "./tools/bank-accounts.js";
import { registerSpendingTools } from "./tools/spending.js";
import { registerDocumentExportTools } from "./tools/document-export.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerUtilTools } from "./tools/utils.js";

const apiKey = process.env.BILLINGO_API_KEY;
if (!apiKey) {
  console.error("BILLINGO_API_KEY environment variable is required");
  process.exit(1);
}

const client = new BillingoClient(apiKey);

const server = new McpServer({
  name: "billingo",
  version: "1.0.0",
});

registerDocumentTools(server, client);
registerPartnerTools(server, client);
registerProductTools(server, client);
registerBankAccountTools(server, client);
registerSpendingTools(server, client);
registerDocumentExportTools(server, client);
registerOrganizationTools(server, client);
registerUtilTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
