import { test, after } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { BillingoClient } from "../src/billingo-client.js";
import { ConfirmationStore, CONFIRMATION_TTL_MS } from "../src/confirm.js";
import { totals, vatRate } from "../src/summaries.js";
import { registerDocumentTools } from "../src/tools/documents.js";
import { registerPartnerTools } from "../src/tools/partners.js";
import { registerProductTools } from "../src/tools/products.js";
import { registerSpendingTools } from "../src/tools/spending.js";
import { registerBankAccountTools } from "../src/tools/bank-accounts.js";

// The confirmation step in front of the irreversible and outward-facing tools. Everything runs on a fake Billingo
// layer (the client's injected fetch); the real API is never reached. The test data is made up.

// Nothing in this file may use the real network: the global fetch is replaced, and every call to it is recorded.
const realFetchCalls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown) => {
  realFetchCalls.push(String(input));
  throw new Error("the real network is not used in tests");
}) as typeof fetch;
after(() => {
  globalThis.fetch = originalFetch;
  assert.deepEqual(realFetchCalls, [], "no test reached the real network");
});

const PARTNER = { id: 501, name: "Példa Kft.", emails: ["szamla@pelda.example"] };
const DOC = { id: 9001, invoice_number: "TEST-2026-1", type: "invoice", partner: { id: 501, name: "Példa Kft." }, gross_total: 25400, currency: "HUF" };

interface Call { method: string; path: string; body?: unknown }

/** A fake Billingo: canned GETs, every write recorded and answered with {ok:true}. Only api.billingo.hu. */
function fakeBillingo(over: { doc?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host !== "api.billingo.hu") throw new Error(`unexpected host ${url.host}`);
    const path = url.pathname.replace(/^\/v3/, "");
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    let body: unknown = { ok: true };
    if (method === "GET" && /^\/partners\/\d+$/.test(path)) body = PARTNER;
    else if (method === "GET" && /^\/documents\/\d+$/.test(path)) body = over.doc ?? DOC;
    else if (method === "GET" && /^\/(products|spending|bank-accounts)\/\d+$/.test(path)) body = { name: "Teszt tétel" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { client: new BillingoClient("test-key", fetchImpl), calls, writes: () => calls.filter((c) => c.method !== "GET") };
}

type Elicit = (msg: string) => { action: "accept" | "decline" | "cancel"; content?: Record<string, unknown> } | Error;

async function connect(opts: { elicit?: Elicit; now?: () => number; doc?: Record<string, unknown> } = {}) {
  const billingo = fakeBillingo({ doc: opts.doc });
  const server = new McpServer({ name: "billingo-test", version: "0.0.0" });
  const store = new ConfirmationStore(opts.now);
  registerDocumentTools(server, billingo.client, store);
  registerPartnerTools(server, billingo.client, store);
  registerProductTools(server, billingo.client, store);
  registerSpendingTools(server, billingo.client, store);
  registerBankAccountTools(server, billingo.client, store);
  const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: opts.elicit ? { elicitation: {} } : {} });
  const asked: string[] = [];
  if (opts.elicit) {
    const elicit = opts.elicit;
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      const message = (req.params as { message: string }).message;
      asked.push(message);
      const r = elicit(message);
      if (r instanceof Error) throw r;
      return r;
    });
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { text: (r.content as Array<{ text: string }>).map((c) => c.text).join("\n"), isError: r.isError === true };
  };
  return { ...billingo, call, asked };
}

const INVOICE = {
  partner_id: 501, block_id: 7, type: "invoice", fulfillment_date: "2026-11-25", due_date: "2026-12-03",
  payment_method: "wire_transfer", items: [{ name: "Tanácsadás", unit_price: 10000, quantity: 2, vat: "27%" }],
};
const accept: Elicit = () => ({ action: "accept", content: { confirm: true } });

