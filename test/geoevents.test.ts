import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { loadGeoEvents, geoReminderLines, geoCalendarLines, parseGeo } from "../src/macro/geoEvents.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief } from "../src/macro/brief.ts";

const root = new URL("../", import.meta.url), rd = (p: string) => readFileSync(new URL(p, root), "utf8");
const { events, error } = loadGeoEvents(), BR = events.find((e) => e.id === "br-2026-runoff")!;
const ASSETS = ["EWZ", "PBR", "VALE", "ITUB", "NU", "BBD", "BRL", "ILF", "EWW", "ECH", "ARGT"];

test("Brazil runoff: Sun 2026-10-25 per TSE (Res. 23.751 art. 2), polls 08:00–17:00 Brasília = 07:00–16:00 ET, geopolitical/election, LatAm, all assets", () => {
  assert.equal(error, undefined); assert.ok(BR);
  assert.equal(BR.dateET, "2026-10-25"); assert.equal(new Date(BR.dateET + "T12:00:00Z").getUTCDay(), 0, "Sunday");
  assert.equal(BR.at, "2026-10-25T11:00:00.000Z"); assert.equal(new Date(BR.at).toLocaleString("en-GB", { timeZone: "America/Sao_Paulo" }), "25/10/2026, 08:00:00");
  assert.equal(new Date(BR.resultsAt!).toLocaleString("en-GB", { timeZone: "America/Sao_Paulo" }), "25/10/2026, 17:00:00");
  assert.equal(new Date(BR.at).toLocaleString("en-GB", { timeZone: "America/New_York" }), "25/10/2026, 07:00:00");
  assert.equal(BR.category, "geopolitical"); assert.equal(BR.subtype, "election"); assert.equal(BR.sector, "LatAm"); assert.deepEqual(BR.assets, ASSETS);
  assert.ok(BR.sources.every((s) => s.startsWith("https://www.tse.jus.br/"))); assert.ok(BR.sources.some((s) => /23\.751/.test(s)));
  assert.throws(() => parseGeo({ events: [{ id: "x", dateET: "2026-10-25", at: "nope", assets: [], sources: ["s"] }] }));
});

test("72h reminder starts Thu 10/22 07:00 ET, not Wed night; runs through Monday's session; calendar row shows in the 14-day window", () => {
  const at = (iso: string) => new Date(iso);
  assert.deepEqual(geoReminderLines(events, at("2026-10-22T10:59:00Z")), [], "Thu 06:59 ET: not yet");
  const thu = geoReminderLines(events, at("2026-10-22T12:00:00Z")).join("\n");
  assert.match(thu, /地缘\/选举事件 72 小时提醒.*2026-10-25（周日）07:00 ET · 巴西总统大选第二轮投票.*还有 71 小时/);
  for (const a of ASSETS) assert.ok(thu.includes(a), a);
  assert.match(thu, /LatAm 板块/); assert.match(thu, /不改 NO_TRADE、48h\/72h 规则和「能不能睡」/);
  assert.match(geoReminderLines(events, at("2026-10-25T15:00:00Z")).join("\n"), /投票进行中/);
  assert.match(geoReminderLines(events, at("2026-10-26T13:00:00Z")).join("\n"), /结果已出 17 小时/, "Mon 09:00 ET");
  assert.deepEqual(geoReminderLines(events, at("2026-10-26T21:00:00Z")), [], "gone 24h after results");
  assert.match(geoCalendarLines(events, at("2026-10-19T17:00:00Z")).join("\n"), /2026-10-25（周日）07:00 ET · 🌎 巴西总统大选第二轮投票（Lula vs Flávio Bolsonaro）（geopolitical\/election · LatAm/);
  assert.deepEqual(geoCalendarLines(events, at("2026-10-05T17:00:00Z")), [], "outside 14 days");
});

test("display only: brief verdict and reasons identical with and without the geo lines; event not in the release calendar or major-events (NO_TRADE / 48h / 72h tag / 能不能睡 inputs)", () => {
  const now = new Date("2026-10-22T12:00:00Z"), macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now);
  const parts = { macro, pm: buildPremarket({ now, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label }), sc: buildScenarios({ now, data: {}, calendar: [] }) };
  const a = buildBrief({ now, ...parts, calendar: [], geo: { reminder: geoReminderLines(events, now), calendar: geoCalendarLines(events, now) } }), b = buildBrief({ now, ...parts, calendar: [] });
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.reasons, b.reasons);
  assert.match(a.md, /🌎 \*\*地缘\/选举事件 72 小时提醒\*\*/); assert.match(a.md.slice(a.md.indexOf("## 6. 日历")), /🌎 巴西总统大选第二轮投票/); assert.doesNotMatch(b.md, /巴西/);
  for (const f of ["calendar/releases-2026.json", "knowledge/calendar/major-events-2026-2027.json"]) assert.doesNotMatch(rd(f), /巴西|Brazil|br-2026/, f);
  const cli = rd("src/cli/brief.ts"); assert.equal(cli.split("\n").filter((l) => /geoF|geoReminderLines|geoCalendarLines/.test(l) && !/^import/.test(l)).length, 2, "loaded once, passed only to buildBrief");
  for (const f of ["src/macro/risk.ts", "src/macro/scenarios.ts", "src/macro/sleepday.ts", "src/options/psych.ts", "src/options/majorEvents.ts", "src/macro/premarket.ts"]) assert.doesNotMatch(rd(f), /geoEvents|geo-events/, f);
});
