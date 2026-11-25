import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { PAYMENT_METHODS } from "../src/tools/payment-methods.js";
import { registerDocumentTools } from "../src/tools/documents.js";
import { registerSpendingTools } from "../src/tools/spending.js";

// The tools are registered on a stand-in server that only records each tool's input shape.
// The client is never called: these tests send nothing to the Billingo API.
type Shape = Record<string, z.ZodTypeAny>;
function shapesOf(register: (server: never, client: never) => void): Map<string, Shape> {
  const shapes = new Map<string, Shape>();
  const server = {
    registerTool: (name: string, config: { inputSchema: z.ZodObject<Shape> }) => { shapes.set(name, config.inputSchema.shape); },
  };
  const client = new Proxy({}, { get: () => () => { throw new Error("no Billingo call in tests"); } });
  register(server as never, client as never);
  return shapes;
}

const TOOLS_WITH_PAYMENT_METHOD: Array<[string, (server: never, client: never) => void]> = [
  ["list_documents", registerDocumentTools],
  ["create_document", registerDocumentTools],
  ["create_modification_document", registerDocumentTools],
  ["update_payment", registerDocumentTools],
  ["create_spending", registerSpendingTools],
  ["update_spending", registerSpendingTools],
];

test("the list is the API's: 28 values, wire_transfer and kompenzacio in, artutalas and compensation out", () => {
  assert.equal(PAYMENT_METHODS.length, 28);
  assert.ok(PAYMENT_METHODS.includes("wire_transfer"));
  assert.ok(PAYMENT_METHODS.includes("kompenzacio"));
  assert.ok(!(PAYMENT_METHODS as readonly string[]).includes("artutalas"));
  assert.ok(!(PAYMENT_METHODS as readonly string[]).includes("compensation"));
});

for (const [name, register] of TOOLS_WITH_PAYMENT_METHOD) {
  test(`${name}: payment_method takes wire_transfer and refuses artutalas`, () => {
    const shape = shapesOf(register).get(name);
    assert.ok(shape, `${name} is registered`);
    const field = shape!.payment_method;
    assert.ok(field, `${name} has a payment_method field`);
    assert.equal(field.safeParse("wire_transfer").success, true);
    assert.equal(field.safeParse("online_bankcard").success, true);
    assert.equal(field.safeParse("artutalas").success, false);
    assert.equal(field.safeParse("compensation").success, false);
  });
}
