# Weekly source review corrections — October 11, 2026

Independent review of `0ba6ba7` found four P2 issues. This focused follow-up
preserves every acquisition original and does not change any source cadence.

1. Calendar histories now carry per-input receipt identity through the merged
   ordering. The selected successful input owns both displayed event values and
   its exact original path/fingerprint. A later failed refresh owns latest health
   only. The regression explicitly covers refresh success at 01:00, legacy-store
   success at 02:00, then refresh failure at 03:00.
2. OFAC sanctions are policy/geopolitical context. They no longer count toward
   Treasury/fiscal coverage, which remains NOT_INTEGRATED without an applicable
   auction/fiscal calendar.
3. Company references use the existing exact TECH36_POOL denominator. QQQ and
   SPY remain separate market-background references and never count as companies.
4. Headline receipt freshness and publication age are separate fields. Each
   registered headline source retains the existing 72-hour news-context window.
   Old content becomes HISTORICAL_BACKGROUND; unknown publication clocks become
   CONTENT_TIME_UNKNOWN. Neither contributes to current available-headline counts.
   Fresh retrieval does not rejuvenate old content. Calendar freshness is still
   the separate existing 26-hour rule; no trading threshold is changed.

The projection also exposes partial parsing, rejected item counts and source
item counts in both source health and refresh receipts. The actual BEA response
was HTTP 200 with 48 source items, 47 parsed and one rejected: a partial result.

## Same-original replay

Assessment pinned to `2026-10-11T03:40:03.949Z`, using the unchanged stage-2
originals: current headline count changes from 148 to 7; the retained display
contains 233 historical and 60 unknown-publication records after display dedup
and the 300-record limit. Company references are 29 across 14 of 36 companies;
QQQ/SPY are two separate background references. Treasury/fiscal has zero matched
records and remains NOT_INTEGRATED. The current-week company event count stays
zero; references are not current event verification.

Focused weekly/source tests pass 25/25, including a regression for each P2 and
partial parsing. Typecheck and real-original desktop/mobile UI checks pass.
Private replay and screenshots use new `review-p2-*` files beside the original
stage-2 evidence; no original acceptance artifact is overwritten. No 4178 change.

The optional process-runner extension is separate work and a subsequent commit;
its lifecycle validation must not be inferred from these source corrections.

## Concurrent update follow-up

Independent review after the real runner acceptance found another P2: the page
composed event facts from one read, awaited the preview, then read sources again
for coverage and receipt identity. A writer could append a newer calendar in that
gap, causing an October 13 event from the 01:00 input to point to the October 14
input received at 02:00.

The page now captures one recursively frozen source snapshot and passes it to
both composition and coverage projection. Calendar facts, latest health, original
identity and refresh-receipt lists therefore remain from that same capture. A
subsequent page request sees the new data together. This does not claim a global
transaction across independent stores or change saved plan fingerprints.

Two deterministic tests reproduce the actual awaited boundary without sleeps,
network access or production writes. One appends a valid legacy journal; the
other publishes a separately prepared immutable refresh receipt after preview
reads but before coverage resumes. Both assert the old fact retains its original
path/fingerprint and the next request adopts the new fact and original together.
The tests also check nested snapshot immutability. Reproduce from this checkout:

```powershell
node --import tsx --test --test-name-pattern concurrent scripts/options-weekly-sources.test.mjs
```

The combined weekly/source suite passes 27/27. The full validation bundle passes
230 components and 5,902 counted tests with zero failures; the node:test-only
weekly suite is reported separately. A local negative-control loader
that restores only the second source read makes both concurrent tests fail on
the wrong fingerprint/path, demonstrating that the cases detect the reviewed
defect. The loader and output remain ignored under
`data/runtime/options-weekly-sources/concurrency-reproduce-old-read.mjs` and
`concurrency-negative-control.txt`.

Offline replay of the existing real receipts at 04:43:52.164 UTC reproduced all
four displayed BLS events from their exact referenced raw inputs, with matching
times, titles and receipt fingerprints. Its ignored result is
`data/runtime/options-weekly-sources/concurrency-saved-source-replay.json`.
No new source request occurred. Original stage-2 files, runner journals, source
receipts and the final runner acceptance hash remain unchanged. The 4178 preview
is still the frozen version and awaits independent review of this follow-up.
