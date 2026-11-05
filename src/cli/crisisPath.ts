/**
 * 危机路径追踪 — semi-monthly standalone report: npm run crisis-path [-- --if-due] [--dry] [--offline-test]
 *   --if-due   only run on the 1st / 15th (or the next NYSE trading day, or a missed slot); otherwise exit 0 quietly
 *   --dry      print the report, do not update data/crisis-path-state.json
 * Read-only data: FRED fredgraph CSV + Yahoo daily bars (front-month WTI via src/macro/wtiFront.ts). Display only:
 * no trades, no alerts, not part of the daily brief. Fetch failures → 无数据 (state untouched).
 * Output: data/out/crisis-path-latest.md / .json and a dated copy data/out/crisis-path-YYYY-MM-DD.md.
 */
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { fetchDaily, type Obs } from "../macro/fetch.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { wtiFront, frontContinuous } from "../macro/wtiFront.ts";
import { loadSignals, loadState, evaluateAll, updateState, renderCrisis, scorePaths, isDue } from "../macro/crisisPath.ts";

const { values } = parseArgs({ options: { "if-due": { type: "boolean" }, dry: { type: "boolean" }, state: { type: "string", default: "data/crisis-path-state.json" } } });
const now = new Date(), today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const f = loadSignals(), prev = loadState(values.state!);
const lastRun = prev.runs.at(-1)?.date ?? null, due = isDue(today, lastRun);
if (values["if-due"] && !due.due) { process.stdout.write(`[crisis-path] not due (last run ${lastRun ?? "never"}, last slot ${due.slot ?? "—"}); next: 1st / 15th or next trading day\n`); process.exit(0); }

const data: Record<string, Obs[]> = {}, failed: Record<string, string> = {};
const fred = [...new Set(f.signals.map((s) => s.series).filter((x): x is string => !!x?.startsWith("fred:")))];
const yahoo = [...new Set([...f.signals.flatMap((s) => s.symbols ?? []), ...f.signals.map((s) => s.series).filter((x): x is string => !!x?.startsWith("yahoo:")).map((x) => x.slice(6))])];
const since = new Date(now.getTime() - 800 * 864e5).toISOString().slice(0, 10), front = wtiFront(today);
await Promise.all([
  ...fred.map(async (k) => { try { data[k] = await fetchDaily({ id: k, provider: "fred", ref: k.slice(5), label: k, unit: "pct", frequency: "daily" }, since, 20_000); } catch (e) { failed[k] = (e as Error).message; } }),
  ...yahoo.map(async (x) => { try { data[`yahoo:${x}`] = (await yahooDaily(x, 600, 20_000)).map((b) => ({ t: b.t, v: b.c })); } catch (e) { failed[`yahoo:${x}`] = (e as Error).message; } }),
  (async () => { try { const [cl, fr] = await Promise.all([yahooDaily("CL=F", 60, 20_000).catch(() => []), yahooDaily(front.yahoo, 60, 20_000)]);
    const s = frontContinuous(cl.map((b) => ({ t: b.t, v: b.c })), fr.map((b) => ({ t: b.t, v: b.c })), front.code); if (s.junction == null && !fr.length) throw new Error("front contract empty"); data.wti_front = s.series; } catch (e) { failed.wti_front = (e as Error).message; } })(),
]);
const evals = evaluateAll(f, data, today);
const { state, newlyTriggered, transitions } = updateState(prev, evals, today);
const md = renderCrisis(f, evals, state, now, today, newlyTriggered) + (Object.keys(failed).length ? `\n\n_抓取失败（按无数据处理）：${Object.entries(failed).map(([k, v]) => `${k}: ${v}`).join("；")}_` : "");
mkdirSync("data/out", { recursive: true });
writeFileSync("data/out/crisis-path-latest.md", md + "\n"); writeFileSync(`data/out/crisis-path-${today}.md`, md + "\n");
writeFileSync("data/out/crisis-path-latest.json", JSON.stringify({ generatedAt: now.toISOString(), date: today, evals, ...scorePaths(f, evals, state), transitions, newlyTriggered, failed }, null, 2) + "\n");
if (!values.dry) writeFileSync(values.state!, JSON.stringify(state, null, 2) + "\n");
process.stdout.write(md + `\n\n[crisis-path] ${today} · ${evals.filter((e) => e.status === "nodata").length} 无数据 · state ${values.dry ? "not written (--dry)" : values.state}\n`);
