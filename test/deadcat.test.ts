import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { matchEcon, econInputs, stockState, deadCatChecklist, renderDeadCat, renderChecklist, deadCatJson, ECON_TABLE, LV, BOTTOM, type EconInput } from "../src/macro/deadcat.ts";
import { classifyMatrix } from "../src/macro/matrix.ts";
import { deadCatCardLines, deadCatLossLines, lossPrompt, renderLossPrompt, RULES } from "../src/review/mentor.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief } from "../src/macro/brief.ts";
import { sleepDay } from "../src/macro/sleepday.ts";
import type { Obs } from "../src/macro/fetch.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const root = new URL("../", import.meta.url);
const DIR = "knowledge/mentor/market-calls/dead-cat-2026-10-19/";
const DAYS = ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19"];
/** 7 daily obs: values given, or a straight line from a to b */
const ser = (a: number, b: number): Obs[] => DAYS.map((t, i) => ({ t, v: a + ((b - a) * Math.max(0, i - 1)) / 5 }));
const vals = (...v: number[]): Obs[] => v.map((x, i) => ({ t: DAYS[DAYS.length - v.length + i]!, v: x }));

test("archive: article + 10 figures byte-for-byte (sha256 in manifest); no author name in any text; fig1 flagged", () => {
  const m = JSON.parse(readFileSync(new URL(DIR + "manifest.json", root), "utf8"));
  assert.equal(m.files.length, 11);
  for (const f of m.files) { const b = readFileSync(new URL(DIR + f.file, root)); assert.equal(b.length, f.bytes, f.file); assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256, f.file); }
  assert.equal(m.files.find((f: { file: string }) => f.file === "assets/fig1.png").containsAuthorHandle, true);
  const art = readFileSync(new URL(DIR + "article.md", root), "utf8");
  assert.match(art, /^# 死猫反弹，还是市场见底？/); assert.ok(art.includes("跟他们男人的鸡巴一样"), "crude wording kept");
  // the author's 2-character handle (visible in fig1) must not appear in any text; only its sha256 is kept here, never the name
  const HANDLE_SHA = "288f26ff083ffd9c57dd08a1d7828ea87d89ecf47c39bcaa8ba733b6b4ea7a8a";
  for (const p of [DIR + "article.md", DIR + "README.md", DIR + "manifest.json", "docs/MENTOR_DEADCAT.md", "docs/DECISIONS.md", "knowledge/README.md", "src/macro/deadcat.ts", "src/review/mentor.ts"]) {
    const t = [...readFileSync(new URL(p, root), "utf8")];
    for (let k = 0; k + 1 < t.length; k++) if (/\p{Script=Han}/u.test(t[k]!) && /\p{Script=Han}/u.test(t[k + 1]!)) assert.notEqual(createHash("sha256").update(t[k]! + t[k + 1]!).digest("hex"), HANDLE_SHA, p);
  }
});

