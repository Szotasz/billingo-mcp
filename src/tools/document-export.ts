import { z } from "zod";
import { resolve, dirname } from "node:path";
import { access, constants } from "node:fs/promises";
import type { BillingoClient } from "../billingo-client.js";

async function validateOutputPath(outputPath: string): Promise<string> {
  const resolved = resolve(outputPath);
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  if (!resolved.startsWith(home + "/") && !resolved.startsWith("/tmp/")) {
    throw new Error(`Output path must be within home directory (${home}) or /tmp`);
  }
  try {
    await access(dirname(resolved), constants.W_OK);
  } catch {
    throw new Error(`Parent directory does not exist or is not writable: ${dirname(resolved)}`);
  }
  return resolved;
}

export function registerDocumentExportTools(
  server: { tool: Function },
  client: BillingoClient,
) {
  server.tool(
    "create_document_export",
    "Dokumentum export indítása (számlák exportálása CSV/Excel formátumban). Visszaadja az export ID-t, amit a download_document_export tool-lal lehet letölteni.",
    {
      start_date: z.string().describe("Kezdő dátum (YYYY-MM-DD)"),
      end_date: z.string().describe("Vég dátum (YYYY-MM-DD)"),
      document_type: z.enum(["invoice", "proforma", "receipt", "draft", "advance", "waybill", "offer"]).optional().describe("Dokumentum típus szűrő"),
    },
    async (params: Record<string, unknown>) => {
      const result = await client.post("/document-export", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "download_document_export",
    "Exportált dokumentum letöltése. Az export ID-t a create_document_export adja vissza. Pollozza a státuszt, amíg kész nem lesz, majd letölti a fájlt.",
    {
      export_id: z.number().describe("Az export ID-ja (create_document_export-ból)"),
      output_path: z.string().describe("Fájl mentési útvonal (pl. /tmp/export.xlsx)"),
    },
    async ({ export_id, output_path }: { export_id: number; output_path: string }) => {
      const safePath = await validateOutputPath(output_path);
      // Poll until ready (max 60 attempts, 2s apart)
      for (let i = 0; i < 60; i++) {
        const status = (await client.get(`/document-export/${export_id}/poll`)) as { status?: string };
        if (status?.status === "completed") {
          break;
        }
        if (status?.status === "failed") {
          return { content: [{ type: "text" as const, text: `Export ${export_id} sikertelen.` }] };
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      const { data } = await client.requestBinary(
        "GET",
        `/document-export/${export_id}/download`,
        "application/octet-stream",
      );
      const fs = await import("node:fs/promises");
      await fs.writeFile(safePath, data);
      return { content: [{ type: "text" as const, text: `Export letöltve: ${safePath} (${data.length} bytes)` }] };
    },
  );
}
