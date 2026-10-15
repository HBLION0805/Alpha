import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCboe, computeGex, renderGex } from "../src/options/gex.ts";
const opt = (sym: string, exp: string, cp: "C" | "P", K: number, oi: number, g: number, iv = 0.3) => ({ option: `${sym}${exp}${cp}${String(K * 1000).padStart(8, "0")}`, open_interest: oi, gamma: g, iv });
const J = (opts: object[], ts = "2026-10-15 14:00:00") => ({ timestamp: ts, data: { current_price: 100, options: opts } });
test("GEX: sign convention, walls, max pain, next-expiry share, window filter", () => {
  const j = J([opt("X", "261016", "C", 105, 1000, 0.05), opt("X", "261016", "P", 95, 400, 0.05), opt("X", "261120", "C", 110, 100, 0.02), opt("X", "261015", "C", 100, 9999, 0.1), opt("X", "270115", "C", 100, 9999, 0.1)]);
  const p = parseCboe(j, 45);
  assert.equal(p.rows.length, 4, "keeps today before the close; drops >45d");
  const r = computeGex("X", parseCboe(J([opt("X", "261016", "C", 105, 1000, 0.05), opt("X", "261016", "P", 95, 400, 0.05), opt("X", "261120", "C", 110, 100, 0.02)]), 45));
  assert.ok(r.net > 0); assert.equal(r.callWall, 105); assert.equal(r.putWall, 95);
  assert.equal(r.nextExpiry, "2026-10-16"); assert.ok(r.nextExpiryShare > 0.9);
  assert.ok(r.maxPain! >= 95 && r.maxPain! <= 105);
  const after = parseCboe(J([opt("X", "261015", "C", 100, 10, 0.1), opt("X", "261016", "C", 100, 10, 0.1)], "2026-10-15 21:00:00"));
  assert.deepEqual(after.rows.map((x) => x.exp), ["2026-10-16"], "today's expiry dropped after the close");
});
test("GEX: negative when puts dominate; render marks failures as unavailable, never fabricated", () => {
  const r = computeGex("Y", parseCboe(J([opt("Y", "261016", "P", 100, 5000, 0.08), opt("Y", "261016", "C", 105, 100, 0.03)])));
  assert.ok(r.net < 0);
  const md = renderGex([r, { symbol: "ZZZ", ok: false, error: "CBOE: no options in response" }]).join("\n");
  assert.match(md, /负 gamma（放大波动）/); assert.match(md, /不可用（不编造）：ZZZ/); assert.match(md, /不判断方向/);
  assert.throws(() => parseCboe({ timestamp: "x", data: { options: [] } }), /no options/);
});
