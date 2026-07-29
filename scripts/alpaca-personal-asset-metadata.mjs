import {
  createAlpacaPersonalAssetMetadataCommandInput,
  parseAlpacaPersonalAssetMetadataCommandArguments,
} from "../src/integration/market-data/alpaca/AlpacaPersonalAssetMetadataCommand.ts";
import {
  AlpacaPersonalAssetMetadataError,
  runAlpacaPersonalMulsAssetMetadataDiagnostic,
} from "../src/integration/market-data/alpaca/AlpacaPersonalAssetMetadataDiagnostic.ts";
import {
  PersonalMulsScopeRetiredError,
  rejectRetiredPersonalMulsLiveOperation,
} from "../src/integration/market-data/PersonalMulsScopeRetirement.ts";

async function main() {
  try {
    rejectRetiredPersonalMulsLiveOperation();
    console.log("ASSET METADATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY");
    const options = parseAlpacaPersonalAssetMetadataCommandArguments(process.argv.slice(2));
    const input = createAlpacaPersonalAssetMetadataCommandInput(options, process.env);
    const result = await runAlpacaPersonalMulsAssetMetadataDiagnostic(input);
    console.log(JSON.stringify(result, null, 2));
    if (!options.confirmed) {
      console.log("Dry run complete. A real read requires fresh Owner authorization and the exact confirmation flag.");
    }
  } catch (error) {
    if (error instanceof PersonalMulsScopeRetiredError) {
      console.error(JSON.stringify(error.toJSON()));
    } else if (error instanceof AlpacaPersonalAssetMetadataError) {
      console.error(JSON.stringify(error.toJSON()));
    } else {
      console.error("Alpaca MULS asset-metadata command failed safely.");
    }
    process.exitCode = 1;
  }
}

void main();
