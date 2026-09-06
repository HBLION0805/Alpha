import { OPTIONS_DRIVER_FACTORS } from "./OptionsDriverCatalog";
import { buildOptionsDriverReport, createDriverObservation, OPTIONS_DRIVER_SOURCES, selectNewDriverObservations, validateDriverSourceHealth, validateStoredDriverObservation } from "./OptionsDriverMonitorEngine";
import { equal, harness, throws, truth } from "../options-market-context/testing/OptionsContextTestSupport";

const h = harness("Options Driver Monitor");
const asOf = "2026-09-06T12:00:00.000Z";
const base = { sourceId: "fed", itemId: "policy-1", headline: "Federal Reserve monetary policy interest rates decision", link: "https://www.federalreserve.gov/", publishedAt: "2026-09-05T12:00:00.000Z", observedAt: asOf, origin: "PUBLIC_FEED" as const };
const observed = createDriverObservation(base);
const ok = { sourceId: "fed", status: "OK" as const, observedAt: asOf, itemsReceived: 1, truncated: false, diagnostic: null };

h.test("catalog has 16 distinct scoped families and primary source context", () => {
  equal(OPTIONS_DRIVER_FACTORS.length, 16);
  equal(new Set(OPTIONS_DRIVER_FACTORS.map((factor) => factor.id)).size, 16);
  for (const factor of OPTIONS_DRIVER_FACTORS) {
    truth(factor.assets.every((asset) => asset === "GLD" || asset === "IBIT"));
    truth(factor.sources.length > 0 && factor.indicators.length > 0);
    truth(Object.isFrozen(factor.indicators) && Object.isFrozen(factor.sources));
  }
});
h.test("fresh headline is a candidate only and never quantitative evidence", () => {
  const report = buildOptionsDriverReport([observed], [ok], asOf);
  const policy = report.factors.find((factor) => factor.id === "monetary_policy")!;
  equal(policy.headlineCoverage, "RECENT_CANDIDATE"); equal(policy.direction, "UNDETERMINED");
  equal(policy.quantitativeCoverage, "NOT_CONNECTED"); equal(report.executionAllowed, false);
  equal(report.probability, null); equal(report.coverageComplete, false);
});
h.test("manual demo cannot claim live headline coverage", () => {
  const report = buildOptionsDriverReport([createDriverObservation({ ...base, origin: "MANUAL_SCENARIO" })], [], asOf);
  truth(report.factors.every((factor) => factor.recentPublicCandidateCount === 0));
});
for (const [label, publishedAt] of [["stale", "2026-08-01T12:00:00.000Z"], ["future", "2026-09-07T12:00:00.000Z"], ["undated", null]] as const) {
  h.test(`${label} headline never counts as fresh`, () => {
    const report = buildOptionsDriverReport([createDriverObservation({ ...base, publishedAt })], [], asOf);
    truth(report.factors.every((factor) => factor.recentPublicCandidateCount === 0));
  });
}
h.test("as-of replay excludes evidence first discovered later", () => {
  equal(buildOptionsDriverReport([observed], [], "2026-09-06T11:00:00.000Z").currentItemVersions, 0);
});
h.test("missing observations and health remain unknown", () => {
  const report = buildOptionsDriverReport([], [], asOf);
  truth(report.factors.every((factor) => factor.headlineCoverage === "NO_MATCHING_OBSERVATION"));
  truth(report.sources.every((source) => source.refreshOverdue && source.health.status === "NOT_REFRESHED"));
});
h.test("cached successful health exposes overdue refresh", () => {
  const report = buildOptionsDriverReport([], [{ ...ok, observedAt: "2026-09-05T12:00:00.000Z" }], asOf);
  equal(report.sources[0]!.refreshOverdue, true);
});
h.test("a failed refresh does not delete historical evidence", () => {
  const report = buildOptionsDriverReport([observed], [{ ...ok, status: "FAILED", itemsReceived: 0, diagnostic: "HTTP_503" }], asOf);
  equal(report.sources[0]!.health.status, "FAILED"); equal(report.observationsInHistory, 1);
});
h.test("same-clock source failure supersedes older success", () => {
  const failed = { ...ok, status: "FAILED" as const, itemsReceived: 0, diagnostic: "HTTP_503" };
  equal(buildOptionsDriverReport([], [ok, failed], asOf).sources[0]!.health.status, "FAILED");
});
h.test("repeated unchanged content retains original first-seen record", () => {
  const repeated = createDriverObservation({ ...base, observedAt: "2026-09-06T13:00:00.000Z" });
  equal(selectNewDriverObservations([observed], [repeated]).length, 0);
});
h.test("A to B to A reversion is saved and latest revision wins", () => {
  const b = createDriverObservation({ ...base, headline: "Corrected inflation policy observation", observedAt: "2026-09-06T13:00:00.000Z" });
  const aAgain = createDriverObservation({ ...base, observedAt: "2026-09-06T14:00:00.000Z" });
  equal(selectNewDriverObservations([observed, b], [aAgain]).length, 1);
  const report = buildOptionsDriverReport([observed, b, aAgain], [], "2026-09-06T15:00:00.000Z");
  equal(report.currentItemVersions, 1);
  equal(report.factors.find((factor) => factor.id === "monetary_policy")!.candidates[0]!.headline, base.headline);
});
h.test("same-clock revisions use journal order instead of hash order", () => {
  const correction = createDriverObservation({ ...base, headline: "Updated monetary policy rates decision" });
  const report = buildOptionsDriverReport([observed, correction], [], asOf);
  equal(report.factors.find((factor) => factor.id === "monetary_policy")!.candidates[0]!.headline, correction.headline);
});
h.test("clock rollback cannot append an apparently earlier discovery", () => {
  throws(() => selectNewDriverObservations([observed], [createDriverObservation({ ...base, observedAt: "2026-09-05T13:00:00.000Z" })]), "DRIVER_OBSERVATION_CLOCK_REGRESSION");
});
for (const key of ["headline", "observedAt", "sourceUrl", "contentFingerprint", "fingerprint"] as const) {
  h.test(`journal checksum rejects ${key} substitution`, () => {
    throws(() => validateStoredDriverObservation({ ...observed, [key]: key === "observedAt" ? "2026-09-06T11:00:00.000Z" : "tampered" }), "DRIVER_JOURNAL_INTEGRITY_FAILURE");
  });
}
h.test("unregistered source and extra observation authority are rejected", () => {
  throws(() => createDriverObservation({ ...base, sourceId: "broker" }), "UNREGISTERED_DRIVER_SOURCE");
  throws(() => createDriverObservation({ ...base, executionAllowed: true }), "INVALID_DRIVER_FIELDS");
});
for (const link of ["javascript:alert(1)", "file:///secret", "https://user:secret@example.com/", "https://example.com\\evil/"]) {
  h.test(`unsafe link ${link} is rejected`, () => { throws(() => createDriverObservation({ ...base, link }), "INVALID_DRIVER_LINK"); });
}
h.test("health must use registered sources and exact typed fields", () => {
  for (const change of [{ status: "APPROVED" }, { itemsReceived: -1 }, { itemsReceived: 101 }, { itemsReceived: 0 }, { observedAt: "today" }, { observedAt: null }, { truncated: "yes" }, { executionAllowed: true }]) {
    throws(() => validateDriverSourceHealth({ ...ok, ...change }), "itemsReceived" in change && change.itemsReceived === 0 ? "INVALID_DRIVER_HEALTH_COUNTS" : "INVALID_DRIVER_HEALTH");
  }
});
h.test("output including nested candidates and sources is immutable", () => {
  const report = buildOptionsDriverReport([observed], [ok], asOf);
  truth(Object.isFrozen(report) && Object.isFrozen(report.factors[0]!.candidates) && Object.isFrozen(OPTIONS_DRIVER_SOURCES[0]));
});
h.test("health status rejects string-coercible arrays and objects", () => {
  for (const status of [["OK"], { toString: () => "OK" }, ["FAILED"], null, 1]) {
    throws(() => validateDriverSourceHealth({ ...ok, status, itemsReceived: 0 }), "INVALID_DRIVER_HEALTH");
  }
});
h.finish();
