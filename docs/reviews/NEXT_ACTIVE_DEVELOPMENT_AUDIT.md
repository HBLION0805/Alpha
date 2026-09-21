# Next active development priority audit

Decision date: September 20, 2026, America/New_York. Saved-data inspection:
September 21, 02:05–02:06 UTC. This is a recommendation, not implementation approval.

**NEXT_ACTIVE_RECOMMENDATION: Case-scoped private evidence export and isolated recovery verification.**

Suggested Codex task name: **Alpha — Private Case Evidence Export & Recovery**.

## Current state and frozen work

Inspected branch `codex/gld-ibit-options-foundation`; local HEAD and remote readback
both `845a703780e045ca4a2693aed6ecb16cca390366`. The recent evidence-loop integration
is present; it must not be rebuilt. The existing unrelated September 16 evening
note is untracked and remains untouched.

The actual saved workbench reader recovered `gld-employment-20261002` draft-v3:
**DRAFT / Prediction NOT_CREATED**, no reported trades. Its expectation is RESEARCH;
Assumption EV remains NOT_CALCULABLE and Validated EV UNKNOWN. The existing next
readiness checkpoint is October 1, followed by the pre-entry assessment. This is
WAITING_FOR_EXTERNAL_CONDITION, not an outcome or a reason to manufacture updates.
The prior private trial-start receipt remains the runtime authority for its exact
references. This audit adds no trial record or research version.

Frozen for feature development: Market Expectation, Trade Thesis, Confirm & Freeze,
Scenario EV, Contract Fit, Prediction Evidence Loop, Manual Ledger, Position/Exit
Checks, Risk/Capital and PRE_EVENT/POST_EVENT logic. Only a separately established,
reproducible trial-blocking product defect could justify a minimal repair.

[Routine acceptance](../status/routine-1550.json) stays PENDING_NATURAL_RUN;
[targeted quotes](../status/position-quotes.json) stay NOT_VERIFIED for real use.
No future window was tested or marked complete. No service was started: no listener
was found on 4173 during inspection. This does not establish a scheduler failure.

## Foundation status: implementation is not real-world validation

Codes: **A** implemented and used; **B** implemented foundation, not workbench-wired;
**C** specification/interface only; **D** partial integration; **E** waiting for real
evidence; **F** further expansion not needed yet. Multiple codes describe different
layers. Runtime absence below is scoped to this checkout and inspected entry paths,
not a claim that another environment has never used the foundation.

