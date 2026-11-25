import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import type { BillingoClient } from "../billingo-client.js";

export function registerOrganizationTools(
  server: McpServer,
  client: BillingoClient,
) {
  server.registerTool(
    "get_organization",
    {
      description: "Szervezet (saját cég) adatainak lekérése a Billingo-ból",
      inputSchema: z.object({}),
      annotations: { title: "Get Organization", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async () => {
      const result = await client.get("/organization");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
