import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket, alarmItems } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief, briefVerdict } from "../src/macro/brief.ts";
import { assembleBriefWatch } from "../src/macro/briefWatch.ts";
import { buildFixedWatchlist, type OasReading } from "../src/macro/fixedWatchlist.ts";
import { vixBackwardationAlarm } from "../src/macro/premarket.ts";
import { buildOilVix } from "../src/macro/oilvix.ts";
import { lastUsCashSession, quoteStamp, sessionOf } from "../src/macro/quoteMeta.ts";
import type { Obs } from "../src/macro/fetch.ts";

const s = (pct: number, a = "2026-11-05", b = "2026-11-06"): Obs[] => [{ t: a, v: 100 }, { t: b, v: 100 * (1 + pct / 100) }];
const D = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, s(v)]));
const sunday = new Date("2026-11-08T18:00:00Z"); // Sunday 13:00 ET
const monday = new Date("2026-11-09T14:00:00Z"); // Monday 09:00 ET

function parts(now: Date) {
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now);
  const pm = buildPremarket({ now, data: {}, calendar: [], earnings: null, headlines: [] });
  const sc = buildScenarios({ now, data: {}, calendar: [] });
  return { macro, pm, sc };
}

test("quote stamps: US cash Friday bar is not stale on Sunday, but it is not a new session; KOSPI is a different session", () => {
  assert.equal(lastUsCashSession(sunday), "2026-11-06");
  const spy = quoteStamp("SPY", s(1), sunday);
  assert.equal(spy.asOf, "2026-11-06");
  assert.equal(spy.session, "美股现金");
  assert.equal(spy.source, "yahoo");
  assert.equal(spy.stale, false);
  assert.equal(quoteStamp("SPY", s(1, "2026-11-04", "2026-11-05"), sunday).stale, true);
  assert.equal(sessionOf("KOSPI"), "韩国现金");
  assert.equal(quoteStamp("KOSPI", [{ t: "2026-11-09", v: 1 }], sunday).session, "韩国现金未收盘", "Seoul Monday bar on Sunday ET is not a completed close");
  assert.notEqual(sessionOf("KOSPI"), sessionOf("SMH"));
  assert.notEqual(sessionOf("KOSPI"), sessionOf("EWY"));
  assert.equal(quoteStamp("VIX", undefined, sunday).stale, true);
});

test("weekend VIX backwardation stays an alarm but is not a new realtime event", () => {
  const data: Record<string, Obs[]> = {
    VIX: [{ t: "2026-11-05", v: 18 }, { t: "2026-11-06", v: 24 }],
    VIX3M: [{ t: "2026-11-05", v: 20 }, { t: "2026-11-06", v: 20 }],
  };
  const sun = buildPremarket({ now: sunday, data, calendar: [], earnings: null, headlines: [] });
  const alarm = sun.alarms.find((a) => a.kind === "VIX_BACKWARDATION");
  assert.ok(alarm);
  assert.equal(alarm!.live, false);
  assert.equal(alarm!.observedOn, "2026-11-06");
  assert.match(sun.md, /不是 2026-11-08 的新实时风险事件/);
  assert.match(sun.md, /source=yahoo asOf=2026-11-06 session=美股现金\/CBOE stale=false/);
  assert.ok(sun.noTrade.some((x) => /VIX_BACKWARDATION/.test(x)), "NO_TRADE still sees the carried alarm");
  const item = alarmItems([alarm!], sunday)[0]!;
  assert.match(item.url, /2026-11-06/);
  assert.doesNotMatch(item.url, /2026-11-08/);
  assert.match(item.guid, /^premarket:2026-11-06:VIX_BACKWARDATION$/);
  assert.match(item.title, /^\[收盘 2026-11-06\]/);

  const week = buildPremarket({ now: monday, data, calendar: [], earnings: null, headlines: [] });
  const live = week.alarms.find((a) => a.kind === "VIX_BACKWARDATION")!;
  assert.equal(live.live, true);
  assert.match(alarmItems([live], monday)[0]!.url, /2026-11-09/);
  assert.match(alarmItems([live], monday)[0]!.title, /^\[盘前 2026-11-09\]/);
});

