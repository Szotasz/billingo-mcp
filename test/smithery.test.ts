import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import startCommand from "../smithery.js";

// Smithery starts the server with this command. It must be the stdio entry (package.json bin), the file that starts
// a server; dist/index.js only exports createServer, so starting it ran nothing. Nothing here starts a process.
test("smithery starts the stdio entry with the configured key", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const cmd = startCommand({ BILLINGO_API_KEY: "test-key-not-real" });
  assert.equal(cmd.command, "node");
  assert.deepEqual(cmd.args, [pkg.bin["billingo-mcp"]]);
  assert.equal(cmd.env.BILLINGO_API_KEY, "test-key-not-real");
});
