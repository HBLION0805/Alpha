import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateOptionsRetailFeasibility } from "../src/engines/options-retail-feasibility/OptionsRetailFeasibilityEngine.ts";

const root = resolve(import.meta.dirname, "..");
const MAX_INPUT_BYTES = 65536;

function readScenario(path) {
  const size = statSync(path).size;
  if (size > MAX_INPUT_BYTES) throw new Error("Scenario JSON exceeds 64 KiB.");
  return JSON.parse(readFileSync(path, "utf8"));
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Alpha GLD / IBIT offline options feasibility");
    console.log("Usage: npm run options:feasibility -- --demo");
    console.log("       npm run options:feasibility -- --input <scenario.json>");
    console.log("Inputs are manual scenarios, not verified quotes. NO_TRADE is a normal diagnostic result.");
    console.log("Compare premium stops from 10% to 25% and net 1.5R to 2R targets. Demo uses an unvalidated 20% research default.");
    console.log("One R includes round-trip fees and exit slippage, with a fixed 0.5% equity budget and separate $25 full-premium stress cap.");
    console.log("No brokerage connection, probability prediction, or trading permission is provided.");
  } else if (args.length === 0 || (args.length === 1 && args[0] === "--demo")) {
    const scenarios = ["gld-normal", "ibit-conditional"].map((name) => ({
      name,
      result: evaluateOptionsRetailFeasibility(readScenario(resolve(root, `fixtures/options-retail-feasibility/${name}.json`))),
    }));
    console.log(JSON.stringify({
      title: "Alpha GLD / IBIT Options Feasibility",
      evidenceOrigin: "MANUAL_SCENARIO",
      pricesAreIllustrative: true,
      researchDefaultStopLossBps: 2000,
      researchDefaultIsValidated: false,
      executionAllowed: false,
      scenarios,
    }, null, 2));
  } else if (args.length === 2 && args[0] === "--input" && !args[1].startsWith("--")) {
    console.log(JSON.stringify(evaluateOptionsRetailFeasibility(readScenario(resolve(args[1]))), null, 2));
  } else {
    throw new Error("Use --demo, --input <scenario.json>, or --help. No live mode exists.");
  }
} catch (error) {
  console.error(JSON.stringify({ status: "INPUT_ERROR", executionAllowed: false, message: error.message }));
  process.exitCode = 2;
}
