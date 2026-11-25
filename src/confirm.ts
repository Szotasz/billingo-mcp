import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// A confirmation step in front of every tool that cannot be undone or that reaches someone outside (issuing a
// non-draft document, cancelling, sending, deleting, recording a payment).
//
// - When the client supports form elicitation, the server asks the user directly (elicitation/create) with a summary
//   of what is about to happen, and runs the tool only on an explicit accept with "confirm" checked. A decline, a
//   cancel, or a failed elicitation request runs nothing.
// - When the client does not support elicitation, the tool does not run silently either (fail closed). The first call
//   returns the summary and a one-time confirmation_id; a second call with the same arguments plus that id runs it.
//   The id is single-use, bound to the tool and to the exact arguments, and expires after CONFIRMATION_TTL_MS.

export const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

export const confirmationIdSchema = z
  .string()
  .optional()
  .describe(
    "Csak megerősítő kliens nélkül: az első hívás visszaadott confirmation_id értéke. Kizárólag akkor add meg, ha a felhasználó az összefoglalót látta és kifejezetten jóváhagyta.",
  );

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

interface Pending {
  tool: string;
  argsKey: string;
  expiresAt: number;
}

/** A stable key for the arguments: sorted keys, the confirmation id left out. */
export function argsKey(args: Record<string, unknown>): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .filter((k) => k !== "confirmation_id")
          .sort()
          .map((k) => [k, norm((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(args));
}

export class ConfirmationStore {
  private pending = new Map<string, Pending>();
  constructor(private now: () => number = Date.now) {}

  issue(tool: string, args: Record<string, unknown>): string {
    this.sweep();
    const id = randomBytes(12).toString("base64url");
    this.pending.set(id, { tool, argsKey: argsKey(args), expiresAt: this.now() + CONFIRMATION_TTL_MS });
    return id;
  }

  /** Consumes the id: true only for this tool, these arguments, before expiry; the id is gone either way. */
  consume(id: string, tool: string, args: Record<string, unknown>): "ok" | "unknown" | "expired" | "mismatch" {
    const p = this.pending.get(id);
    this.pending.delete(id);
    if (!p) return "unknown";
    if (this.now() > p.expiresAt) return "expired";
    if (p.tool !== tool || p.argsKey !== argsKey(args)) return "mismatch";
    return "ok";
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, p] of this.pending) if (t > p.expiresAt) this.pending.delete(k);
  }
}

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

export interface ConfirmOptions<A extends Record<string, unknown>> {
  server: McpServer;
  store: ConfirmationStore;
  tool: string;
  /** Whether this call needs a confirmation at all (e.g. create_document only for a non-draft type). */
  needed?: (args: A) => boolean;
  /** The summary the user sees before anything happens. */
  describe: (args: A) => Promise<string> | string;
  run: (args: A) => Promise<ToolResult>;
}

/** Wraps a tool handler with the confirmation step. */
export function withConfirmation<A extends Record<string, unknown>>(o: ConfirmOptions<A>) {
  return async (args: A): Promise<ToolResult> => {
    if (o.needed && !o.needed(args)) return o.run(args);

    const id = typeof args.confirmation_id === "string" ? args.confirmation_id : undefined;
    if (id !== undefined) {
      const verdict = o.store.consume(id, o.tool, args);
      if (verdict === "ok") return o.run(args);
      const why = {
        unknown: "ismeretlen vagy már felhasznált azonosító",
        expired: "lejárt azonosító",
        mismatch: "az azonosító más eszközhöz vagy más paraméterekhez tartozik",
      }[verdict];
      return text(`Nem történt semmi: a confirmation_id nem érvényes (${why}). Kérj új összefoglalót confirmation_id nélkül.`, true);
    }

    const summary = await o.describe(args);

    if (o.server.server.getClientCapabilities()?.elicitation?.form) {
      let answer;
      try {
        answer = await o.server.server.elicitInput({
          mode: "form",
          message: summary,
          requestedSchema: {
            type: "object",
            properties: {
              confirm: { type: "boolean", title: "Végrehajtod?", description: "Pipáld be, ha a fenti műveletet el kell végezni." },
            },
            required: ["confirm"],
          },
        });
      } catch (err) {
        return text(`Nem történt semmi: a megerősítés kérése nem sikerült (${err instanceof Error ? err.message : String(err)}).`, true);
      }
      if (answer.action === "accept" && answer.content?.confirm === true) return o.run(args);
      return text(
        answer.action === "accept"
          ? "Nem történt semmi: a megerősítés nem volt bepipálva."
          : `Nem történt semmi: a felhasználó ${answer.action === "decline" ? "elutasította" : "megszakította"} a műveletet.`,
      );
    }

    const issued = o.store.issue(o.tool, args);
    const minutes = Math.round(CONFIRMATION_TTL_MS / 60000);
    return text(
      `${summary}\n\nEz a művelet még NEM történt meg. A kliens nem tud megerősítést kérni, ezért mutasd meg ezt az összefoglalót a felhasználónak, ` +
        `és csak az ő kifejezett jóváhagyása után hívd meg újra ugyanezekkel a paraméterekkel, ezzel kiegészítve: confirmation_id: "${issued}" ` +
        `(egyszer használható, ${minutes} percig érvényes).`,
    );
  };
}
