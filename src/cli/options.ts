/**
 * npm run options -- chain.json [--direction bull|bear|neutral] [--bars spy-daily.json] [--earnings earnings.json]
 *   [--book positions.json] [--journal journal.json] [--vix 17.2] [--no-save] [--out data/out/options-latest.md]
 * [--proposal trade.json]  → enforced pre-trade checks (assignment plan, per-leg risk, buying power, time buffer...)
 * direction: bull | bear | neutral | big_move | hedge
 * chain.json = normalized chain (see test/fixtures/spy-chain-robinhood-2026-10-14.json). Build it from saved Robinhood
 * MCP output with: npm run options -- --rh-instruments a.json,b.json --rh-quotes q.json --spot 769.6 --symbol SPY --write-chain chain.json
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { parseChain, type Chain } from "../options/chain.ts";
import { chainFromRobinhood, unwrapJson } from "../options/robinhood.ts";
import { buildDashboard, renderDashboard } from "../options/dashboard.ts";
import { initIv, saveIv, loadIv } from "../options/ivhistory.ts";
import { parseEarnings } from "../options/events.ts";
import { checkBook, stressTest, type Book } from "../options/rules.ts";
import { strategyStats, validateEntry, journalHealth, type JournalEntry } from "../options/journal.ts";
import { preTradeChecks, type Proposal } from "../options/pretrade.ts";
import { DEFAULT_RULES } from "../options/rules.ts";
import { parseBars } from "../levels.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import type { Direction } from "../options/matrix.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  direction: { type: "string", default: "neutral" }, bars: { type: "string" }, earnings: { type: "string" }, book: { type: "string" }, journal: { type: "string" }, proposal: { type: "string" },
  vix: { type: "string" }, "no-save": { type: "boolean" }, out: { type: "string", default: "data/out/options-latest.md" },
  "rh-instruments": { type: "string" }, "rh-quotes": { type: "string" }, spot: { type: "string" }, symbol: { type: "string", default: "SPY" }, "write-chain": { type: "string" },
} });
const read = (p: string) => unwrapJson(readFileSync(p, "utf8"));

let chain: Chain;
if (values["rh-instruments"] && values["rh-quotes"]) {
  if (!values.spot) throw new Error("--spot is required with --rh-* inputs");
  chain = chainFromRobinhood(values["rh-instruments"].split(",").map(read), values["rh-quotes"].split(",").map(read), values.symbol!, Number(values.spot));
  if (values["write-chain"]) writeFileSync(values["write-chain"], JSON.stringify(chain, null, 1));
} else {
  if (!positionals[0]) { console.error("usage: npm run options -- chain.json [--direction bull|bear|neutral] ..."); process.exit(2); }
  chain = parseChain(read(positionals[0]));
}

const year = chain.asOf.slice(0, 4);
const calPath = new URL(`../../calendar/releases-${year}.json`, import.meta.url);
const calendar: CalendarEvent[] = existsSync(calPath) ? (JSON.parse(readFileSync(calPath, "utf8")) as { events: CalendarEvent[] }).events : [];
const dbPath = process.env.ALPHA_DB ?? "data/alpha-news.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
initIv(db);
let vix: number | null = values.vix ? Number(values.vix) : null;
if (vix == null) {
  try { const r = db.prepare("SELECT v FROM macro_obs WHERE series IN ('VIX','VIX_FRED') ORDER BY t DESC LIMIT 1").get() as { v: number } | undefined; vix = r?.v ?? null; } catch { /* no macro table yet */ }
}
const history = loadIv(db, chain.symbol).filter((r) => r.date < chain.asOf.slice(0, 10)).map((r) => r.iv30);
const dash = buildDashboard(chain, {
  calendar, vix, ivHistory: history, direction: values.direction as Direction,
  bars: values.bars ? parseBars(read(values.bars)) : undefined,
  earnings: values.earnings ? parseEarnings(read(values.earnings)) : undefined,
});
const etDate = new Date(chain.asOf).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
if (!values["no-save"] && dash.iv30 != null) saveIv(db, { symbol: chain.symbol, date: etDate, iv30: dash.iv30, frontIv: dash.term.frontIv, backIv: dash.term.backIv, skew25: dash.expiries[0]?.skew25 ?? null, source: chain.source ?? "chain.json" });
db.close();

