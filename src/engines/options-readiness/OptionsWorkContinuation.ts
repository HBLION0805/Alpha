import { readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import { freezePaper } from "../options-paper/OptionsPaperTradingEngine";
export const OPENING_START = "2026-09-08T13:30:00.000Z";
export const OPENING_END = "2026-09-08T13:50:00.000Z";
const GUARD_START = "2026-09-08T13:00:00.000Z", GUARD_END = "2026-09-08T14:00:00.000Z";

/** Host routing only. This function cannot schedule, call sources, load journals or execute development. */
export function routeOptionsWorkContinuation(phase: unknown, asOf: string) {
  readinessClock(asOf);
  if (phase !== "armed" && phase !== "daily") throw Error("WORK_CONTINUATION_PHASE");
  const clock = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(asOf)).map(p => [p.type, p.value]));
  const hour = Number(clock.hour), minute = Number(clock.minute), second = Number(clock.second), millis = new Date(asOf).getUTCMilliseconds();
  let action: "DEVELOPMENT" | "DAILY_CONTEXT" | "YIELD" | "COLLECT" | "RESTORE_THEN_CLOSEOUT" | "PHASE_BLOCKED";
  if (phase === "armed" && asOf >= OPENING_END) action = "RESTORE_THEN_CLOSEOUT";
  else if (phase === "armed" && asOf >= OPENING_START) action = "COLLECT";
  else if (phase === "daily" && asOf < OPENING_END) action = "PHASE_BLOCKED";
  else if (hour === 9 && minute < 15) action = "DAILY_CONTEXT";
  else if (asOf >= GUARD_START && asOf < GUARD_END) action = "YIELD";
  else if (hour === 8 && (60 - minute) * 60000 - second * 1000 - millis < 600000) action = "YIELD";
  else action = "DEVELOPMENT";
  const body = { version: "OPTIONS_WORK_CONTINUATION_ROUTE_V1", phase, asOf, action,
    newYorkClock: `${clock.hour}:${clock.minute}:${clock.second}`, developmentStopAt: action === "DEVELOPMENT" ? new Date(Date.parse(asOf) + 600000).toISOString() : null,
    maximumNewWorkMinutes: action === "DEVELOPMENT" ? 10 : 0, marketContextRefreshDue: action === "DAILY_CONTEXT",
    frozenQuoteTickDue: action === "COLLECT", restoreV6BeforeCollectionEvidence: action === "RESTORE_THEN_CLOSEOUT",
    brokerAccountAllowed: false, orderExecutionAllowed: false, sourceCallExecuted: false, schedulerUpdated: false,
    note: "A routing result does not prove the host will wake or finish on time. Preserve all actual gaps and the original quote/restore workflow." };
  return freezePaper({ ...body, routeSha256: readinessFingerprint(body) });
}