const E = (o: Partial<EconInput>): EconInput => ({ wti5: 0, dxy5: 0, y30bp5: 0, spy5: 0, def5: 0, growth5: 0, ...o });
test("经济情景表: each of the 4 rows is matched 4/4 by its own pattern (synthetic)", () => {
  const cases: Array<[string, EconInput]> = [
    ["growth", E({ wti5: -0.4, dxy5: 0.8, y30bp5: 12, spy5: 2, def5: 0.5, growth5: 3 })],          // oil flat counts for growth (↓ / —)
    ["inflation", E({ wti5: 4, dxy5: 0.6, y30bp5: 15, spy5: -0.2, def5: -1, growth5: -0.5 })],     // stocks mixed (no defensive lead)
    ["stagflation", E({ wti5: 4.7, dxy5: -0.75, y30bp5: -16, spy5: -1.4, def5: 1.9, growth5: -5 })], // today's setup
    ["recession", E({ wti5: -6, dxy5: -0.9, y30bp5: -20, spy5: -4, def5: -2, growth5: -5 })],
  ];
  for (const [id, inp] of cases) {
    const r = matchEcon(inp);
    assert.deepEqual(r.best.map((b) => b.id), [id], id); assert.equal(r.score, 4, id); assert.equal(r.known, 4);
  }
  assert.equal(matchEcon(E({ wti5: -3, dxy5: 0.8, y30bp5: 12, spy5: 2, def5: 0, growth5: 3 })).best[0]!.id, "growth", "oil ↓ also growth");
  assert.equal(ECON_TABLE.length, 4);
});
test("经济情景表: dead-bands, stock states, unknown dims never count", () => {
  assert.equal(matchEcon(E({ wti5: 0.9 })).dims.oil, "flat"); assert.equal(matchEcon(E({ wti5: 1.1 })).dims.oil, "up");
  assert.equal(matchEcon(E({ dxy5: -0.29 })).dims.dxy, "flat"); assert.equal(matchEcon(E({ y30bp5: -6 })).dims.y30, "down");
  assert.equal(stockState({ spy5: 1, def5: 0, growth5: 2 }), "broad_up");
  assert.equal(stockState({ spy5: 0, def5: 2, growth5: -1 }), "defensive_lead");
  assert.equal(stockState({ spy5: -2, def5: -1, growth5: -3 }), "broad_down");
  assert.equal(stockState({ spy5: 0.1, def5: -0.5, growth5: 0 }), "mixed");
  assert.equal(stockState({ spy5: 1, def5: null, growth5: 2 }), "unknown");
  const r = matchEcon({ wti5: 5, dxy5: null, y30bp5: null, spy5: null, def5: null, growth5: null });
  assert.equal(r.known, 1); assert.equal(r.score, 1); assert.deepEqual(r.best.map((b) => b.id).sort(), ["inflation", "stagflation"]);
  const none = matchEcon({ wti5: null, dxy5: null, y30bp5: null, spy5: null, def5: null, growth5: null }); assert.equal(none.known, 0); assert.deepEqual(none.best, []);
  // from series: 5-day changes, 30Y in bp, FRED fallback
  const i = econInputs({ WTI: ser(93.74, 97.78), DXY: ser(102.58, 101.95), UST30Y_FRED: ser(5.6, 5.45), SPY: ser(778.1, 767.55), XLP: ser(84.41, 87.36), XLV: ser(171.99, 176.22), XLU: ser(41.63, 41.49), QQQ: ser(746.04, 720.09), SMH: ser(590.99, 551.68) });
  assert.ok(Math.abs(i.wti5! - 4.31) < 0.01); assert.ok(Math.abs(i.y30bp5! + 15) < 0.01);
  assert.equal(matchEcon(i).best[0]!.id, "stagflation");
});
test("经济情景表 render: best row, score, both mentor tables compared (agree / disagree)", () => {
  const d = { WTI: ser(90, 95), DXY: ser(102, 101), UST30Y: ser(5.6, 5.4), SPY: ser(100, 98), XLP: ser(80, 82), XLV: ser(80, 82), XLU: ser(80, 81), QQQ: ser(100, 95), SMH: ser(100, 93), UST10Y: ser(4.5, 4.3) };
  const r = renderDeadCat(d, classifyMatrix(d));
  const md = r.lines.join("\n");
  assert.match(md, /【大佬经济情景表】\*\*（图八，5 日方向）最接近：\*\*滞胀\*\*（匹配 4\/4/);
  assert.match(md, /对照 【大佬情景对照】/);
  const fake = { best: [{ id: "bull", name: "牛市" }], matches: 3 } as never;
  assert.match(renderDeadCat(d, fake).lines.join("\n"), /⚠️ 两张表不一致/);
  assert.match(renderDeadCat(d, { best: [{ id: "bear2", name: "熊市·第二阶段" }], matches: 3 } as never).lines.join("\n"), /✅ 两张表方向一致/);
  assert.match(renderDeadCat({}).lines.join("\n"), /数据不可用（n\/a）/);
});

const TODAY = (): Record<string, Obs[]> => ({ WTI: vals(91.85, 93.74, 94.14, 95.09, 97.97, 101.41, 97.78), KOSPI: vals(6625.93, 6384.24, 6035.35, 6008.81, 5554.22, 5668.05, 5768.01),
  RSP: vals(213.04, 213.19, 213.3, 212.09, 215, 214.09, 213.4), EWF: vals(8696), VIX: vals(14.84, 15.21, 15.27, 16.87, 16.46, 19.99, 17.66), NQ: vals(31108.75, 30898.25, 30791.5, 30182.75, 30143.75, 29391.5, 29841.5) });
