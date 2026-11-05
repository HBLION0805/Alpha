import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coMove, regime, REGIME, dailyChg, normYield, regimeOilContract, manualLines, ratesLines, DEFAULT_MANUAL } from "../src/macro/ratesRegime.ts";

const S = (vals: Array<[string, number]>) => vals.map(([t, v]) => ({ t: `${t}T00:00:00Z`, v }));
test("2Y vs 30Y co-movement: 4 quadrants + 1bp dead-band", () => {
  assert.match(coMove(-3, -4), /衰退\/降息/); assert.match(coMove(-3, 2), /回避长债/);
  assert.match(coMove(2, 3), /鹰派/); assert.match(coMove(2, -2), /熊平/);
  assert.match(coMove(0.5, -3), /无明确联动/); assert.match(coMove(0.4, -0.9), /无信号/); assert.equal(coMove(null, 1), "数据不足");
});
test("oil / yields / USD regime", () => {
  assert.equal(regime(1.2, -3, 0.3).text, REGIME.stag); assert.equal(regime(-1, -2, -0.2).text, REGIME.rebound);
  assert.equal(regime(1, 2, 0.3).tag, "mixed"); assert.equal(regime(0.1, -3, 0.3).tag, "mixed", "oil inside dead-band"); assert.equal(regime(null, 1, 1).tag, null);
});
test("bp / % changes, ×10 yields normalized, aligned co-move date", () => {
  assert.deepEqual(dailyChg(S([["2026-10-16", 4.6], ["2026-10-19", 4.65]]), "bp"), { v: 4.65, chg: 5, date: "2026-10-19" });
  assert.equal(dailyChg(S([["2026-10-16", 100], ["2026-10-19", 102]]), "pct").chg, 2);
  assert.equal(normYield(S([["2026-10-19", 46.5]]))[0]!.v, 4.65);
  const out = ratesLines({ y2: S([["2026-10-16", 3.6], ["2026-10-19", 3.55]]), y30: S([["2026-10-16", 4.6], ["2026-10-19", 4.63], ["2026-10-20", 4.7]]),
    y10: S([["2026-10-19", 4.1], ["2026-10-20", 4.07]]), dxy: S([["2026-10-19", 100], ["2026-10-20", 100.3]]), oil: S([["2026-10-19", 90], ["2026-10-20", 91]]), oilCode: "CLZ26", manual: DEFAULT_MANUAL }).join("\n");
  assert.match(out, /2Y vs 30Y 联动（2026-10-19）：2Y −?-5\.0bp · 30Y \+3\.0bp → \*\*长端担忧/);
  assert.match(out, /30Y 美债收益率 4\.700%/); assert.match(out, /WTI CLZ26 \+1\.11%.*滞胀\/衰退压力/); assert.match(out, /导师框架/);
});
test("regime oil: CLX26 expires 10/20 → CLZ26; before that CLX26", () => {
  assert.equal(regimeOilContract("2026-10-20").code, "CLZ26"); assert.equal(regimeOilContract("2026-10-19").code, "CLX26");
});
test("manual MOVE / collateral multiplier: danger flag only for MOVE up + multiplier down", () => {
  assert.match(manualLines(DEFAULT_MANUAL).join("\n"), /1\.83（10\/16.*MOVE avg 100\+ since late Sep[\s\S]*最危险组合/);
  assert.match(manualLines(DEFAULT_MANUAL).join("\n"), /🚨/);
  assert.doesNotMatch(manualLines({ ...DEFAULT_MANUAL, move: { text: "MOVE 85", trend: "down" } }).join("\n"), /🚨/);
});
test("display only: rates regime never reaches verdict / NO_TRADE / alerts; no mentor name", () => {
  const src = readFileSync(new URL("../src/macro/ratesRegime.ts", import.meta.url), "utf8");
  const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./fetch.ts", "./wtiFront.ts", "node:fs"]);
});
