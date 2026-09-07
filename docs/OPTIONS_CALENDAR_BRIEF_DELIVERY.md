# Public calendar context brief delivery

Task: OPT-CALENDAR-BRIEF-1. Date: 2026-09-07.

## Change and reason

A new read-only composition and CLI combine BLS scheduled release instants with
FOMC date-only intervals over thirty New York dates. Timed and date-only entries
remain separate, including when they overlap. An ongoing meeting retains its
original start date. A passed scheduled time does not assert publication or
collection of economic values. Explicit source cancellation/tentative labels are
retained without inferring other cancellations or rescheduling.

Files changed: new `OptionsCalendarBrief.ts` and its tests, new
`options-calendar-brief.mjs` and its I/O tests, package and aggregate registrations,
the [prior specification](specifications/OPTIONS_CALENDAR_BRIEF_V1.md), this
delivery, [checkpoint](status/calendar-brief.json), README, handoff and changelog.
Existing readiness, operator brief, source engines, exports, Host code, frozen
study and daily v5 configuration are unchanged.

Each source is independently recovered and validated at its actual check clock.
Missing, empty, blocked, failed and overdue states remain distinct. A latest
failure does not promote last-known dates to a current calendar. Missing BLS
source metadata and the FOMC page update date are visible separately from actual
receipt clocks. Text escapes control/bidi characters, displays at most forty
entries and declares the total; bound JSON retains all selected rows.

## Actual local result

At **2026-09-07T08:06:06.562Z**, the two existing journals produced **13 entries**:
twelve scheduled BLS instants and one September 15-16 FOMC interval. Both stores
were available, each had one retrieval and neither required a refresh at its
check time. The BLS calendar's 313 entries all lacked source stamp/modified
metadata. The FOMC page update date remains August 19, not the original meeting
publication time. Intraday FOMC timing and independent confirmation remain unknown.

The explicitly saved local artifacts are
`data/runtime/options-readiness/calendar-brief.json` and `calendar-brief.txt`.
The report fingerprint is
`56e9c4d73c2a532839f11a851995bcd22c2604fdf9011c7b10376d54f034cd5c`.
The command itself does not create report files; a separate owner-authorized
wrapper saved these new paths without overwriting prior reports.

Twenty-five protected source/study/report/snapshot files and the active host file
matched before and after. No network call, source append, host update, new task,
account/order access, simulated trade or actual trade occurred.

## Validation and limits

Commands: `npm run typecheck`, `npm run test:options-calendar-brief`,
`npm run test:options-calendar-brief-io`, actual local report generation,
preservation checks, Git diff review and `npm run alpha:validate`.
The focused suites passed **19 pure and 12 I/O tests**. An initial test-helper
literal widened to `string` and failed typechecking; its explicit literal type
was corrected. Runtime-focused checks passed and the final typecheck passed.
The full bundle passed **3,107/3,107 tests**, 120 components, zero failures in
59,755 ms. Results and the retained local log are bound in the checkpoint.

Tests cover precision/date boundaries, actual receipt clocks, source cancellation,
failed-latest histories, isolated corruption, missing stores, held locks, unsafe
links, size bounds, control-safe text, no transport calls, no source mutations and
unchanged original source reports. No actual recovery or rendering failure occurred.

Assumptions/risks: the existing source parsers and local journal integrity remain
the authority. Recovery is sequential, not an atomic cross-store snapshot. A
calendar is incomplete context, not a prediction, trade blackout or safety score.
This standalone brief does not add FOMC to old readiness/cutoff/export versions.
NO_REPLAY, unknown win probability and no-order authority remain unchanged.

Next: inspect actual scheduled source refresh and the September 8 opening quote
window. Commit and push follow successful validation under standing authorization;
the Git state and validation result are checked at delivery.
