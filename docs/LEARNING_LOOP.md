# Alpha Learning Loop v1

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

The Alpha Learning Loop is the system responsible for improving Alpha over time. It transforms completed predictions, completed trades, completed research, and completed reviews into better future decisions.

Alpha needs a Learning Loop because prediction accuracy alone is insufficient. A prediction can be correct while the trade loses money because of poor execution, poor instrument selection, weak risk control, or bad timing.

Profitable trades alone are also insufficient. A trade can be profitable because of luck, favorable market conditions, or execution effects rather than durable decision quality.

Learning must occur after resolution because active decisions should follow the frozen plan. Changing the lesson while the trade is still unfolding creates hindsight bias, emotional reactions, and inconsistent strategy behavior.

Learning happens after completion, never during execution.

The Learning Loop does not execute trades.

The Learning Loop does not rewrite history.

The Learning Loop only generates evidence-based learning.

## 2. Inputs

The Learning Loop may use the following inputs:

- Research Framework
- Research Reports
- Prediction Log
- Trade Outcome Log
- Risk Engine
- Decision Engine
- Alpha Journal
- Strategy Version
- Dashboard observations
- Market environment
- Execution statistics
- Unknowns
- Assumptions
- Future backtests
- Future event replay

Inputs must preserve the distinction between verified facts, calculated metrics, inferences, assumptions, and unknowns.

## 3. Learning Principles

The Learning Loop must follow these principles:

- Evidence before opinion
- Small sample sizes should not trigger strategy changes
- Separate prediction quality from execution quality
- Separate execution quality from profitability
- Preserve historical records
- Do not rewrite history
- Avoid hindsight bias
- Avoid recency bias
- Avoid emotional learning
- Prefer repeatable improvements
- Capital protection before optimization

Learning should strengthen Alpha's ability to protect, allocate, grow, and compound capital without increasing unnecessary complexity.

## 4. Learning Pipeline

The Learning Loop follows this sequential workflow:

Completed Prediction
|
v
Trade Outcome
|
v
Review
|
v
Root Cause Analysis
|
v
Pattern Detection
|
v
Candidate Improvement
|
v
Validation
|
v
Strategy Proposal
|
v
Strategy Versioning Review
|
v
Approved Strategy Update

Stages:

- Completed Prediction: A prediction has reached its time horizon or has been resolved.
- Trade Outcome: A linked trade, if any, has closed and its execution and result have been recorded.
- Review: Alpha compares prediction quality, trade outcome, plan adherence, risk control, and instrument suitability.
- Root Cause Analysis: Alpha identifies why the outcome occurred and separates contributing causes.
- Pattern Detection: Alpha checks whether the issue or strength is recurring across records.
- Candidate Improvement: Alpha proposes a possible improvement with evidence, cost, risk, and expected value.
- Validation: Alpha tests the proposal against evidence, sample size, alternatives, risk, and architecture fit.
- Strategy Proposal: A validated improvement becomes a formal candidate for strategy change.
- Strategy Version Review: The proposal is reviewed against the active strategy and prior versions.
- Approved Strategy Update: Only approved changes become part of a new or updated strategy version.

## 5. Root Cause Analysis

Alpha must determine why an outcome occurred before proposing improvements.

Possible causes include:

- Prediction
- Research
- Execution
- Instrument selection
- Risk management
- Market regime
- Unexpected event
- Behavior
- Luck

Multiple contributing causes are allowed. Each cause should include supporting evidence and a confidence level when practical.

Root cause analysis should distinguish what was knowable before execution from what became clear only later.

## 6. Pattern Detection

Alpha should identify recurring behaviors and recurring system weaknesses before proposing major changes.

Patterns may include:

- Repeated execution mistakes
- Repeated prediction errors
- Repeated stop-loss problems
- Repeated sizing mistakes
- Repeated instrument-selection mistakes
- Repeated market-regime weaknesses

Isolated events are insufficient.

A single unusual outcome may justify monitoring, a note, or a research question, but it should not automatically change a strategy.

## 7. Improvement Candidates

The Learning Loop may generate candidate improvements such as:

