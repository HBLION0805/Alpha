import { createHash } from "node:crypto";
import type { OptionsDriverObservation, OptionsDriverSource, OptionsDriverSourceHealth } from "../../contracts/OptionsDriverMonitor";
import { OPTIONS_DRIVER_FACTORS } from "./OptionsDriverCatalog";

export function freezeDriverValue<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDriverValue(child);
    Object.freeze(value);
  }
  return value;
}

/** Verified public endpoints, 2026-09-06. They are headline feeds, not market-data feeds. */
export const OPTIONS_DRIVER_SOURCES: readonly OptionsDriverSource[] = freezeDriverValue([
  { id: "fed", label: "Federal Reserve releases", url: "https://www.federalreserve.gov/feeds/press_all.xml", maxHeadlineAgeHours: 72 },
  { id: "bls", label: "BLS economic indicators", url: "https://www.bls.gov/feed/bls_latest.rss", maxHeadlineAgeHours: 72 },
  { id: "bea", label: "BEA economic releases", url: "https://apps.bea.gov/rss/rss.xml", maxHeadlineAgeHours: 72 },
  { id: "ecb", label: "European Central Bank releases", url: "https://www.ecb.europa.eu/rss/press.html", maxHeadlineAgeHours: 72 },
  { id: "ofac", label: "US Treasury OFAC actions", url: "https://ofac.treasury.gov/rss.xml", maxHeadlineAgeHours: 72 },
  { id: "sec", label: "SEC press releases", url: "https://www.sec.gov/news/pressreleases.rss", maxHeadlineAgeHours: 72 },
]);

export function requireDriverSource(id: string): OptionsDriverSource {
  const source = OPTIONS_DRIVER_SOURCES.find((value) => value.id === id);
  if (!source) throw new Error("UNREGISTERED_DRIVER_SOURCE");
  return source;
}
function utc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f]/u.test(value);
}
/** Local checksums prove content consistency only; neither source assertions nor headlines are independently verified facts. */
export function createDriverObservation(input: unknown): OptionsDriverObservation {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_DRIVER_OBSERVATION");
  const value = input as Record<string, unknown>;
  const fields = ["sourceId", "itemId", "link", "headline", "publishedAt", "observedAt", "origin"];
  if (Object.keys(value).length !== fields.length || Object.keys(value).some((key) => !fields.includes(key))) throw new Error("INVALID_DRIVER_FIELDS");
  if (!boundedString(value.sourceId, 40) || !boundedString(value.itemId, 1024) || !boundedString(value.link, 2048)
      || !boundedString(value.headline, 400) || !utc(value.observedAt)
      || (value.publishedAt !== null && !utc(value.publishedAt))
      || (value.origin !== "PUBLIC_FEED" && value.origin !== "MANUAL_SCENARIO")) throw new Error("INVALID_DRIVER_OBSERVATION");
  const source = requireDriverSource(value.sourceId);
  // Links are displayed, never fetched. Require HTTPS and exclude embedded credentials and backslashes.
  if (!/^https:\/\/[a-z0-9][a-z0-9.-]+\//iu.test(value.link) || /[@\\\s]/u.test(value.link)) throw new Error("INVALID_DRIVER_LINK");
  const body = { schemaVersion: "1.0" as const, sourceId: source.id, sourceUrl: source.url,
    itemId: value.itemId, link: value.link, headline: value.headline,
    publishedAt: value.publishedAt as string | null, origin: value.origin as OptionsDriverObservation["origin"] };
  // First seen time is retained by the journal; a repeated unchanged item is not a new version.
  const record = { ...body, observedAt: value.observedAt, contentFingerprint: digest(body) };
  return freezeDriverValue({ ...record, fingerprint: digest(record) });
}
export function validateStoredDriverObservation(input: unknown): OptionsDriverObservation {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_DRIVER_JOURNAL");
  const value = input as Record<string, unknown>;
  const { schemaVersion, sourceUrl, contentFingerprint, fingerprint, ...body } = value;
  const recreated = createDriverObservation(body);
  if (schemaVersion !== "1.0" || sourceUrl !== recreated.sourceUrl || contentFingerprint !== recreated.contentFingerprint || fingerprint !== recreated.fingerprint) throw new Error("DRIVER_JOURNAL_INTEGRITY_FAILURE");
  return recreated;
}

export function validateDriverSourceHealth(input: unknown): OptionsDriverSourceHealth {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_DRIVER_HEALTH");
  const value = input as Record<string, unknown>;
  const keys = ["sourceId", "status", "observedAt", "itemsReceived", "truncated", "diagnostic"];
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))
    || typeof value.sourceId !== "string" || typeof value.status !== "string" || !["OK", "EMPTY", "FAILED", "NOT_REFRESHED"].includes(value.status)
    || (value.observedAt !== null && !utc(value.observedAt))
    || (value.status !== "NOT_REFRESHED" && value.observedAt === null)
    || typeof value.itemsReceived !== "number" || !Number.isSafeInteger(value.itemsReceived) || value.itemsReceived < 0 || value.itemsReceived > 100
    || typeof value.truncated !== "boolean" || (value.diagnostic !== null && !boundedString(value.diagnostic, 240))) throw new Error("INVALID_DRIVER_HEALTH");
  requireDriverSource(value.sourceId);
  if ((value.status === "OK" && value.itemsReceived === 0) || (["EMPTY", "FAILED", "NOT_REFRESHED"].includes(value.status) && value.itemsReceived !== 0)) throw new Error("INVALID_DRIVER_HEALTH_COUNTS");
  return freezeDriverValue({ ...value } as unknown as OptionsDriverSourceHealth);
}

