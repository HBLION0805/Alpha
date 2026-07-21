import {
  parseTwelveDataLiveSmokeArguments,
  runInitialTwelveDataLiveSmoke,
} from "../src/integration/market-data/twelve-data/TwelveDataLiveSmoke.ts";

const CONFIRMATION_FLAG = "--confirm-live-smoke";

async function main() {
  console.log("LIVE SMOKE ONLY — NO TRADING OR DECISION AUTHORIZATION");
  try {
    const options = parseTwelveDataLiveSmokeArguments(process.argv.slice(2));
    const summary = await runInitialTwelveDataLiveSmoke({ ...options, environment: process.env });
    console.log(JSON.stringify(summary, null, 2));
    if (!options.confirmed) {
      console.log(`Dry run complete. Re-run with ${CONFIRMATION_FLAG} only after owner authorization.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Twelve Data live-smoke command failed safely.");
    process.exitCode = 1;
  }
}

void main();
