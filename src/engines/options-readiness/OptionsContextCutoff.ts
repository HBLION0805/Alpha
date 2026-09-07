import { readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import { buildOptionsDriverReport } from "../options-drivers/OptionsDriverMonitorEngine";
import type { OptionsDriverObservation, OptionsDriverSourceHealth } from "../../contracts/OptionsDriverMonitor";
import { reportTreasuryHistory, type TreasuryInput } from "../options-treasury/TreasuryRealYieldEngine";
import { reportBtcContext, type BtcContextInput } from "../options-btc-context/BtcSpotContextEngine";
import { reportReleaseCalendar, type ReleaseCalendarInput } from "../options-release-calendar/BlsReleaseCalendarEngine";

export const CONTEXT_CUTOFF_SOURCES = ["headlines", "treasury", "btc", "blsCalendar"] as const;
type ErrorCode = "STORE_MISSING" | "STORE_BUSY" | "STORE_UNSAFE" | "RECOVERY_FAILED";
export type ContextHistory<T> = { state: "AVAILABLE"; checkedAt: string; payload: T; errorCode: null } |
  { state: "MISSING" | "BLOCKED"; checkedAt: string; payload: null; errorCode: ErrorCode };
interface Headlines { observations: readonly OptionsDriverObservation[]; health: readonly OptionsDriverSourceHealth[] }
export interface ContextCutoffHistories {
  headlines: ContextHistory<Headlines>; treasury: ContextHistory<readonly TreasuryInput[]>;
  btc: ContextHistory<readonly BtcContextInput[]>; blsCalendar: ContextHistory<readonly ReleaseCalendarInput[]>;
}
function fail(code: string): never { throw Error("CONTEXT_CUTOFF_" + code); }
function exact(v: unknown, keys: string[]) { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) fail("SHAPE"); }
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function headlineReport(payload: Headlines, at: string) {
  exact(payload, ["observations", "health"]);
  if (!Array.isArray(payload.observations) || !Array.isArray(payload.health) || payload.observations.length > 20000 || payload.health.length > 20000) fail("HEADLINE_HISTORY_LIMIT");
  const report = buildOptionsDriverReport(payload.observations, payload.health, at);
  for (const records of [payload.observations, payload.health]) {
    const clocks = new Map<string, string>();
    for (const record of records) {
      if (record.observedAt === null) continue;
      const prior = clocks.get(record.sourceId);
      if (record.observedAt > at || prior !== undefined && record.observedAt < prior) fail("HEADLINE_HISTORY_CLOCK");
      clocks.set(record.sourceId, record.observedAt);
    }
  }
  return report;
}

/** Reconstruct local journal context; never asserts that a historical trade/decision actually used it. */
export function reconstructOptionsContext(histories: ContextCutoffHistories, cutoffAt: string, constructedAt: string) {
  readinessClock(cutoffAt); readinessClock(constructedAt); exact(histories, [...CONTEXT_CUTOFF_SOURCES]);
  if (cutoffAt > constructedAt) fail("FUTURE_CUTOFF");
  let priorCheck = cutoffAt;
  for (const id of CONTEXT_CUTOFF_SOURCES) {
    const h = histories[id]; exact(h, ["state", "checkedAt", "payload", "errorCode"]); readinessClock(h.checkedAt);
    if (h.checkedAt < priorCheck || h.checkedAt > constructedAt) fail("CHECK_CLOCK_ORDER"); priorCheck = h.checkedAt;
    if (h.state === "AVAILABLE") { if (h.payload === null || h.errorCode !== null) fail("STORAGE_STATE"); }
    else if (!["MISSING", "BLOCKED"].includes(h.state) || h.payload !== null || (h.state === "MISSING" ? h.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(h.errorCode))) fail("STORAGE_STATE");
  }
  function project<T, R>(history: ContextHistory<T>, build: (payload: T, at: string) => R, select: (payload: T) => T) {
    if (history.state !== "AVAILABLE") return { state: history.state, errorCode: history.errorCode, selectedPrefixSha256: null, reportSha256: null, report: null };
    try {
      build(history.payload, history.checkedAt); // Validate complete current history before selecting a prefix.
      const prefix = select(history.payload), report = build(prefix, cutoffAt);
      return { state: "AVAILABLE" as const, errorCode: null, selectedPrefixSha256: readinessFingerprint(prefix), reportSha256: readinessFingerprint(report), report };
    } catch { return { state: "BLOCKED" as const, errorCode: "HISTORY_VALIDATION_FAILED" as const, selectedPrefixSha256: null, reportSha256: null, report: null }; }
  }
  const components = {
    headlines: project(histories.headlines, headlineReport, p => ({ observations: p.observations.filter(o => o.observedAt <= cutoffAt), health: p.health.filter(h => h.observedAt !== null && h.observedAt <= cutoffAt) })),
    treasury: project(histories.treasury, reportTreasuryHistory, p => p.filter(r => r.receivedAt <= cutoffAt)),
    btc: project(histories.btc, reportBtcContext, p => p.filter(r => r.receivedAt <= cutoffAt)),
    blsCalendar: project(histories.blsCalendar, reportReleaseCalendar, p => p.filter(r => r.receivedAt <= cutoffAt)),
  };
  const context = { version: "OPTIONS_JOURNAL_CONTEXT_CUTOFF_V1", cutoffAt, relevantAssets: ["GLD", "IBIT"], components,
    selectionBasis: "STORED_RECEIPT_OR_DISCOVERY_TIME_AT_OR_BEFORE_CUTOFF", historicalDecisionProven: false,
    publisherVintageAuthenticated: false, journalAppendTimesKnown: false, globalKnowledgeCoverageComplete: false,
    emptyHistoryMeaning: "NO_LOCAL_OBSERVATIONS_MET_THE_CUTOFF_NOT_A_NEUTRAL_VALUE", executionAllowed: false, replayAllowed: false, winProbability: null };
  const body = { context, contextSha256: readinessFingerprint(context), constructedAt,
    checkedAt: Object.fromEntries(CONTEXT_CUTOFF_SOURCES.map(id => [id, histories[id].checkedAt])),
    blockedStores: CONTEXT_CUTOFF_SOURCES.filter(id => components[id].state === "BLOCKED"),
    missingStores: CONTEXT_CUTOFF_SOURCES.filter(id => components[id].state === "MISSING"),
    mode: "LOCAL_RETROSPECTIVE_RECONSTRUCTION", snapshotAtomicAcrossStores: false,
    networkAccess: false, executionAllowed: false, sourceAppends: 0, reportFilesCreated: false };
  return freeze({ ...body, artifactSha256: readinessFingerprint(body) });
}
