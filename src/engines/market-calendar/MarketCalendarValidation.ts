import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { MarketCalendarSessionStatus, MarketDataOrigin, MarketCalendarIssueCode, type MarketCalendarSessionEvidence, type MarketCalendarIssue, type MarketCalendarValidationResult } from "../../contracts/MarketCalendar";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u;

/** Selects from explicit exchange-calendar evidence; it never infers a session from the UTC date. */
export function latestCompletedTradingSession(
  asOf: string,
  exchangeCalendar: readonly MarketCalendarSessionEvidence[],
): MarketCalendarSessionEvidence | undefined {
  if (!timestamp(asOf)) return undefined;
  return [...exchangeCalendar]
    .filter(
      (entry) =>
        entry.status === MarketCalendarSessionStatus.Completed &&
        timestamp(entry.marketClose) &&
        Date.parse(entry.marketClose) +
          entry.closureBufferSeconds * 1_000 <=
          Date.parse(asOf),
    )
    .sort((left, right) => right.marketClose.localeCompare(left.marketClose))[0];
}

export function exchangeLocalDate(asOf: string, timezone: string): string {
  if (!timestamp(asOf)) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(asOf));
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return "";
  }
}

/** Reuse calendar validation without fabricating quote or request evidence. */
export function validateMarketCalendarEvidence(
  value: unknown,
  asOf: string,
): MarketCalendarValidationResult {
  const issues: MarketCalendarIssue[] = [];
  if (!timestamp(asOf)) {
    issues.push(issue(MarketCalendarIssueCode.InvalidSessionEvidence,
      "asOf", "A canonical as-of timestamp is required."));
  } else {
    validateSessionCalendarEvidence(value, asOf, issues);
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

function validateSessionCalendarEvidence(
  value: unknown,
  asOf: string,
  issues: MarketCalendarIssue[],
): ReadonlyMap<string, MarketCalendarSessionEvidence> {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(
      issue(
        MarketCalendarIssueCode.InvalidSessionEvidence,
        "sessionCalendarEvidence",
        "Explicit calendar/session evidence is required.",
      ),
    );
    return new Map();
  }
  const byDate = new Map<string, MarketCalendarSessionEvidence>();
  value.forEach((entry, index) => {
    const field = `sessionCalendarEvidence[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          MarketCalendarIssueCode.InvalidSessionEvidence,
          field,
          "Calendar/session evidence must be an object.",
        ),
      );
      return;
    }
    allowOnly(
      entry,
      [
        "calendarEvidenceId",
        "calendarEvidenceFingerprint",
        "calendarId",
        "sessionId",
        "sessionDate",
        "sessionType",
        "timezone",
        "marketOpen",
        "marketClose",
        "closureBufferSeconds",
        "status",
        "provenanceReference",
        "dataOrigin",
      ],
      field,
      issues,
    );
    const sessionDate =
      typeof entry.sessionDate === "string" ? entry.sessionDate : "";
    const identityValid =
      [
        entry.calendarEvidenceId,
        entry.calendarId,
        entry.sessionId,
        entry.timezone,
        entry.provenanceReference,
      ].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) &&
      /^\d{4}-\d{2}-\d{2}$/u.test(sessionDate) &&
      ["REGULAR", "EXTENDED"].includes(String(entry.sessionType)) &&
      timestamp(entry.marketOpen) &&
      timestamp(entry.marketClose) &&
      Date.parse(String(entry.marketOpen)) <
        Date.parse(String(entry.marketClose)) &&
      Number.isSafeInteger(entry.closureBufferSeconds) &&
      Number(entry.closureBufferSeconds) >= 0 &&
      Number(entry.closureBufferSeconds) <= 300 &&
      Object.values(MarketCalendarSessionStatus).includes(
        entry.status as MarketCalendarSessionStatus,
      ) &&
      Object.values(MarketDataOrigin).includes(
        entry.dataOrigin as MarketDataOrigin,
      );
    const fingerprintInput = {
      calendarEvidenceId: entry.calendarEvidenceId,
      calendarId: entry.calendarId,
      sessionId: entry.sessionId,
      sessionDate: entry.sessionDate,
      sessionType: entry.sessionType,
      timezone: entry.timezone,
      marketOpen: entry.marketOpen,
      marketClose: entry.marketClose,
      closureBufferSeconds: entry.closureBufferSeconds,
      status: entry.status,
      provenanceReference: entry.provenanceReference,
      dataOrigin: entry.dataOrigin,
    };
    if (
      !identityValid ||
      entry.calendarEvidenceFingerprint !==
        deterministicFingerprint(fingerprintInput) ||
      String(entry.sessionId) !== `session:${sessionDate}:regular` ||
      String(entry.marketOpen).slice(0, 10) !== sessionDate ||
      String(entry.marketClose).slice(0, 10) !== sessionDate ||
      byDate.has(sessionDate)
    ) {
      issues.push(
        issue(
          MarketCalendarIssueCode.InvalidSessionEvidence,
          field,
          "Calendar/session identity, fingerprint, chronology, or uniqueness is invalid.",
        ),
      );
      return;
    }
    const closureComplete =
      Date.parse(String(entry.marketClose)) +
        Number(entry.closureBufferSeconds) * 1_000 <=
      Date.parse(asOf);
    if (
      (entry.status === MarketCalendarSessionStatus.Completed &&
        !closureComplete) ||
      (entry.status === MarketCalendarSessionStatus.Scheduled &&
        closureComplete)
    ) {
      issues.push(
        issue(
          MarketCalendarIssueCode.InvalidSessionEvidence,
          field,
          "Calendar status must match the as-of closure boundary.",
        ),
      );
      return;
    }
    if (
      entry.status !== MarketCalendarSessionStatus.HolidayClosed &&
      [0, 6].includes(
        new Date(`${sessionDate}T12:00:00.000Z`).getUTCDay(),
      )
    ) {
      issues.push(
        issue(
          MarketCalendarIssueCode.InvalidSessionEvidence,
          field,
          "Weekend dates cannot be completed trading sessions.",
        ),
      );
      return;
    }
    byDate.set(
      sessionDate,
      entry as unknown as MarketCalendarSessionEvidence,
    );
  });
  return byDate;
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function record(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: MarketCalendarIssueCode,
  field: string,
  message: string,
): MarketCalendarIssue {
  return Object.freeze({ code, field, message });
}

function allowOnly(
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
  issues: MarketCalendarIssue[],
): void {
  for (const key of Object.keys(value))
    if (!fields.includes(key))
      issues.push(
        issue(
          MarketCalendarIssueCode.UndeclaredField,
          `${path}.${key}`,
          "Undeclared field is not allowed.",
        ),
      );
}
