/** npm run flatten -- --before 15:45 [--lead 5] [--symbols META,RSP] [--dry-run] [--force] [--log data/journal/flatten-YYYY-MM-DD.jsonl]
 *  Alpaca PAPER only. For an external scheduler (cron / routine) — call it every minute from before−lead; reruns are no-ops once flat.
 *  Exit 0 = flat (or too early / dry-run), 2 = something still open after the run, 1 = error. */
import { parseArgs } from "node:util";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { alpacaPaperHttp } from "../adapters/alpacaPaper.ts";
import { flatten } from "../paper/flatten.ts";

const { values } = parseArgs({ options: { before: { type: "string", default: "15:45" }, lead: { type: "string", default: "5" }, symbols: { type: "string" }, "dry-run": { type: "boolean" }, force: { type: "boolean" }, log: { type: "string" } } });
const now = new Date(), day = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const log = values.log ?? `data/journal/flatten-${day}.jsonl`;
try {
  const r = await flatten({ http: alpacaPaperHttp(), now, before: values.before!, leadMin: Number(values.lead), symbols: values.symbols?.split(",").map((s) => s.trim()).filter(Boolean), dryRun: !!values["dry-run"], force: !!values.force });
  mkdirSync(dirname(log), { recursive: true }); appendFileSync(log, JSON.stringify({ runAt: now.toISOString(), before: values.before, ...r }) + "\n");
  for (const s of r.steps) console.error(`[flatten] ${s.action}${s.symbol ? " " + s.symbol : ""}${s.id ? " " + s.id : ""} → ${s.status}${s.detail ? " (" + s.detail + ")" : ""}`);
  console.error(`[flatten] ${r.mode} window=${r.window} ok=${r.ok} remaining positions=[${r.remainingPositions.join(", ")}] orders=[${r.remainingOrders.join(", ")}] → ${log}`);
  process.exitCode = r.ok ? 0 : 2;
} catch (e) { console.error(`[flatten] error: ${(e as Error).message}`); process.exitCode = 1; }
