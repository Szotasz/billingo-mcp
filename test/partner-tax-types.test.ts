import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { PARTNER_TAX_TYPES } from "../src/tools/partner-tax-types.js";
import { registerPartnerTools } from "../src/tools/partners.js";

// The tools are registered on a stand-in server that only records each tool's input shape.
// The client is never called: these tests send nothing to the Billingo API.
type Shape = Record<string, z.ZodTypeAny>;
function shapes(): Map<string, Shape> {
  const out = new Map<string, Shape>();
  const server = {
    registerTool: (name: string, config: { inputSchema: z.ZodObject<Shape> }) => { out.set(name, config.inputSchema.shape); },
  };
  const client = new Proxy({}, { get: () => () => { throw new Error("no Billingo call in tests"); } });
  registerPartnerTools(server as never, client as never);
  return out;
}

test("the list is the API's: FOREIGN, HAS_TAX_NUMBER, NO_TAX_NUMBER; no TAXPAYER", () => {
  assert.deepEqual([...PARTNER_TAX_TYPES], ["FOREIGN", "HAS_TAX_NUMBER", "NO_TAX_NUMBER"]);
});

for (const name of ["create_partner", "update_partner"]) {
  test(`${name}: tax_type takes the API's values and refuses TAXPAYER and PRIVATE_PERSON`, () => {
    const field = shapes().get(name)?.tax_type;
    assert.ok(field, `${name} has a tax_type field`);
    for (const ok of ["FOREIGN", "HAS_TAX_NUMBER", "NO_TAX_NUMBER", undefined]) {
      assert.equal(field.safeParse(ok).success, true, `${ok} is accepted`);
    }
    for (const bad of ["TAXPAYER", "PRIVATE_PERSON", ""]) {
      assert.equal(field.safeParse(bad).success, false, `${JSON.stringify(bad)} is refused`);
    }
  });
}
