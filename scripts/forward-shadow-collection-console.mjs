import {
  FORWARD_SHADOW_COLLECTION_USAGE,
  runForwardShadowCollectionConsole,
} from "../src/engines/forward-shadow-collection-control/ForwardShadowCollectionControlConsole.ts";

try {
  console.log(runForwardShadowCollectionConsole(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : FORWARD_SHADOW_COLLECTION_USAGE);
  process.exitCode = 1;
}
