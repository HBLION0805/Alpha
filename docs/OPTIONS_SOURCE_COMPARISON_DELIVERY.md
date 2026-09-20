# Event source comparison and original-position review

Delivered September 20, 2026 on `codex/gld-ibit-options-foundation`, based on
`7c327a82ef2bb869299dac2f09b43e58843ca2e9`. The existing targeted quote implementation
and original exit evaluator are reused. No Host schedule, collector, allocation,
frozen rule, reported fill or research cohort changed.

## Using the feature

1. Open **News & calendar → Event details · Source comparison**. Select an
   existing event and one to six relevant saved materials, then prepare the
   evidence package. Primary publisher entries appear first. Preparation saves
   selections; it does not run analysis or queue work. Optional excerpts reuse
   Macro playbook's saved note and remain Owner-supplied.
2. Ask the existing equipped Host to read that exact package and return a cited
   draft through the existing macro-context CLI. The executable handoff and
   payload fields are in the [specification](specifications/OPTIONS_SOURCE_COMPARISON_V1.md).
   The page can also receive an already generated draft. No application model
   service or automatic source fetch was introduced.
3. Select the received draft, review its five sections, optionally link a saved
   draft/frozen plan version and specific condition, preview, then explicitly
   confirm/save. Semantic support stays unverified unless separately reviewed.
   Changes invalidate the preview; revisions append without changing originals.
4. Open linked comparisons from **Trade planner** or **Trade journal → Position
   exit checks**. A qualified numerical candidate can prefill the original
   Owner-confirmation form. Review and explicitly confirm there before saving an
   evaluation. The existing evaluator applies original event identity, metric,
   period, unit, adjustment, vintage, source and prospective expectation checks.
   Narrative references never auto-invalidate a thesis.
5. For new quotes, use the unchanged **On-demand position quotes** request and
   Owner-triggered Host path. Comparison saves, page opens and refreshes make no
   market request. News, quote and evaluation clocks remain separate; co-display
   is not continuous or simultaneous monitoring.

SUPPORTED/UNKNOWN/exit outcomes are still produced by the original evaluator.
Source comparison has only reference/manual-review/handoff eligibility. It adds
no independent thresholds, scoring, probability or trading permission. Reliable
prior exits remain visible when another evidence source or quote is missing.

## Implementation and persistence

- New bounded source-comparison helpers and existing macro-context CLI/service
  actions implement preparation, draft receipt, preview, explicit save, recovery
  and the original confirmation handoff.
- Existing protected same-origin session API gains `/api/source-comparison`;
  News & calendar, planner and position checks gain compact cards/back-links.
  Original evidence-field edits clear Owner confirmation before another preview.
- Existing `options-macro-comparisons` storage retains the shared 500-record and
  16 KiB limits. Package, draft and saved comparison are three distinct record
  types; numerical macro comparisons retain their old reader/behavior. GET does
  not append. Fingerprinted references, exclusive writes and idempotent saves
  prevent replacement; missing/corrupt records are Unavailable. Historical saved
  events remain selectable after leaving the current calendar.
- The two existing Macro playbook entries `psych-news` and `psych-tools` were
  updated, without new catalog entries. Tool names, author use cases, connection,
  actual use and unknown fees remain distinct. No broker identity is assigned to
  the Owner from author material.

Changed implementation files: `apps/options-workbench/{api,app,focused-news,
position-watch,styles,trade-thesis,views,source-comparison}`; `scripts/lib/
options-{source-comparison,macro-context-io,trade-thesis-io,workbench-data}.mjs`;
`scripts/options-{macro-context,workbench}.mjs`; `MacroPsychologyCatalog.ts`.
Focused fixtures/test and the existing validation registry were extended.
The earlier quote delivery's code example was rewritten equivalently because
the existing Markdown checker interpreted bracket-call syntax as a local link.
No validator bypass was added.

## Actual historical comparison

