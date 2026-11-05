/**
 * npm run shadow            — forward shadow tracking of the pre-registered backtest tracks A (v2a) and B (v2b + 200DMA short block).
 * npm run shadow -- report  — per-track equity, trades, win rate, expectancy, t, max DD vs SPY buy & hold since the start date.
 * Idempotent per trading day: each final SPY daily bar is processed once (data/out/shadow/ledger.json). Run after the post-close
 * (≥16:00 ET) brief; a bar for today waits until that brief exists. Read-only data (Yahoo daily bars + brief-latest.json); no broker calls.
 * Never touches the paper journal; never counted toward readiness, caps or sins. Spec: docs/SHADOW_TRACKS.md.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { yahooDaily } from "../adapters/yahoo.ts";
import { loadMajorEvents } from "../options/majorEvents.ts";
import { newLedger, processBars, shadowReport, type Bar, type DayInput, type Ledger } from "../shadow/engine.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { ledger: { type: "string", default: "data/out/shadow/ledger.json" }, brief: { type: "string", default: "data/out/brief-latest.json" }, now: { type: "string" } } });
const path = values.ledger!, now = values.now ? new Date(values.now) : new Date();
const etDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const etHm = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
const load = (): Ledger | null => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null);
const save = (L: Ledger) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path + ".tmp", JSON.stringify(L, null, 1) + "\n"); renameSync(path + ".tmp", path); };

if (positionals[0] === "report") {
  const L = load(); if (!L) { process.stdout.write("[shadow] 还没有账本（先运行 npm run shadow）\n"); process.exit(0); }
  process.stdout.write(["# 影子跟踪报告", "", ...shadowReport(L!)].join("\n") + "\n");
  process.exit(0);
}
if (positionals[0]) { process.stderr.write("用法：npm run shadow [-- report]\n"); process.exit(2); }

const today = etDay(now), afterClose = etHm(now) >= "16:10";
const bars: Bar[] = (await yahooDaily("SPY", 420)).filter((b) => b.t < today || (b.t === today && afterClose)).map(({ t, o, h, l, c }) => ({ t, o, h, l, c }));
if (bars.length < 210) { process.stderr.write(`[shadow] SPY 日线不足（${bars.length}）→ 不处理\n`); process.exit(1); }
// the day's leader snapshot: only a brief generated after the close of that ET day counts (the 16:30 run)
const brief = existsSync(values.brief!) ? JSON.parse(readFileSync(values.brief!, "utf8")) as { generatedAt: string; verdict?: string; leader?: string | null } : null;
const bDay = brief ? etDay(new Date(brief.generatedAt)) : null, bPost = brief ? etHm(new Date(brief.generatedAt)) >= "16:00" : false;
const days: Record<string, DayInput> = {};
if (brief && bPost && bDay) {
  const asof = async (sym: string, yld: boolean) => { const s = (await yahooDaily(sym, 40).catch(() => [])).filter((b) => b.t <= bDay); const j = s.length - 1;
    return j >= 5 ? (yld ? (s[j]!.c - s[j - 5]!.c) * 100 : (s[j]!.c / s[j - 5]!.c - 1) * 100) : null; };
  const [y10, dxy, wti] = await Promise.all([asof("^TNX", true), asof("DX-Y.NYB", false), asof("CL=F", false)]);
  days[bDay] = { date: bDay, leader: brief.leader ?? null, verdict: brief.verdict ?? null, briefAt: brief.generatedAt, y10_5d: y10, dxy_5d: dxy, wti_5d: wti };
}
// today's bar waits for its post-close brief (otherwise the leader would be "missing" for a day that will get one)
const usable = bars.filter((b) => !(b.t === today && !days[b.t]));
if (usable.length < bars.length) process.stdout.write(`[shadow] ${today} 的收盘后简报还没有 → 今天的 K 线等 16:30 简报后再处理\n`);
let L = load();
const lastBar = usable.at(-1)!.t;
if (!L) { L = newLedger(lastBar); process.stdout.write(`[shadow] 新账本：起点 = ${lastBar} 收盘（第一次运行 ${today} ${etHm(now)} ET）\n`); }
const events = loadMajorEvents().events;
const lines = processBars(L, usable, days, events);
save(L);
process.stdout.write((lines.length ? lines : [`[shadow] 没有新的交易日（最新已处理 ${L.lastDate}）→ 不变`]).join("\n") + "\n");