| Foundation | Status | Actual implementation / consumption evidence |
| --- | --- | --- |
| Prediction Log | D/E | [PredictionLog](../../src/engines/prediction-log/PredictionLog.ts) and NDJSON repository are used by [evidence adapter](../../scripts/lib/options-evidence-loop.mjs), through planner freeze and Trade journal. Real draft recovery works; no production prediction store/outcome exists yet. |
| Alpha Journal | D/E | [AlphaJournal](../../src/engines/alpha-journal/AlphaJournal.ts) is called by the same adapter after explicit review confirmation. UI/restart acceptance exists in [latest delivery](../OPTIONS_EVIDENCE_LOOP_DELIVERY.md); no actual closed-trade journal exists. Not a missing feature. |
| Research Lab | B/F | [ResearchLab](../../src/engines/research-lab/ResearchLab.ts) has finalize/amend/review/query/predictionEvidence and [local storage](../../src/repositories/LocalNdjsonResearchRepository.ts). No application instantiation/route found. Current options research uses its existing source-comparison records instead; no generic research store was found at the documented location. |
| Strategy Versioning | B/F | [StrategyVersioning](../../src/engines/strategy-versioning/StrategyVersioning.ts) implements proposal, validation, approval and activation; [local repository](../../src/repositories/LocalNdjsonStrategyRepository.ts) exists. No options runtime binding or populated local strategy store established. Do not fabricate a strategy link. |
| Learning Loop | C/F | [Learning Loop](../LEARNING_LOOP.md) describes reviewed-outcome learning. [LearningRepository](../../src/repositories/LearningRepository.ts) is an interface, not an operational learning service. Journal integration does not implement automatic strategy learning. |
| AI Router | B | [routeAIRequest](../../src/engines/ai-router/AIRouterEngine.ts) is called by [AIRuntimeWorkflow](../../src/engines/ai-runtime-workflow/AIRuntimeWorkflow.ts); no workbench runtime instantiation found. |
| AI Provider Adapter | B | [Registry/compatibility checks](../../src/engines/ai-provider-adapter/AIProviderAdapterRegistry.ts) exist. Inspected execution tests use fixture adapters; no application provider transport was found. Existing equipped Host use is not this adapter being product-wired. |
| AI Cost Governor | B | [evaluateAICost](../../src/engines/ai-cost-governor/AICostGovernor.ts) is connected inside AIRuntimeWorkflow, not the workbench or the independent Jev experiment. |
| AI Cost Ledger | B | [ledger engine](../../src/engines/ai-cost-ledger/AICostLedger.ts) and [NDJSON repository](../../src/repositories/LocalNdjsonAICostLedgerRepository.ts) exist; workflow reconciliation exists. No workbench ledger consumption/provider billing history established. |
| AI Execution Coordinator | B | [coordinator](../../src/engines/ai-execution-coordinator/AIExecutionCoordinator.ts) performs gated adapter execution inside AIRuntimeWorkflow. This is implemented composition, not an active workbench AI service. |
| Unified Audit | B | [audit repository](../../src/engines/ai-audit-repository/AIAuditRepository.ts), local persistence and translation functions exist. Workflow writes normalized audit instructions/records; no unified workbench audit route or populated application audit store established. It is not Options Outcome Audit. |
| Event Replay architecture | B/F | [EventReplayEngine](../../src/engines/event-replay/EventReplayEngine.ts) and [local repository](../../src/repositories/LocalNdjsonEventReplayRepository.ts) implement timeline/checkpoint reconstruction. No application caller found; not merely a specification, and not an option-price simulator. |
| Options Outcome Audit | A/D | [CLI/readers](../../scripts/options-outcome-audit.mjs) feed [workbench state](../../scripts/lib/options-workbench-data.mjs) and [Reviews](../../apps/options-workbench/views.js). Current paper component recovers SYNTHETIC_FIXTURE outcomes; historical component is blocked (below). It does not need another audit page. |
| Options Historical Replay | D/E | [CLI](../../scripts/options-historical-replay.mjs), engine and bounded journal exist and feed Outcome Audit. Actual read returns STORE_BUSY; target-market replay qualification must not be inferred from engineering fixtures or the generic Event Replay engine. |
| Dashboard / workbench Overview | A | Existing [routes/views](../../apps/options-workbench/views.js) consume chain, manual records, progress, calendar and review projections from saved state. It is already a usable surface, not a missing dashboard. |
| Macro playbook / World Model | A | [playbook reader](../../scripts/lib/options-macro-playbook-io.mjs), [World Model UI](../../apps/options-workbench/world-model.js), protected API and [Batch 2 integration](../MACRO_WORLD_MODEL_BATCH_2_DELIVERY.md) are wired. [Real-material retrieval](../research/macro/world-model/BATCH_2_REAL_NEWS_VALIDATION.md) is bounded/in-sample, not validated trading influence. |
| Trade journal | A/D/E | [existing journal view](../../apps/options-workbench/views.js) already connects manual records, independent exits and evidence-loop reviews. Actual draft is readable; no real trade/outcome is available for the new loop. |

Inspected imports, constructors, routes, saved readers and actual component states,
not just document titles. The local reader returned AVAILABLE for current manual,
guidance, source comparison, expectation, scenario, evidence-loop, playbook,
World Model and storyline components. Four Owner-reviewed storyline links are
recorded in [delivery status](../status/storyline-links.json); relevance approval
does not upgrade coverage, causality or trading permission. No browser session
was started for this repository audit; prior browser acceptance remains dated.

## Concrete gaps

**1. Portable current-case evidence is outside the existing export scope.**
[Exporter V1/V2](../../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts)
cover older study/paper/historical/context stores and require a study plan. The
read-only `exportSourcePolicy` probe returned `OPTIONS_EXPORT_SOURCE_SCOPE` for
the actual manual-ledger manifest, employment expectation and scenario paths in
both profiles. Prediction/Journal paths are also outside scope; their current
absence is correct, not missing evidence to manufacture.

The [browser download function](../../apps/options-workbench/app.js) exports selected
view data, not all referenced authoritative files. Its
[guide](../OPTIONS_WORKBENCH_GUIDE.md) explicitly says downloads do not replace
recovery packages. Existing [export guarantees](../OPTIONS_EVIDENCE_EXPORT_DELIVERY.md)
provide bounded copies, hashes and before/after checks, but deliberately not semantic
recovery or off-device protection. Reload/restart acceptance against the same stores
is also not proof that a detached copy contains the entire case. No claim is made
about any independent Owner backup outside this repository.

