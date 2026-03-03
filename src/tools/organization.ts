import { z } from "zod";
import type { BillingoClient } from "../billingo-client.js";

export function registerOrganizationTools(
  server: { tool: Function },
  client: BillingoClient,
) {
  server.tool(
    "get_organization",
    "Szervezet (saját cég) adatainak lekérése a Billingo-ból",
    {},
    async () => {
      const result = await client.get("/organization");
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