Saved `fomc-20260916-historical-comparison` at
`2026-09-20T04:00:09.893Z` against the existing September 15–16 FOMC event ID.
It compares two previously saved feed titles: the Fed statement announcement and
a CoinDesk live-update market-reaction headline. Both remain **HEADLINE_ONLY**;
no article body was retrieved. It records an emphasis difference, not an invented
factual dispute or verified policy result. The reporter's morning publication
clock precedes the later events described in the saved title; absent a revision
clock the later headline cannot be assigned to that morning observation.

The saved card has no numerical actual, semantic confirmation, plan binding or
new position. Its private receipt is
`data/runtime/options-workbench-development/source-historical-acceptance.json`.
The saved comparison fingerprint is
`sha256:2b4a83efebd99d63654d5e75976dcaffd87e9c85c98359286f8cf690ba07c93e`.
Package/draft paths and clocks are retained in that receipt and status file.
The actual page displayed this same saved ID, all five sections, coverage,
independent clocks and semantic limitations after a full reload.

## Verification and independent states

The final fresh full validation passed **4,845/4,845**, zero failures, across 182
components, including TypeScript. The focused suite passed **19/19**. See
[machine-readable status](status/source-comparison.json) for log fingerprint and
browser receipt. The focused suite checks
single/shared sources, incomplete coverage, conflict, semantics, original rules,
late/revised material, immutable plans, retries/revisions, protected APIs,
restart recovery and existing targeted-quote co-display. No new test framework.

Browser acceptance used an isolated synthetic workspace. Selection → Host draft
receipt → preview/edit invalidation → save → original frozen condition → explicit
Owner confirmation → original INVALIDATED/exit reason → back-reference worked.
A stale quote did not create a current valuation or hide the fact exit. An
injected targeted quote then appeared under the same existing position checks;
the original exit trigger survived. A process restart recovered the same
comparison, targeted review ID and evaluation. Original-plan navigation was also
checked. These are synthetic acceptance records, not production observations.

The first full run had passing product tests/typecheck but failed the existing
Markdown scan on the prior delivery's code example. Browser testing also found
and fixed a missing client API allowlist entry. Both were resolved; the final
validation run is separately recorded rather than relabeling the first run.

Three separate states:

- **Source comparison and integration:** implemented and locally verified;
  one real, dated, limited historical comparison saved and displayed.
- **First real targeted position quote:** NOT_VERIFIED. No existing real review
  receipt was present; the local reported supported ledger had no open positions,
  the actual session was a weekend, and no explicit eligible review scope was
  supplied. This is not a statement about the brokerage account. No account read
  or fabricated position was used.
- **Routine 15:50 natural acceptance:** remains PENDING_NATURAL_RUN. The existing
  candidate window is September 21; its future receipt was not re-audited and no
  substitute collection was started. Targeted fixtures do not satisfy it.

## Calls, storage, limits and next condition

This feature's real market calls and returned quote rows: **0 / 0**. Production
comparison writes: **3** (package, draft, comparison). Production ledger writes
and targeted review writes: **0**. Private development receipts are separate.
One historical **Host analysis generation** was used; external model API calls
added by the application: **0**. Host model identity is not exposed in its saved
receipt. Dollar cost remains **UNKNOWN**, including Codex usage. The existing
context service retained its prior setting; its natural public refresh is not a
new source-comparison request.

The isolated browser targeted round used two injected calls, one ETF quote row,
one option quote row and six existing collector/store writes. This does not count
as real market acceptance. Existing real targeted limits remain two calls/six
verified contracts per explicitly requested round, shared slots, regular-session
and 15:50 reservation checks, no chain scans or automatic retry. No subscription,
external service, new cadence or storage-capacity increase was introduced.

Next: when the Owner has a genuinely reported supported open position and
explicitly selects its review scope, execute the existing two-call path in an
eligible regular session and retain its actual result. No autonomous future task
was created. Missing bodies/lineage remain limitations of the historical card.

Recovery: keep all private records. If code rollback is separately authorized,
revert this feature commit normally, without reset/rebase or deleting evidence.
Older readers will not understand the new additive comparison records; preserve
them and use this version to read them. Git does not back up runtime evidence,
installed automation or Host state.