**2. Historical research is currently unavailable through its normal reader.**
At 02:06 UTC Outcome Audit reported historical `BLOCKED / STORE_BUSY`; direct
historical `--report` returned EEXIST for the existing writer lock. File metadata
shows an empty lock created September 20 at 04:01:36 UTC. No matching workbench/
historical-replay Node process appeared in the inspected process list. That does
not prove the lock is abandoned or establish its owner/cause. The
[repository](../../src/repositories/LocalOptionsHistoricalReplayRepository.ts)
requires an exclusive lock even for reads; its
[test](../../scripts/options-historical-replay.test.mjs) explicitly prohibits
bypassing/removing existing locks. Lock and journal remain untouched. This does
not block the current employment draft or prove a product defect.

**3. Process identity is partly covered already.**
[Launcher](../../scripts/start-options-workbench.mjs) verifies application, workspace
fingerprint and ledger before reuse; [health API](../../scripts/options-workbench.mjs)
also reports context-refresh mode. It does not expose loaded build HEAD/start time.
That is a bounded diagnostic opportunity, not evidence of a wrong running version
now. Starting a second instance or expanding automatic collection is not a remedy.

## Candidate milestones (four only)

| Candidate / timing | Problem and visible Owner value | Implementation cost / affected modules | Operating cost |
| --- | --- | --- | --- |
| **1. Current-case private export + isolated recovery — BUILD NOW, after approval** | Existing export cannot carry current case authorities. Owner gets one explicitly scoped, verified private package and a recovery receipt, preserving original versions even outside the working store. | **MEDIUM**, estimated 2–3 focused sessions. Extend existing exporter/profile/manifest and reuse existing readers against copies; existing tests/CLI. No frozen engine, writer, schema or page changes. No dependency, API or provider. | No AI/market/public calls or paid service. Manual export and local storage; packaging is not off-device backup. |
| **2. Historical STORE_BUSY incident resolution — BACKLOG** | Restore access to already saved historical reviews if lock provenance can be established safely. No new replay functionality. | **LOW–MEDIUM**, 1–2 sessions if provenance is resolvable; reader/recovery procedure only. A lock ownership investigation may end externally blocked; do not pre-authorize deletion. No new dependency/API. | No external calls/services; one manual recovery review. Future legitimate locks must still block. |
| **3. Workbench loaded-build identity readback — BACKLOG** | Reduce manual uncertainty about which committed build a running instance loaded. Existing workspace/ledger identity checks remain. | **LOW**, about one session; launcher, health response and a small existing status display. Shared server/UI plumbing would still need compatibility checks. No new dependency/API. | No AI/market/public calls or paid service; small metadata maintenance. No automatic restart/update manager. |
| **4. Generic Research Lab read-only record browser — BACKLOG** | Expose generic finalized research/history if actual records arrive. Current options research already has source-comparison and snapshot views, so immediate additional value is weak. | **MEDIUM**, 2–3 sessions; repository read adapter and existing research surface. No external dependency; importing current options research would exceed this candidate and touch frozen scope. | No external calls/services; manual records and parallel UI maintenance. No content to backfill merely to populate it. |

| Additional criterion | 1: Private recovery | 2: Historical lock | 3: Build identity | 4: Research browser |
| --- | --- | --- | --- | --- |
| Touch frozen trial logic? | No; read/copy only, use unchanged readers on copies | No; separate historical store | No business logic; shared workbench plumbing | No only if kept generic; no options migration |
| Fully validate now? | Yes: current draft + isolated lifecycle fixtures, exact missing states | Conditional on ownership evidence; not assured | Yes with isolated process checks | Technical UI yes; actual usefulness not established |
| Future market/outcome needed? | No; absent future records remain absent | No | No | Not market-specific; needs a real usage need/records |
| Complexity effect | Small exporter scope added; reduces ad hoc copying/recovery work | Reduces one operational blockage | Small diagnostics added; reduces version ambiguity | Adds another browsing surface |
| Existing foundation reused? | Export bounds/hashes/exclusive writes + existing verifiers | Existing reader, locks and recovery checks | Existing launcher and health identity | Research Lab and NDJSON repository |
| Visible value now? | Protect/recover actual saved evidence | Historical engineering views only | Diagnostic, currently no running instance to reconcile | Limited; would largely be an empty view |
| Reversible? | Additive tooling; retain all packages/old profiles | Diagnosis yes; lock changes only after explicit safe procedure | Yes | Yes, but avoid redundant authority |
| Fits 1–3 sessions? | Reasonable scoped estimate, not a promise of full-workspace backup | If not externally blocked | Yes | Yes for browsing only |

