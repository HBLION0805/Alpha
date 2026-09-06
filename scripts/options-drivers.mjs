import { resolve } from "node:path";
import { OPTIONS_DRIVER_FACTORS } from "../src/engines/options-drivers/OptionsDriverCatalog.ts";
import { buildOptionsDriverReport, createDriverObservation, OPTIONS_DRIVER_SOURCES, selectNewDriverObservations, validateDriverSourceHealth, validateStoredDriverObservation } from "../src/engines/options-drivers/OptionsDriverMonitorEngine.ts";
import { parseDriverFeed, readPublicDriverFeed, withDriverJournal } from "./lib/options-driver-io.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !["--catalog", "--refresh", "--report", "--demo", "--help"].includes(args[0]))) throw new Error("Use --catalog, --refresh, --report, --demo or --help; arbitrary sources and brokerage modes are unsupported.");
  const mode = args[0] ?? "--report";
  const asOf = new Date().toISOString();
  if (mode === "--help") {
    console.log("Alpha GLD/IBIT driver monitor: --catalog, --refresh, --report, --demo.");
    console.log("--refresh reads six fixed official public feeds once and saves local headline history. --report uses saved history only.");
    console.log("No background service, calibrated forecast, account access or trading execution is provided.");
  } else if (mode === "--catalog") {
    console.log(JSON.stringify({ asOf, executionAllowed: false, coverageComplete: false, factors: OPTIONS_DRIVER_FACTORS }, null, 2));
  } else if (mode === "--demo") {
    const item = createDriverObservation({ sourceId: "fed", itemId: "synthetic-policy", link: "https://www.federalreserve.gov/", headline: "Illustrative monetary policy and interest rates scenario", publishedAt: asOf, observedAt: asOf, origin: "MANUAL_SCENARIO" });
    console.log(JSON.stringify(buildOptionsDriverReport([item], [], asOf), null, 2));
  } else {
    const refreshed = mode === "--refresh" ? await Promise.all(OPTIONS_DRIVER_SOURCES.map(async (source) => {
      try {
        const xml = await readPublicDriverFeed(source.id);
        const observedAt = new Date().toISOString();
        const parsed = parseDriverFeed(xml, source.id, observedAt);
        const observations = parsed.items.map(createDriverObservation);
        return { observations, health: { sourceId: source.id, observedAt, status: observations.length ? "OK" : "EMPTY", itemsReceived: observations.length, truncated: parsed.truncated,
          diagnostic: parsed.rejectedItems ? `${parsed.rejectedItems} invalid headline items rejected` : null } };
      } catch (error) {
        return { observations: [], health: { sourceId: source.id, observedAt: new Date().toISOString(), status: "FAILED", itemsReceived: 0, truncated: false,
          diagnostic: /^(?:HTTP_\d+|FEED_TOO_LARGE|UNEXPECTED_CONTENT_TYPE|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|EMPTY_RESPONSE_BODY)$/.test(error.message) ? error.message : "FETCH_OR_PARSE_FAILED" } };
      }
    })) : [];
    const report = withDriverJournal(root, (store) => {
      const existing = store.observations.map(validateStoredDriverObservation);
      const health = store.health.map(validateDriverSourceHealth);
      const added = selectNewDriverObservations(existing, refreshed.flatMap((batch) => batch.observations));
      const result = { ...buildOptionsDriverReport([...existing, ...added], [...health, ...refreshed.map((batch) => batch.health)], new Date().toISOString()),
        mode, newlySavedObservations: added.length, journalDirectory: store.directory };
      // Validate both observations and health before publishing one checked refresh envelope.
      store.appendBatch(added, refreshed.map((batch) => batch.health));
      return result;
    });
    console.log(JSON.stringify(report, null, 2));
    if (refreshed.some((batch) => batch.health.status === "FAILED")) process.exitCode = 3;
  }
} catch (error) {
  console.error(JSON.stringify({ status: "DRIVER_MONITOR_ERROR", executionAllowed: false, message: error.message }));
  process.exitCode = 2;
}
