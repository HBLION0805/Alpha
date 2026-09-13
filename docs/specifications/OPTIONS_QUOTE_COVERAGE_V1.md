# Per-contract quote delivery coverage

Problem: successful tool calls can return only part of the requested quote IDs.
The original normalizer correctly marks such captures partial, but the Host's
transport-failure list can be empty and the UI shows only an aggregate count.

Use the existing verified capture, instrument metadata, request receipts and
failure records for a separate read-only coverage projection. Every selected ID
must remain present, grouped by ETF and expiry. Distinguish returned quotes,
successful responses without a usable quote for that ID, failed requests,
request-start bounds and IDs never requested. Include request/receipt/source
clocks; absent values remain null. A returned quote is not necessarily fresh or
tradable. A null quote without an attributable ID cannot identify which missing
contract it describes; describe the missing quote without guessing that cause.

New Host captures add an explicit missing-ID diagnostic after the same bounded
quote calls. No retries, replacement contracts, extra calls or timing changes.
The original capture version, normalizer output, issued report fingerprints,
partial-capture gate and paper sources remain unchanged. Coverage is added to
the existing delivery-health frontend/Host/CLI projection, never to saved
guidance decision inputs or outputs. The original records remain immutable.

An Owner-conversation diagnostic may be saved separately with actual clocks and
control IDs. It is later evidence and cannot repair an old capture or paper
window. The September 12 check uses twelve missing September 28 contracts and
two October 9 controls in two read-only calls. Source-side absence is observed;
new-listing status, upstream root cause and a reliable future recovery remain
unestablished. No order, enrollment, source schedule or approved lesson changes.

Acceptance: verify omission, anonymous null, request failure/bound, metadata gaps,
reordered replies, source clocks and zero-price preservation; same old report
fingerprints and read-only bytes. Frontend lists expiry totals and all selected
contracts, with source gaps separated from quote freshness. No real-price gate.
