import type { BillingoClient } from "./billingo-client.js";

// The text a confirmation shows before an irreversible or outward-facing tool runs. Every lookup here is a read
// (GET); a failed lookup leaves a note in the summary instead of stopping it, because the IDs themselves are shown.

export interface ItemLike {
  name?: string;
  product_id?: number;
  unit_price: number;
  unit_price_type?: "gross" | "net";
  quantity: number;
  unit?: string;
  vat?: string;
}

/** The VAT rate of a Billingo VAT code: "27%" -> 0.27; the special codes (AAM, TAM, EU, ...) carry no VAT. */
export function vatRate(vat: string | undefined): number {
  const m = /^(\d+(?:[.,]\d+)?)%$/.exec((vat ?? "27%").trim());
  return m ? Number(m[1].replace(",", ".")) / 100 : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net, VAT and gross of the items, as the API would compute them before its own rounding. */
export function totals(items: ItemLike[]): { net: number; vat: number; gross: number } {
  let net = 0;
  let gross = 0;
  for (const it of items) {
    const rate = vatRate(it.vat);
    const line = it.unit_price * it.quantity;
    if ((it.unit_price_type ?? "net") === "gross") {
      gross += line;
      net += line / (1 + rate);
    } else {
      net += line;
      gross += line * (1 + rate);
    }
  }
  return { net: round2(net), vat: round2(gross - net), gross: round2(gross) };
}

const money = (n: number, currency: string) => `${n.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} ${currency}`;

export function itemLines(items: ItemLike[], currency: string): string[] {
  return items.map((it) => {
    const what = it.name ?? (it.product_id !== undefined ? `termék #${it.product_id}` : "tétel");
    return `  - ${what}: ${it.quantity} ${it.unit ?? "db"} x ${money(it.unit_price, currency)} (${it.unit_price_type ?? "net"}), áfa ${it.vat ?? "27%"}`;
  });
}

async function name(client: BillingoClient, path: string, field = "name"): Promise<string> {
  try {
    const r = (await client.get(path)) as Record<string, unknown>;
    const v = r?.[field];
    return typeof v === "string" && v ? v : "(név nélkül)";
  } catch {
    return "(nem olvasható)";
  }
}

export async function partnerLine(client: BillingoClient, partnerId: number): Promise<string> {
  return `Vevő: ${await name(client, `/partners/${partnerId}`)} (partner #${partnerId})`;
}

/** One line about an existing document: number, type, partner, gross total. */
export async function documentLine(client: BillingoClient, documentId: number): Promise<string> {
  try {
    const d = (await client.get(`/documents/${documentId}`)) as Record<string, unknown>;
    const partner = (d.partner as Record<string, unknown> | undefined)?.name;
    const parts = [
      `bizonylat #${documentId}`,
      typeof d.invoice_number === "string" ? `sorszám ${d.invoice_number}` : null,
      typeof d.type === "string" ? `típus ${d.type}` : null,
      typeof partner === "string" ? `vevő ${partner}` : null,
      typeof d.gross_total === "number" ? `bruttó ${money(d.gross_total, typeof d.currency === "string" ? d.currency : "")}` : null,
    ].filter(Boolean);
    return parts.join(", ");
  } catch {
    return `bizonylat #${documentId} (a részletei nem olvashatók)`;
  }
}

export async function namedLine(client: BillingoClient, label: string, path: string, id: number, field = "name"): Promise<string> {
  return `${label}: ${await name(client, path, field)} (#${id})`;
}
