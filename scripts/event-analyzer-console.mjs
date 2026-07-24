import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_ANALYZER_HELP, EVENT_ANALYZER_USAGE, runEventAnalyzerConsole } from "../src/engines/event-analyzer/EventAnalyzerConsole.ts";

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") console.log(EVENT_ANALYZER_HELP);
  else console.log(runEventAnalyzerConsole(args, (path) => JSON.parse(readFileSync(resolve(path), "utf8"))));
} catch (error) {
  console.error(error instanceof Error ? error.message : EVENT_ANALYZER_USAGE);
  process.exitCode = 1;
}