const st = (c: ReturnType<typeof deadCatChecklist>, id: string) => c.items.find((x) => x.id === id)!;
test("checklist: thresholds for each item", () => {
  const c = deadCatChecklist(TODAY());
  assert.equal(st(c, "wti").status, "bottom", "97.78 < 100 and falling"); assert.match(st(c, "wti").note, /继续回落/);
  assert.equal(st(c, "kospi").status, "bottom", "above 5266, +1.76% bounce");
  assert.equal(st(c, "ewf").status, "dead_cat", "RSP −0.32% → rotation reversing"); assert.match(st(c, "ewf").proxy!, /RSP/, "EWF=F has 1 bar → RSP proxy, labeled");
  assert.equal(st(c, "vix").status, "neutral"); assert.match(st(c, "vix").value, /10\/16 收 19\.99；飙升后第 1 个交易日/); assert.match(st(c, "vix").note, /降温中/);
  assert.equal(st(c, "nq").status, "neutral"); assert.match(st(c, "nq").note, /28500 和 30000 之间/);
  // WTI
  const w = (v: number[]) => st(deadCatChecklist({ WTI: vals(...v) }), "wti").status;
  assert.equal(w([98, 100.5]), "dead_cat"); assert.equal(w([99, 100]), "dead_cat"); assert.equal(w([97, 98]), "neutral"); assert.equal(w([98, 97]), "bottom");
  // KOSPI: below support / weak bounce (+0.6%, the mentor's example) / strong bounce
  const k = (v: number[]) => st(deadCatChecklist({ KOSPI: vals(...v) }), "kospi").status;
  assert.equal(k([5300, 5260]), "dead_cat"); assert.equal(k([5700, 5734.2]), "neutral"); assert.equal(k([5700, 5790]), "bottom");
  const ewy = st(deadCatChecklist({ EWY: vals(150, 152) }), "kospi"); assert.match(ewy.proxy!, /EWY/); assert.match(ewy.note, /无法对照 5266/);
  // EWF futures used when it has history
  const ewf = st(deadCatChecklist({ EWF: vals(8700, 8720), RSP: vals(200, 190) }), "ewf"); assert.equal(ewf.status, "bottom"); assert.equal(ewf.proxy, undefined); assert.match(ewf.value, /^EWF1!/);
  assert.equal(st(deadCatChecklist({ RSP: vals(200, 200.2) }), "ewf").status, "neutral");
  // VIX re-spike: above the 10/16 close, or above 20; spike day itself; no 10/16 bar → n/a
  const v = (...x: number[]) => st(deadCatChecklist({ VIX: vals(...x) }), "vix");
  assert.equal(v(16.46, 19.99, 17.66).status, "neutral");
  assert.equal(v(16.46, 19.99, 17.66, 20.5).status, "dead_cat"); assert.match(v(16.46, 19.99, 17.66, 20.5).note, /再次飙升/);
  assert.equal(v(16.46, 19.5, 17, 19.8).status, "dead_cat", "> 10/16 close even below 20");
  assert.equal(v(16.46, 19.99, 16.5).status, "bottom", "< 17");
  assert.equal(st(deadCatChecklist({ VIX: [{ t: "2026-10-15", v: 16 }, { t: "2026-10-16", v: 19.99 }] }), "vix").note, "今天就是飙升日");
  assert.equal(st(deadCatChecklist({ VIX: [{ t: "2026-10-19", v: 18 }] }), "vix").status, "na");
  // NQ, and the QQQ-equivalent when NQ is missing
  const n = (x: number) => st(deadCatChecklist({ NQ: vals(x) }), "nq").status;
  assert.equal(n(30010), "bottom"); assert.equal(n(29000), "neutral"); assert.equal(n(28400), "dead_cat");
  const q = st(deadCatChecklist({ QQQ: vals(720), NDX: vals(29500) }), "nq"); assert.equal(q.status, "neutral"); assert.match(q.proxy!, /QQQ 等效/); assert.match(q.value, /等效 30000 ≈ 732\.20/);
  // nothing → every item n/a, no throw
  const empty = deadCatChecklist({}); assert.ok(empty.items.every((x) => x.status === "na")); assert.equal(empty.known, 0); assert.equal(empty.wrongFlag, false);
  assert.match(renderChecklist(empty).join("\n"), /➖ 5/);
});
test("DK devil's advocate: 「死猫判断可能错了」 only when ≥3 of 4 bottom conditions are met", () => {
  assert.equal(BOTTOM.need, 3);
  const today = deadCatChecklist(TODAY()); assert.equal(today.met, 1, "only KOSPI holds"); assert.equal(today.wrongFlag, false);
  assert.doesNotMatch(renderChecklist(today).join("\n"), /死猫判断可能错了/);
  const three = deadCatChecklist({ WTI: vals(96, 94), VIX: vals(19.99, 16.5), KOSPI: vals(5600, 5700), NQ: vals(29900) });
  assert.equal(three.met, 3); assert.equal(three.wrongFlag, true); assert.match(renderChecklist(three).join("\n"), /「死猫判断可能错了」/);
  const four = deadCatChecklist({ WTI: vals(96, 94), VIX: vals(19.99, 16.5), KOSPI: vals(5600, 5700), NQ: vals(30100) }); assert.equal(four.met, 4); assert.ok(four.wrongFlag);
  const twoKnown = deadCatChecklist({ WTI: vals(96, 94), VIX: vals(19.99, 16.5) }); assert.equal(twoKnown.met, 2); assert.equal(twoKnown.known, 2); assert.equal(twoKnown.wrongFlag, false, "unknown never counts as met");
  assert.equal(LV.kospiSupport, 5266.12);
});

