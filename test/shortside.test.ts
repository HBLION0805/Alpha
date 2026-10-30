import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shortEntryChecks, SHORT_LIMITS, SHORT_TAGS, SHORT_MANUAL, type OhlcBar, type ShortInput } from "../src/options/shortside.ts";
import { paperOpen, type PaperJournal } from "../src/options/paper.ts";
import { buildCard, type CardInput, type Quote } from "../src/review/card.ts";

const d = (k: number) => new Date(Date.UTC(2026, 4, 1) + k * 864e5).toISOString().slice(0, 10);
const mk = (cs: number[], r = 0.4): Array<OhlcBar & { v: number }> => cs.map((c, k) => ({ t: d(k), o: k ? cs[k - 1]! : c, h: c + r, l: c - r, c, v: 1e6 }));
// clean short setup: 70-day downtrend, rebound to MA20, failing; weaker than a rising SPY and a flat sector
const DOWN = () => { const b = mk([...Array.from({ length: 70 }, (_, i) => 120 - 0.35 * i), 97, 98, 99, 98.2, 97.6, 97.3]); b[74] = { ...b[74]!, l: 96.9 }; return b; };
const SPY = mk(Array.from({ length: 76 }, (_, i) => 500 + i * 0.5)), SEC = mk(Array.from({ length: 76 }, () => 200));
const base = (o: Partial<ShortInput> = {}): ShortInput => ({ sym: "XYZ", bars: DOWN(), spyBars: SPY, sectorSym: "XLK", sectorBars: SEC, expirations: ["2026-08-21"], asOf: d(75), squeezeCheck: "SI 3% · float 2B · gamma + · 无梗股热度", invalidationLevel: 101, ...o });

test("short checklist: clean failed-rebound short in a weak name → no warn tags, failed rebound + relative weakness shown", () => {
  const r = shortEntryChecks(base());
  assert.deepEqual(r.tags, [], r.details.join("; "));
  assert.equal(r.metrics.failedRebound, true);
  assert.ok(r.info.some((x) => /相对弱势/.test(x)) && r.info.some((x) => /反弹碰到 MA20/.test(x)));
  assert.equal(r.manual.length, SHORT_MANUAL.length);
});

test("short_vs_strength + short_no_relative_weakness on a strong uptrend that beats SPY and sector", () => {
  const up = mk(Array.from({ length: 76 }, (_, i) => 50 + i * 0.6));
  const r = shortEntryChecks(base({ bars: up, invalidationLevel: 100 }));
  assert.ok(r.tags.includes("short_vs_strength"));
  assert.ok(r.tags.includes("short_no_relative_weakness"));
  assert.ok(!r.tags.includes("short_chasing"));
});

test("relative weakness needs BOTH index and sector: lagging SPY but beating the sector still warns", () => {
  const falling = mk(Array.from({ length: 76 }, (_, i) => 300 - i * 2));
  const r = shortEntryChecks(base({ sectorBars: falling }));
  assert.ok(r.tags.includes("short_no_relative_weakness"));
  assert.match(r.details.join(), /板块 XLK/);
  assert.doesNotMatch(r.details.join(), /≥ SPY/);
});

test("short_chasing: big red day / below prior-day low / stretched under MA20", () => {
  const b = DOWN(); const last = b.at(-1)!; b[75] = { ...last, c: 93.5, l: 93.2, h: 97.4 }; // −3.9% day, below prior low, ~4 ATR under MA20
  const r = shortEntryChecks(base({ bars: b, invalidationLevel: 99 }));
  assert.ok(r.tags.includes("short_chasing"));
  const det = r.details.find((x) => x.includes("short_chasing"))!;
  assert.match(det, /今天已跌/); assert.match(det, /前日低点/); assert.match(det, /ATR/);
});

test("squeeze: OHLC proxy (+10% day) and missing written check; broad ETFs skip both", () => {
  const b = DOWN(); b[60] = { ...b[60]!, c: b[59]!.c * 1.12, h: b[59]!.c * 1.13 };
  const r = shortEntryChecks(base({ bars: b, squeezeCheck: "", netGamma: -5e8 }));
  assert.ok(r.tags.includes("short_squeeze_prone"));
  assert.ok(r.tags.includes("short_squeeze_risk_unchecked"));
  assert.match(r.details.join(), /负 gamma/);
  const etf = shortEntryChecks(base({ sym: "QQQ", bars: b, squeezeCheck: null, sectorSym: null }));
  assert.ok(!etf.tags.some((t) => /squeeze/.test(t)), etf.tags.join());
  assert.ok(!etf.tags.includes("short_data_insufficient"), "QQQ has no sector benchmark by design");
});

