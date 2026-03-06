import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BillingoClient } from "../billingo-client.js";

export function registerOrganizationTools(
  server: McpServer,
  client: BillingoClient,
) {
  server.tool(
    "get_organization",
    "Szervezet (saját cég) adatainak lekérése a Billingo-ból",
    {},
    { title: "Get Organization", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async () => {
      const result = await client.get("/organization");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