const T = (o: Partial<JournalEntry>): JournalEntry => ({ id: "x", symbol: "QQQ", strategy: "call_debit_spread", mode: "paper", kind: "practice", source: "paper_sim", openedAt: "2026-10-14T14:00:00Z", maxLoss: 20, legs: [], ...o } as JournalEntry);
test("mentor hooks: long tech / rebound cards; defensive cards only when WTI > 95; losing long-tech close; quotes verbatim", () => {
  const art = readFileSync(new URL(DIR + "article.md", root), "utf8");
  for (const id of ["dead_cat_rebound", "oil_hurts_defensives"]) for (const x of RULES[id]!.quotes) assert.ok(art.includes(x.text), id);
  const tech = deadCatCardLines("NVDA", "bull", "财报后突破", { wti: 90 }).join("\n");
  assert.match(tech, /「大佬：如果是死猫反弹，每一次反弹都是卖掉破玩意儿的机会」/); assert.match(tech, /原文：「如果真的重演，那这就是死猫反弹/);
  assert.match(deadCatCardLines("IWM", "bull", "小盘超跌反弹", null).join("\n"), /论点提到「超跌」/);
  assert.deepEqual(deadCatCardLines("IWM", "bull", "降息", null), []); assert.deepEqual(deadCatCardLines("NVDA", "bear", "反弹做空", { wti: 99 }), [], "bear cards: none");
  const def = deadCatCardLines("XLP", "bull", "防御", { wti: 97.78 }).join("\n"); assert.match(def, /WTI 97\.78 > 95/); assert.match(def, /「大佬：油价继续上涨，连防御股也得遭殃」/);
  assert.deepEqual(deadCatCardLines("XLP", "bull", "防御", { wti: 94 }), []); assert.deepEqual(deadCatCardLines("KO", "bull", null, { wti: null }), []);
  assert.match(deadCatCardLines("SPY", "bull", "买必需消费 staples", { wti: 99 }).join("\n"), /防御股也得遭殃/);
  // losing close
  assert.ok(deadCatLossLines(T({})).length > 0); assert.deepEqual(deadCatLossLines(T({ strategy: "put_debit_spread" })), []); assert.deepEqual(deadCatLossLines(T({ symbol: "XLE", thesis: "油价" })), []);
  const now = new Date("2026-10-19T15:00:00Z");
  const lp = lossPrompt(T({ closedAt: "2026-10-19T14:00:00Z", pnl: -15, thesis: "抄底科技" } as never), [], now)!;
  assert.ok(lp.mentor?.some((l) => /死猫反弹/.test(l))); assert.match(renderLossPrompt(lp, now).join("\n"), /🐈 亏损的是做多科技\/反弹单/);
  const win = lossPrompt(T({ closedAt: "2026-10-19T14:00:00Z", pnl: 15 } as never), [], now); assert.equal(win, null);
});

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
test("display only (static): deadcat.ts is used only by the brief CLI/renderer; its JSON only by plan-card reminders", () => {
  const src = new URL("src", root).pathname, rel = (p: string) => p.slice(src.length + 1);
  const users = walk(src).filter((f) => rel(f) !== "macro/deadcat.ts" && /deadcat\.ts|deadCatLines|renderDeadCat|deadCatJson|deadCatChecklist|matchEcon/.test(readFileSync(f, "utf8"))).map(rel).sort();
  assert.deepEqual(users, ["cli/brief.ts", "macro/brief.ts"]);
  const readers = walk(src).filter((f) => /\.deadCat\b/.test(readFileSync(f, "utf8"))).map(rel);
  assert.deepEqual(readers, ["review/card.ts"], "brief-latest.json deadCat is read only for the card reminders");
  const card = readFileSync(`${src}/review/card.ts`, "utf8").split("\n").filter((l) => /deadCat/.test(l) && !/^\s*import/.test(l));
  for (const l of card) assert.doesNotMatch(l, /verdict =|failing\.|warnTags|formal =|contracts/, l);
  const dc = readFileSync(`${src}/macro/deadcat.ts`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); assert.doesNotMatch(dc, /alarm|noTrade|store\.insert|verdict\s*=|import .*(risk|brief|alerts|store|sleepday)\.ts/i);
});
test("display only (rendered): the block changes nothing else in the brief; 能不能睡 is not an input", () => {
  const n = new Date("2026-10-19T14:30:00Z");
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], n), pm = buildPremarket({ now: n, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label }), sc = buildScenarios({ now: n, data: {}, calendar: [] });
  const dc = renderDeadCat(TODAY());
  const a = buildBrief({ now: n, macro, pm, sc, calendar: [], deadCatLines: dc.lines }), b = buildBrief({ now: n, macro, pm, sc, calendar: [] });
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.reasons, b.reasons);
  assert.equal(a.md.replace(dc.lines.join("\n") + "\n", ""), b.md, "only the dead-cat block differs");
  assert.match(a.md, /## 1\.3 大佬：死猫反弹，还是市场见底？/);
  const j = deadCatJson(dc, TODAY()); assert.equal(j.wti, 97.78); assert.equal(j.bottomMet, 1); assert.equal(j.deadCatWrong, false);
  // sleepDay takes no market data at all → the label cannot depend on this block
  const sd = sleepDay({ date: "2026-10-19", now: n, events: [], fed: null, trump: null });
  assert.ok(!("deadCat" in sd) && !JSON.stringify(sd).includes("死猫"));
});