test("short_expiry_too_short: front DTE < horizon + 14, or time stop after expiry", () => {
  assert.ok(shortEntryChecks(base({ expirations: [d(85)] })).tags.includes("short_expiry_too_short"), "10 DTE < 7+14");
  assert.ok(!shortEntryChecks(base({ expirations: [d(97)] })).tags.includes("short_expiry_too_short"), "22 DTE ≥ 21");
  assert.ok(shortEntryChecks(base({ expirations: [d(97)], horizonDays: 20 })).tags.includes("short_expiry_too_short"), "22 < 20+14");
  assert.ok(shortEntryChecks(base({ timeStopAt: "2026-09-01" })).tags.includes("short_expiry_too_short"), "time stop after expiry");
});

test("short_invalidation_not_above_spot and short_data_insufficient", () => {
  assert.ok(shortEntryChecks(base({ invalidationLevel: 95 })).tags.includes("short_invalidation_not_above_spot"));
  const r = shortEntryChecks({ sym: "XYZ", bars: [] });
  assert.deepEqual(r.tags.filter((t) => t !== "short_squeeze_risk_unchecked"), ["short_data_insufficient"]);
  assert.match(r.details.join(), /趋势/); assert.match(r.details.join(), /SPY/); assert.match(r.details.join(), /板块/);
});

test("rules.json spec mirrors the code: same thresholds, same tag set, auto/manual flags present", () => {
  const spec = JSON.parse(readFileSync("knowledge/mentor/discipline/short-selling.rules.json", "utf8"));
  assert.deepEqual(spec.thresholds, { ...SHORT_LIMITS });
  const tags = spec.items.map((x: { tag: string | null }) => x.tag).filter(Boolean).sort();
  assert.deepEqual(tags, [...SHORT_TAGS].sort());
  for (const it of spec.items) assert.equal(typeof it.autoFromDailyOHLC, "boolean", it.id);
  assert.equal(spec.mode, "warn_only");
  const pts = new Set(spec.items.flatMap((x: { points: number[] }) => x.points));
  for (let p = 1; p <= 10; p++) assert.ok(pts.has(p), `article point ${p} covered`);
});

test("verbatim mentor text is byte-identical inside short-selling.md", () => {
  const md = readFileSync("knowledge/mentor/discipline/short-selling.md");
  const h = Buffer.from("## 大佬原文（verbatim）\n\n"), a = md.indexOf(h) + h.length, b = md.indexOf(Buffer.from("\n---\n\n## DK 整理"));
  const body = md.subarray(a, b);
  assert.ok(body.length === 2988 && body.includes(Buffer.from("空弱，不空强。")) && body.includes(Buffer.from("用权利金抵消做空利息。借刀杀人。")));
});

// --- wiring ---
const now = new Date("2026-07-16T14:00:00Z");
const prop = (legs: unknown[]) => ({ symbol: "XYZ", strategy: "put_debit_spread", asOf: "2026-07-16", underlyingPrice: 97.3, thesisHorizonDays: 10, capital: 50000, buyingPower: 20000, legs,
  checklist: { maxLoss: 140, maxProfit: 360, breakevens: [95.6], maxLossConditions: "XYZ ≥ 97 at expiry", beforeExpiryPlan: "close by 07-23" },
  discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, side: "short" } }) as never;
const SPREAD = [{ type: "put", strike: 97, qty: 1, premium: 2.0, expiration: "2026-07-24", bid: 1.9, ask: 2.1, openInterest: 5000 }, { type: "put", strike: 92, qty: -1, premium: 0.6, expiration: "2026-07-24", bid: 0.55, ask: 0.65, openInterest: 5000 }];
const CARD = { id: "card-x", sym: "XYZ", dir: "bear" as const, thesis: "叙事破了", invalidation: "收盘站上 101", trade: { invalidationLevel: 101, tpKind: "short_dated", mechanical: "30/30" } };
const CLEAN = { at: "x", objections: [], blocks: 0, warns: 0 };

