import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateHistoricalReplayConfig } from "../src/engines/options-historical-replay/OptionsHistoricalReplayEngine.ts";
import { fixtureHistoricalReplayCases } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { buildHistoricalReplayReport, createHistoricalReplayRun } from "../src/engines/options-historical-replay/OptionsHistoricalReplayReview.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";

const usage = "--help | --demo | --record-demo | --input <local config JSON> | --report";
export function runOptionsHistoricalReplayCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { command: "options:historical-replay", usage, executionAllowed: false,
    meaning: "Independent counterfactual research trials. Dataset lookup uses existing local market imports. No credentials, network or broker orders." };
  if (args.length === 1 && args[0] === "--demo") return buildHistoricalReplayReport(fixtureHistoricalReplayCases().map((item) => createHistoricalReplayRun(item.config, item.evidence, item.recordedAt)));
  if (args.length === 1 && args[0] === "--record-demo") {
    let changed = 0;
    for (const item of fixtureHistoricalReplayCases()) {
      const update = withOptionsHistoricalReplayRepository(workspaceRoot, (repository) => repository.append(item.config, item.evidence, now()));
      if (update.changed) changed++;
    }
    return { runsAppended: changed, ...withOptionsHistoricalReplayRepository(workspaceRoot, (repository) => repository.readReport()) };
  }
  if (args.length === 1 && args[0] === "--report") return withOptionsHistoricalReplayRepository(workspaceRoot, (repository) => repository.readReport());
  if (args.length === 2 && args[0] === "--input" && !args[1].startsWith("--")) {
    const path = resolve(workspaceRoot, args[1]), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error("HISTORICAL_INVALID_OR_OVERSIZED_INPUT_FILE");
    const bytes = readFileSync(path);
    if (bytes.byteLength > 64 * 1024) throw new Error("HISTORICAL_INVALID_OR_OVERSIZED_INPUT_FILE");
    const config = validateHistoricalReplayConfig(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    const evidence = withOptionsMarketEvidenceRepository(workspaceRoot, (repository) => repository.readEvidence(config.datasetId)) ?? null;
    return withOptionsHistoricalReplayRepository(workspaceRoot, (repository) => repository.append(config, evidence, now()));
  }
  throw new Error(`HISTORICAL_UNSUPPORTED_COMMAND: ${usage}`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsHistoricalReplayCommand(process.argv.slice(2)), null, 2)); }
  catch (error) {
    console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "HISTORICAL_COMMAND_FAILED" }));
    process.exitCode = 2;
  }
}