test("the totals and the VAT codes: net price, gross price, special codes carry no VAT", () => {
  assert.deepEqual(totals([{ unit_price: 10000, quantity: 2, vat: "27%" }]), { net: 20000, vat: 5400, gross: 25400 });
  assert.deepEqual(totals([{ unit_price: 12700, unit_price_type: "gross", quantity: 1, vat: "27%" }]), { net: 10000, vat: 2700, gross: 12700 });
  assert.equal(vatRate("5%"), 0.05);
  assert.equal(vatRate("AAM"), 0);
  assert.equal(vatRate(undefined), 0.27);
});

test("with elicitation: the user sees the summary and an accept issues the invoice, once", async () => {
  const s = await connect({ elicit: accept });
  const r = await s.call("create_document", INVOICE);
  assert.equal(r.isError, false);
  assert.equal(s.asked.length, 1);
  for (const want of ["Példa Kft.", "partner #501", "wire_transfer", "Tanácsadás", "nettó 20000", "áfa 5400", "bruttó 25400", "invoice"]) {
    assert.ok(s.asked[0].includes(want), `summary names ${want}`);
  }
  const posts = s.writes();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, "/documents");
});

for (const [label, answer] of [
  ["a decline", { action: "decline" }],
  ["a cancel", { action: "cancel" }],
  ["an accept without the box checked", { action: "accept", content: { confirm: false } }],
] as const) {
  test(`with elicitation: ${label} issues nothing`, async () => {
    const s = await connect({ elicit: () => answer as never });
    const r = await s.call("create_document", INVOICE);
    assert.match(r.text, /Nem történt semmi/);
    assert.deepEqual(s.writes(), []);
  });
}

test("with elicitation: a failed elicitation request issues nothing (fail closed)", async () => {
  const s = await connect({ elicit: () => new Error("client gave up") });
  const r = await s.call("cancel_document", { document_id: 9001 });
  assert.equal(r.isError, true);
  assert.deepEqual(s.writes(), []);
});

test("a draft needs no confirmation; a read-only tool neither", async () => {
  const s = await connect({ elicit: () => { throw new Error("must not be asked"); } });
  await s.call("create_document", { ...INVOICE, type: "draft" });
  await s.call("list_documents", {});
  assert.equal(s.asked.length, 0);
  assert.equal(s.writes().length, 1);
});

test("without elicitation: the first call only returns the summary and an id; the second call with it runs, once", async () => {
  const s = await connect();
  const first = await s.call("create_document", INVOICE);
  assert.deepEqual(s.writes(), [], "nothing issued on the first call");
  assert.match(first.text, /NEM történt meg/);
  assert.ok(first.text.includes("bruttó 25400"));
  const id = /confirmation_id: "([A-Za-z0-9_-]+)"/.exec(first.text)?.[1];
  assert.ok(id, "an id is handed out");
  const second = await s.call("create_document", { ...INVOICE, confirmation_id: id });
  assert.equal(second.isError, false);
  assert.equal(s.writes().length, 1);
  assert.equal((s.writes()[0].body as Record<string, unknown>).confirmation_id, undefined, "the confirmation id is not sent to Billingo");
  const third = await s.call("create_document", { ...INVOICE, confirmation_id: id });
  assert.equal(third.isError, true, "the id is single-use");
  assert.equal(s.writes().length, 1);
});

test("without elicitation: an id is bound to its tool and arguments, and it expires", async () => {
  let t = 1_000_000;
  const s = await connect({ now: () => t });
  const idOf = async (name: string, args: Record<string, unknown>) => /confirmation_id: "([A-Za-z0-9_-]+)"/.exec((await s.call(name, args)).text)![1];
  const id1 = await idOf("create_document", INVOICE);
  const changed = await s.call("create_document", { ...INVOICE, items: [{ ...INVOICE.items[0], quantity: 20 }], confirmation_id: id1 });
  assert.equal(changed.isError, true, "other arguments");
  const id2 = await idOf("cancel_document", { document_id: 9001 });
  const otherTool = await s.call("send_document", { document_id: 9001, confirmation_id: id2 });
  assert.equal(otherTool.isError, true, "another tool");
  const id3 = await idOf("cancel_document", { document_id: 9001 });
  t += CONFIRMATION_TTL_MS + 1;
  const expired = await s.call("cancel_document", { document_id: 9001, confirmation_id: id3 });
  assert.equal(expired.isError, true, "expired");
  const made = await s.call("cancel_document", { document_id: 9001, confirmation_id: "made-up-id" });
  assert.equal(made.isError, true, "an id nobody issued");
  assert.deepEqual(s.writes(), []);
});

