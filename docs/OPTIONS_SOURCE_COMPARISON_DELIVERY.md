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

## Original-body content acceptance — September 20, 2026

This follow-up used unchanged product baseline
`26f5abbb85008da215b4cfea45bfed964138b377`. It checked one existing event,
`FOMC:2026-09-15/2026-09-16/MEETING_DATE_RANGE`, through the existing Host,
comparison store, protected page save and reload. No feature was added or fixed.
The earlier title-only comparison and its limits remain dated history.

The Host read the substantive extracted bodies of the Fed's
[September 16 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm)
and its linked
[implementation note](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a1.htm).
The second document adds operational details; both belong to the same primary
publisher and policy package. No factual disagreement was found, and they are
not two independent confirmations. The earlier CoinDesk title was not promoted
to a body analysis. No login, subscription, scraper or background task was added.

The two web-tool invocations made three URL attempts: statement success and
implementation direct-open failure, followed by success through the statement's
actual implementation link. The original failure is preserved. Second-precision
receipt clocks were `2026-09-20T04:25:42Z` and `2026-09-20T04:25:54Z`; requests
began at `04:25:41Z`. These are tool-observed clocks, not publisher transport
timestamps. The copied package contains selected **EXCERPT** material, not an
archival HTML/PDF capture. The statement specifies September 16 at 14:00 EDT;
the implementation note supplies only a publication date and effective date.
Its exact publication/effective clock stays unknown.

Four claims were checked against the saved original text and paragraph locators:

| Claim | Content check |
| --- | --- |
| Target range | A 0.25 percentage-point increase to 3.75%–4.00%; 25 basis points, not a 25% relative increase. |
| Reserve-balance interest | 3.90%, effective September 17; a separate administered rate, not the target range. |
| Desk directive | Same target range, effective September 17; a directive does not establish executed transactions. |
| Conditional reserve maintenance | Preserve “when appropriate,” “if needed,” remaining maturity of three years or less, and the ample-reserve purpose. |

No numerical mismatch was found. The initial draft's “permits” wording was
refined to “directs conditional actions” to reflect the directive's force while
retaining its conditions. It does not prove completed purchases or an ETF move.
Draft V1 remains immutable; V2 names its predecessor and actual check time.
This was a **same-Host content check**, not an independent reviewer or Owner
confirmation. Owner semantic-review boxes remain unchecked and the existing
`SEMANTIC_SUPPORT_UNVERIFIED` label remains; the attributed Host interpretation
records what was actually checked. No structured fact was sent to an evaluator.

The existing exported Host package helper received the actually read excerpts
and source receipts; existing CLI `RECEIVE_DRAFT` stored both analysis versions.
This avoided mislabeling Host-fetched text as an Owner-supplied Macro note.
The page's current feed catalog still lacks those bodies and truthfully shows
`UNAVAILABLE_IN_CURRENT_CATALOG_COPIED_SELECTION_RETAINED`. The copied excerpts,
original URLs, actual receipt clocks and V2 draft remain recoverable.

Production comparison `comparison-731f50e0-c04b-4d2d-9769-b0dbfeab6ec4` was
previewed and explicitly saved at `2026-09-20T04:34:07.448Z`, then reloaded in
**News & calendar → Event details · Source comparison**. Its fingerprint is
`sha256:b11ed211c4352987811dfcd7aace93c3b9449ff7f73b4c403ef49a4e151d7723`.
It appends to the original title-only comparison without replacing that record.
The existing reader verified package, drafts and comparison fingerprints.

No applicable real local plan existed, so production remains standalone with
zero bindings and zero ledger writes. A separate **SYNTHETIC_FIXTURE** workspace
copied the comparison and saved one explicitly incomplete draft at the real
current time. Page preview/save/reload linked its exact version and `owner`
condition as **REFERENCE_ONLY**, with no executable evidence. The original-plan
modal showed the matching fingerprint; the planner back-reference opened the
same saved comparison. There were no registrations, fills, holdings or exit
evaluations. This demonstrates the link operation, not a real-plan decision.

Unresolved: no archived September 16 release vintage, no precise implementation
clock, no matched pre-event expectation/plan, and no operation or ETF/option
outcome evidence. This is a September 20 historical review. It cannot prove an
original expectation surprise or backfill a historical condition trigger.

Private acceptance receipt:
`data/runtime/options-workbench-development/source-body-acceptance.json`, SHA-256
`83f46f3f637495d328e10778f6e77093d058655dd28eb3e9dcaea6fa1ec0524b`.
It locates the original tool responses, retained failure, claim checks, both
drafts, saved comparison, isolated draft and page checks. Raw text and local
runtime evidence are excluded from Git.

