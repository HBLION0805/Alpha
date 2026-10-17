/**
 * npm run paper -- open|close|list|mark   (paper trades ONLY — this file never calls a broker; there is no order path)
 *   open  --proposal p.json --thesis "…" --invalidation "…" --stop "…" --motive thesis --tp short_dated|narrative|windfall [--time-stop YYYY-MM-DD] [--ack]
 *         bearish: [--sector SMH] [--squeeze-check "SI x% · float y · gamma … · 情绪 …"] → 做空清单 warn tags (src/options/shortside.ts; warn only)
 *         心理 (warn only, src/options/psych.ts): [--confirm "确认信号"] (adding to a losing position) [--target 95] (Put 目标价); 72h rule reads data/in/earnings*.json + data/in/major-events.json
 *         --hedge built_in_spread|direct|portfolio --hedge-detail "…" [--stop-pct 7 (stocks)] [--kind formal|practice]
 *         (唱反调 critique printed first; BLOCK refuses, WARNs need --ack; the critique is saved in the entry)
 *   mark  [--quotes data/in/x-chain.json ...]   (Robinhood chain JSON when present, else Yahoo spot + Black-Scholes)
 *   close --id P001 --exit-kind invalidation|time_stop|take_profit|max_loss|discretionary [--pnl N] [--commissions N]
 *         [--error-class judgment|execution|risk|variance --error-tags a,b] [--violations chasing,...] [--lesson "…"]
 *   list
 *   journal --id X [--why "…"] [--thesis "…"] [--right "…"] [--wrong "…"] [--violated "…"] [--redo "…"] [--profitable-but-wrong yes|no]   (交易日记 6 问; knowledge/mentor/psychology/journal-and-outcome-bias.md)
 *   sin   --id X --sin wrath,greed [--note "…"] | --remove greed   (股市七宗罪 manual tag / reject an auto candidate; src/options/sins.ts)
 *   sins  [--backfill]   (list auto-derived 七宗罪 candidates per own closed trade; --backfill stores them as by:"auto" in the journal)
 * Common: --journal data/journal/paper.json (default), --capital N (first use; default ALPHA_CAPITAL or 5000 (src/config.ts)).
 */
