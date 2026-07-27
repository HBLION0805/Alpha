import {
  createTwelveDataPersonalMulsReferenceCommandInput,
  parseTwelveDataPersonalMulsReferenceCommandArguments,
} from "../src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceCommand.ts";
import {
  TwelveDataPersonalMulsReferenceLiveError,
  runTwelveDataPersonalMulsReferenceLiveOperation,
} from "../src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceLiveOperation.ts";

async function main() {
  console.log(
    "REFERENCE DATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY",
  );
  try {
    const options =
      parseTwelveDataPersonalMulsReferenceCommandArguments(process.argv.slice(2));
    const input = createTwelveDataPersonalMulsReferenceCommandInput(
      options,
      process.env,
    );
    const result =
      await runTwelveDataPersonalMulsReferenceLiveOperation(input);
    console.log(JSON.stringify(result, null, 2));
    if (!options.confirmed) {
      console.log(
        "Dry run complete. A real read requires fresh Owner authorization bound to the UTC date and exact request fingerprint.",
      );
    }
  } catch (error) {
    if (error instanceof TwelveDataPersonalMulsReferenceLiveError) {
      console.error(JSON.stringify(error.toJSON()));
    } else {
      console.error(
        "Twelve Data MULS reference command failed safely.",
      );
    }
    process.exitCode = 1;
  }
}

void main();
