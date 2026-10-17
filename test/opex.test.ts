import { test } from "node:test";
import assert from "node:assert/strict";
import { thirdFriday, withOpex } from "../src/macro/opex.ts";
test("3rd Friday OpEx dates", () => {
  assert.equal(thirdFriday(2026, 9), "2026-10-16");
  assert.equal(thirdFriday(2026, 0), "2026-01-16");
  assert.equal(thirdFriday(2026, 4), "2026-05-15");
  const c = withOpex([], 2026); assert.equal(c.length, 13); assert.match(c[0]!.title, /DK/);
  assert.equal(withOpex(c, 2026).length, 13);
});