## Recommended next ACTIVE: completion boundary

**Problem:** the evolving real case spans stores omitted by the existing portable
export mechanism. **Expected value:** Owner can recover exactly what was saved,
with a visible distinction between byte integrity and semantic/reference recovery.
**Why now:** real pre-event evidence already exists; this can be checked before
future outcomes, without inventing any. **Why isolated:** only additive export and
copy-verification code changes; all frozen readers, writers, schemas and decisions
stay byte-identical. If that boundary cannot be maintained, stop and re-scope.

Completion conditions for a separately approved task:

1. One explicit manual entry exports an allowlisted case package using existing
   bounds and safe-copy primitives. Preserve full necessary ledger history and
   exact referenced versions; do not filter hash chains into invalid fragments.
   Missing future predictions/outcomes are declared, never synthesized. No blanket
   runtime/log/credential copy, source reads, scheduler, cloud upload or in-place restore.
2. Manifest identifies scope, code compatibility, original clocks, source hashes,
   missing dependencies and consistency limits. Keep V1/V2 meaning and recovery
   unchanged; do not relabel checksums as semantic validation or atomicity.
3. Recover the copied current draft and references in an isolated directory via
   existing validators; compare IDs/fingerprints and DRAFT/NOT_CREATED state.
   Deliberately absent or corrupted references fail visibly in isolated fixtures.
   Future populated lifecycle coverage uses fixtures only, never production fills.
4. Before/after source hashes and ledger head prove production records unchanged.
   Produce a private receipt usable by Owner; no private contents committed to Git.
   A local package remains vulnerable to loss of its disk; off-device transfer
   requires a separate explicit Owner destination/action, not an added service.

No-new-feature was explicitly considered. It would be preferable to another empty
foundation UI, automatic learning or provider integration. Candidate 1 is narrower:
the export scope mismatch is directly reproducible and protects existing work.
Candidate 2 concerns old research and unresolved lock ownership; candidate 3 already
has partial safeguards; candidate 4 duplicates access before demand exists.

## Stop expanding / explicit backlog

Do not delete implemented foundations simply because they are idle. Stop creating
parallel Prediction/Journal, audit or replay pages for capabilities already wired.
Reuse existing views; retain distinct synthetic/historical/manual authorities.
Retire no historical evidence, diagnostic lock or frozen experiment in this audit.

| Deferred item | Current disposition / reason |
| --- | --- |
| Macro Batch 3 | **BACKLOG** — use the existing ten themes; no demonstrated uncovered task. |
| Learning Loop automation | **WAITING_FOR_EVIDENCE** — no reviewed real outcome series; one case cannot justify strategy updates. |
| Jev MCP / runtime routing | **WAITING_FOR_EVIDENCE** — prospective shadow evidence is insufficient; keep optional experiment isolated. |
| Kelly / Sharpe | **WAITING_FOR_EVIDENCE** — no adequate outcome distribution/calibration; no sizing inference. |
| Current-State auto refresh | **BACKLOG** — adds cadence, source-age obligations and operating cost without a proven current requirement. |
| Automatic news classification | **BACKLOG** — retain reviewed relevance links; retrieval acceptance is not classification accuracy. |
| New option strategies | **REJECT_FOR_NOW** — current trial/risk/exit chain is frozen. |
| New broker or data providers | **REJECT_FOR_NOW** — no need for this milestone; preserve known source limits. |
| AI runtime/provider integration, Unified Audit UI, general Event Replay UI | **BACKLOG** — foundations exist; do not turn unused code into mandatory product work. |

## Audit verification and delivery scope

This round inspected repository implementation, import/route consumption, local
readers and saved status; performed the pure export-policy probe and reproduced
the historical read refusal. No market/news/model call, Jev sample, service restart,
plan/ledger change, lock removal or recommended implementation occurred. Jev
samples/calls = 0; no eligible unresolved OWNER_GATE/FAILURE_TRIAGE was manufactured.
Git remote reads/push are repository operations, not market/model requests.

Only this review document is in scope for commit. Relative-link existence and
Markdown structure checks passed; working/staged `git diff --check` passed before
staging and are checked again on the final staged file. No product suite was run.
No new billed service was used; total billed dollars are not inferred from missing
billing evidence. Ordinary search misses for nonexistent filenames/glob paths were
corrected during inspection; they are not product failures or Jev cases.

Recommendation ends here. Do not create a new task or begin implementation until
Owner approves it. Existing natural collection and the real trial remain separate.
