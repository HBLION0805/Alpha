# Treasury daily real-yield context v1

Task OPT-RATES-1. Continue the Owner's requested collection of factors relevant
to GLD/IBIT while keeping automatic orders closed. Add one public numerical
source for the existing `real_yields` factor family. Do not change options
selection, schedules, quote diagnostics, risk limits or accepted journals.

## Source review and actual probe

Treasury documents an anonymous XML GET endpoint for monthly daily par real
yield curves. The reviewed source is `daily_treasury_real_yield_curve`; the only
request period is the current New York calendar month, derived from actual
request time. Fixed host, path and parameter names exclude arbitrary endpoints,
all-years pagination, provider links, accounts, credentials and paid services.
[Official XML documentation](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed).

The September 2026 endpoint returned HTTP 200, XML and four daily entries during
the actual probe at `2026-09-07T03:38:47.439Z` through `03:38:48.226Z`. The 5,094-byte
response SHA-256 was `b8349abe7d7490a2dd186c9254e1aad27c3b1c547a406ffedf46c349a0207912`.
Fields are `DailyTreasuryRealYieldCurveRateDataId`, `NEW_DATE`, and five real-yield
tenors: 5, 7, 10, 20 and 30 years. Source dates run September 1-4. Feed/entry
updated times are shared and do not establish the original publication time of
each daily row. Browser XML viewing is not the supported API consumption path.
[Developer notice](https://home.treasury.gov/developer-notice-xml-changes).

These are Treasury's daily indicative par real-yield estimates, not live ETF,
option or executable bond quotes. Retain their source date and actual retrieval
clock separately. Do not turn feed timestamps into historical knowledge or
estimate GLD/IBIT price changes from a presumed fixed inverse relationship.
[Treasury data description](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_real_yield_curve).

## Reviewed implementation

A deterministic TypeScript boundary parses a bounded Atom/XML subset with the
reviewed namespaces and seven exact data fields. Reject DTD/entity declarations,
duplicate or malformed entries/fields, inconsistent types, noncanonical dates,
out-of-month/future source dates, duplicate IDs/dates and oversized input. Null
rates stay null; negative real yields are valid. Store exact source text and
whole basis-point rates (0.01 percentage point), avoiding binary-float arithmetic.

A script-owned transport performs one bounded current-month GET with omitted
credentials, no redirects, a twelve-second deadline and 512 KiB decoded-body
limit. Validate response type and UTF-8. Provider error bodies are excluded;
failures keep fixed codes and actual request/receipt metadata. Empty valid XML
is explicitly empty, never a current value inferred from an older snapshot.

Keep a separate bounded, checksum-linked local journal. Each successful attempt
retains exact XML and its validated snapshot; failed attempts retain sanitized
health only. Recompute all records on restart. Preserve successive corrections,
including A-to-B-to-A reversions, with actual first-observed times; do not claim
historical vintages existed before Alpha retrieved them. Truncation, altered
hashes, unsafe paths/links, clock rollback and directory/file limits fail visibly.

The report separates latest retrieval health, latest source-date values, missing
tenors, date lag and earlier known observations. A failed or empty latest attempt
does not silently promote old data to current. Comparisons describe differences
between source observations in the retrieved snapshot, not intraday returns or
causal trading signals. Publication timing and expected holiday release gaps
remain unknown. Only this five-tenor daily source is connected; the other
numerical factors and source-specific options replay remain incomplete.

Expose `options:treasury -- --refresh`, `--report` and `--help`. After real source
verification, add the one-shot refresh to the existing daily news workflow using
a new versioned restoration snapshot that retains the old news instructions.
Preserve the old restoration file byte-for-byte, update only the active baseline
reference, and retain the opening quote window and cadence. One shared heartbeat
only. Routine rates are recorded quietly; report only new failures, recoveries
or required action. No numerical value or headline can issue code/trading commands.

## Acceptance

Test exact XML schema/units/nulls/negative values, clocks and month boundaries,
failure/empty/partial states, revision history and actual-time first sightings,
deterministic changes without look-ahead claims, safe transport limits/errors,
immutable journal/recovery/locks/path bounds and unchanged existing outputs.
Use labeled synthetic fixtures, one real CLI retrieval and restart readback.
Run focused and aggregate tests, verify protected hashes and the actual host
configuration, then commit and push under the Owner's standing authorization.