test("VIX and VIX3M on different dates do not fire a backwardation alarm", () => {
  const data: Record<string, Obs[]> = {
    VIX: [{ t: "2026-11-05", v: 18 }, { t: "2026-11-06", v: 24 }],
    VIX3M: [{ t: "2026-11-04", v: 20 }, { t: "2026-11-05", v: 20 }],
  };
  const r = buildPremarket({ now: monday, data, calendar: [], earnings: null, headlines: [] });
  assert.ok(!r.alarms.some((a) => a.kind === "VIX_BACKWARDATION"));
  assert.match(r.md, /不是同一时点/);
  assert.ok(!r.noTrade.some((x) => /VIX_BACKWARDATION/.test(x)));
});

test("KOSPI vs US semis print separate sessions and do not claim one timestamp", () => {
  const data: Record<string, Obs[]> = {
    KOSPI: [{ t: "2026-11-06", v: 100 }, { t: "2026-11-09", v: 97 }],
    EWY: s(-1),
    SMH: s(1),
    SOX: s(1),
  };
  const r = buildPremarket({ now: monday, data, calendar: [], earnings: null, headlines: [] });
  assert.match(r.md, /KOSPI -3\.00%（source=yahoo asOf=2026-11-09 session=韩国现金/);
  assert.match(r.md, /SMH \+1\.00%（source=yahoo asOf=2026-11-06 session=美股现金/);
  assert.match(r.md, /EWY 是美股上市的韩国 ETF/);
  assert.match(r.md, /不是同一时点的同步背离/);
  assert.ok(!r.noTrade.some((x) => /背离|KOSPI/.test(x)));
});

test("oil down alone is not a demand recession", () => {
  const S = (d5: number): Obs[] => {
    const end = 100, p5 = end / (1 + d5 / 100);
    return [90, 91, p5, p5, p5, p5, p5, end].map((v, i) => ({ t: `2026-10-${String(8 + i).padStart(2, "0")}`, v }));
  };
  const r = buildOilVix({ WTI: S(-4), BRENT: S(-4), SPX: S(0.2), NDX: S(0.2), VIX: S(1) });
  const md = r.lines.oil.join("\n");
  assert.notEqual(r.driver, "demand_weak");
  assert.match(md, /仅油价下跌不能判断需求衰退/);
  assert.doesNotMatch(md, /衰退迹象/);
});

test("fund flow: missing OAS and volume do not invent spread widening or 放量; duration zeros the HYG vote", () => {
  const now = new Date("2026-11-06T21:00:00Z"); // Friday 16:00 ET
  const empty = buildFixedWatchlist({}, { now });
  const emptyMd = [...empty.watchLines, ...empty.flowLines].join("\n");
  assert.match(emptyMd, /source=yahoo asOf=n\/a session=/);
  assert.match(emptyMd, /stale=true/);
  assert.match(emptyMd, /不写成放大/);
  assert.doesNotMatch(emptyMd, /放量/);
  assert.match(emptyMd, /不写信用利差扩大/);
  assert.doesNotMatch(emptyMd, /利差走阔/);

  const dur = buildFixedWatchlist(D({ SPY: 0, RSP: 0, IWM: 0, SMH: 0, XLU: 0, XLY: 0, XLP: 0, HYG: 0.5, TLT: -1.5, SHY: -0.2, GLD: 0.1 }), { now });
  assert.equal(dur.label, "混乱并列");
  assert.equal(dur.votes.find((v) => v.id === "HYG vs TLT/GLD")!.vote, 0);
  assert.match(dur.flowLines.join("\n"), /久期\/利率干扰/);
  assert.doesNotMatch(dur.flowLines.join("\n"), /利差走阔/);

  const clean = buildFixedWatchlist(D({ SPY: 0.1, RSP: 0.1, IWM: 0.1, SMH: 0.1, XLU: 0.1, XLY: 0.1, XLP: 0.1, HYG: 1, TLT: -1, GLD: -1, SHY: 0.05 }), { now, rates1dBp: 1 });
  assert.equal(clean.votes.find((v) => v.id === "HYG vs TLT/GLD")!.vote, 1);
  assert.doesNotMatch(clean.flowLines.join("\n"), /久期\/利率干扰/);

  const oas: OasReading = { source: "fred", asOf: "2026-11-06", session: "FRED发布", stale: false, last: 3.4, chg20Bp: 40 };
  const wide = buildFixedWatchlist(D({ HYG: 0, TLT: 0, GLD: 0, SHY: 0, SPY: 0, SMH: 1, XLU: -1, XLY: 1, XLP: -1, RSP: 1, IWM: 1 }), { now, oas });
  assert.match(wide.flowLines.join("\n"), /source=fred asOf=2026-11-06 session=FRED发布 stale=false/);
  assert.match(wide.flowLines.join("\n"), /利差走阔/);
});

