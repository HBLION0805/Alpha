import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { routeOptionsWorkContinuation } from "../src/engines/options-readiness/OptionsWorkContinuation.ts";
export function runOptionsWorkContinuationCommand(args, { now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:work-continuation -- --route armed|daily", meaning: "Read actual time and return a host action; no source, scheduler, account or journal operation.", executionAllowed: false };
  if (args.length !== 2 || args[0] !== "--route") throw Error("WORK_CONTINUATION_ARGUMENTS");
  return routeOptionsWorkContinuation(args[1], now());
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsWorkContinuationCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "WORK_CONTINUATION_ERROR", code: /^(?:WORK_CONTINUATION_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "WORK_CONTINUATION_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
