import {
  createAlpacaLiveReadSmokeInput,
  parseAlpacaLiveReadCommandArguments,
} from "../src/integration/market-data/alpaca/AlpacaPersonalMarketDataLiveSmokeCommand.ts";
import {
  AlpacaLiveReadSmokeError,
  runAlpacaPersonalMarketDataLiveSmoke,
} from "../src/integration/market-data/alpaca/AlpacaPersonalMarketDataLiveSmoke.ts";

async function main() {
  console.log("LIVE READ ONLY -- NO TRADING OR DECISION AUTHORIZATION");
  try {
    const options = parseAlpacaLiveReadCommandArguments(process.argv.slice(2));
    const input = createAlpacaLiveReadSmokeInput(options, process.env);
    const summary = await runAlpacaPersonalMarketDataLiveSmoke(input);
    console.log(JSON.stringify(summary, null, 2));
    if (!options.confirmed) {
      console.log("Dry run complete. Add --confirm-alpaca-live-read only after fresh Owner authorization.");
    }
  } catch (error) {
    if (error instanceof AlpacaLiveReadSmokeError) {
      console.error(JSON.stringify(error.toJSON()));
    } else {
      console.error("Alpaca personal market-data live-read command failed safely.");
    }
    process.exitCode = 1;
  }
}

void main();
