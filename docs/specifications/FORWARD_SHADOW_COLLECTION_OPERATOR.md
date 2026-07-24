# Forward Shadow Collection Operator v1

Status: Day15-T3B4 implemented locally and pending owner review.

Schema: reuses Forward Shadow Collection Control `1.0`

## Purpose

This boundary gives a local human operator two explicit commands for the existing Day15-T3B3 collection-control engine:

- freeze one prospectively declared collection plan to a new JSON file;
- inspect collection progress from that verified plan and one existing Day15-T2 shadow ledger.

It makes the manual forward-collection workflow reproducible without adding automatic collection, market access, scheduling, or trading authority.

## `freeze-plan`

Input:

- one caller-authored Day15-T3B3 plan-creation request JSON file;
- one explicit output-file path.

Behavior:

- validates and constructs the canonical continuous BTC-USD 15-minute plan;
- rebuilds the canonical plan fingerprint;
- writes the immutable artifact only when the target does not already exist;
- flushes the opened file before closing it;
- refuses unknown, duplicate, or missing command options.

An existing target is never overwritten. A partially written file caused by an operating-system or storage failure is not treated as valid: later `progress` use must reconstruct and verify the complete artifact fingerprint.

The caller-supplied `createdAt` remains local evidence only. It is not a trusted external timestamp, proof of Robinhood listing, or production-grade notarization.

## `progress`

Input:

- one frozen-plan JSON artifact;
- one explicit existing Day15-T2 ledger directory and optional safe store identity;
- one explicit UTC `asOfTime`;
- one explicit audit identity.

Behavior:

- rejects undeclared fields, malformed plan structure, altered plan content, and fingerprint mismatch before reading the ledger;
- requires the ledger file to exist and never creates it;
- reads histories through the existing fail-closed Day15-T2 repository and service;
- invokes the existing Day15-T3B3 read-only progress audit;
- returns deterministic JSON without mutating the plan or ledger.

Missing or corrupt ledgers fail closed. The command does not silently repair, initialize, append, capture, settle, or select any observation.

## Path and persistence boundary

This is an explicitly invoked local development surface. The operator owns the supplied plan and ledger paths. Store identities are restricted to a bounded safe character set, and frozen-plan creation uses exclusive file creation.

The boundary does not claim:

- sandboxing against hostile local filesystem links or compromised host access;
- atomic multi-file transactions, recovery, backup, encryption, signing, retention, or production durability;
- multi-process coordination beyond the exclusive creation of one target plan file.

## Explicit exclusions

Day15-T3B4 adds no:

- Robinhood, BRTI, exchange, provider, API, network, credential, browser, OCR, screenshot, polling, scheduler, daemon, or background job;
- automatic plan timing, observation capture, settlement capture, retry, repair, or research-sample selection;
- T3A audit creation, T3B2 binding, dataset qualification, feature calculation, model, probability, calibration, expected value, or return claim;
- recommendation, ranking, leverage, sizing, Risk/Decision/Portfolio mutation, broker, order, or execution.

## Operator sequence

1. Before the first planned cutoff, author and review a plan request.
2. Run `freeze-plan` once and preserve the resulting file.
3. Continue using the separately reviewed manual Day15-T1/T2 capture and settlement path.
4. Run `progress` against the existing ledger when an audit snapshot is needed.
5. Use explicit T3A/T3B2/T3B workflows only after the required evidence exists.

Development tests use temporary fixtures only and do not freeze a real collection plan. Day15-T3C remains blocked until a real, non-fixture dataset independently qualifies.
