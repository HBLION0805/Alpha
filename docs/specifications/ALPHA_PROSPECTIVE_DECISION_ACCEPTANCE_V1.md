# Alpha Prospective Decision Acceptance V1

## Scope

This milestone begins only after Event Intelligence & Point-in-Time Replay can preserve real evidence. It does not expand option structures.

The three explicit product deliveries are:

1. **Event Readiness & Rule Registry**
2. **Qualified Required Evidence Intake**
3. **Prospective Decision Issuer**

A prospective engineering PASS proves that Alpha made a timely, reproducible, point-in-time decision from predeclared rules and qualified evidence. It does **not** prove that market direction was correct, that the strategy has edge, or that it can make money.

## Gate 1 — Pre-event Ready

Each real scheduled event must have a frozen event-specific readiness contract before the event. The contract defines event identity/time, thesis version, only the evidence required for that event/asset, exact source, freshness clock/limit, session applicability, missing-data behavior, executable SUPPORT / DEGRADE / INVALIDATE rules, and a frozen latency/generator policy.

A GLD-only event must not be blocked by an unrelated IBIT gap. If a rule requires a real yield, a nominal yield is not a substitute.

Gate 1 is PRE_EVENT_READY only when every EVENT_NOT_READY requirement is satisfied and a matching Decision Issuer fault rehearsal has passed. Missing rule-only evidence remains RULE_UNEVALUABLE; it is never silently neutral.

Event start is a hard boundary. A contract registered after the event, or a first readiness evaluation after event start, cannot be promoted to prospective readiness.

## Rules are executable, not prose

Each rule binds: rule ID/version, effect, metric, exact source, operator/threshold, required observations, observation interval, evaluation window, applicable session, freshness requirement, and missing-data policy. A changed threshold or source creates a new version; prior versions remain immutable.

## Gate 2 — Live Run

The V1 Prospective Decision Issuer is deterministic: generatorType = RULE_ENGINE and modelVersion = null.

It records trigger evidence IDs, triggerEligibleAt, processingStartedAt, evidenceCutoffAt, generatedAt, processingCompletedAt, decision latency, latency policy version, exact input evidence IDs, contract/rule/thesis versions, evidence completeness, thesis state, and blockers.

The same trigger identity is idempotent. A correction uses a new evidence identity and may append a new decision. Restart resumes the original attempt identity. Evaluation failures leave a terminal FAILED record. A decision after the frozen latency limit is retained as TIMED_OUT; the threshold is never moved after seeing the result.

UNEVALUABLE may be an engineering PASS when issued automatically and on time because required evidence is genuinely unavailable. Inventing stale or substitute evidence is a failure.

## Gate 3 — Post-event Audit

Replay must recover the original decision without rerunning today's rules or model. Evidence requires receivedAt <= replay time and, when parsed, parsedAt <= replay time. Decisions require generatedAt <= replay time. Later corrections append and never rewrite prior facts/decisions. Source latency and Alpha processing latency remain separate. Chronology does not prove causality.

## Fault rehearsal

Before a real event may pass Gate 1, the exact generator and latency-policy versions must have a saved rehearsal covering duplicate trigger, restart after START, correction/new trigger, evaluator failure, and decision timeout. Synthetic rehearsal validates software only; it never becomes market evidence.

## Acceptance discipline

A calendar date never lowers the gate. If a planned event arrives before Gate 1 is ready, record EVENT_NOT_READY / observation-only and use a later event for formal acceptance.

The October 2, 2026 Employment Situation remains a failed live acceptance sample. Later BLS repairs, real-market observations and post-event assessments must not convert the missed 08:30 window into a prospective PASS.

## Current boundary

No production/future event readiness contract has been registered yet. The current engineering rehearsal proves issuer mechanics only. Qualified GLD/IBIT live market evidence remains an open dependency for any event whose contract requires it.

Execution authority remains false.
## Relationship to the current real-data experiment standard

Prospective Decision Acceptance remains the event-decision integrity standard, but it no longer delays real-data paper experimentation until every prospective gate is complete.

The current governing development order is defined by `ALPHA_REAL_DATA_EXPERIMENT_STANDARD_V1.md`: real-data engineering experiments start on October 8, 2026, while strategy validation continues separately with frozen prospective rules.

A NO_TRADE_VALID outcome may pass its non-trade engineering path but cannot pass full held-position exit acceptance. SYSTEM_FAILURE remains an engineering failure even when preserved correctly. A single LOSS is a trade outcome, not an edge conclusion.

Prospective event gates remain mandatory for samples that claim prospective strategy validation.
