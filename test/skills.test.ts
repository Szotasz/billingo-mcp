import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { SkillsClient } from "@modelcontextprotocol/client/ext/skills";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import { BillingoClient } from "../src/billingo-client.js";
import { registerPrompts } from "../src/prompts.js";
import { registerSkills, SKILLS_DIR } from "../src/skills.js";
import { registerDocumentTools } from "../src/tools/documents.js";
import { registerPartnerTools } from "../src/tools/partners.js";
import { registerProductTools } from "../src/tools/products.js";
import { registerBankAccountTools } from "../src/tools/bank-accounts.js";
import { registerSpendingTools } from "../src/tools/spending.js";
import { registerDocumentExportTools } from "../src/tools/document-export.js";
import { registerOrganizationTools } from "../src/tools/organization.js";
import { registerUtilTools } from "../src/tools/utils.js";

// The billing guides in skills/: served as MCP skills and as skill-<name> prompts. Nothing here calls the Billingo
// API: the client's fetch throws, and only listing and reading run.

const SKILLS = ["add-partner-with-tax-number", "choose-payment-method", "handle-nav-rejection", "issue-invoice"];

async function connect() {
  const noNetwork = (async () => { throw new Error("no Billingo call in tests"); }) as typeof fetch;
  const billingo = new BillingoClient("test-key", noNetwork);
  const server = new McpServer({ name: "billingo-test", version: "0.0.0" });
  for (const register of [registerDocumentTools, registerPartnerTools, registerProductTools, registerBankAccountTools,
    registerSpendingTools, registerDocumentExportTools, registerOrganizationTools, registerUtilTools]) {
    register(server, billingo);
  }
  registerPrompts(server);
  await registerSkills(server);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const files = () => SKILLS.map((name) => ({ name, text: readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf8") }));

test("the server serves the four skills, and every file verifies against its entry", async () => {
  const client = await connect();
  const skills = new SkillsClient(client);
  assert.equal(skills.supported, true);
  const { skills: entries } = await skills.list();
  assert.deepEqual(entries.map((e) => e.frontmatter.name).sort(), SKILLS);
  for (const entry of entries) {
    assert.ok(String(entry.frontmatter.description).length > 40, `${entry.frontmatter.name} has a description`);
    const file = await skills.read(entry);
    assert.equal(file.verified, true);
    assert.ok(file.body && file.body.length > 200, `${entry.frontmatter.name} has a body`);
  }
  await client.close();
});

test("each skill is also a prompt (for clients without skills), next to the existing prompts", async () => {
  const client = await connect();
  const { prompts } = await client.listPrompts();
  const names = prompts.map((p) => p.name).sort();
  assert.deepEqual(names, ["check-tax-number", "exchange-rates", "list-invoices", ...SKILLS.map((s) => `skill-${s}`)].sort());
  const r = await client.getPrompt({ name: "skill-issue-invoice" });
  const text = (r.messages[0].content as { text: string }).text;
  assert.match(text, /list_document_blocks/);
  assert.doesNotMatch(text, /^---/, "the prompt carries the body, not the frontmatter");
  await client.close();
});

test("every tool a skill names exists, and every skill a skill points to exists", async () => {
  const client = await connect();
  const tools = new Set((await client.listTools()).tools.map((t) => t.name));
  await client.close();
  for (const { name, text } of files()) {
    for (const [, word] of text.matchAll(/`([a-z][a-z_]*)`/g)) {
      if (/^(list|get|create|update|delete|cancel|send|check|download|copy)_/.test(word)) {
        assert.ok(tools.has(word), `${name} names a tool that does not exist: ${word}`);
      }
    }
    for (const [, word] of text.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)) {
      assert.ok(SKILLS.includes(word), `${name} points to a skill that does not exist: ${word}`);
    }
  }
});

test("the stdio entry (cli.ts) serves the skills and the prompts too", async () => {
  // Spawned for real over stdio; initialize, prompts/list and skills/list only, so no Billingo call is made.
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts"], {
    env: { PATH: process.env.PATH, BILLINGO_API_KEY: "test-key-not-real" },
    stdio: ["pipe", "pipe", "ignore"],
  });
  const replies = new Map<number, (v: unknown) => void>();
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d;
    for (let i; (i = buf.indexOf("\n")) >= 0;) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const msg = JSON.parse(line);
      replies.get(msg.id)?.(msg);
    }
  });
  let id = 0;
  const send = (method: string, params: unknown) => new Promise<any>((resolve) => {
    replies.set(++id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  try {
    const init = await send("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    assert.ok(init.result.capabilities.extensions?.["io.modelcontextprotocol/skills"], "the skills extension is declared");
    const prompts = await send("prompts/list", {});
    assert.equal(prompts.result.prompts.length, 3 + SKILLS.length);
    const skills = await send("skills/list", {});
    assert.deepEqual(skills.result.skills.map((s: { frontmatter: { name: string } }) => s.frontmatter.name).sort(), SKILLS);
  } finally {
    child.kill();
  }
});

// A public repository: the guides carry rules, never someone's data. These shapes catch the usual slips.
const FORBIDDEN: Array<[string, RegExp]> = [
  ["an email address", /[\w.+-]+@[\w-]+\.[\w.]+/],
  ["a URL", /https?:\/\//i],
  ["a Hungarian tax number", /\b\d{8}-\d-\d{2}\b/],
  ["an IBAN or account number", /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b|\b\d{8}-\d{8}(-\d{8})?\b/],
  ["a phone number", /\+\d{2}[\s-]?\d|\b06[\s-]?\d{2}[\s-]?\d{3}/],
  ["a long number (an id, an invoice number, an amount from a real case)", /\d{5,}/],
  ["an invoice number", /\b[A-Z]{2,}[-/ ]+\d{4}[-/ ]+\d+/],
];

test("the skills carry no personal or account data", () => {
  const found: string[] = [];
  for (const dir of readdirSync(SKILLS_DIR)) {
    for (const file of readdirSync(join(SKILLS_DIR, dir))) {
      const text = readFileSync(join(SKILLS_DIR, dir, file), "utf8");
      for (const [what, rx] of FORBIDDEN) {
        const m = rx.exec(text);
        if (m) found.push(`${dir}/${file}: ${what} (${JSON.stringify(m[0])})`);
      }
    }
  }
  assert.deepEqual(found, []);
});
