# Evidence Fusion Layer Foundation Specification

Status: Day13-T1 completed, committed, and pushed as `7c670acd7a934ece5e6cbee844a9f5aa121c82d0`

Schema version: `1.0`

## Problem Solved

Future Decision and Risk consumers must not couple themselves to every evidence producer or consume raw benchmark observations. Evidence Fusion provides one deterministic composition boundary that validates reviewed evidence inputs and produces one immutable snapshot.

The foundation boundary is:

`approved evidence assessment -> source adapter -> EvidenceFusionInput -> deterministic validation and composition -> EvidenceFusionSnapshot -> future Decision/Risk consumers`

Day13-T1 accepts only Broad Market Evidence. Market Regime, Decision, Risk, Dashboard, Portfolio, and runtime startup are not wired in this milestone.

## Responsibilities

Evidence Fusion owns:

- a discriminated provider-neutral input contract;
- deterministic validation of source identity, state, schema, age, references, and provenance;
- explicit versioned source requirements;
- immutable composition assessments and snapshots;
- completeness, freshness, quality, contradiction, blocker, warning, and provenance output;
- deterministic translation into the existing Unified Audit input.

It does not fetch evidence, normalize market data, calculate benchmark features, classify a market regime, score opportunities, recommend actions, enforce risk, persist records, or mutate another domain.

## Source Adapter Boundary

`evidenceFusionInputFromBroadMarketEvidence` is the only V1 source adapter. It accepts an authoritative `BroadMarketEvidenceAssessment`, validates its structural and lifecycle invariants, and maps only declared provider-neutral fields into an immutable `EvidenceFusionInput`.

Provider payloads, symbols, headers, credentials, benchmark observations, and source-specific feature arrays do not cross the fusion boundary. The input retains source assessment and snapshot identity, policy/rule/feature versions, source timestamps, evidence references, issues, warnings, and audit references.

Future sources such as Sector, Volatility, Breadth, News, Macro, Calendar, or Liquidity require a new explicit source type, adapter, policy entry, fixtures, and version review. There is no generic unvalidated object input, reflection, automatic discovery, or semantic matching.

## Policy

`EvidenceFusionPolicy` is explicit and versioned. Each source requirement declares:

- source type;
- required status;
- accepted source schema version;
- required source state;
- maximum evidence age in seconds;
- minimum evidence-reference count.

V1 requires exactly one Broad Market Evidence source and accepts only `COMPLETE`. Thresholds are supplied by policy; there are no hidden defaults.

## Snapshot Contract

`EvidenceFusionSnapshot` preserves:

- schema version, snapshot ID, deterministic fingerprint, evaluation time, and creation time;
- policy ID/version and rule-set version;
- sorted unique evidence references;
- completeness, freshness, and quality;
- explicit contradictions, blockers, and warnings;
- sorted source provenance and trace metadata;
- deterministic and read-only markers.

The snapshot contains no recommendation, market regime, trade direction, signal, score, probability, expected return, position size, plan, or execution instruction.

A downstream eligibility reference must bind to the exact accepted assessment ID, snapshot ID, fingerprint, schema version, policy version, rule-set version, evaluation time, accepted state, and authoritative evidence-reference set. Matching only source type or acceptance state is insufficient.

## Fail-closed Composition

Malformed source records, malformed inputs, unsupported source types, duplicate sources, and invalid policies are rejected before composition.

Valid requests produce these deterministic outcomes:

- missing required source -> `MISSING_REQUIRED`, `UNKNOWN`, `REJECTED`, `BLOCKED`;
- partial or insufficient source -> `INCOMPLETE`, `REJECTED`, `BLOCKED`;
- stale source state or age threshold breach -> `STALE`, `REJECTED`, `BLOCKED`;
- future-dated source -> `UNKNOWN`, `REJECTED`, `BLOCKED`;
- contradictory source -> `CONTRADICTORY`, preserved contradiction details, `BLOCKED`;
- missing required evidence references -> `INCOMPLETE`, `REJECTED`, `BLOCKED`;
- complete, current, policy-compatible source -> `COMPLETE`, `CURRENT`, `ACCEPTED`, `READY`.

Warnings remain visible but do not override a valid complete source. Blockers and contradictions can never be averaged, scored, or hidden.

## Immutability and Determinism

Inputs created by the source adapter and all engine outputs are deeply frozen. Construction copies declared fields only. Evidence references, source issues, warnings, contradictions, blockers, and provenance have stable deterministic ordering. Repeating an identical request produces an identical assessment and FNV-1a snapshot fingerprint.

FNV-1a is used only for deterministic local change detection. It is not a cryptographic integrity primitive.

## Audit

`auditRecordFromEvidenceFusionAssessment` translates a completed assessment into the existing Unified Audit contract with status, reasons, source counts, quality dimensions, policy versions, snapshot fingerprint, and source audit references.

Evidence Fusion does not create an audit repository or persist audit records.

## Downstream Boundary

Future Decision and Risk integrations may consume only a reviewed `EvidenceFusionSnapshot`, never raw benchmark observations or producer-native payloads. `READY` means the fusion evidence gate passed; it does not guarantee a trade, recommendation, risk approval, or execution authorization.

Market Regime is not changed or wired by Day13-T1. The repository currently keeps Broad Market Evidence-to-Regime integration deferred; this specification does not claim otherwise.

## Non-goals and Deferred Work

Deferred:

- additional evidence sources and their adapters;
- Decision, Risk, Market Regime, Dashboard, Portfolio, or startup wiring;
- live market data, providers, SDKs, HTTP, polling, streaming, routing, or fallback;
- persistence, replay, backtesting, caching, alerts, and scheduling;
- AI, scoring, probability, optimization, signals, trading, brokerage, and execution.