- Research improvement
- Risk improvement
- Trading plan improvement
- Instrument ranking improvement
- Decision improvement
- Dashboard improvement
- Learning improvement
- AI Router improvement

Every proposal must include:

- Problem
- Expected value
- Cost
- Risk
- Evidence
- Recommendation

Improvement candidates should remain small, reviewable, and compatible with Alpha's existing architecture.

## 8. Validation

Before any strategy change, Alpha must validate the candidate improvement.

Validation must include:

- Evidence review
- Sample size review
- Alternative explanations
- Risk review
- Architecture compatibility
- Expected benefit
- Possible unintended consequences
- Validation status

Validation should reject changes based only on emotion, recency, hindsight, or a single unsupported outcome.

## 9. Strategy Update Rules

Strategies are versioned.

Old versions remain available.

One trade never creates a new strategy version.

One profitable month is insufficient evidence.

Learning Loop proposes.

Strategy Versioning reviews.

Owner approves.

Approved changes must preserve the reason for the change, the evidence used, and the strategy version affected.

## 10. Integration

### Research Framework

The Learning Loop uses the Research Framework's evidence separation, scenario review, confidence fields, assumptions, and unknowns to evaluate research quality.

### Research Reports

Research Reports provide the original thesis, data, sources, scenarios, risks, and recommended next steps used for later learning.

### Prediction Log

The Prediction Log provides resolved prediction records so Alpha can evaluate prediction quality separately from trade outcome.

### Trade Outcome Log

The Trade Outcome Log provides execution details, profitability, plan adherence, risk review, attribution, and lessons learned.

### Opportunity Score Engine

The Learning Loop uses opportunity outcomes to assess whether opportunity evaluation is filtering and advancing the right situations.

### Instrument Ranking Engine

The Learning Loop uses instrument suitability outcomes to improve future instrument ranking decisions.

### Decision Engine

The Decision Engine receives approved learning outputs as future decision-support improvements, not as live trade changes.

### Risk Engine

The Learning Loop evaluates whether risk controls protected capital, failed, or need review.

### Dashboard

The Dashboard may display learning metrics, recurring patterns, open learning items, and approved strategy changes.

### Alpha Journal

The Alpha Journal summarizes lessons and observations, while the Learning Loop preserves structured learning records.

### Strategy Versioning

Strategy Versioning records approved changes and preserves old versions for comparison.

### Research Lab

The Research Lab can test learning hypotheses through future studies, backtests, and event replay.

### Future Backtesting

Future backtesting may validate candidate improvements before strategy adoption.

### AI Router

The AI Router may route learning analysis, validation, and review tasks based on complexity, evidence requirements, cost, and provider capability while preserving provider independence.

## 11. Learning Record Template

Use this reusable Markdown outline for learning records:

- Learning ID: `[Learning ID]`
- Source: `[Prediction Log / Trade Outcome Log / Research Report / Alpha Journal / Dashboard / other source]`
- Date: `[YYYY-MM-DD]`
- Evidence: `[Verified facts, calculated metrics, linked records, and data periods]`
- Observed Pattern: `[Observed pattern or isolated event]`
- Root Cause: `[Primary cause and contributing causes]`
- Supporting Records: `[Linked prediction, trade, research, decision, journal, or strategy records]`
- Confidence: `[Low / medium / high with rationale]`
- Candidate Improvement: `[Proposed improvement]`
- Validation Status: `[Not started / in review / validated / rejected / approved]`
- Decision: `[Monitor / research further / propose strategy update / reject / archive]`
- Related Strategy Version: `[Strategy version]`
- Recommended Next Step: `[Recommended next action]`

## 12. Future Expansion

Future additions may include:

- Automatic pattern mining
- Trade clustering
- Market regime learning
- Cross-strategy comparison
- Provider comparison
- AI model comparison
- Cost optimization learning
- Portfolio learning
- Long-term capital learning
- Behavioral learning
- Backtesting integration
- Event replay integration
- Dashboard learning metrics

Future expansion should preserve provider independence, auditability, historical integrity, and separation between learning, review, approval, and execution.