test("send_document: without addresses the summary names the partner's ACTUAL address, read from Billingo", async () => {
  const s = await connect({ elicit: () => ({ action: "decline" }) });
  await s.call("send_document", { document_id: 9001 });
  assert.ok(s.asked[0].includes("szamla@pelda.example"), "the partner's address is shown");
  assert.deepEqual(s.writes(), []);
  const explicit = await connect({ elicit: () => ({ action: "decline" }) });
  await explicit.call("send_document", { document_id: 9001, emails: ["konyveles@example.com"] });
  assert.ok(explicit.asked[0].includes("konyveles@example.com"));
  assert.ok(!explicit.asked[0].includes("szamla@pelda.example"), "explicit addresses replace the partner's");
});

test("send_document: when the document's address and the partner's current one differ, both are shown", async () => {
  const doc = { ...DOC, partner: { id: 501, name: "Példa Kft.", emails: ["regi@pelda.example"] } };
  const s = await connect({ elicit: () => ({ action: "decline" }), doc });
  await s.call("send_document", { document_id: 9001 });
  assert.ok(s.asked[0].includes("ELTÉRÉS"), "the difference is named");
  assert.ok(s.asked[0].includes("regi@pelda.example") && s.asked[0].includes("szamla@pelda.example"), "both addresses are shown");
  const same = await connect({ elicit: () => ({ action: "decline" }), doc: { ...DOC, partner: { id: 501, name: "Példa Kft.", emails: ["szamla@pelda.example"] } } });
  await same.call("send_document", { document_id: 9001 });
  assert.ok(!same.asked[0].includes("ELTÉRÉS"), "no difference, no warning");
  assert.deepEqual(s.writes(), []);
});

const GUARDED: Array<[string, Record<string, unknown>]> = [
  ["create_document", INVOICE],
  ["cancel_document", { document_id: 9001 }],
  ["delete_draft", { document_id: 9001 }],
  ["create_from_proforma", { document_id: 9001 }],
  ["create_from_draft", { document_id: 9001 }],
  ["create_modification_document", { document_id: 9001, items: INVOICE.items, fulfillment_date: "2026-11-25", due_date: "2026-12-03", payment_method: "wire_transfer" }],
  ["send_document", { document_id: 9001, emails: ["konyveles@example.com"] }],
  ["copy_document", { document_id: 9001 }],
  ["update_payment", { document_id: 9001, date: "2026-11-25", price: 25400, payment_method: "wire_transfer" }],
  ["delete_payment", { document_id: 9001 }],
  ["delete_partner", { partner_id: 501 }],
  ["delete_product", { product_id: 12 }],
  ["delete_spending", { spending_id: 13 }],
  ["delete_bank_account", { bank_account_id: 14 }],
];

for (const [name, args] of GUARDED) {
  test(`${name}: nothing is written before a confirmation, with or without elicitation`, async () => {
    const plain = await connect();
    const r = await plain.call(name, args);
    assert.deepEqual(plain.writes(), [], `${name} wrote without a confirmation`);
    assert.match(r.text, /confirmation_id: "/);
    const declined = await connect({ elicit: () => ({ action: "decline" }) });
    await declined.call(name, args);
    assert.equal(declined.asked.length, 1, `${name} asked the user`);
    assert.deepEqual(declined.writes(), [], `${name} wrote after a decline`);
    const accepted = await connect({ elicit: accept });
    await accepted.call(name, args);
    assert.equal(accepted.writes().length, 1, `${name} runs after an accept`);
  });
}
