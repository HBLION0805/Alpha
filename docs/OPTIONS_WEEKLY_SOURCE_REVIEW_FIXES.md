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
