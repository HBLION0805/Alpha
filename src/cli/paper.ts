/**
 * npm run paper -- open|close|list|mark   (paper trades ONLY — this file never calls a broker; there is no order path)
 *   open  --proposal p.json --thesis "…" --invalidation "…" --stop "…" --motive thesis --tp short_dated|narrative|windfall [--time-stop YYYY-MM-DD] [--ack]
 *         --hedge built_in_spread|direct|portfolio --hedge-detail "…" [--stop-pct 7 (stocks)] [--kind formal|practice]
 *         (唱反调 critique printed first; BLOCK refuses, WARNs need --ack; the critique is saved in the entry)
 *   mark  [--quotes data/in/x-chain.json ...]   (Robinhood chain JSON when present, else Yahoo spot + Black-Scholes)
 *   close --id P001 --exit-kind invalidation|time_stop|take_profit|max_loss|discretionary [--pnl N] [--commissions N]
 *         [--error-class judgment|execution --error-tags a,b] [--violations chasing,...] [--lesson "…"]
 *   list
 * Common: --journal data/journal/paper.json (default), --capital N (first use; default ALPHA_CAPITAL or 5000 (src/config.ts)).
 */
import { defaultCapital } from "../config.ts";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { checkTakeProfit, costBasis } from "../options/tpplan.ts";
const etDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
import { paperOpen, paperMark, paperClose, openPaper, type PaperJournal } from "../options/paper.ts";
import { parseChain, type Chain } from "../options/chain.ts";
import { unwrapJson } from "../options/robinhood.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { readiness } from "../options/readiness.ts";
import { renderRiskPlan } from "../options/riskplan.ts";
import { critique, renderCritique, proposalSide } from "../review/critique.ts";
import type { Proposal } from "../options/pretrade.ts";
import type { Motive } from "../options/discipline.ts";
import type { JournalEntry } from "../options/journal.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  journal: { type: "string", default: "data/journal/paper.json" }, capital: { type: "string" }, proposal: { type: "string" },
  thesis: { type: "string" }, invalidation: { type: "string" }, stop: { type: "string" }, motive: { type: "string" }, "time-stop": { type: "string" }, tp: { type: "string" },
  quotes: { type: "string", multiple: true }, id: { type: "string" }, "exit-kind": { type: "string" }, pnl: { type: "string" }, commissions: { type: "string" },
  "error-class": { type: "string" }, "error-tags": { type: "string" }, violations: { type: "string" }, lesson: { type: "string" }, kind: { type: "string" }, hedge: { type: "string" }, "hedge-detail": { type: "string" }, "stop-pct": { type: "string" }, ack: { type: "boolean", default: false }, now: { type: "string" } } });
const cmd = positionals[0];
const now = values.now ? new Date(values.now) : new Date();
const path = values.journal!;
const j: PaperJournal = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { capital: Number(values.capital ?? defaultCapital()), entries: [] };
const save = () => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path + ".tmp", JSON.stringify(j, null, 2) + "\n"); renameSync(path + ".tmp", path); };
const list = (s: string | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);
const fail = (lines: string[]) => { process.stderr.write(["[paper] 拒绝 refused:", ...lines.map((l) => `  - ${l}`)].join("\n") + "\n"); process.exit(1); };