/** Consecutive-version dedupe preserves A -> B -> A corrections in append order. */
export function selectNewDriverObservations(history: readonly OptionsDriverObservation[], incoming: readonly OptionsDriverObservation[]): readonly OptionsDriverObservation[] {
  const current = new Map<string, string>();
  const identity = (item: OptionsDriverObservation) => `${item.origin}:${item.sourceId}:${item.itemId}`;
  let latestObserved = "";
  for (const input of history) {
    const item = validateStoredDriverObservation(input);
    current.set(identity(item), item.contentFingerprint);
    if (item.observedAt > latestObserved) latestObserved = item.observedAt;
  }
  const added: OptionsDriverObservation[] = [];
  for (const input of incoming) {
    const item = validateStoredDriverObservation(input);
    if (item.observedAt < latestObserved) throw new Error("DRIVER_OBSERVATION_CLOCK_REGRESSION");
    const key = identity(item);
    if (current.get(key) !== item.contentFingerprint) { current.set(key, item.contentFingerprint); added.push(item); }
  }
  return freezeDriverValue(added);
}

export function buildOptionsDriverReport(observations: readonly OptionsDriverObservation[], health: readonly OptionsDriverSourceHealth[], asOf: string) {
  if (!utc(asOf)) throw new Error("INVALID_DRIVER_AS_OF");
  const validHealth = health.map(validateDriverSourceHealth);
  const now = Date.parse(asOf);
  const latest = new Map<string, OptionsDriverObservation>();
  for (const input of observations) {
    const observation = validateStoredDriverObservation(input);
    if (Date.parse(observation.observedAt) > now) continue; // As-of reports cannot use later discoveries.
    const key = `${observation.origin}:${observation.sourceId}:${observation.itemId}`;
    const previous = latest.get(key);
    // Input order is append order. A later journal revision wins a same-clock tie.
    if (!previous || observation.observedAt >= previous.observedAt) latest.set(key, observation);
  }
  const current = [...latest.values()];
  const freshness = (item: OptionsDriverObservation): string => {
    if (item.publishedAt === null) return "UNDATED";
    const published = Date.parse(item.publishedAt);
    if (published > Date.parse(item.observedAt) || published > now) return "FUTURE_DATED";
    return now - published <= requireDriverSource(item.sourceId).maxHeadlineAgeHours * 3600000 ? "RECENT" : "STALE";
  };
  const sources = OPTIONS_DRIVER_SOURCES.map((source) => {
    const records = validHealth.filter((record) => record.sourceId === source.id && record.observedAt !== null && Date.parse(record.observedAt) <= now).reverse()
      .sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? ""));
    const last = records[0];
    return { ...source, health: last ?? { sourceId: source.id, status: "NOT_REFRESHED" as const, observedAt: null, itemsReceived: 0, truncated: false, diagnostic: null },
      healthAgeHours: last?.observedAt ? (now - Date.parse(last.observedAt)) / 3600000 : null,
      refreshOverdue: !last?.observedAt || now - Date.parse(last.observedAt) > 3600000 };
  });
  const factors = OPTIONS_DRIVER_FACTORS.map((factor) => {
    const matches = current.filter((item) => factor.keywords.some((keyword) => {
      const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "iu").test(item.headline);
    }));
    const recent = matches.filter((item) => item.origin === "PUBLIC_FEED" && freshness(item) === "RECENT");
    return { ...factor, headlineCoverage: recent.length > 0 ? "RECENT_CANDIDATE" : matches.length > 0 ? "STALE_UNDATED_OR_SCENARIO_ONLY" : "NO_MATCHING_OBSERVATION",
      quantitativeCoverage: "NOT_CONNECTED", direction: "UNDETERMINED", evidenceQualification: "UNVERIFIED_HEADLINES_ONLY",
      candidateCount: matches.length, recentPublicCandidateCount: recent.length,
      candidates: matches.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 8)
        .map((item) => ({ ...item, freshness: freshness(item) })) };
  });
  return freezeDriverValue({ schemaVersion: "1.0", asOf, tradeUniverse: ["GLD", "IBIT"], executionAllowed: false,
    assessment: "NO_TRADE_INCOMPLETE_OPTION_AND_PORTFOLIO_EVIDENCE", probability: null,
    coverageComplete: false, historicalOutcomeCalibration: "NOT_IMPLEMENTED", observationsInHistory: observations.length,
    currentItemVersions: current.length, sources, factors,
    requiredConfirmations: ["Verified GLD/IBIT option chain, bid/ask sizes, fees, IV and Greeks", "Account eligibility, settled cash, portfolio and expiry risk", "A locked thesis, time exit and cost-aware target-before-stop validation"],
    limitations: ["Catalog coverage cannot enumerate every possible influence; no fixed causal direction is assumed.",
      "Headlines are untrusted source assertions and keyword tags are candidate relevance only; they are not independently verified facts.",
      "A recent headline does not connect a numeric series or establish a trading edge; stale/missing data are unknown, not neutral.",
      "Journal checksums detect accidental changes, not malicious rewriting or authenticating a publisher.",
      "Saved observations are local history, not a backtest-ready historical option dataset.",
      "Refresh is one-shot; no background monitor or recurring schedule is implied."] });
}
