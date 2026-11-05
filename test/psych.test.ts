import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { psychEntryTags, profitableButWrong, confidenceRatio, etToIso, PSYCH_TAGS } from "../src/options/psych.ts";
import { paperOpen, paperClose, type PaperJournal } from "../src/options/paper.ts";
import { weeklyReport } from "../src/options/weekly.ts";
import { readiness } from "../src/options/readiness.ts";
import { tradeCard } from "../src/options/reviewreport.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const T = (o: Partial<JournalEntry>): JournalEntry => ({ id: "x", symbol: "NVDA", strategy: "call_debit_spread", mode: "paper", kind: "practice", source: "paper_sim", openedAt: "2026-10-15T14:00:00Z", maxLoss: 20, legs: [], ...o } as JournalEntry);
const tags = (e: JournalEntry, all: JournalEntry[], ctx = {}) => psychEntryTags(e, all, { capital: 5000, ...ctx }).tags;

test("72h rule: after earnings (am/pm) or a flagged event, not before, not after 72h", () => {
  const e = T({ openedAt: "2026-10-15T14:00:00Z" }); // 10:00 ET
  const pm = [{ symbol: "NVDA", date: "2026-10-14", timing: "pm", confirmed: true, source: "t" }];
  assert.ok(tags(e, [], { earnings: pm }).includes("warn_72h_event"));
  assert.ok(!tags(e, [], { earnings: [{ ...pm[0]!, date: "2026-10-11" }] }).includes("warn_72h_event"), "> 72h");
  assert.ok(!tags(e, [], { earnings: [{ ...pm[0]!, date: "2026-10-16" }] }).includes("warn_72h_event"), "future earnings");
  assert.ok(!tags(e, [], { earnings: [{ ...pm[0]!, symbol: "AMD" }] }).includes("warn_72h_event"), "other ticker");
  assert.ok(tags(e, [], { events: [{ at: "2026-10-13T18:00:00Z", symbol: null, title: "救市" }] }).includes("warn_72h_event"), "market-wide event");
  assert.equal(etToIso("2026-10-14", "16:05"), "2026-10-14T20:05:00.000Z"); assert.equal(etToIso("2026-12-14", "09:30"), "2026-12-14T14:30:00.000Z");
});
test("add to a loser: needs --confirm; second add warns; profit → pyramid must shrink", () => {
  const lose = T({ id: "a", openedAt: "2026-10-14T14:00:00Z", maxLoss: 20, marks: [{ at: "2026-10-14T20:00:00Z", value: 1, pnl: -8, spot: 1, sources: [] }] });
  const e = T({ id: "b", maxLoss: 20 });
  assert.ok(tags(e, [lose]).includes("warn_add_to_loser_unconfirmed"));
  assert.ok(!tags(e, [lose], { confirm: "收复 VWAP" }).includes("warn_add_to_loser_unconfirmed"));
  assert.ok(!tags(e, [lose], { confirm: "x" }).includes("warn_second_add_to_loser"));
  const add1 = T({ id: "c", openedAt: "2026-10-14T18:00:00Z", marks: [{ at: "2026-10-14T20:00:00Z", value: 1, pnl: -2, spot: 1, sources: [] }] });
  assert.ok(tags(e, [lose, add1], { confirm: "x" }).includes("warn_second_add_to_loser"));
  assert.ok(!tags(T({ id: "d", strategy: "long_put" }), [lose]).includes("warn_add_to_loser_unconfirmed"), "different structure");
  const win = T({ id: "w", openedAt: "2026-10-13T14:00:00Z", maxLoss: 20, marks: [{ at: "2026-10-14T20:00:00Z", value: 1, pnl: 9, spot: 1, sources: [] }] });
  assert.ok(tags(T({ id: "p", maxLoss: 30 }), [win]).includes("warn_pyramid_add_larger"));
  assert.ok(!tags(T({ id: "p", maxLoss: 10 }), [win]).includes("warn_pyramid_add_larger"));
});
test("win streak / big win day → shrink size; day after a big win", () => {
  const w = (i: number, pnl: number, day: string) => T({ id: `w${i}`, symbol: "SPY", maxLoss: 20, openedAt: `${day}T14:00:00Z`, closedAt: `${day}T19:00:00Z`, pnl, commissions: 0 });
  const three = [w(1, 5, "2026-10-08"), w(2, 5, "2026-10-09"), w(3, 5, "2026-10-12")];
  assert.ok(tags(T({ id: "n", maxLoss: 40 }), three).includes("warn_size_up_after_wins"));
  assert.ok(!tags(T({ id: "n", maxLoss: 20 }), three).includes("warn_size_up_after_wins"), "same size ok");
  assert.ok(!tags(T({ id: "n", maxLoss: 40 }), three.slice(0, 2)).includes("warn_size_up_after_wins"), "2 wins only");
  const big = [w(4, 60, "2026-10-14")]; // ≥1% of 5000
  assert.ok(tags(T({ id: "n", maxLoss: 20 }), big).includes("warn_day_after_big_win"));
  assert.ok(!tags(T({ id: "n" }), [w(5, 20, "2026-10-14")]).includes("warn_day_after_big_win"));
});
test("entry window, put strike vs target / 1 SD, ticker magnetism; mentor shadow untouched", () => {
  assert.ok(tags(T({ openedAt: "2026-10-15T17:00:00Z" }), []).includes("info_midday_entry")); // 13:00 ET
  assert.ok(!tags(T({ openedAt: "2026-10-15T13:45:00Z" }), []).includes("info_midday_entry")); // 09:45 ET
  assert.ok(!tags(T({ openedAt: "2026-10-15T19:30:00Z" }), []).includes("info_midday_entry")); // 15:30 ET
  const put = (k: number, o: Partial<JournalEntry> = {}) => T({ strategy: "long_put", underlyingAtEntry: 100, legs: [{ type: "put", strike: k, qty: 1, premium: 0.5, expiration: "2026-10-22", iv: 0.3 }], ...o });
  assert.ok(tags(put(90), [], { target: 95 }).includes("warn_put_strike_unrealistic"));
  assert.ok(!tags(put(95), [], { target: 95 }).includes("warn_put_strike_unrealistic"));
  assert.ok(tags(put(88), []).includes("warn_put_strike_unrealistic"), "7 DTE 1SD ≈ 95.8");
  assert.ok(!tags(put(97), []).includes("warn_put_strike_unrealistic"));
  assert.ok(!tags(put(88, { thesis: "彩票单" }), []).includes("warn_put_strike_unrealistic"));
  const turned = T({ id: "t", symbol: "TSLA", openedAt: "2026-10-01T14:00:00Z", closedAt: "2026-10-03T19:00:00Z", pnl: -10, commissions: 0, marks: [{ at: "2026-10-02T15:00:00Z", value: 1, pnl: 15, spot: 1, sources: [] }] });
  const re1 = T({ id: "r1", symbol: "TSLA", openedAt: "2026-10-06T14:00:00Z", closedAt: "2026-10-07T19:00:00Z", pnl: -5, commissions: 0 });
  assert.ok(!tags(T({ id: "r", symbol: "TSLA" }), [turned]).includes("info_ticker_magnetism"), "first re-entry");
  assert.ok(tags(T({ id: "r", symbol: "TSLA" }), [turned, re1]).includes("info_ticker_magnetism"));
  assert.deepEqual(tags(T({ source: "mentor_shadow", openedAt: "2026-10-15T17:00:00Z" }), []), []);
  for (const t of PSYCH_TAGS) assert.match(t, /^(warn|info)_/);
});
test("paperOpen practice: psych tags become warn tags (never a block); formal records psychTags only", () => {
  const now = new Date("2026-10-15T17:00:00Z");
  const p = { symbol: "INTC", strategy: "long_put", asOf: "2026-10-15", underlyingPrice: 32, thesisHorizonDays: 20, capital: 5000, buyingPower: 20000,
    legs: [{ type: "put", strike: 31, qty: 1, premium: 0.5, expiration: "2026-11-20", openInterest: 5000, bid: 0.49, ask: 0.51 }],
    discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 50, entryRange: { low: 31, high: 33 }, side: "short" } } as never;
  const CARD = { id: "card-1", sym: "INTC", dir: "bear" as const, thesis: "capex slowdown", trade: { mechanical: "30/30", invalidationLevel: 35, tpKind: "narrative" } };
  const j: PaperJournal = { capital: 5000, entries: [] };
  const r = paperOpen(j, p, { now, kind: "practice", card: CARD, critique: { at: "x", objections: [], blocks: 0, warns: 0 },
    psych: { earnings: [{ symbol: "INTC", date: "2026-10-14", timing: "pm", confirmed: true, source: "t" }], target: 31.5 } });
  assert.ok(r.entry, r.refused.join("|"));
  for (const t of ["warn_72h_event", "info_midday_entry", "warn_put_strike_unrealistic"]) assert.ok(r.entry!.warnTags!.includes(t), `${t} in ${r.entry!.warnTags}`);
  assert.deepEqual(r.entry!.psychTags!.sort(), ["info_midday_entry", "warn_72h_event", "warn_put_strike_unrealistic"]);
  assert.equal(r.entry!.priceTarget, 31.5);
  assert.ok(r.entry!.warnDetails!.some((d) => /心理·warn_72h_event/.test(d)));
});
test("loss classes risk/variance; journal + profitable-but-wrong; confidence ratio; review + weekly sections", () => {
  const open = T({ id: "o", marks: [{ at: "2026-10-15T19:00:00Z", value: 1, pnl: -10, spot: 1, sources: [] }] });
  assert.match(paperClose(open, { exitKind: "max_loss", errorClass: "luck" as never, errorTags: ["x"], now: new Date("2026-10-15T20:00:00Z") }).refused.join(), /judgment.*variance/);
  const v = paperClose(open, { exitKind: "max_loss", errorClass: "variance", errorTags: ["normal_variance"], now: new Date("2026-10-15T20:00:00Z") }).entry!;
  assert.equal(v.lossReview!.errorClass, "variance");
  const c = (id: string, pnl: number, o: Partial<JournalEntry> = {}) => T({ id, closedAt: "2026-10-15T19:00:00Z", pnl, commissions: 0, ...o });
  const good = c("g", 10), lucky = c("l", 10, { warnTags: ["warn_over_cap"] }), judged = c("j", -10, { lossReview: { at: "x", errorClass: "judgment", errorTags: ["late_entry"] } });
  const risk = c("r", -10, { lossReview: { at: "x", errorClass: "risk", errorTags: ["oversized"] } }), varl = c("v", -10, { lossReview: { at: "x", errorClass: "variance", errorTags: [] } });
  assert.deepEqual(profitableButWrong(lucky), { flag: true, by: "auto", why: "盈利但带着 warn_over_cap（候选，复盘时确认）" });
  assert.equal(profitableButWrong({ ...lucky, profitableButWrong: false }).flag, false);
  assert.equal(profitableButWrong(c("i", 10, { warnTags: ["info_midday_entry"] })).flag, false, "info tags do not make a candidate");
  const E = [good, lucky, judged, risk, varl, c("m", 10, { source: "mentor_shadow", violations: ["exceeds_1pct_cap"] })];
  const cr = confidenceRatio(E, "2026-10-09", "2026-10-15");
  assert.deepEqual([cr.successes, cr.failures, cr.ratio], [2, 3, 0.67]);
  const card = tradeCard({ ...lucky, tradeJournal: { at: "x", why: "突破", redo: "等确认" } }, E).join("\n");
  assert.match(card, /交易日记：我为什么入场？ 突破/); assert.match(card, /未答：/); assert.match(card, /赚钱但做错/); assert.match(card, /焦虑\/睡不着/);
  assert.match(tradeCard(risk, E).join("\n"), /risk（风险管理错）/);
  const w = weeklyReport({ entries: E, capital: 5000, from: "2026-10-09", to: "2026-10-15", readiness: readiness({ journal: E, capital: 5000, shockDates: [] }) });
  assert.match(w.md, /八之四、交易信心/); assert.match(w.md, /本周：2 \/ 3 = 0\.67/);
  const rd = readiness({ journal: E.map((e) => ({ ...e, kind: "formal" as const })), capital: 5000, shockDates: [] });
  assert.match(rd.criteria.find((x) => x.id === "loss_review")!.detail.join(), /风险管理 1 \/ 正常波动 1/);
});

