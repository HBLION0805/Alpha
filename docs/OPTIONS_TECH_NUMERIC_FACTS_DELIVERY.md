# Explicit numeric facts in existing research reviews

October 13, 2026. `fundamental.numericFacts` previously remained an unconditional
empty array; the V1 event-review schema accepted only prose and citations. This
delivery adds `TECH36_EVENT_REVIEW_REQUEST_V2` to the same `--append-event-review`
entrypoint and existing append-only store. No collector, financial database,
automatic text extraction, ranking change or additional CLI was introduced.

## Boundaries and validation

V2 adds `review.numericFacts`, with at most eight explicitly reviewed net-revenue
groups. Each group contains metric, currency, scope, current amount/unit/period,
one or two YOY/MOM comparisons, interpretation and the exact prior review head.
It requires an existing qualified company/event review, a successful bound receipt
and retained source bytes.
V1 still rejects numeric fields and produces exactly its original empty array.

Amounts are nonnegative decimal strings, preserving the displayed precision.
The bounded validator supports TWD, explicitly labeled USD and EUR amounts, and
ones/thousands/millions. It performs no currency or unit conversion. A comparison
must use the same unit, metric, currency, scope and source document. Unit labels,
metric labels and period context are cited separately from the numeric token.
MONTH and January-start YTD periods are calendar-checked; YOY requires the same
period in the preceding year, MOM adjacent months. Missing/zero baselines,
mixed units, unsupported scopes and wrong source bindings fail closed.

Every citation carries source SHA256, exact URL, block index and SHA256 of the
extracted block's UTF-8 text. Numeric token offsets address that normalized block;
the existing document projection retains source coordinates and original bytes.
These are not hashes of reserialized HTML. All referenced blocks must be in the
review's explicit citation list and belong to the same event/company source.
Column and accounting meaning remain attributed review, not machine authentication.

The declared formula is `(current / baseline - 1) * 100`. BigInt decimal arithmetic
recomputes it and retains the exact rational numerator/denominator. The displayed
result uses one decimal, nearest with ties away from zero, and must match the
source's explicitly located percentage. No tolerance silently repairs a mismatch.
Other calculation types or reporting precision remain unsupported.

The consumer revalidates the facts against retained documents and the exact V2
record. Each emitted fact has both the earlier source-review SHA and its own
request ID, append-review SHA, reviewed-at clock and base receipt. Replay and
copied-only recovery use the existing chain. A later prose-only review yields
no numeric facts in its latest projection; earlier versions remain recoverable.
No prose interpretation, metadata row or legacy Boolean can populate numeric facts.

## Actual saved TSM consumption

No new source call was made. The separately acquired October 13 receipt of the
October 8 TSM 6-K remains intact. An isolated copy of its two existing reviews
received a third review at `2026-10-13T01:39:50.059Z` (October 12 21:39:50.059 ET).
The new head is
`4907925af792651b8f11d52357d60210a76b26239e4d1f2de04fe01f2179a477`.

The existing research reader now returns two `fundamental.numericFacts` groups:

| Period | Current value and unit | Comparison baseline | Verified reported change |
| --- | --- | --- | --- |
| September 2026 | 511,857 NT$ million | September 2025: 330,980 NT$ million | +54.6% YOY |
| September 2026, same group | Same current value | August 2026: 514,806 NT$ million | -0.6% MOM |
| January–September 2026 | 3,898,726,974 NT$ thousand | January–September 2025: 2,762,963,851 NT$ thousand | +41.1% YOY |

The September group uses the million-unit table consistently because its August
comparator is there. The separate more precise September thousand-unit values
remain in the original and prior review; they are not silently substituted into
the million-unit comparison. The cumulative group uses the detailed thousand-unit
table. Its scope is company-reported rather than extending a consolidation claim
beyond the reviewed table labels. The reported percentage is separately cited.

This supports historical top-line growth and a small sequential monthly decline.
Historical age does not invalidate that background value. It does not establish
profit, margins, consensus surprise, guidance revision, undervaluation or future
share-price direction. The October 8 event and original discovery/receipt clocks
remain historical. Fundamental/news direction stays UNKNOWN; technical structure,
holding window and new catalyst timing are still unestablished. Existing ranking
is exactly unchanged at REJECTED; quote, admission and Paper were not run.

## Evidence and preservation

The focused regression run passed 206 tests, including 20 new numeric append,
rejection, version and recovery cases. The final 21-case numeric subset was rerun
after the projection text and success-only source-receipt alignment were finalized.
The whole repository suite was
not run. Negative cases cover mixed units, cross-period/missing baselines,
arithmetic differences, source URL/hash/block mismatches, token substrings,
uncited blocks, currency/period labels and unqualified or stale review bindings.

Private run: `data/runtime/options-workbench-development/tsm-numeric-facts-20261013-01`.
`request.json` is the explicit V2 request; `append.json` the saved revision;
`fundamental-input.json` is actual reader output, not a hand-built substitute for
numeric facts; `after-review.json` contains the complete projection. `recovery.json`
records exact copied-only replay, unchanged prior ranking and historical-version
replay at its original read clock. Test logs and preservation evidence are local.

All old receipts/reviews, protected runtime/account/CPI records and existing
websites remain unchanged. This is a local code delivery and isolated research
append only; no push, deployment, new source cadence or trading authority.
