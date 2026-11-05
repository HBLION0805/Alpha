import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCapital } from "../src/config.ts";
test("default simulation capital is $5000; ALPHA_CAPITAL overrides", () => {
  assert.equal(defaultCapital({}), 5000);
  assert.equal(defaultCapital({ ALPHA_CAPITAL: "20000" }), 20000);
  assert.equal(defaultCapital({ ALPHA_CAPITAL: "x" }), 5000);
});
