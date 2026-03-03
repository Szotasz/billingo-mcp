import { z } from "zod";
import type { BillingoClient } from "../billingo-client.js";

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
      await fs.writeFile(output_path, data);
      return { content: [{ type: "text" as const, text: `Export letöltve: ${output_path} (${data.length} bytes)` }] };
    },
  );
}
