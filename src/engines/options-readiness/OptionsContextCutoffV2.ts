import { reconstructOptionsContext, CONTEXT_CUTOFF_SOURCES, type ContextCutoffHistories, type ContextHistory } from "./OptionsContextCutoff";
import { readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import { reportFomcCalendar, type FomcCalendarInput } from "../options-fomc-calendar/FomcCalendarEngine";

export interface ContextCutoffHistoriesV2 extends ContextCutoffHistories {
  fomcCalendar: ContextHistory<readonly FomcCalendarInput[]>;
}
export const CONTEXT_CUTOFF_SOURCES_V2 = [...CONTEXT_CUTOFF_SOURCES, "fomcCalendar"] as const;
function fail(code: string): never { throw Error("CONTEXT_CUTOFF_" + code); }
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("SHAPE");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function projectFomc(history: ContextHistory<readonly FomcCalendarInput[]>, cutoffAt: string) {
  if (history.state !== "AVAILABLE") return { state: history.state, errorCode: history.errorCode, selectedPrefixSha256: null, reportSha256: null, report: null };
  try {
    reportFomcCalendar(history.payload, history.checkedAt);
    const prefix = history.payload.filter(input => input.receivedAt <= cutoffAt);
    const report = reportFomcCalendar(prefix, cutoffAt);
    return { state: "AVAILABLE" as const, errorCode: null, selectedPrefixSha256: readinessFingerprint(prefix), reportSha256: readinessFingerprint(report), report };
  } catch {
    return { state: "BLOCKED" as const, errorCode: "HISTORY_VALIDATION_FAILED" as const, selectedPrefixSha256: null, reportSha256: null, report: null };
  }
}

/** Receipt-time reconstruction only. Meeting/page dates never imply earlier local knowledge. */
export function reconstructOptionsContextV2(histories: ContextCutoffHistoriesV2, cutoffAt: string, constructedAt: string) {
  exact(histories, CONTEXT_CUTOFF_SOURCES_V2);
  const { fomcCalendar, ...original } = histories;
  const core = reconstructOptionsContext(original, cutoffAt, constructedAt);
  exact(fomcCalendar, ["state", "checkedAt", "payload", "errorCode"]);
  readinessClock(fomcCalendar.checkedAt);
  if (fomcCalendar.checkedAt < histories.blsCalendar.checkedAt || fomcCalendar.checkedAt > constructedAt) fail("CHECK_CLOCK_ORDER");
  if (fomcCalendar.state === "AVAILABLE") {
    if (fomcCalendar.payload === null || fomcCalendar.errorCode !== null) fail("STORAGE_STATE");
  } else if (!["MISSING", "BLOCKED"].includes(fomcCalendar.state) || fomcCalendar.payload !== null ||
    (fomcCalendar.state === "MISSING" ? fomcCalendar.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(fomcCalendar.errorCode))) fail("STORAGE_STATE");

  const component = projectFomc(fomcCalendar, cutoffAt);
  const context = { ...core.context, version: "OPTIONS_JOURNAL_CONTEXT_CUTOFF_V2", baseContextSha256: core.contextSha256,
    components: { ...core.context.components, fomcCalendar: component } };
  const { artifactSha256: _originalArtifact, ...base } = core;
  const payload = { ...base, context, contextSha256: readinessFingerprint(context),
    checkedAt: { ...core.checkedAt, fomcCalendar: fomcCalendar.checkedAt },
    blockedStores: [...core.blockedStores, ...(component.state === "BLOCKED" ? ["fomcCalendar"] : [])],
    missingStores: [...core.missingStores, ...(component.state === "MISSING" ? ["fomcCalendar"] : [])] };
  return freeze({ ...payload, artifactSha256: readinessFingerprint(payload) });
}