test("production seam: assembleBriefWatch output is what buildBrief renders, and the CLI calls it", () => {
  assert.match(readFileSync("src/cli/brief.ts", "utf8"), /assembleBriefWatch\(/);
  const now = sunday;
  const series = { ...D({ SPY: 0.4, QQQ: 0.2, SMH: 1.2, XLE: -0.4, XLF: 0.1, XLU: -0.8, XLY: 1, XLP: -0.5, RSP: 0.6, IWM: 0.2, HYG: 0.1, TLT: -0.4, GLD: 0.2, SHY: -0.05 }), UST10Y: [{ t: "2026-11-05", v: 4.2 }, { t: "2026-11-06", v: 4.32 }] };
  const fw = assembleBriefWatch(series, { now, oas: null });
  assert.equal(fw.label, "偏进攻");
  assert.match(fw.flowLines.join("\n"), /久期\/利率干扰/);
  assert.match(fw.watchLines.join("\n"), /运行日不是美股交易日/);
  assert.match(fw.watchLines.join("\n"), /source=yahoo asOf=2026-11-06 session=美股现金 stale=false/);
  const before = briefVerdict(parts(now));
  const rendered = buildBrief({ now, ...parts(now), calendar: [], fixedWatchLines: fw.watchLines, fundFlowLines: fw.flowLines });
  const w = rendered.md.indexOf("## 【宏观盯盘】"), f = rendered.md.indexOf("## 【资金流】"), a = rendered.md.indexOf("## 2. 警报");
  assert.ok(w > 0 && f > w && a > f);
  assert.match(rendered.md.slice(w, a), /source=yahoo/);
  assert.match(rendered.md.slice(w, a), /不写信用利差扩大/);
  assert.match(rendered.md.slice(w, a), /VIX\/VIX3M 数据不足，不触发降级/);
  assert.deepEqual(briefVerdict(parts(now)), before);
});

test("credit or VIX stress downgrades 偏进攻 to 混乱并列; missing, stale, or misaligned data does not; 偏防守 stays", () => {
  const now = new Date("2026-11-06T21:00:00Z"); // Friday 16:00 ET
  const OFF = D({ SPY: 1, RSP: 1.6, IWM: 2, SMH: 3, XLE: 0.5, XLF: 1.2, XLU: -0.5, XLY: 1.5, XLP: -0.3, HYG: 0.4, TLT: -0.8, GLD: -0.5 });
  const DEF = D({ SPY: -0.5, RSP: -1, IWM: -1.8, SMH: -2.5, XLE: -0.2, XLF: -1, XLU: 1, XLY: -1.2, XLP: 0.6, HYG: -0.4, TLT: 0.9, GLD: 1.1 });
  const MIX = D({ SPY: 1, RSP: 0, IWM: -0.5, SMH: 2, XLE: 0, XLF: 0.3, XLU: -0.5, XLY: 1, XLP: 0, HYG: 0, TLT: 1, GLD: 1.5 });
  const oas = (chg20Bp: number, stale = false): OasReading => ({ source: "fred", asOf: "2026-11-06", session: "FRED发布", stale, last: 3.48, chg20Bp });
  const term = (vix: number, v3: number, a = "2026-11-05", b = "2026-11-06") => ({
    VIX: [{ t: a, v: vix }, { t: b, v: vix }],
    VIX3M: [{ t: a, v: v3 }, { t: b, v: v3 }],
  });
  const line = (r: ReturnType<typeof buildFixedWatchlist>) => r.flowLines.join("\n");

  assert.equal(vixBackwardationAlarm(1, true), true);
  assert.equal(vixBackwardationAlarm(1, false), false);
  assert.equal(vixBackwardationAlarm(0.999, true), false);

  const plain = buildFixedWatchlist(OFF, { now });
  assert.equal(plain.label, "偏进攻");
  assert.match(line(plain), /OAS 数据不足（缺 OAS），不触发降级/);
  assert.match(line(plain), /VIX\/VIX3M 数据不足，不触发降级/);
  assert.doesNotMatch(line(plain), /降为混乱并列/);

  const widen = buildFixedWatchlist(OFF, { now, oas: oas(31) });
  assert.equal(widen.label, "混乱并列");
  assert.match(line(widen), /信用\/波动率示警，偏进攻降为混乱并列（OAS）/);
  assert.match(line(widen), /source=fred asOf=2026-11-06 session=FRED发布 stale=false/);
  assert.match(line(widen), /利差走阔/);
  assert.doesNotMatch(line(widen), /OAS 与 VIX/);
  assert.equal(buildFixedWatchlist(OFF, { now, oas: oas(30) }).label, "偏进攻", "30bp is not widening; the bar is chg20 > 30");

  const back = buildFixedWatchlist({ ...OFF, ...term(20, 20) }, { now });
  assert.equal(back.label, "混乱并列", "ratio exactly 1 uses the VIX_BACKWARDATION alarm");
  assert.match(line(back), /信用\/波动率示警，偏进攻降为混乱并列（VIX）/);
  assert.match(line(back), /source=yahoo asOf=2026-11-06 session=美股现金\/CBOE stale=false/);
  assert.match(line(back), /OAS 数据不足/);

  const both = buildFixedWatchlist({ ...OFF, ...term(24, 20) }, { now, oas: oas(40) });
  assert.equal(both.label, "混乱并列");
  assert.match(line(both), /信用\/波动率示警，偏进攻降为混乱并列（OAS 与 VIX）/);

  const staleOas = buildFixedWatchlist({ ...OFF, ...term(24, 20, "2026-11-03", "2026-11-04") }, { now, oas: oas(80, true) });
  assert.equal(staleOas.label, "偏进攻");
  assert.match(line(staleOas), /OAS 数据不足（已过期/);
  assert.match(line(staleOas), /VIX\/VIX3M 数据不足（stale/);
  assert.doesNotMatch(line(staleOas), /降为混乱并列/);
  assert.doesNotMatch(line(staleOas), /利差走阔/);

  const skew = buildFixedWatchlist({
    ...OFF,
    VIX: [{ t: "2026-11-05", v: 20 }, { t: "2026-11-06", v: 24 }],
    VIX3M: [{ t: "2026-11-04", v: 18 }, { t: "2026-11-05", v: 20 }],
  }, { now, oas: oas(10) });
  assert.equal(skew.label, "偏进攻");
  assert.match(line(skew), /日期错位/);
  assert.match(line(skew), /数据不足，不触发降级/);
  assert.doesNotMatch(line(skew), /降为混乱并列/);

  const guard = buildFixedWatchlist({ ...DEF, ...term(24, 20) }, { now, oas: oas(40) });
  assert.equal(guard.label, "偏防守");
  assert.match(line(guard), /偏防守不受影响/);
  assert.doesNotMatch(line(guard), /降为混乱并列/);

  const already = buildFixedWatchlist({ ...MIX, ...term(24, 20) }, { now, oas: oas(40) });
  assert.equal(already.label, "混乱并列");
  assert.match(line(already), /结论已是混乱并列，不改/);
  assert.doesNotMatch(line(already), /降为混乱并列/);
});
