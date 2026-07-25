import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_HELP,
  runCollectionRunnerRecoveryControlConsole,
} from "../src/engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlConsole.ts";

try {
  const args = process.argv.slice(2);
  console.log(
    args.length === 0
      ? COLLECTION_RUNNER_RECOVERY_CONTROL_HELP
      : runCollectionRunnerRecoveryControlConsole(args),
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Recovery-control command failed closed.",
  );
  process.exitCode = 1;
}