if (cmd === "open") {
  if (!values.proposal) fail(["缺少 --proposal file.json"]);
  const p = JSON.parse(readFileSync(values.proposal!, "utf8")) as Proposal;
  // real data: the proposal's underlying price must match the live Yahoo price (stale proposal → refuse)
  const bars = await yahooDaily(p.symbol, 45).catch(() => []);
  const live = bars.at(-1)?.c ?? null;
  const ps = typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[p.symbol];
  if (live == null) fail([`无法取得 ${p.symbol} 实时价格（Yahoo），不能确认是真实数据`]);
  if (ps == null || Math.abs(ps / live! - 1) > 0.03) fail([`proposal underlyingPrice ${ps} 与 Yahoo ${live!.toFixed(2)} 相差 >3% → 方案已过期，请用当前链/报价重做`]);
  const bf = existsSync("data/out/brief-latest.json") ? JSON.parse(readFileSync("data/out/brief-latest.json", "utf8")) : null;
  const brief = bf && now.getTime() - Date.parse(bf.generatedAt) < 12 * 3600_000 ? bf : {};
  const year = now.getFullYear(), calF = new URL(`../../calendar/releases-${year}.json`, import.meta.url);
  const calendar = existsSync(calF) ? JSON.parse(readFileSync(calF, "utf8")).events ?? [] : [];
  const cr = critique({ proposal: p, side: proposalSide(p), thesis: values.thesis ?? "", invalidation: values.invalidation ?? "", stop: values.stop ?? "", motive: values.motive,
    leader: brief.leader === undefined ? undefined : brief.leader, verdict: brief.verdict ?? null, verdictReasons: brief.reasons ?? [],
    futuresGapPct: (brief.reasons ?? []).some((x: string) => /期货跳空/.test(x)) ? 1.5 : null, open: openPaper(j), bars, calendar, now, capital: j.capital });
  process.stdout.write(renderCritique(cr) + "\n");
  const r = paperOpen(j, p, { kind: values.kind as "formal" | "practice" | undefined, hedge: values.hedge, hedgeDetail: values["hedge-detail"], stopPct: values["stop-pct"] != null ? Number(values["stop-pct"]) : undefined, critique: cr, ack: values.ack, thesis: values.thesis, invalidation: values.invalidation, stop: values.stop, motive: values.motive as Motive, timeStopAt: values["time-stop"], tp: values.tp, now });
  for (const c of r.checks.filter((c) => c.severity !== "OK" && c.severity !== "INFO")) process.stdout.write(`${c.severity} ${c.id}: ${c.detail}\n`);
  if (!r.entry) fail(r.refused);
  j.entries.push(r.entry!); save();
  process.stdout.write(renderRiskPlan(r.entry!.riskPlan!) + "\n");
  process.stdout.write(`[paper] 模拟开仓 ${r.entry!.id} ${r.entry!.symbol} ${r.entry!.strategy} · 最大亏损 $${r.entry!.maxLoss} · 当前持仓 ${r.entry!.concurrentAtEntry} → ${path}（不是真实订单）\n`);
} else if (cmd === "mark") {
  const files = values.quotes ?? (existsSync("data/in") ? readdirSync("data/in").filter((f) => /chain.*\.json$/.test(f)).map((f) => join("data/in", f)) : []);
  const chains: Chain[] = files.map((f) => parseChain(unwrapJson(readFileSync(f, "utf8"))));
  const cache = new Map<string, number | null>();
  const spot = async (s: string) => { if (!cache.has(s)) { const ch = chains.find((c) => c.symbol === s); cache.set(s, ch?.underlyingPrice ?? (await yahooDaily(s, 10).catch(() => [])).at(-1)?.c ?? null); } return cache.get(s)!; };
  for (const e of openPaper(j)) {
    try { const m = await paperMark(e, { spot, chains }, now); (e.marks ??= []).push(m); process.stdout.write(`${e.id} ${e.symbol}: P&L $${m.pnl} (${((m.pnl / (e.capitalAtEntry ?? j.capital)) * 100).toFixed(2)}%) · ${m.sources.join("; ")}\n`);
      for (const h of checkTakeProfit(e.takeProfit, costBasis(e.legs ?? []), m.pnl, etDate(now), e.tpHits)) { (e.tpHits ??= []).push(h.gainPct); process.stdout.write(`⚠️ ${e.id} ${e.symbol}: ${h.text}\n`); } }
    catch (err) { process.stdout.write(`${e.id} ${e.symbol}: 无法估值 ${(err as Error).message}\n`); }
  }
  save();
} else if (cmd === "close") {
  const e = j.entries.find((x) => x.id === values.id && x.mode === "paper");
  if (!e) fail([`找不到模拟交易 --id ${values.id ?? ""}`]);
  const r = paperClose(e!, { exitKind: values["exit-kind"] as JournalEntry["exitKind"], pnl: values.pnl != null ? Number(values.pnl) : undefined, commissions: values.commissions != null ? Number(values.commissions) : undefined,
    errorClass: values["error-class"] as "judgment" | "execution", errorTags: list(values["error-tags"]), violations: list(values.violations), lesson: values.lesson, now });
  if (!r.entry) fail(r.refused);
  j.entries[j.entries.indexOf(e!)] = r.entry!; save();
  process.stdout.write(`[paper] 模拟平仓 ${e!.id} P&L $${r.entry!.pnl} · ${r.entry!.exitKind}${r.entry!.exitKind === "discretionary" ? "（失效条件未触发、时间止损未到 → 记为提前离场）" : ""}\n`);
} else if (cmd === "list") {
  const rows = j.entries.filter((e) => e.mode === "paper").map((e) => `| ${e.id}${e.kind === "practice" ? "（练习）" : ""} | ${e.symbol} | ${e.strategy} | ${e.openedAt.slice(0, 10)} | ${e.closedAt?.slice(0, 10) ?? "open"} | ${e.pnl ?? e.marks?.at(-1)?.pnl ?? "—"} | ${e.exitKind ?? ""} |`);
  const r = readiness({ journal: j.entries, capital: j.capital, shockDates: [] });
  process.stdout.write(["| id | 标的 | 结构 | 开仓 | 平仓 | P&L | 离场 |", "|---|---|---|---|---|---|---|", ...rows, "", `持仓 ${openPaper(j).length} · 已平仓 ${r.stats.paperClosed} · 期望值 $${r.stats.ev}/笔 · 详见 npm run readiness`].join("\n") + "\n");
} else fail(["用法：npm run paper -- open|close|list|mark（只做模拟交易）"]);