test("paper open (practice, bearish): 做空清单 tags become warn tags and a shortChecklist snapshot; never a block", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  const r = paperOpen(j, prop(SPREAD), { kind: "practice", card: CARD, critique: CLEAN, now, short: { bars: DOWN(), spyBars: SPY, sectorSym: "XLK", sectorBars: SEC } });
  assert.ok(r.entry, r.refused.join("; "));
  assert.ok(r.entry!.warnTags!.includes("short_expiry_too_short"), "8 DTE < 10+14");
  assert.ok(r.entry!.warnTags!.includes("short_squeeze_risk_unchecked"));
  assert.ok(!r.entry!.warnTags!.includes("short_chasing") && !r.entry!.warnTags!.includes("short_no_relative_weakness"));
  assert.deepEqual(r.entry!.shortChecklist!.tags, ["short_squeeze_risk_unchecked", "short_expiry_too_short"]);
  assert.equal(r.entry!.shortChecklist!.manual.length, SHORT_MANUAL.length);
  const ok = paperOpen(j, prop(SPREAD), { kind: "practice", card: { ...CARD, squeezeCheck: "SI 2%" }, critique: CLEAN, now, short: { bars: DOWN(), spyBars: SPY, sectorSym: "XLK", sectorBars: SEC } });
  assert.ok(!ok.entry!.warnTags?.includes("short_squeeze_risk_unchecked"), "card squeeze note is used");
});

test("short stock, covered put and naked short options stay NOT enabled: refused even as practice", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  const open = (legs: unknown[]) => paperOpen(j, prop(legs), { kind: "practice", card: CARD, critique: CLEAN, now });
  const stock = open([{ type: "stock", strike: 97.3, qty: -10, premium: 97.3 }]);
  assert.equal(stock.entry, null); assert.match(stock.refused.join(), /做空股票（含 covered put）不启用/);
  const cp = open([{ type: "stock", strike: 97.3, qty: -100, premium: 97.3 }, { type: "put", strike: 92, qty: -1, premium: 0.6, expiration: "2026-08-21", bid: 0.55, ask: 0.65, openInterest: 5000 }]);
  assert.equal(cp.entry, null, "covered put");
  const np = open([{ type: "put", strike: 90, qty: -1, premium: 1, expiration: "2026-08-21", bid: 0.9, ask: 1.1, openInterest: 5000 }]);
  assert.equal(np.entry, null); assert.match(np.refused.join(), /裸卖 put/);
  assert.ok(open(SPREAD).entry, "a put debit spread (defined risk) is still fine");
});

test("plan card: bearish card gets §9 做空清单 + shortTags without changing the verdict; bullish card has none", () => {
  const EXP = "2026-07-24", q = (strike: number, bid: number, ask: number): Quote => ({ type: "put", strike, expiration: EXP, bid, ask, src: "t" });
  const ci = (o: Partial<CardInput>): CardInput => ({ now, sym: "XYZ", dir: "bear", exp: EXP, spot: 97.3, bars: DOWN(), levels: null, quotes: [q(97, 1.9, 2.1), q(96, 1.5, 1.6)],
    brief: { generatedAt: now.toISOString(), leader: null, verdict: "TRADE", plan: [] }, gex: null, calendar: [], earnings: [], journal: [], capital: 5000, thesis: "叙事破了", invalidation: "收盘站上 101",
    legs: [{ qty: 1, type: "put", strike: 97 }, { qty: -1, type: "put", strike: 96 }], ...o });
  const without = buildCard(ci({ dir: "bear", bars: [] })), withShort = buildCard(ci({ short: { spyBars: SPY, sectorSym: "XLK", sectorBars: SEC, squeezeCheck: "SI 2%" } }));
  const s9 = withShort.sections.find((s) => s.n === 9)!;
  assert.ok(s9 && withShort.shortTags!.includes("short_expiry_too_short"));
  assert.ok(withShort.warnTags!.includes("short_expiry_too_short"));
  assert.ok(s9.lines.some((l) => /手动清单/.test(l)));
  assert.equal(withShort.verdict, without.verdict, "short checklist never changes the verdict");
  assert.ok(without.shortTags!.includes("short_data_insufficient"));
  const bull = buildCard(ci({ dir: "bull", legs: undefined }));
  assert.equal(bull.sections.find((s) => s.n === 9), undefined); assert.equal(bull.shortTags, undefined);
});
