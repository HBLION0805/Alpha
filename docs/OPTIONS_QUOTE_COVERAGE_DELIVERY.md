# Quote omissions separated from collection failures

Daily guidance, the Host brief and `--delivery-health` now list every selected
contract and group quote coverage by ETF and expiry. The original verified source
determines whether its request failed, never started, was absent, or succeeded
without a quote for that ID. Returned quotes retain their own clocks and quality
checks. Missing values do not become zero prices or invented return observations.

Future Host captures record `OPTION_QUOTE_IDENTITIES_MISSING` when a successful
bounded quote response omits selected identities. The read count, contract
selection and deadline are unchanged; no retry or substitute-contract mechanism
was added. Historical captures, normalization and issued guidance fingerprints
remain unchanged. The partial-capture gate still applies.

Actual diagnostic, September 12 New York: the original sample requested 36
quotes and returned 24. All twelve missing IDs are September 28 expirations,
six GLD and six IBIT. A later two-call check returned all fourteen requested
instrument definitions as active/tradable, but quotes for only the two October 9
controls. This establishes source-side quote absence in those replies, not its
upstream cause. A new listing, outage, zero volume or institutional activity
cannot be inferred. The later check is separate evidence, not a backfilled capture.

See [design](specifications/OPTIONS_QUOTE_COVERAGE_V1.md) and
[actual validation/readback](status/quote-coverage.json). No schedule, enrollment,
Owner ledger, approved lesson, risk-policy or real-price gate change is included.