This follow-up used **zero market calls**, zero quote rows and zero application
external-model API calls. Two explicitly recorded Host analysis generations
(initial and revised) are not a count of all internal Codex inference. Production
store additions were four records: one package, two drafts and one comparison;
ledger and targeted-review writes were zero. Dollar cost remains **UNKNOWN**.
Existing limits and natural context-service settings did not change.

Only this delivery and its existing status file changed. Current checks cover
original quote matching, record integrity, retained revisions, unchanged ledger,
isolated reference-only binding, page save/reload/back-navigation, existing
Markdown validation, JSON parsing and both Git whitespace checks. The earlier
4,845-test product result above is historical, not a rerun for this content-only
task. No product defect was found. First real targeted quoting remains
NOT_VERIFIED; routine 15:50 acceptance remains PENDING_NATURAL_RUN.

For a future real-plan use, the remaining requirement is a genuinely saved
applicable plan and contemporaneous expectation; this historical review cannot
create them retrospectively. No new automatic work was scheduled.

## Prospective planning trial — September 20, 2026

Starting from `9e4a2b5b09ab81a35a14a5aadb61a24e173a05be`, the existing workflow
saved one real **prospective analyst research draft**, not a synthetic fixture,
approved execution plan or holding. A future event from the existing calendar
was checked against its official calendar and a primary prior-period release.
Publication and actual receipt clocks remain distinct; the future actual is
absent. Research content, source excerpts and operating records remain private.

The saved comparison separates four attributed source claims, conditional
support/mixed/reverse scenarios, a counterexample, missing consensus and quote
evidence, and a proposed manual follow-up. Same-Host original-text checks found
no numeric or quotation mismatch. They do not constitute independent review or
Owner confirmation. No quantified expectation surprise or executable opportunity
was established. The conditional thesis and future outcome have not been tested.

Existing Host package/receive functions and protected local preview/save routes
stored the package, analysis, incomplete plan and exact-version comparison link.
The plan stays `DRAFT`; the link stays `REFERENCE_ONLY`. No contract identity,
expiry, strike, size, premium, stop/target or latest position exit was invented.
A research review deadline is not a position exit or contract expiry. Future
checks require an explicit active review; recording them creates no automation.
The original 09:00/15:50 schedule does not establish opening or release-time
coverage. No trade remains an allowed result.

Actual browser checks reopened the same comparison and original-plan modal,
resumed the draft in Trade planner, and followed its comparison back-reference.
Saved IDs, exact plan version, source coverage/clocks, unconfigured fields and
non-executable status matched. A fresh process verified record fingerprints and
the ledger; every prior comparison fingerprint remained unchanged. There are
still zero registered trades, fills, holdings and position evaluations.

This use exposed one presentation defect: every saved comparison was labeled
historical, including prospective event planning. The card now says **Saved
source snapshot, not a live market assessment**, and directs readers to the
recorded clocks. No temporal status engine, source transport, trading rule or
new page was added. One existing-suite regression covers both past and future
events while preserving the unverified-semantic and no-live-assessment labels.

Private acceptance receipt:
`data/runtime/options-workbench-development/prospective-acceptance.json`, SHA-256
`fd829bb17f6614d20b121e8cc84f8b31397aff299086718f0a7897e669966195`.
It contains private IDs, versions, read receipts, next checks and browser evidence
references. Git contains only this operational summary and sanitized status.

Current validation, after the product text fix: source-comparison tests **20/20**,
`npm run typecheck` passed, and `node scripts/alpha-validate.mjs` passed **4,846
tests, zero failures across 182 components**. Warnings concerned the intentionally
dirty working tree and LF/CRLF normalization. A private API-check helper initially
looked for workspace identity in the state response; it failed before saving and
was corrected to use the existing health endpoint. No product API defect or data
loss resulted. An initial private validation-log parser also failed before receipt
creation and was corrected; the actual product validation had already passed.
The final documentation-only update uses the existing Markdown check and JSON
parsing plus both Git whitespace checks; no second full product run is implied.

Usage: **3 public web-tool invocations**, comprising 3 page-read operations over
2 distinct official pages and 1 consensus search with no results. The first read
has an observed receipt-end bound but no precise request-start clock; subsequent
search/read clocks are retained. One attributed Host analysis generation was
saved; this is not a count of all internal Codex inference. Application external
model API calls, market calls and new quote rows were **zero**. The product added
3 comparison-store records and 1 draft ledger event (2 ledger files plus 1 API
command file): **6 durable product files**, excluding private development receipts.
No targeted review was added. Dollar cost remains **UNKNOWN**.

Remaining conditions are reliable pre-release expectation evidence, appropriate
fresh saved quotes and explicit Owner confirmation of an executable plan. Future
event outcomes remain pending rather than failed. First real targeted quoting
remains NOT_VERIFIED and routine 15:50 remains PENDING_NATURAL_RUN; this trial
does not advance either acceptance. No source frequency, frozen experiment,
historical evidence, capital setting or account/order permission changed.