const extra: string[] = []; const json: Record<string, unknown> = { dashboard: dash };
if (values.book) {
  const book = read(values.book) as Book;
  const { rules, checks } = checkBook(book); const st = stressTest(book);
  json.book = { rules, checks, stress: st };
  extra.push("", "## 期权仓位规则卡 / Position rule card (期权课 13.9 / 附录 D.2)", "", ...checks.map((c) => `- ${c.ok ? "✅" : "❌"} ${c.rule}: ${c.detail}`));
  extra.push("", "## 每周压力测试 / Weekly stress test (P&L $ vs now)", "", "| Position | Value | −20% gap | IV×2 | Both | +10% |", "|---|---|---|---|---|---|");
  for (const r of st.rows) extra.push(`| ${r.id} ${r.symbol} | ${r.base} | ${r.gapDown20} | ${r.ivX2} | ${r.both} | ${r.gapUp10} |`);
  extra.push(`| **Total** | ${st.total.base} | ${st.total.gapDown20} | ${st.total.ivX2} | ${st.total.both} | ${st.total.gapUp10} |`, "", `Worst: $${st.worst} (${st.worstPct}% of capital)`);
}
if (values.journal) {
  const entries = read(values.journal) as JournalEntry[];
  const bad = entries.map((e) => ({ id: e.id, errs: validateEntry(e) })).filter((x) => x.errs.length);
  const stats = strategyStats(entries);
  json.journal = { stats, invalid: bad };
  extra.push("", "## 期权交易日志 / Journal — expectancy by strategy (worst first)", "", "| Strategy | N | Win% | Avg win | Avg loss | EV/trade | EV/risk | Total | Worst | Commissions | Rule breaks | Assigned follow-up (separate) |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const s of stats) extra.push(`| ${s.strategy} | ${s.n} | ${(s.winRate * 100).toFixed(0)}% | ${s.avgWin} | ${s.avgLoss} | **${s.expectancy}** | ${s.expectancyPerRisk} | ${s.total} | ${s.worst} | ${s.commissions} | ${s.ruleBreaks} | ${s.assignedFollowUpPnl} |`);
  const hl = journalHealth(entries, DEFAULT_RULES.winStreakReview);
  json.journalHealth = hl;
  extra.push("", `Rule compliance ${hl.compliancePct ?? "—"}% · current streak ${hl.streak}${hl.streakAlert ? " · ⚠️ 连胜超过上限 → 强制压力测试 + 复核规则卡 (D.2)" : ""} · P&L is full-accounting (commissions + adjustments); assigned-share follow-up shown separately (复盘 HYG/TLT 9)`);
  for (const b of bad) extra.push(`- ⚠️ ${b.id}: ${b.errs.join("; ")}`);
}
if (values.proposal) {
  const prop = read(values.proposal) as Proposal;
  const r = preTradeChecks(prop, { ...DEFAULT_RULES });
  json.preTrade = r;
  const icon = { NO_TRADE: "🛑", BLOCK: "⛔", WARN: "⚠️", OK: "✅", INFO: "ℹ️" } as const;
  extra.push("", `## 下单前检查 / Pre-trade checks — ${prop.symbol} ${prop.strategy}: ${r.blocked ? "**BLOCKED**" : "pass"}`, "", ...r.checks.map((c) => `- ${icon[c.severity]} **${c.id}** ${c.detail} _(${c.cite})_`));
}
const md = renderDashboard(dash, extra);
mkdirSync(dirname(values.out!), { recursive: true });
const jsonPath = values.out!.replace(/\.md$/, "") + ".json";
for (const [p, body] of [[values.out!, md], [jsonPath, JSON.stringify(json, null, 2) + "\n"]] as const) { writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); }
process.stdout.write(md);
