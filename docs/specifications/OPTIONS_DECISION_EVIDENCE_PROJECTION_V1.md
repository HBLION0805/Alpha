# Options Decision Evidence Projection V1

## Purpose and authority

Successful Fast Host FINISH adds one immutable, local Decision Evidence artifact after capture, attributed analysis, issued guidance, and Prediction Evidence. It contains exactly GLD and IBIT. It is an audit projection of the issued decision context, not a strategy, Prediction Log entry, frozen plan, broker instruction, or canonical trading decision. The artifact and each candidate set `executionAllowed=false`, `canonicalDecisionEligible=false`, `canonicalPredictionEligible=false`, and `ownerAuthorityRequired=true`.

Prediction Evidence V1 has no forecast horizon, frozen plan, or Owner authority. Decision Evidence therefore records `NO_TRADE` for both assets, even when the original issued guidance is favorable. It separately retains the original disposition and a conditional direction candidate from the bound Prediction Evidence / Host bias: BULLISH to UP, BEARISH to DOWN, MIXED or INSUFFICIENT_EVIDENCE to null. Event surprise signs cannot set direction. The original decision card entry condition, attributed invalidation, full issued blockers, source clocks, and reference contracts remain labeled context. Trigger, numerical entry/stop/target, exact time exit, frozen plan, fill, and confidence remain null. Illustrative cost examples and candidate plans are never selected trades or approved risk.

## Temporal binding and storage

Build cards from the verified original report envelope, using exactly `report.report`, `report.input`, `report.input.analyst`, and `explainDailyGuidance(report.input)`. Focused-news source health comes from the saved input. Capital policy is assessed only against `report.input.settings`. The saved payload does not consume refreshed `guidance.current`, later settings, later policy, manual plans, or the read clock. Provenance binds Prediction Evidence path/identity; report path/input and report fingerprints/issued clock; capture path/fingerprint/capture clock; analyst path/fingerprint/assessment clock. Copy the Prediction Evidence eventFacts snapshot without reinterpretation.

Use a deterministic key from the exact Prediction Evidence and issued report identities under ignored `data/runtime/options-decision-evidence/`. Existing safe evidence-export byte/path helpers enforce bounded reads, canonical JSON bytes, integrity hash, exclusive creation, and symlink/unsafe-path rejection. A verified existing record returns idempotently; mismatched binding or corruption fails closed. `/api/state` and `--decision-evidence` are read only. Earlier evidence stays `NOT_MATERIALIZED`; absent Prediction Evidence has an explicit dependency reason. No backfill.

FINISH may materialize only after the existing operational checks pass. An operational FAIL returns `decisionEvidence: SKIPPED` with a reason and leaves no Decision artifact. A projection error fails FINISH closed. The compact FINISH field carries status, identity, path, candidate count, and disabled execution within the existing 16 KiB limit. A pure validator and saved-artifact verification provide the independent Alpha1550Verifier V3 reference check; neither reads sources nor grants authority.

## Acceptance

Isolated fixtures cover actual materialize/read/verify, all four bias mappings, unchanged identity on repeat, read-before-write, stale capture and mismatched Prediction Evidence, unsafe paths and corruption, changed settings/clock, operational failure, Fast Host identity propagation and output size. Existing Prediction Evidence and related suites, typecheck, and full Alpha validation must pass. No real prospective record is created by these fixtures; natural 2026-09-30 15:50 capture and 16:05 acceptance are separate and unobserved.
