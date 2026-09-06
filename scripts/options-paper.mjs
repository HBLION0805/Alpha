import { readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { appendOptionsPaperScenario, paperFingerprint, replayOptionsPaperAccount } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";

const args = process.argv.slice(2);
try {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Alpha local options lifecycle: --demo (isolated in-memory fixtures), --record-demo (persist fixtures), --input <local JSON> (append/resume local simulation), --report (replay saved history). No brokerage operation exists.");
  } else if (args.length === 1 && args[0] === "--demo") {
    let scenarios = [];
    for (const input of optionsPaperDemoScenarios()) scenarios = appendOptionsPaperScenario(scenarios, input).scenarios;
    console.log(JSON.stringify(replayOptionsPaperAccount(scenarios), null, 2));
  } else if (args.length === 1 && args[0] === "--record-demo") {
    // Reopening between batches exercises recovery, including an open position awaiting exit liquidity.
    let report;
    let changed = 0;
    // A fully recorded demo is idempotent; its earlier partial liquidity input must not rewind the completed revision.
    const existing = withOptionsPaperRepository(process.cwd(), (repository) => repository.readReport());
    const fixtures = optionsPaperDemoScenarios();
    const latestFixtures = new Map(fixtures.map((input) => [input.scenarioId, input]));
    for (const input of fixtures) {
      const saved = withOptionsPaperRepository(process.cwd(), (repository) => repository.readScenario(input.scenarioId));
      if (saved && paperFingerprint(saved) === paperFingerprint(latestFixtures.get(input.scenarioId))) continue;
      if (saved && saved.quotes.length > input.quotes.length) throw new Error("DEMO_SCENARIO_COLLISION");
      const result = withOptionsPaperRepository(process.cwd(), (repository) => repository.append(input));
      if (result.changed) changed++;
      report = result.report;
    }
    report ??= existing;
    console.log(JSON.stringify({ batchesAppended: changed, ...report }, null, 2));
  } else if (args.length === 1 && args[0] === "--report") {
    console.log(JSON.stringify(withOptionsPaperRepository(process.cwd(), (repository) => repository.readReport()), null, 2));
  } else if (args.length === 2 && args[0] === "--input") {
    const path = resolve(args[1]);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error("INVALID_OR_OVERSIZED_PAPER_INPUT_FILE");
    const input = JSON.parse(readFileSync(path, "utf8"));
    console.log(JSON.stringify(withOptionsPaperRepository(process.cwd(), (repository) => repository.append(input)), null, 2));
  } else throw new Error("Use --help for the supported local simulation commands.");
} catch (error) {
  console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "PAPER_COMMAND_FAILED" }));
  process.exitCode = 2;
}
