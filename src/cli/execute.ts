/** npm run execute -- --plan data/plans/plan-premarket-YYYY-MM-DD.md [--confirm] [--equity N] [--risk 50] [--entry limit|market]
 *                       [--state data/journal/plans/intraday-state-YYYY-MM-DD.json] [--journal data/journal/paper.json]
 *  Intraday plan executor (src/paper/executor.ts), Alpaca PAPER only. For an external scheduler — call every few minutes from 09:45 ET:
 *   - before 09:45 ET: nothing (no broker calls); 09:45–15:20: confirm each plan row's trigger on 5m bars (OR = 09:30–09:45),
 *     size = floor(risk/|entry−stop|) with risk $25–100 (default $50) inside the day's remaining cap (riskCap.ts dailyRiskCapUsd
 *     minus risk already used in the state file / opened today in the ledger), submit ONE bracket per symbol+side per day
 *     (take_profit = 目标1, stop_loss = 止损, client_order_id alpha-YYYYMMDD-SYM-side → reruns never double-submit);
 *   - fills are logged as kind=formal entries in the paper ledger (id sym-stock-side-YYYY-MM-DD-paper);
 *   - 15:20–15:45: no new positions; at/after 15:45: flatten() (cancel bracket legs, close plan symbols' positions).
 *  --equity defaults to the paper ledger's equity at the start of the ET day. DRY-RUN BY DEFAULT (only GETs, no files); --confirm sends orders to the paper account.
 *  Keys: ALPACA_KEY / ALPACA_SECRET (never printed). Exit 0 = ok, 2 = flatten left something open, 1 = error. */
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { alpacaBars, alpacaPaperHttp } from "../adapters/alpacaPaper.ts";
import { etDay, executeDryRun, executePlan, parsePlan, type IntradayState } from "../paper/executor.ts";
import { equityAtStartOf } from "../options/riskCap.ts";
import { defaultCapital } from "../config.ts";
import type { PaperJournal } from "../options/paper.ts";

const { values } = parseArgs({ options: { plan: { type: "string" }, "dry-run": { type: "boolean" }, confirm: { type: "boolean" }, equity: { type: "string" }, risk: { type: "string" }, entry: { type: "string", default: "limit" },
  state: { type: "string" }, journal: { type: "string", default: "data/journal/paper.json" } } });
const now = new Date(), day = etDay(now), dryRun = executeDryRun(values);
const statePath = values.state ?? `data/journal/plans/intraday-state-${day}.json`, jPath = values.journal!;
const save = (p: string, x: unknown) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", JSON.stringify(x, null, 2) + "\n"); renameSync(p + ".tmp", p); };
try {
  if (!values.plan) throw new Error("--plan path.md required");
  if (values.entry !== "limit" && values.entry !== "market") throw new Error("--entry limit|market");
  const plan = parsePlan(readFileSync(values.plan, "utf8"));
  const j: PaperJournal = existsSync(jPath) ? JSON.parse(readFileSync(jPath, "utf8")) : { capital: defaultCapital(), entries: [] };
  const equity = values.equity != null ? Number(values.equity) : equityAtStartOf(j.entries, j.capital, day);
  if (!(equity > 0)) throw new Error(`bad equity ${values.equity}`);
  const state: IntradayState | null = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
  const r = await executePlan({ http: alpacaPaperHttp(), bars: alpacaBars(), now, plan, planPath: values.plan, state, ledger: j.entries, equity,
    riskPerTrade: values.risk != null ? Number(values.risk) : undefined, entryType: values.entry as "limit" | "market", dryRun });
  if (r.persist) {
    save(statePath, r.state);
    if (r.ledgerAdds.length) { j.entries.push(...r.ledgerAdds.filter((e) => !j.entries.some((x) => x.id === e.id))); save(jPath, j); }
  }
  for (const a of r.actions) console.error(`[execute] ${a.action}${a.symbol ? " " + a.symbol : ""}${a.status != null ? " → " + a.status : ""}: ${a.detail}`);
  console.error(`[execute] ${r.mode} ${r.day} phase=${r.phase} 风险 已用 $${r.usedUsd} / 上限 $${r.capUsd}（权益 $${equity}）${r.persist ? ` → ${statePath}${r.ledgerAdds.length ? ` + ${jPath}` : ""}` : "（未写文件）"}`);
  process.exitCode = r.flatten && !r.flatten.ok ? 2 : 0;
} catch (e) { console.error(`[execute] error: ${(e as Error).message}`); process.exitCode = 1; }