// ---------- verbatim storage of the psychology batch ----------
const DIR = new URL("../knowledge/mentor/psychology/", import.meta.url);
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const M = JSON.parse(readFileSync(new URL("manifest.json", DIR), "utf8")) as { sources: Record<string, { redactedSha256: string; rawSha256: string; rawBytes: number }>; segments: Array<{ source: string; lines: [number, number]; topic: string; file: string; sha256: string }>; images: Record<string, { bytes: number; sha256: string; file: string }>; nonVerbatim: string[] };
test("psychology: verbatim segments rebuild the redacted sources byte-exact, full contiguous coverage", () => {
  const blocks = new Map<string, string>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".md"))) {
    const s = readFileSync(new URL(f, DIR), "utf8");
    for (const m of s.matchAll(/<!-- verbatim (\S+) L(\d+)-L(\d+) sha256=([0-9a-f]{16}) -->\n([\s\S]*?)\n<!-- \/verbatim -->/g)) {
      assert.equal(sha(m[5]!).slice(0, 16), m[4], `${f} ${m[1]} L${m[2]}`); blocks.set(`${m[1]}:${m[2]}:${m[3]}:${f}`, m[5]!);
    }
  }
  for (const [src, meta] of Object.entries(M.sources)) {
    const segs = M.segments.filter((s) => s.source === src);
    let next = 1; const texts: string[] = [];
    for (const s of segs) {
      assert.equal(s.lines[0], next, `${src} gap before L${s.lines[0]}`); next = s.lines[1] + 1;
      const t = blocks.get(`${src}:${s.lines[0]}:${s.lines[1]}:${s.file}`); assert.ok(t != null, `${src} L${s.lines[0]} missing in ${s.file}`);
      assert.equal(sha(t!), s.sha256); texts.push(t!);
    }
    const red = texts.join("\n");
    assert.equal(sha(red), meta.redactedSha256, `${src} rebuild`);
    assert.equal(blocks.size >= segs.length, true);
    if (existsSync(`/workspace/mentor-inbox/${src}`)) { // optional: the raw inbox file (not in the repo)
      const raw = readFileSync(`/workspace/mentor-inbox/${src}`, "utf8");
      assert.equal(sha(raw), meta.rawSha256); assert.equal(red, raw.replaceAll("夜雨", "[导师]").replaceAll("@madao", "[群友]"));
    }
  }
  assert.equal(blocks.size, M.segments.length, "no extra verbatim blocks");
  const all = [...blocks.values()].join("\n");
  assert.match(all, /^【来源说明/m); assert.match(all, /【缺失/); assert.match(all, /youtu/i); assert.match(all, /1drv\.ms|onedrive/i);
});
test("psychology: no author names; images ≤400 KB, hashed and referenced; video summary marked non-verbatim", () => {
  for (const f of readdirSync(DIR).filter((x) => !statSync(new URL(x, DIR)).isDirectory())) {
    const s = readFileSync(new URL(f, DIR), "utf8"); assert.ok(!/夜雨|@madao|madao/.test(s), f);
  }
  for (const [img, m] of Object.entries(M.images)) {
    const b = readFileSync(new URL(`assets/${img}`, DIR)); assert.ok(b.length <= 400 * 1024, img); assert.equal(sha(b), m.sha256);
    assert.ok(readFileSync(new URL(m.file, DIR), "utf8").includes(`assets/${img}`), `${img} referenced in ${m.file}`);
  }
  assert.equal(Object.keys(M.images).length, 7);
  const v = readFileSync(new URL("video-the-trading-game.md", DIR), "utf8");
  assert.match(v, /不是逐字稿/); assert.ok(!/<!-- verbatim /.test(v));
  for (const f of ["stop-loss-and-ownership.md", "patience-and-overtrading.md", "position-sizing-after-wins.md"]) assert.match(readFileSync(new URL(f, DIR), "utf8"), /video-the-trading-game\.md/, f);
  const cat = JSON.parse(readFileSync(new URL("../knowledge/catalog.json", import.meta.url), "utf8")) as { sources: Array<{ id: string }>; items: Array<{ id: string; sources: string[] }> };
  for (const id of ["mentor-psych-batch", "mentor-video-trading-game"]) assert.ok(cat.sources.some((s) => s.id === id), id);
  for (const id of ["psych-72-hours", "psych-ticker", "psych-loss-attribution", "psych-realized-profit-redeployment", "psych-entry-warn-tags"]) assert.ok(cat.items.find((i) => i.id === id)!.sources.includes("mentor-psych-batch"), id);
});

