import { buildOptionsReadiness, readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import { buildOptionsContextReadiness } from "./OptionsContextReadinessEngine";
import { reportReleaseCalendar, type ReleaseCalendarInput } from "../options-release-calendar/BlsReleaseCalendarEngine";

type Core = ReturnType<typeof buildOptionsContextReadiness>;
export type BriefCalendarInput = { state: "AVAILABLE"; checkedAt: string; inputs: readonly ReleaseCalendarInput[]; errorCode: null } |
  { state: "MISSING" | "BLOCKED"; checkedAt: string; inputs: null; errorCode: "STORE_MISSING" | "STORE_BUSY" | "STORE_UNSAFE" | "RECOVERY_FAILED" };
function fail(code: string): never { throw Error("OPTIONS_BRIEF_" + code); }
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function exact(v: unknown, keys: string[]) { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) fail("CALENDAR_SHAPE"); }
/** Plain-text presentation only; titles cannot introduce terminal control or bidi sequences. */
function plain(value: unknown): string {
  if (value === null || value === undefined) return "unknown";
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
const nyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" });
function ny(at: string): string {
  const p = Object.fromEntries(nyFormat.formatToParts(new Date(at)).map(v => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${p.timeZoneName} (America/New_York)`;
}
function rate(bps: number | null): string {
  if (bps === null) return "unknown";
  const digits = String(Math.abs(bps)).padStart(3, "0");
  return (bps < 0 ? "-" : "") + digits.slice(0, -2) + "." + digits.slice(-2) + "%";
}

export function buildOptionsOperatorBrief(core: Core, calendar: BriefCalendarInput, assessedAt: string) {
  readinessClock(assessedAt);
  if (!core || typeof core !== "object" || !core.evidence) fail("CORE_SHAPE");
  const { btc, ...baseEvidence } = core.evidence;
  const v1 = buildOptionsReadiness(core.studyId, baseEvidence, core.coreAssessedAt);
  const v2 = buildOptionsContextReadiness(v1, btc, core.assessedAt);
  if (readinessFingerprint(v2) !== readinessFingerprint(core)) fail("CORE_REPORT_CHANGED");
  exact(calendar, ["state", "checkedAt", "inputs", "errorCode"]); readinessClock(calendar.checkedAt);
  if (calendar.checkedAt < core.assessedAt || assessedAt < calendar.checkedAt) fail("CHECK_CLOCK_ORDER");
  if (calendar.state === "AVAILABLE") { if (!Array.isArray(calendar.inputs) || calendar.errorCode !== null) fail("CALENDAR_STATE"); }
  else if (!["MISSING", "BLOCKED"].includes(calendar.state) || calendar.inputs !== null ||
    (calendar.state === "MISSING" ? calendar.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(calendar.errorCode))) fail("CALENDAR_STATE");
  const releaseReport = calendar.state === "AVAILABLE" ? reportReleaseCalendar(calendar.inputs, calendar.checkedAt) : null;
  const calendarSha = releaseReport ? readinessFingerprint(releaseReport) : null;
  const calendarNextStep = calendar.state === "BLOCKED" ? "REVIEW_BLS_CALENDAR_STORAGE" : calendar.state === "MISSING" ? "AWAIT_DAILY_BLS_CALENDAR" :
    releaseReport?.latestRetrieval?.status === "FAILED" ? "REVIEW_BLS_CALENDAR_SOURCE_FAILURE" : "CONTINUE_DAILY_CALENDAR_OBSERVATIONS";
  const rows = ["ALPHA | GLD / IBIT | LOCAL TEST BRIEF", `Assessed: ${assessedAt}`, `Study: ${core.studyId}`,
    "Status: NO_REPLAY. Real-price trade test is not ready. Automatic orders: disabled.",
    "Win probability: unknown. Live brokerage account: not inspected.", "",
    "COLLECTION", `State: ${core.collectionState}`];
  const collection = core.evidence.collection;
  if (collection.state === "AVAILABLE") {
    const s = collection.summary;
    rows.push(`Window start: ${ny(s.windowStartAt)} | ${s.windowStartAt}`, `Window end:   ${ny(s.windowEndAt)} | ${s.windowEndAt} (end excluded)`,
      `Slots: ${s.completeUsableSlots} complete usable / ${s.elapsedSlots} elapsed / ${s.declaredSlots} declared.`,
      `Recorded: ${s.automaticAttempts} automatic attempts; ${s.sourceFailures} source failures; ${s.savedFrames} frames; ${s.usableObservations} usable observations.`,
      "Coverage describes diagnostic observations, not a strategy win rate.");
  } else rows.push(`Selected study evidence: ${collection.state} (${collection.errorCode}).`);
  rows.push("", "LOCAL STORAGE (availability does not mean valid market data)");
  for (const [id, evidence] of Object.entries(core.evidence)) rows.push(`${id}: ${evidence.state}${evidence.errorCode ? " / " + evidence.errorCode : ""}; checked ${evidence.checkedAt}`);
  rows.push(`blsCalendar: ${calendar.state}${calendar.errorCode ? " / " + calendar.errorCode : ""}; checked ${calendar.checkedAt}`);
  rows.push("", "TRADE REVIEWS AND CANDIDATE NOTEBOOKS");
  const reviews = core.closedPaperReviewCoverage;
  rows.push(reviews ? `Local simulated closed trades: ${reviews.closed}; stored reviews: ${reviews.reviewed}; missing or unmatched closed-trade reviews: ${reviews.missing}; consistent: ${reviews.consistent}.` : "Closed-trade review coverage: unknown (paper storage unavailable).");
  const paper = core.evidence.paper, historical = core.evidence.historical;
  if (paper.state === "AVAILABLE") rows.push(`Paper origin: ${plain(paper.summary.origin)}; open positions: ${paper.summary.openPositionCount}; pending modeled orders: ${paper.summary.pendingOrderCount}.`);
  if (historical.state === "AVAILABLE") rows.push(`Independent historical research: ${historical.summary.runCount} runs; ${historical.summary.reviewedRunCount} reviewed; ${historical.summary.syntheticRuns} synthetic; ${historical.summary.importedRuns} owner-file; ${historical.summary.missingDataRuns} missing-data runs.`);
  rows.push(`Candidate lessons: paper ${plain(core.candidateNotebooks.paper)}; historical ${plain(core.candidateNotebooks.historical)}; collection operations ${plain(core.candidateNotebooks.collectionOperations)}; quote quality ${plain(core.candidateNotebooks.quoteQuality)}.`,
    "Candidates are not approved knowledge or established causes of success/failure. No automatic strategy changes.",
    "Paper scenario clocks are not actual brokerage trade times. Independent research accounts are not compounded together.", "", "SOURCE CONTEXT");
  const headlines = core.evidence.headlines;
  if (headlines.state === "AVAILABLE") {
    rows.push(`Official headlines: ${headlines.summary.observationsInHistory} historical observations.`);
    for (const s of headlines.summary.sources) rows.push(`  ${s.id}: ${s.status}; last observed ${plain(s.observedAt)}; refresh overdue: ${s.refreshOverdue}.`);
  } else rows.push(`Official headlines: ${headlines.state}.`);
  const treasury = core.evidence.treasury;
  if (treasury.state === "AVAILABLE") {
    const s = treasury.summary;
    rows.push(`Treasury daily real yields: ${s.status}; source date ${plain(s.sourceDate)}; received ${plain(s.receivedAt)}.`);
    if (s.ratesBps) rows.push("  " + ([5, 7, 10, 20, 30] as const).map(tenor => `${tenor}Y ${rate(s.ratesBps![tenor])}`).join(" | "));
    rows.push(`  Source-date lag at check: ${plain(s.dateLagDays)} days. Daily indicative values are not live option quotes.`);
  } else rows.push(`Treasury daily real yields: ${treasury.state}.`);
  if (btc.state === "AVAILABLE") {
    const s = btc.summary;
    rows.push(`BTC-USD (Coinbase Exchange, IBIT context): ${s.status}; display fresh at check: ${s.displayFreshAtCheck}.`,
      `  Observed midpoint USD: ${plain(s.midpointUsd)}; source time ${plain(s.sourceTime)}; received ${plain(s.receivedAt)}.`,
      "  Single-venue saved observation. No IBIT conversion or continuous market coverage.");
    if (s.issues.length) rows.push("  Quality issues: " + s.issues.join(", "));
  } else rows.push(`BTC-USD context: ${btc.state}.`);
  rows.push("", "UPCOMING BLS RELEASES (scheduled times, not released values)");
  if (releaseReport) {
    const latest = releaseReport.latestRetrieval;
    rows.push(`Latest attempt: ${latest?.status ?? "NOT_REFRESHED"}; received ${plain(latest?.receivedAt)}; refresh overdue: ${releaseReport.refreshOverdue}.`,
      `Upcoming within seven days from the calendar check: ${releaseReport.upcoming.length}; shown: ${Math.min(20, releaseReport.upcoming.length)}.`);
    for (const e of releaseReport.upcoming.slice(0, 20)) rows.push(`  ${ny(e.scheduledAt)} | ${e.scheduledAt} | ${plain(e.title)} | ${e.family} | status ${e.status}`);
    if (latest?.status === "FAILED" && releaseReport.lastKnownSchedule) rows.push(`Last-known calendar exists from ${releaseReport.lastKnownSchedule.receivedAt}; its events are not promoted into the current list.`);
    if (latest) rows.push(`Missing source stamp/modified clocks: ${latest.missingSourceStampCount}/${latest.missingSourceModifiedCount}.`);
    rows.push(`Consecutive comparison available: ${releaseReport.comparison.available}; changed: ${releaseReport.comparison.changes.length}; added: ${releaseReport.comparison.addedUids.length}; absent: ${releaseReport.comparison.absentUids.length}.`);
  } else rows.push(`Calendar: ${calendar.state} (${calendar.errorCode}). Upcoming schedule is unknown.`);
  rows.push("Calendar absence does not mean cancellation or a safe trading period. Non-BLS and unscheduled events are not covered.",
    "", "NEXT CHECKS", `Core next step: ${core.nextStep}`, `BTC context next step: ${core.contextNextStep}`, `BLS context next step: ${calendarNextStep}`);
  for (const d of core.dependencies) rows.push(`  ${d.code}: ${d.state}. ${d.detail}`);
  rows.push("", "PROVENANCE AND LIMITS", `Readiness v2 checked: ${core.assessedAt}; SHA-256 ${core.reportSha256}.`,
    `BLS checked: ${calendar.checkedAt}; report SHA-256 ${plain(calendarSha)}.`,
    "Sequential local reads are not an atomic snapshot. The host schedule was not inspected by this command.",
    "No network requests, source appends, repairs, trades or risk-limit changes are performed.");
  const body = { version: "OPTIONS_OPERATOR_BRIEF_V1", assessedAt, studyId: core.studyId, coreReportSha256: core.reportSha256,
    coreAssessedAt: core.assessedAt, calendarCheckedAt: calendar.checkedAt, calendarReportSha256: calendarSha,
    calendarState: calendar.state, calendarErrorCode: calendar.errorCode, calendarNextStep,
    blockedStores: [...core.blockedStores, ...(calendar.state === "BLOCKED" ? ["blsCalendar"] : [])],
    missingStores: [...core.missingStores, ...(calendar.state === "MISSING" ? ["blsCalendar"] : [])],
    text: rows.join("\n") + "\n", executionAllowed: false, networkAccess: false, reportFilesCreated: false };
  return freeze({ ...body, reportSha256: readinessFingerprint(body) });
}
