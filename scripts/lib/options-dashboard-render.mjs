import { createHash } from "node:crypto";
import { readinessClock, readinessFingerprint } from "../../src/engines/options-readiness/OptionsReadinessEngine.ts";

const fail = code => { throw Error("OPTIONS_DASHBOARD_" + code); };
const escape = value => String(value ?? "Unknown").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const money = cents => cents === null || cents === undefined ? "Unknown" : `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
const plain = value => escape(String(value ?? "Unknown").replaceAll("_", " "));
const details = (label, value) => `<details><summary>${escape(label)}</summary><pre>${escape(JSON.stringify(value, null, 2))}</pre></details>`;
const table = (labels, rows) => `<div class="scroll"><table><thead><tr>${labels.map(l => `<th scope="col">${escape(l)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${labels.length}">No saved records available.</td></tr>`}</tbody></table></div>`;
function checkHash(report, field, version) {
  if (!report || report.version !== version) fail("REPORT_VERSION");
  const { [field]: hash, ...payload } = report;
  if (readinessFingerprint(payload) !== hash) fail("REPORT_HASH");
  if (report.executionAllowed !== false || report.winProbability !== null) fail("AUTHORITY");
}
export function buildDashboardReport(readiness, calendar, outcomes, constructedAt) {
  checkHash(readiness, "reportSha256", "OPTIONS_OPERATIONAL_READINESS_V2");
  checkHash(calendar, "reportSha256", "OPTIONS_PUBLIC_CALENDAR_BRIEF_V1");
  checkHash(outcomes, "artifactSha256", "OPTIONS_OUTCOME_AUDIT_V1");
  for (const t of [readiness.assessedAt, calendar.assessedAt, outcomes.constructedAt, constructedAt]) readinessClock(t);
  if (readiness.assessedAt > calendar.assessedAt || calendar.assessedAt > outcomes.constructedAt || outcomes.constructedAt > constructedAt) fail("CLOCK_ORDER");
  if (readiness.realPriceTestReady !== false || readiness.automaticOrdersEnabled !== false || readiness.liveAccountInspected !== false || outcomes.calibrated !== false) fail("AUTHORITY");
  const crossReportChecks = ["paper", "historical"].map(id => {
    const a = readiness.evidence[id], b = outcomes.components[id];
    return { component: id, state: a.state === "AVAILABLE" && b.state === "AVAILABLE" ? (a.reportSha256 === b.audit.sourceReportSha256 ? "MATCHED" : "CHANGED_DURING_READ") : "UNAVAILABLE_FOR_COMPARISON" };
  });
  const payload = { version: "OPTIONS_LOCAL_DASHBOARD_V1", studyId: readiness.studyId, constructedAt,
    readiness, calendar, outcomes, crossReportChecks, snapshotAtomicAcrossStores: false,
    sourceAccess: "SAVED_LOCAL_STORES_ONLY", hostSchedule: "NOT_INSPECTED", liveAccountInspected: false,
    realPriceTestReady: false, automaticOrdersEnabled: false, executionAllowed: false, winProbability: null };
  return { ...payload, artifactSha256: readinessFingerprint(payload) };
}
export function renderDashboard(report, css) {
  const expected = buildDashboardReport(report.readiness, report.calendar, report.outcomes, report.constructedAt);
  if (readinessFingerprint(report) !== readinessFingerprint(expected)) fail("REPORT_CHANGED");
  const { readiness: r, calendar: c, outcomes: o } = report, collection = r.evidence.collection.summary;
  const styleHash = createHash("sha256").update(css).digest("base64");
  const metric = (label, value, note) => `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong><p>${escape(note)}</p></div>`;
  function outcomesSection(id, title) {
    const component = o.components[id], a = component.audit;
    if (!a) return `<section id="${id}"><h2>${title}</h2><p>${plain(component.state)} · ${plain(component.errorCode)}</p></section>`;
    const m = a.metrics, shown = a.cases.slice(0, 100), lessons = a.candidateNotebook.entries.slice(0, 80);
    return `<section id="${id}"><div class="section-head"><h2>${title}</h2><span class="tag">${id === "paper" ? "Shared simulation account" : "Independent hypothetical trials"}</span></div>
      <p>${id === "paper" ? "Scenario clocks are hypothetical. Balance and cash below belong to the local simulation." : "Each run starts a separate hypothetical $1,000 account. Totals below describe cases, not a portfolio return."} Closed-case results exclude unresolved exposure.</p>
      <div class="metrics">${metric("Closed cases", m.closedCount, `${m.caseCount} total cases · ${m.openExposureCount} unresolved positions`)}${metric("Net-positive / negative", `${m.netPositiveCount} / ${m.netNegativeCount}`, `${m.breakevenCount} flat · descriptive counts only`)}${metric("Modeled net PnL", money(m.netPnlCents), `${money(m.feesCents)} fees in closed cases`)}${metric("Loss beyond planned R", m.lossBeyondPlannedRiskCount, "A stop trigger does not guarantee the planned exit price.")}</div>
      ${id === "paper" ? `<p>Modeled account equity: <b>${money(a.account.equityCents)}</b> · Realized closed-case maximum drawdown: <b>${money(a.realizedClosedCurve.maxDrawdownCents)}</b> (excludes open marks).</p>` : ""}
      <p>Showing ${shown.length} of ${a.cases.length} cases. Full records and exact ratios are in the saved report.</p>
      ${table(["Case / origin", "Asset / setup", "Disposition", "Modeled net", "Review / limitations"], shown.map(item => [
        `${escape(item.id)}<small>${plain(item.origin)}</small>`, `${escape(item.symbol)}<small>${escape(item.strategyVersion)} · ${escape(item.setupKey)}</small>`, plain(item.status), money(item.review?.input.netPnlCents),
        details(item.review ? `${item.review.input.exitReason} · ${item.candidateLessonCodes.length} candidate lessons` : `${item.blockers.length} blockers · ${item.candidateLessonCodes.length} candidate lessons`, { recordedAt: item.recordedAt, scenarioAsOf: item.scenarioAsOf, blockers: item.blockers, review: item.review, candidateLessonCodes: item.candidateLessonCodes })]))}
      <h3>Candidate mistake notebook</h3><p>Showing ${lessons.length} of ${a.candidateNotebook.entries.length} entries. Causes remain unproven; candidates cannot approve themselves or change a strategy.</p>
      ${table(["Observation", "Next check", "Support"], lessons.map(l => [`<b>${plain(l.code)}</b><small>${escape(l.observation)}</small>`, escape(l.nextCheck), `${escape(l.occurrenceCount)} occurrences${details("Supporting records", l.supportingTradeIds ?? l.supportingRunIds)}`]))}
      ${details("Group metrics by origin, asset, strategy and setup", a.groups)}</section>`;
  }
  const sources = Object.entries(r.evidence).map(([id, e]) => [plain(id), `${plain(e.state)}${e.errorCode ? `<small>${plain(e.errorCode)}</small>` : ""}`, escape(e.checkedAt), details("Saved source summary", e.summary)]);
  for (const [id, s] of Object.entries(c.sources)) sources.push([`${id.toUpperCase()} calendar`, `${plain(s.state)}<small>Latest attempt: ${plain(s.latestAttempt)}${s.errorCode ? " · " + plain(s.errorCode) : ""}</small>`, escape(s.checkedAt), details("Receipt, freshness and source clocks", s)]);
  const entries = c.groups.flatMap(g => [...g.dateOnlyEntries, ...g.scheduledTimeEntries]).slice(0, 40);
  const receiptRows = [
    ...(r.evidence.headlines.summary?.sources ?? []).map(s => [s.id.toUpperCase(), plain(s.status), escape(s.observedAt), escape(s.refreshOverdue ? "Refresh overdue" : "Within source cadence at check")]),
    ["Treasury real yields", plain(r.evidence.treasury.summary?.status), escape(r.evidence.treasury.summary?.receivedAt), escape(r.evidence.treasury.summary?.sourceDate ? `Source date ${r.evidence.treasury.summary.sourceDate}; lag ${r.evidence.treasury.summary.dateLagDays} days` : "Source date unknown")],
    ["BTC-USD spot", plain(r.evidence.btc.summary?.status), escape(r.evidence.btc.summary?.receivedAt), escape(r.evidence.btc.summary ? (r.evidence.btc.summary.displayFreshAtCheck ? "Fresh at check" : "Not fresh at check") : "Unknown")],
    ...Object.entries(c.sources).map(([id, s]) => [id.toUpperCase() + " calendar", plain(s.latestAttempt), escape(s.latestReceivedAt), escape(s.refreshOverdue === null ? "Unknown" : s.refreshOverdue ? "Refresh overdue" : "Within source cadence at check")]),
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'; connect-src 'none'"><title>Alpha · GLD / IBIT operations</title><meta name="description" content="Local collection, context and simulation review snapshot for Alpha."><style>${css}</style></head><body>
<a class="skip" href="#main">Skip to operational snapshot</a><header><div class="brand">ALPHA <span>GLD / IBIT</span></div><nav aria-label="Sections"><a href="#collection">Collection</a><a href="#sources">Sources</a><a href="#calendar">Calendar</a><a href="#paper">Paper</a><a href="#historical">Research</a></nav><a class="download" href="report.json" download>Save report</a></header>
<main id="main"><div class="eyebrow">LOCAL OPERATIONS SNAPSHOT</div><h1>Prepare. Observe. Review.</h1><p class="timestamp">Saved ${escape(report.constructedAt)} · UTC. This page does not update automatically.</p>
<div class="notice"><b>Real-price testing is not ready.</b><p>Automatic orders are off. Robinhood account state is unverified. The next action is ${plain(r.nextStep).toLowerCase()}.</p></div>
<div class="metrics">${metric("Selected quote window", plain(r.collectionState), collection ? `${collection.completeUsableSlots} / ${collection.declaredSlots} complete usable slots` : "Selected study evidence unavailable")}${metric("Source stores blocked", r.blockedStores.length + c.blockedStores.length, "A readable store can still contain a failed or stale source reply.")}${metric("Paper reviews retained", r.closedPaperReviewCoverage ? `${r.closedPaperReviewCoverage.reviewed} / ${r.closedPaperReviewCoverage.closed}` : "Unknown", "Closed simulated trades only")}${metric("Calibrated probability", "Not established", "No 80% claim or size escalation")}</div>
<section id="collection"><h2>Opening collection</h2><p class="mono">${escape(report.studyId)}</p>${collection ? `<p><b>${escape(collection.windowStartAt)} → ${escape(collection.windowEndAt)}</b> (UTC)</p><p>${collection.automaticAttempts} saved automatic attempts · ${collection.usableObservations} usable observations · ${collection.sourceFailures} recorded source failures.</p>` : "<p>Frozen window unavailable. No dates or successful collection are inferred.</p>"}<p>The saved study describes the window. The host scheduler was not inspected by this page; computer uptime alone does not guarantee collection.</p>${table(["Dependency", "State", "Evidence needed"], r.dependencies.map(d => [plain(d.code), plain(d.state), escape(d.detail)]))}</section>
<section id="sources"><h2>Sources &amp; freshness</h2><p>Read from saved journals. Receipt time, source date and quote time have different meanings.</p>${table(["Source", "Last attempt", "Received / observed UTC", "Freshness at check"], receiptRows)}<details><summary>Repository checks and full source clocks</summary>${table(["Component", "Local store", "Checked UTC", "Details"], sources)}</details></section>
<section id="calendar"><h2>Upcoming calendar context</h2><p>Showing ${entries.length} of ${c.entryCount} entries in the next 30 New York dates. Date-only FOMC listings have unknown intraday times. A passed scheduled time does not prove that released values were collected.</p>${table(["Source", "Listing", "Scheduled time or date range", "Precision / status"], entries.map(e => [escape(e.source), escape(e.title), escape(e.precision === "DATE_ONLY" ? `${e.startDate} through ${e.endDate}` : e.localScheduledTime), `${plain(e.precision)}<small>${plain(e.sourceStatus)}</small>`]))}<p>Missing calendar entries do not establish an event-free trading session.</p></section>
${outcomesSection("paper", "Paper lifecycle outcomes")}${outcomesSection("historical", "Historical research outcomes")}
<section id="integrity"><h2>Snapshot integrity</h2><p>Reports were recovered sequentially. This is not an atomic snapshot, a live balance or authenticated brokerage evidence.</p>${table(["Repeated store read", "Comparison"], report.crossReportChecks.map(x => [plain(x.component), plain(x.state)]))}${details("Report fingerprints", { dashboard: report.artifactSha256, readiness: r.reportSha256, calendar: c.reportSha256, outcomes: o.artifactSha256 })}<p>Rebuild with a new snapshot ID to read newer local records. Rebuilding does not request market data.</p></section>
</main><footer>Alpha · Protect capital · Local research evidence only</footer></body></html>\n`;
}