test("72h rule fires off the official FOMC / CPI / NFP calendar (tracked fallback)", async () => {
  const { loadMajorEvents } = await import("../src/options/majorEvents.ts");
  const { events, from } = loadMajorEvents("/nonexistent/major-events.json");
  assert.equal(from, "knowledge/calendar/major-events-2026-2027.json");
  const n = (s: string) => events.filter((e) => e.series === s).length;
  assert.deepEqual([n("FOMC"), n("CPI"), n("NFP")], [10, 14, 14]);
  for (const e of events) { assert.match(e.source!, /^https:\/\/www\.(federalreserve|bls)\.gov\//); assert.equal(e.timeET, e.series === "FOMC" ? "14:00" : "08:30"); }
  const at = (iso: string) => psychEntryTags(T({ symbol: "SPY", openedAt: iso }), [], { capital: 5000, events }).details.join();
  assert.match(at("2026-10-29T14:00:00Z"), /FOMC 利率决议.*之后 20 小时/); // FOMC 2026-10-28 14:00 EDT
  assert.match(at("2026-11-10T20:00:00Z"), /CPI（October 2026）/);      // CPI 08:30 EST = 13:30Z
  assert.match(at("2026-11-07T15:00:00Z"), /非农就业/);                  // NFP 2026-11-06
  assert.doesNotMatch(at("2026-11-02T15:00:00Z"), /warn_72h_event/);      // > 72h after FOMC, before NFP
  assert.doesNotMatch(at("2026-10-28T17:59:00Z"), /warn_72h_event/);      // one minute before the decision
});
