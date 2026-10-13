# Saved weekly research and cited review projection

October 13, 2026 UTC (October 12 New York). This stage connects the saved weekly
intake and exact Microsoft review to Event research. It does not acquire sources,
create reviews, rerank with new rules, request quotes or run Paper.

## Read contract

`scripts/lib/options-weekly-research-view.mjs` reads an explicit local
`data/runtime/options-weekly-sources/research-binding.json`. No binding means
MISSING; it does not discover or switch research workspaces. The binding pins one
intake receipt hash and optional exact review heads. Paths are relative to the
bound root. Stored absolute paths inside historical receipts are never followed.

The reader replays saved issuer originals, checks intake counts and lineage, then
uses the existing `readTechEventReviews` source/review-chain validator for each
batch. A review must match the original base receipt, scan, event catalog and
requested head. It attaches by exact event identity, never ticker/title/date.
Repeated identical bindings do not duplicate a review. Conflicting or unavailable
reviews show explicit unavailability; base pending material is retained without
an old successful review. Missing batches show separate catalog and loaded counts.
Aggregate input inventory is bounded at 192 MiB / 2,400 files, with per-file,
depth, path and link checks in addition to existing reader limits.

Public output allowlists summaries, public source URLs, hashes and separate
request/receipt/publication/SEC-acceptance/review clocks. It omits filesystem paths,
raw envelopes and complete documents. SEC submission metadata remains missing
filing-body evidence. Latest source failure remains visible even with earlier
successful receipts. Research direction is UNKNOWN; quote and Paper are NOT_RUN.

## Actual saved evidence

- Intake: `weekly-research-intake-20261012-02`, hash
  `87acabdfa8a002879e72af0204740ec2e5b04330e2444ecafca55079f7f39549`.
- 105 original receipts, 101 company receipts, 768 parsed rows, 223 duplicate rows,
  545 event versions in seven batches. All 545 are readable; 533 lack filing bodies.
- 31 latest IR sources failed; 11 companies have parseable IR and 25 companies have
  failed IR without a parseable alternative. These are coverage gaps, not absence
  of company events.
- One attributed Microsoft calendar review from `weekly-original-review-20261012-01`
  overlays `weekly-batch-004` at head
  `7c1b0d061a323463fa56a1a73fb6a09e31e01a1d3e1ab90e853b1e13d0e83bca`.
  Its cited page receipt is October 12 23:00:07.908Z; review is 23:01:02.698Z.
  Publication time remains UNKNOWN. The narrow October 28 calendar statement is
  attributed, not machine-authenticated. Original scores impact 0 / catalyst 1 /
  evidence 2 / valuation UNKNOWN retain REJECTED; selected events remain zero.

The old TECH36 scan remains a separately labeled historical section. New filters
cover company, review state, body/source gaps and batch, with 25 rows per page and
stable event disclosure identities. App navigation/back and the existing reload
button retain filters; no browser persistence or new write action was added.

## Isolated delivery and verification

Run: `weekly-research-web-20261013-01`. The private run directory contains copied
intake/review originals, bindings, source baselines, projection and recovery
receipts, test logs, archived code, browser screenshots and HTTP evidence.

Code commits: `75b88044a6c5bbffe4e63f2247d9d51094b2a5bd` and
`049b753a8267fc03199da0a61885380c381688f6`. The final preview uses the latter archive
(1,620 pinned files) at `http://127.0.0.1:4181/#event-research`. Node filesystem
writes, child processes and outbound requests are disabled. Non-read methods
return 405; private/unavailable paths return 404 and foreign origins return 403.
4178 and 4180 remain on `38d532e25ca82a8275b0eb687d316f6ec7a796ca` with their prior
startup clocks. No site switch or deployment was performed.

97 targeted tests passed (13 new projection/UI tests plus existing adapter,
technology status and trace tests). They cover duplicate/conflicting bindings,
review reorder, exact identity, copied recovery without the original workspace,
changed bytes, missing batches, unknown clocks, public-field filtering and read
bounds. A fresh process recovered all 545 actual copied rows with hash
`b5a5b86413f741afe435fb193e2ea9839543acbe4751cedf9a6596956a1a781d`.
Final browser acceptance is recorded separately in the status file; the full
repository suite was not rerun. Test counts do not establish live Paper acceptance.

This stage is local only. No push, main merge, market call, account or challenge
ledger write, 15:50 change, CPI pre-release restart or real order is included.
