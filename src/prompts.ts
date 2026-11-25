import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

/** The server's prompts, shared by the stdio entry (cli.ts) and the createServer export (index.ts). */
export function registerPrompts(server: McpServer) {
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
}
