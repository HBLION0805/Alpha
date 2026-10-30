import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { RULES, TAG_RULE, mentorForTags, selectReminders, reminderSection, lossPrompt, renderLossPrompt, pickQuote, type ReminderState } from "../src/review/mentor.ts";
import { PSYCH_TAGS } from "../src/options/psych.ts";
import { renderCard, type Card } from "../src/review/card.ts";
import { paperClose } from "../src/options/paper.ts";
import { tradeCard } from "../src/options/reviewreport.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief } from "../src/macro/brief.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const root = new URL("../", import.meta.url);
const T = (o: Partial<JournalEntry>): JournalEntry => ({ id: "x", symbol: "SPY", strategy: "call_debit_spread", mode: "paper", kind: "practice", source: "paper_sim", openedAt: "2026-10-14T14:00:00Z", maxLoss: 20, legs: [], ...o } as JournalEntry);
const now = new Date("2026-10-19T11:30:00Z"); // Mon 07:30 ET
const S = (o: Partial<ReminderState> = {}): ReminderState => ({ now, verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: [], capital: 5000, ...o });
const ids = (s: ReminderState) => selectReminders(s).map((r) => r.id);

test("every mentor quote is verbatim inside the mentor's original text (not the DK sections)", () => {
  for (const r of Object.values(RULES)) for (const q of r.quotes) {
    const f = readFileSync(new URL(q.file, root), "utf8");
    if (q.file.includes("/psychology/")) {
      const blocks = [...f.matchAll(/<!-- verbatim [^\n]* -->\n([\s\S]*?)\n<!-- \/verbatim -->/g)].map((m) => m[1]!);
      assert.ok(blocks.some((b) => b.includes(q.text)), `${r.id}: ${q.text}`);
    } else {
      const i = f.indexOf(q.text), dk = f.search(/^## DK/m); assert.ok(i >= 0 && (dk < 0 || i < dk), `${r.id}: ${q.text}`);
    }
  }
  for (const t of [...PSYCH_TAGS, "warn_sin_wrath", "warn_sin_gluttony", "warn_sin_greed", "short_vs_strength", "short_chasing", "short_squeeze_prone", "short_expiry_too_short", "warn_over_cap", "warn_far_otm", "warn_off_plan"])
    assert.ok(RULES[TAG_RULE[t]!], t);
});
test("tags → rule name + verbatim quote + topic link; unknown tags say so instead of guessing", () => {
  const L = mentorForTags(["warn_72h_event", "warn_size_up_after_wins", "warn_day_after_big_win", "warn_mystery"], now);
  assert.equal(L.length, 3, "two pride tags share one line");
  assert.match(L[0]!, /`warn_72h_event` → \*\*72 小时原则\*\*：.*「.+」 → \[psychology\/narrative-and-news\.md\]\(knowledge\/mentor\/psychology\/narrative-and-news\.md\)/);
  assert.match(L[1]!, /`warn_size_up_after_wins` `warn_day_after_big_win` → \*\*骄兵必败/);
  assert.match(L[2]!, /`warn_mystery`：没有对应的导师原文/);
  const card: Card = { id: "c1", createdAt: now.toISOString(), sym: "NVDA", dir: "bear", verdict: "practice_warn", verdictText: "🟢 可练习（有提示）", failing: ["最大亏损 $80 超限"], warnTags: ["warn_over_cap"], shortTags: ["short_vs_strength"], sections: [], trade: {} as never } as Card;
  const md = renderCard(card, 100, "2026-11-20");
  assert.match(md, /导师怎么说/); assert.match(md, /\*\*仓位太大\*\*/); assert.match(md, /\*\*做空：柿子挑软的捏\*\*/);
  assert.doesNotMatch(renderCard({ ...card, warnTags: [], shortTags: [] }, 100, null), /导师怎么说/);
});
test("brief reminders: each trigger from real state; priority, cap 3, deterministic, rotating, no repeated quote", () => {
  assert.deepEqual(ids(S()), []);
  assert.deepEqual(ids(S({ events: [{ at: "2026-10-21T12:30:00Z", symbol: null, title: "CPI" }] })), ["rule_72h"]);
  assert.deepEqual(ids(S({ events: [{ at: "2026-10-23T12:30:00Z", symbol: null, title: "CPI" }] })), [], "> 72h ahead");
  const w = (i: number, pnl: number, d: string) => T({ id: `w${i}`, openedAt: `${d}T14:00:00Z`, closedAt: `${d}T19:00:00Z`, pnl, commissions: 0 });
  assert.deepEqual(ids(S({ journal: [w(1, 5, "2026-10-13"), w(2, 5, "2026-10-14"), w(3, 5, "2026-10-15")] })), ["pride_after_wins"]);
  assert.deepEqual(ids(S({ journal: [w(1, 60, "2026-10-16")] })), ["pride_after_wins"], "≥1% day");
  assert.deepEqual(ids(S({ journal: [w(1, -120, "2026-10-16")] })), ["wrath_stop"], "−2% day");
  assert.deepEqual(ids(S({ journal: [w(1, -120, "2026-10-09")] })), [], "breach too old");
  assert.deepEqual(ids(S({ previousLeader: "base", leader: "melt_up" })), ["chart_logic"]);
  assert.deepEqual(ids(S({ previousRegime: "RISK_ON", regime: "RISK_OFF" })), ["chart_logic"]);
  assert.deepEqual(ids(S({ leader: "hawkish", previousLeader: "hawkish" })), ["short_soft"]);
  assert.deepEqual(ids(S({ verdict: "NO_TRADE" })), ["patience"]);
  const sloth = [T({ id: "s1", closedAt: "2026-10-15T19:00:00Z", pnl: 3, commissions: 0, violations: ["no_pre_written_plan"] }), T({ id: "s2", closedAt: "2026-10-16T19:00:00Z", pnl: 3, commissions: 0, violations: ["no_pre_written_plan"] })];
  assert.deepEqual(ids(S({ journal: sloth })), ["sin_sloth"]);
  const all = S({ verdict: "NO_TRADE", leader: "hawkish", previousLeader: "base", events: [{ at: "2026-10-20T18:00:00Z", symbol: null, title: "FOMC" }], journal: [w(1, -120, "2026-10-16")] });
  const r = selectReminders(all);
  assert.deepEqual(r.map((x) => x.id), ["wrath_stop", "rule_72h", "chart_logic"], "breach first, then listed order, cap 3");
  assert.deepEqual(selectReminders(all), r, "deterministic");
  const quotes = (d: Date) => selectReminders({ ...all, now: d }).map((x) => /「(.+?)」/.exec(x.line)![1]);
  assert.equal(new Set(quotes(now)).size, 3, "no repeated quote");
  assert.notDeepEqual(quotes(now), quotes(new Date("2026-10-20T11:30:00Z")), "rotates by day");
  assert.notEqual(pickQuote(RULES.patience!, now).text, pickQuote(RULES.patience!, new Date("2026-10-20T11:30:00Z")).text);
  assert.match(r[0]!.line, /触发日亏上限 \$100/);
  assert.match(reminderSection(S())[3]!, /今天没有触发条件，轮换提醒/);
});
test("brief has a 1.1 导师提醒 section when mentor state is passed", () => {
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now);
  const pm = buildPremarket({ now, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label });
  const sc = buildScenarios({ now, data: {}, calendar: [] });
  const md = buildBrief({ now, macro, pm, sc, calendar: [], mentor: { events: [{ at: "2026-10-20T18:00:00Z", symbol: null, title: "FOMC 利率决议" }], journal: [], capital: 5000 } }).md;
  assert.match(md, /## 1\.1 导师提醒[\s\S]*72 小时原则[\s\S]*FOMC 利率决议 还有 31 小时[\s\S]*## 2\. 警报/);
  assert.doesNotMatch(buildBrief({ now, macro, pm, sc, calendar: [] }).md, /导师提醒/);
});
test("losing close: four attribution questions + repeat-error callout (class / tag / sin within 30 days)", () => {
  const prior = T({ id: "p1", closedAt: "2026-10-01T19:00:00Z", pnl: -10, commissions: 0, lossReview: { at: "x", errorClass: "execution", errorTags: ["late_entry"] }, violations: ["no_pre_written_plan"] });
  const old = T({ id: "p0", closedAt: "2026-09-01T19:00:00Z", pnl: -10, commissions: 0, lossReview: { at: "x", errorClass: "execution", errorTags: ["late_entry"] } });
  const open = T({ id: "n", violations: ["no_pre_written_plan"], marks: [{ at: "2026-10-15T19:00:00Z", value: 1, pnl: -12, spot: 1, sources: [] }] });
  const t = new Date("2026-10-15T20:00:00Z");
  const c = paperClose(open, { exitKind: "max_loss", errorClass: "execution", errorTags: ["late_entry"], now: t }).entry!;
  const lp = lossPrompt(c, [old, prior, c], t)!;
  assert.equal(lp.questions.length, 4); assert.match(lp.questions[1]!, /^☑ execution/); assert.match(lp.questions[0]!, /^☐ judgment/);
  assert.equal(lp.repeats.length, 3, lp.repeats.join("|"));
  assert.match(lp.repeats[0]!, /错误类型 execution（执行错）30 天内第 2 次：p1$/); assert.match(lp.repeats[1]!, /late_entry/); assert.match(lp.repeats[2]!, /懒惰/);
  const out = renderLossPrompt(lp, t).join("\n");
  assert.match(out, /亏损归因.*判断错了，执行错了，风险管理错了/); assert.match(out, /🔁 重复错误/);
  assert.equal(lossPrompt({ ...c, pnl: 5 }, [c], t), null, "wins get no loss prompt");
  assert.equal(lossPrompt(c, [c], t)!.repeats.length, 0);
  assert.match(tradeCard({ ...c, lossPrompt: lp }, [prior, c]).join("\n"), /亏损归因 4 问[\s\S]*🔁 重复错误：错误类型 execution/);
});
