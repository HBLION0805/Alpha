import {
  parseKalshiLiveReadSmokeArguments,
  runInitialKalshiLiveReadSmoke,
} from "../src/integration/event-contract/kalshi/KalshiEventContractLiveSmoke.ts";

const CONFIRMATION_FLAG = "--confirm-live-read";

async function main() {
  console.log("LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION");
  try {
    const options = parseKalshiLiveReadSmokeArguments(process.argv.slice(2));
    const summary = await runInitialKalshiLiveReadSmoke(options);
    console.log(JSON.stringify(summary, null, 2));
    if (!options.confirmed) {
      console.log(`Dry run complete. Re-run with ${CONFIRMATION_FLAG} only after separate owner authorization.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Kalshi live-read command failed safely.");
    process.exitCode = 1;
  }
}

void main();