test("plan card (rendered): dead-cat / defensive reminders appear; verdict, failing, tags and size are identical with and without them", async () => {
  const { buildCard, renderCard } = await import("../src/review/card.ts");
  const EXP = "2026-10-23", NOW = new Date("2026-10-19T14:00:00Z");
  const q = (strike: number, bid: number, ask: number) => ({ type: "call" as const, strike, expiration: EXP, bid, ask, src: "t" });
  const mk = (sym: string, thesis: string, deadCat: { wti: number } | null) => buildCard({ now: NOW, sym, dir: "bull", exp: EXP, spot: 100, bars: [], levels: null, quotes: [q(100, 3, 3.2), q(102, 2, 2.2)],
    brief: { generatedAt: NOW.toISOString(), leader: null, verdict: "RESEARCH_OK", plan: [], ...(deadCat ? { deadCat } : {}) }, gex: null, calendar: [], earnings: [], journal: [], capital: 5000, thesis });
  const strip = (c: ReturnType<typeof mk>) => ({ ...c, macroTheme: undefined });
  const a = mk("NVDA", "超跌反弹", { wti: 97.78 }), b = mk("NVDA", "超跌反弹", null);
  assert.ok(a.macroTheme?.some((l) => /死猫反弹/.test(l)));
  assert.match(renderCard(a, 100, EXP), /「大佬：如果是死猫反弹，每一次反弹都是卖掉破玩意儿的机会」/);
  const x = mk("XLP", "防御", { wti: 97.78 }), y = mk("XLP", "防御", { wti: 90 });
  assert.ok(x.macroTheme?.some((l) => /防御股也得遭殃/.test(l))); assert.equal(y.macroTheme, undefined);
  for (const [p, r] of [[a, b], [x, y]] as const) { assert.equal(p.verdict, r.verdict); assert.deepEqual(p.failing, r.failing); assert.deepEqual(p.warnTags, r.warnTags); assert.deepEqual(p.trade, r.trade); assert.deepEqual(strip(p).sections, strip(r).sections); }
});
