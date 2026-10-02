# Alpha Real-Data Experiment Standard V1

## Authority and purpose

This is the current Alpha development and acceptance standard. It replaces the prior sequencing assumption that the system should be broadly completed before real-data paper experiments begin.

The governing loop is:

**Real data -> Paper decision/entry -> Position monitoring -> Exit -> Trade forensics -> Root-cause classification -> Targeted fix -> Next experiment.**

Real-data paper experiments are part of development, not a post-development reward. This standard does not expand product scope, add live-order authority, or prove strategy edge.

## Hard dates

- **2026-10-08 America/New_York:** Real-Data Experiment Start. Alpha must begin operating in the real market environment. A valid NO_TRADE, an integrity block, or a recorded system failure are legitimate experiment outcomes; lack of system-wide completeness is not a reason to skip the experiment.
- **2026-10-30 America/New_York:** Diagnostic Review. Review engineering reliability, evidence quality, execution-model assumptions, error recurrence, and strategy samples separately.

The October 8 date requires a real environment experiment, not a forced fill.
## Two parallel tracks

### Track A — Engineering Experiment

Question: **Can Alpha complete or honestly terminate the real-data decision lifecycle?**

A setup may be ordinary and must be labeled as engineering/process validation when it is not a predeclared strategy sample. This track tests data retrieval, chronology, contract identity, decision generation, simulated fill logic, position monitoring, exit handling, recovery and forensics.

Engineering results do not establish strategy edge.

### Track B — Strategy Validation

Question: **Do predeclared Alpha decision rules show useful performance across later samples?**

Rules, selection criteria and versions must be frozen before the eligible decision. Winning or losing one trade must not cause silent threshold changes. Strategy changes require a new version and validation on later samples.

Qualified and non-qualified cases must both remain in the record; do not retain only attractive trades.
## Experiment outcome labels

### PAPER_FILLED

A simulated position was entered from preserved real market evidence and a declared fill model. It may proceed toward full position/exit acceptance.

### NO_TRADE_VALID

The system correctly completed the non-trade path: for example no eligible setup, price outside the plan, liquidity failure, or a declared rule prevented entry.

NO_TRADE_VALID **may pass the non-trade engineering path**, but it **does not pass complete position-and-exit acceptance** because no held position lifecycle occurred.

### BLOCKED_DATA_INTEGRITY

The experiment stopped because evidence identity, contract identity, chronology, or another experiment-integrity requirement was unreliable. The stop itself may be correctly recorded, but it is not a full lifecycle pass.

### SYSTEM_FAILURE

A real experiment reached a software/process failure and Alpha preserved the failure record.

SYSTEM_FAILURE is a valid observed experiment result, but **engineering acceptance is FAILED**. Recording a failure correctly does not convert the failed engineering run into a pass.
### INCOMPLETE_EXPERIMENT

The chain cannot be reconstructed from Decision -> Contract -> Entry evidence -> Position -> Exit evidence -> Modeled fill -> Review. Later market movement cannot be used to fill the gap retrospectively.

### LOSS

A completed paper trade has negative modeled net PnL under the frozen fill/cost assumptions.

A single LOSS describes that trade only. It does **not** establish that the strategy lacks edge. Edge remains an aggregate later-sample question.

## Minimum experiment integrity

The system may tolerate optional-data gaps, known source delays and ordinary uncertainty. It must not waive the following merely to obtain a paper fill:

- exact option-contract identity
- preserved source and receipt clocks
- no future-information leakage
- explicit paper order / simulated fill assumptions
- immutable decision and rule versions
- observable exit trigger and exit evidence
- evidence lineage sufficient for post-trade reconstruction

If these are not trustworthy, use an integrity blocker instead of manufacturing a trade.
## Fill and friction rules

A real quote is evidence; it is not automatically a fill.

Paper fills must preserve bid, ask, displayed size when available, spread, quote/source clocks, paper-order time, fill rule, slippage rule, timeout and partial-fill handling.

Do not default multi-leg strategies to perfect simultaneous midpoint fills. Fill rules must be frozen before evaluating the result and may not be improved after seeing PnL.

## Attribution rules

Trade forensics must separate:

1. **Root cause**
2. **Transmission chain**
3. **Final symptom**

Examples of root-cause families include thesis, information latency, timing, structure, strike/expiry, pricing/liquidity, risk, market-data mapping, system/runtime, and execution-model errors.

Spread and slippage may be analyzed from preserved quotes and the declared simulated-fill model.

Theta and implied-volatility PnL contribution are normally **model estimates**, not directly observed cash attribution. Any theta/IV attribution must state valuation/pricing method, input Greeks/IV and timestamps, counterfactual convention, and residual/error or model limitation.

Do not present modeled theta/IV decomposition as exact realized attribution.
## P0 development admission rule

Until the Real-Data Experiment Loop is operating, every P0 task must answer:

> **Which concrete blocker in Decision -> Contract Selection -> Real Quote -> Paper Fill -> Position Watch -> Exit -> Forensic Review does this task remove?**

If no concrete blocker can be named, the task is not P0.

P0 work must not expand news coverage, UI breadth, strategy catalog, replay decoration or commercial features merely because they may be useful later.

A failed experiment may create a new P0 only when the failure provides evidence of an actual blocker or when a non-negotiable integrity requirement is missing.

## Change policy

- Clear software/data bugs may be fixed immediately, with the original failed experiment preserved.
- Strategy thresholds and trading logic must not be tuned from one recent result without a new frozen version.
- Similar cases are not automatically independent samples.
- Engineering pass/fail and strategy win/loss remain separate dimensions.
- No paper experiment grants live-order authority.

Execution authority remains false.