import { defaultCapital } from "../config.ts";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { writePostMortem, mentorCompare } from "../options/postmortem.ts";
import { capFlags } from "../options/breach.ts";
import { chainsFromQuotes, upsertMark } from "../options/paper.ts";
import { settleable, expireEntry, weekendRule, isAm } from "../options/expire.ts";
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
import { autoSins, sinsOf, SINS, SIN_IDS, type SinId } from "../options/sins.ts";
import { SECTOR_OF, BROAD_ETFS } from "../options/shortside.ts";
import { loadEarningsBook } from "../options/earningsStore.ts";
import { JOURNAL_QUESTIONS, LOSS_CLASSES, profitableButWrong, type MajorEvent } from "../options/psych.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  journal: { type: "string", default: "data/journal/paper.json" }, capital: { type: "string" }, proposal: { type: "string" },
  thesis: { type: "string" }, invalidation: { type: "string" }, stop: { type: "string" }, motive: { type: "string" }, "time-stop": { type: "string" }, tp: { type: "string" }, settle: { type: "string", multiple: true }, "plan-id": { type: "string" }, card: { type: "string" }, class: { type: "string" }, tags: { type: "string" }, result: { type: "string" }, "pnl-pct": { type: "string" }, note: { type: "string" }, "followed-stop": { type: "string" }, "followed-tp": { type: "string" }, "followed-size": { type: "string" },
  quotes: { type: "string", multiple: true }, id: { type: "string" }, "exit-kind": { type: "string" }, pnl: { type: "string" }, commissions: { type: "string" },
  "error-class": { type: "string" }, "error-tags": { type: "string" }, violations: { type: "string" }, lesson: { type: "string" }, kind: { type: "string" }, hedge: { type: "string" }, "hedge-detail": { type: "string" }, "stop-pct": { type: "string" }, sector: { type: "string" }, "squeeze-check": { type: "string" }, sin: { type: "string" }, confirm: { type: "string" }, target: { type: "string" }, why: { type: "string" }, right: { type: "string" }, wrong: { type: "string" }, violated: { type: "string" }, redo: { type: "string" }, "profitable-but-wrong": { type: "string" }, remove: { type: "string" }, backfill: { type: "boolean", default: false }, ack: { type: "boolean", default: false }, now: { type: "string" } } });
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
    futuresGapPct: (brief.reasons ?? []).some((x: string) => /期货跳空/.test(x)) ? 1.5 : null, open: openPaper(j), history: j.entries, bars, calendar, now, capital: j.capital });
  process.stdout.write(renderCritique(cr) + "\n");
  const pcF = "data/journal/pending-cards.json", card = values.card && existsSync(pcF) ? (JSON.parse(readFileSync(pcF, "utf8")).cards ?? []).find((c: { id: string }) => c.id === values.card) ?? null : null;
  if (values.card && !card) process.stdout.write(`⚠️ 找不到计划卡 ${values.card}（${pcF}）\n`);
  // bearish: 做空清单 inputs (120 daily bars of the underlying, SPY, sector ETF); warn tags only, missing data reported by shortside.ts
  const side = proposalSide(p); // same side paperOpen uses
  let short: Parameters<typeof paperOpen>[2]["short"];
  if (side === "short") {
    const sectorSym = BROAD_ETFS.has(p.symbol.toUpperCase()) ? null : values.sector?.toUpperCase() ?? SECTOR_OF[p.symbol.toUpperCase()] ?? null;
    const [sb, spy, sec] = await Promise.all([yahooDaily(p.symbol, 200).catch(() => []), p.symbol.toUpperCase() === "SPY" ? Promise.resolve([]) : yahooDaily("SPY", 200).catch(() => []), sectorSym ? yahooDaily(sectorSym, 200).catch(() => []) : Promise.resolve([])]);
    short = { bars: sb, spyBars: spy, sectorSym, sectorBars: sec, squeezeCheck: values["squeeze-check"] ?? card?.squeezeCheck ?? null };
  }
  // 交易心理: earnings rows (past ones too, for the 72h rule) + flagged major events (data/in/major-events.json: {"events":[{"at":ISO,"symbol":null|"XYZ","title":"…"}]})
  const evF = "data/in/major-events.json", events: MajorEvent[] = existsSync(evF) ? JSON.parse(readFileSync(evF, "utf8")).events ?? [] : [];
  if (values.target != null && !(Number(values.target) > 0)) fail([`--target ${values.target} 无效（目标价，正数）`]);
  const psych = { earnings: loadEarningsBook().rows, events, confirm: values.confirm ?? null, target: values.target != null ? Number(values.target) : null };
  const r = paperOpen(j, p, { psych, short, card, kind: values.kind as "formal" | "practice" | undefined, hedge: values.hedge, hedgeDetail: values["hedge-detail"], stopPct: values["stop-pct"] != null ? Number(values["stop-pct"]) : undefined, critique: cr, ack: values.ack, thesis: values.thesis, invalidation: values.invalidation, stop: values.stop, motive: values.motive as Motive, timeStopAt: values["time-stop"], tp: values.tp, cardId: values.card, planId: values["plan-id"], plan: brief.plan ?? [], side: proposalSide(p), now });
  for (const c of r.checks.filter((c) => c.severity !== "OK" && c.severity !== "INFO")) process.stdout.write(`${c.severity} ${c.id}: ${c.detail}\n`);
  if (!r.entry) fail(r.refused);
  if (r.entry!.kind !== "practice" && r.entry!.psychTags?.length) process.stdout.write(`🧠 心理提示（不阻止）：${r.entry!.psychTags.join("、")}\n`);
  if (r.entry!.warnTags?.length) process.stdout.write(`🟢 练习单已记录提示（不阻止）：${r.entry!.warnTags.join("、")}\n${(r.entry!.warnDetails ?? []).map((d) => `  - ${d}`).join("\n")}\n`);
  j.entries.push(r.entry!); save();
  process.stdout.write(renderRiskPlan(r.entry!.riskPlan!) + "\n");
  process.stdout.write(`[paper] 模拟开仓 ${r.entry!.id} ${r.entry!.symbol} ${r.entry!.strategy} · 最大亏损 $${r.entry!.maxLoss} · 当前持仓 ${r.entry!.concurrentAtEntry} → ${path}（不是真实订单）\n`);
} else if (cmd === "mark") {
  const files = values.quotes ?? (existsSync("data/in") ? readdirSync("data/in").filter((f) => /chain.*\.json$/.test(f)).map((f) => join("data/in", f)) : []);
  const chains: Chain[] = files.map((f) => parseChain(unwrapJson(readFileSync(f, "utf8"))));
  // read-only Robinhood quotes (get_option_quotes joined to strikes) take priority over Black-Scholes
  if (existsSync("data/in/rh-option-quotes.json")) {
    const qf = JSON.parse(readFileSync("data/in/rh-option-quotes.json", "utf8"));
    const age = Math.round((now.getTime() - Date.parse(qf.fetchedAt)) / 60000);
    if (!(age <= 60)) process.stdout.write(`⚠️ data/in/rh-option-quotes.json 已 ${age} 分钟未更新（例行任务应先刷新 Robinhood 报价，见 docs/ROUTINE_PAPER.md）\n`);
    chains.unshift(...chainsFromQuotes(qf));
  } else process.stdout.write("⚠️ 没有 data/in/rh-option-quotes.json → 用 Black-Scholes 估算（见 docs/ROUTINE_PAPER.md）\n");
  const cache = new Map<string, number | null>();
  const spot = async (s: string) => { if (!cache.has(s)) { const ch = chains.find((c) => c.symbol === s); cache.set(s, ch?.underlyingPrice ?? (await yahooDaily(s, 10).catch(() => [])).at(-1)?.c ?? null); } return cache.get(s)!; };
  // simulated positions + open real_practice records (marked for review only; never in caps/readiness)
  const toMark = [...openPaper(j), ...j.entries.filter((e) => e.source === "real_practice" && !e.closedAt && (e.legs ?? []).every((l) => l.premium != null))];
  for (const e of toMark) {
    try { const m = await paperMark(e, { spot, chains }, now); upsertMark(e, m); process.stdout.write(`${e.id} ${e.symbol}: P&L $${m.pnl}${m.estimated ? "（估算）" : ""} (${((m.pnl / (e.capitalAtEntry ?? j.capital)) * 100).toFixed(2)}%) · ${m.sources.join("; ")}\n`);
      for (const h of checkTakeProfit(e.takeProfit, costBasis(e.legs ?? []), m.pnl, etDate(now), e.tpHits)) { (e.tpHits ??= []).push(h.gainPct); process.stdout.write(`⚠️ ${e.id} ${e.symbol}: ${h.text}\n`); } }
    catch (err) { process.stdout.write(`${e.id} ${e.symbol}: 无法估值 ${(err as Error).message}\n`); }
  }
  for (const f of capFlags(j.entries, j.capital, now)) process.stdout.write(f + "\n");
  save();
} else if (cmd === "legs") {
  // open option legs that need a Robinhood quote (routine: get_option_instruments → get_option_quotes → data/in/rh-option-quotes.json)
  const today = etDate(now), seen = new Set<string>(), out: object[] = [];
  for (const e of j.entries.filter((x) => !x.closedAt && x.mode === "paper")) for (const l of e.legs ?? []) {
    if (l.type === "stock" || !l.expiration || l.expiration < today) continue;
    const u = (l.underlying ?? e.symbol).toUpperCase(), k = `${u}|${l.type}|${l.strike}|${l.expiration}`;
    if (!seen.has(k)) { seen.add(k); out.push({ underlying: u, type: l.type, strike: l.strike, expiration: l.expiration }); }
  }
  writeFileSync("data/in/paper-open-legs.json", JSON.stringify({ generatedAt: now.toISOString(), legs: out }, null, 1) + "\n");
  process.stdout.write(JSON.stringify(out) + "\n");
} else if (cmd === "expire") {
  // settle expired entries (PM close from Yahoo; AM-settled VIX needs --settle VIX=<VRO>), then the mentor weekend rule
  // settlement values: --settle SYM=price, or data/in/settle.json {"date":"YYYY-MM-DD","VIX":<VRO>} written by the routine (only used on that date)
  const sf = existsSync("data/in/settle.json") ? JSON.parse(readFileSync("data/in/settle.json", "utf8")) : null;
  const fromFile = sf && sf.date === etDate(now) ? Object.fromEntries(Object.entries(sf).filter(([k, v]) => k !== "date" && typeof v === "number").map(([k, v]) => [k.toUpperCase(), v as number])) : {};
  const manual = { ...fromFile, ...Object.fromEntries((values.settle ?? []).map((x: string) => { const [k, v] = x.split("="); return [k!.toUpperCase(), Number(v)]; })) };
  for (const [i, e] of j.entries.entries()) {
    const kind = settleable(e, now);
    if (kind) {
      const settle: Record<string, number> = { ...manual };
      for (const l of e.legs ?? []) { const u = (l.underlying ?? e.symbol).toUpperCase(); const exp = l.expiration!;
        if (settle[u] == null && !isAm(u)) settle[u] = (await yahooDaily(u, 10).catch(() => [])).find((b) => b.t.slice(0, 10) === exp)?.c ?? NaN; }
      const r = expireEntry(e, settle, now);
      if (r.entry) { j.entries[i] = r.entry; process.stdout.write(`[expire] ${e.id} ${e.symbol} 到期结算 ${JSON.stringify(r.entry.settlement!.prices)} → P&L $${r.entry.pnl}${r.entry.pnl! <= 0 ? "（亏损：待复盘）" : ""}\n`); }
      else { j.entries[i] = { ...e, settlePending: `${now.toISOString()} ${r.error}` } ; process.stdout.write(`[expire] ${e.id}: 待结算 · ${r.error}\n`); }
      continue;
    }
    const w = weekendRule(e, now);
    if (w) { j.entries[i] = w; process.stdout.write(`[weekend] ${e.id} ${e.symbol} ${w.exitReason} P&L $${w.pnl}\n`); }
  }
  save();
} else if (cmd === "review") {
  // per-trade post-mortem after close/expiry (wins included)
  const i = j.entries.findIndex((x) => x.id === values.id);
  if (i < 0) fail([`找不到 --id ${values.id ?? ""}`]);
  const yn = (k: string) => ((values as Record<string, unknown>)[k] == null ? null : /^(y|yes|1|true)$/i.test(String((values as Record<string, unknown>)[k])));
  const r = writePostMortem(j.entries[i]!, { classification: values.class, tags: list(values.tags), lesson: values.lesson, followed: { stop: yn("followed-stop"), takeProfit: yn("followed-tp"), size: yn("followed-size") }, now });
  if (!r.entry) fail(r.refused);
  j.entries[i] = r.entry!; save(); process.stdout.write(`[review] ${values.id} 复盘已记录：${r.entry!.postMortem!.classification} · ${r.entry!.postMortem!.lesson}\n`);
} else if (cmd === "mentor") {
  // record the mentor's actual result for a mentor_shadow trade
  const e = j.entries.find((x) => x.id === values.id && x.source === "mentor_shadow");
  if (!e) fail([`找不到大佬影子单 --id ${values.id ?? ""}`]);
  const res = values.result as "win" | "loss" | "flat" | "unknown";
  if (!["win", "loss", "flat", "unknown"].includes(res)) fail(["--result win|loss|flat|unknown"]);
  e!.mentorOutcome = { at: now.toISOString(), result: res, pnlPct: values["pnl-pct"] != null ? Number(values["pnl-pct"]) : null, note: values.note };
  save(); process.stdout.write(mentorCompare(e!).join("\n") + "\n");
} else if (cmd === "close") {
  const e = j.entries.find((x) => x.id === values.id && x.mode === "paper");
  if (!e) fail([`找不到模拟交易 --id ${values.id ?? ""}`]);
  const r = paperClose(e!, { exitKind: values["exit-kind"] as JournalEntry["exitKind"], pnl: values.pnl != null ? Number(values.pnl) : undefined, commissions: values.commissions != null ? Number(values.commissions) : undefined,
    errorClass: values["error-class"] as (typeof LOSS_CLASSES)[number], errorTags: list(values["error-tags"]), violations: list(values.violations), lesson: values.lesson, now });
  if (!r.entry) fail(r.refused);
  j.entries[j.entries.indexOf(e!)] = r.entry!; save();
  process.stdout.write(`[paper] 模拟平仓 ${e!.id} P&L $${r.entry!.pnl} · ${r.entry!.exitKind}${r.entry!.exitKind === "discretionary" ? "（失效条件未触发、时间止损未到 → 记为提前离场）" : ""}\n`);
} else if (cmd === "list") {
  const rows = j.entries.filter((e) => e.mode === "paper").map((e) => `| ${e.id}${e.kind === "practice" ? "（练习）" : ""} | ${e.symbol} | ${e.strategy} | ${e.openedAt.slice(0, 10)} | ${e.closedAt?.slice(0, 10) ?? "open"} | ${e.pnl ?? e.marks?.at(-1)?.pnl ?? "—"} | ${e.exitKind ?? ""} |`);
  const r = readiness({ journal: j.entries, capital: j.capital, shockDates: [] });
  process.stdout.write(["| id | 标的 | 结构 | 开仓 | 平仓 | P&L | 离场 |", "|---|---|---|---|---|---|---|", ...rows, "", `持仓 ${openPaper(j).length} · 已平仓 ${r.stats.paperClosed} · 期望值 $${r.stats.ev}/笔 · 详见 npm run readiness`].join("\n") + "\n");
} else if (cmd === "sin") {
  // 股市七宗罪: manual behaviour tag (or reject an auto candidate with --remove); warn-only, never a rule
  const e = j.entries.find((x) => x.id === values.id);
  if (!e) fail([`找不到 --id ${values.id ?? ""}`]);
  if (e!.source === "mentor_shadow") fail(["大佬影子单不打七宗罪标签（那是大佬的决定）"]);
  const add = list(values.sin) ?? [], rm = list(values.remove) ?? [], bad = [...add, ...rm].filter((x) => !SIN_IDS.includes(x as SinId));
  if (bad.length || !(add.length || rm.length)) fail([`--sin / --remove 取值：${SIN_IDS.map((x) => `${x}(${SINS[x].zh})`).join(" ")}${bad.length ? `；无效：${bad.join(",")}` : ""}`]);
  const at = now.toISOString(), keep = (e!.behaviorSins ?? []).filter((x) => !add.includes(x.sin) && !rm.includes(x.sin));
  e!.behaviorSins = [...keep, ...add.map((sin) => ({ sin: sin as SinId, by: "manual" as const, reason: values.note ?? "手动标记", at })), ...rm.map((sin) => ({ sin: sin as SinId, by: "manual" as const, reason: values.note ?? "复盘确认不是", at, removed: true }))];
  save(); process.stdout.write(`[sin] ${e!.id}：${sinsOf(e!, j.entries, undefined, j.capital).map((x) => `${SINS[x.sin].zh}${x.by === "auto" ? "(自动)" : ""}`).join("、") || "无"}\n`);
} else if (cmd === "journal") {
  // 交易日记 6 问 + 赚钱但做错 (warn-only review data; never changes readiness)
  const e = j.entries.find((x) => x.id === values.id);
  if (!e) fail([`找不到 --id ${values.id ?? ""}`]);
  const v = values as unknown as Record<string, string | undefined>, ans = Object.fromEntries(JOURNAL_QUESTIONS.map(([k]) => [k, v[k]]).filter(([, x]) => x?.trim()));
  const pbw = v["profitable-but-wrong"];
  if (pbw != null && !/^(y|yes|true|1|n|no|false|0)$/i.test(pbw)) fail(["--profitable-but-wrong yes|no"]);
  if (!Object.keys(ans).length && pbw == null) fail([`至少回答一题：${JOURNAL_QUESTIONS.map(([k, q]) => `--${k}（${q}）`).join(" ")}`]);
  e!.tradeJournal = { ...(e!.tradeJournal ?? {}), ...ans, at: now.toISOString() };
  if (pbw != null) e!.profitableButWrong = /^(y|yes|true|1)$/i.test(pbw);
  save();
  const miss = JOURNAL_QUESTIONS.filter(([k]) => !e!.tradeJournal?.[k]).map(([, q]) => q), c = profitableButWrong(e!);
  process.stdout.write(`[journal] ${e!.id} 已记录${miss.length ? ` · 还没答：${miss.join(" ")}` : " · 6 问已答完"}${c.flag ? ` · ⚠️ ${c.why}` : ""}\n`);
} else if (cmd === "sins") {
  let n = 0;
  for (const e of j.entries.filter((x) => x.closedAt && x.source !== "mentor_shadow")) {
    const xs = autoSins(e, j.entries, undefined, j.capital);
    if (values.backfill) { const have = new Set((e.behaviorSins ?? []).map((x) => x.sin)); const add = xs.filter((x) => !have.has(x.sin)).map((x) => ({ ...x, at: now.toISOString() }));
      if (add.length) { e.behaviorSins = [...(e.behaviorSins ?? []), ...add]; n += add.length; } }
    const all = sinsOf(e, j.entries, undefined, j.capital);
    process.stdout.write(`${e.id} ${e.symbol}: ${all.length ? all.map((x) => `${SINS[x.sin].zh}${x.by === "auto" ? "(自动)" : ""} — ${x.reason}`).join(" | ") : "无"}\n`);
  }
  if (values.backfill) { save(); process.stdout.write(`[sins] backfill：写入 ${n} 个自动候选标签 → ${path}\n`); }
} else fail(["用法：npm run paper -- open|close|list|mark|expire|review|mentor|journal|sin|sins（只做模拟交易）"]);
