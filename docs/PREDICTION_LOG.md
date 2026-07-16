# Alpha Prediction Log v1

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

The Alpha Prediction Log is the permanent record of meaningful market predictions made by Alpha. It exists so Alpha can measure prediction quality separately from trading profitability and improve future decisions based on evidence.

Prediction accuracy is not the same as trading profitability.

A correct prediction can produce a losing trade because of poor execution.

An incorrect prediction can occasionally produce a profitable trade because of luck or execution effects.

Alpha must evaluate prediction and execution separately.

## 2. Prediction Identity

Every prediction record must include:

- Prediction ID
- Research ID
- Opportunity ID
- Strategy version
- Prediction owner
- Created timestamp
- Data timestamp
- Market session
- Status
- Related instruments
- Related research report

## 3. Prediction Scope

Each prediction must record:

- Market, sector, company, ETF, event, or macro subject
- Exact question being predicted
- Time horizon
- Expected direction
- Expected magnitude or range
- Expected duration
- Relevant benchmark
- What is explicitly outside scope

The scope must be narrow enough to resolve later without rewriting the original thesis.

## 4. Evidence Snapshot

Each prediction must preserve the evidence available when the prediction was created:

- Verified facts
- Calculated metrics
- Inferences
- Assumptions
- Unknowns
- Sources
- Source timestamps
- Data periods
- Data freshness
- Relevant charts or evidence references

Later information must not be silently added to the original prediction record.

New evidence may be linked through an amendment or resolution record, but the original evidence snapshot must remain unchanged.

## 5. Scenario Forecast

Each prediction should include:

- Bull case
- Base case
- Bear case

For each case, record:

- Probability or qualitative confidence
- Expected move
- Expected duration
- Supporting evidence
- Failure conditions

Do not invent precision. If probability cannot be supported, use qualitative confidence and explain the evidence limit.

## 6. Confidence Fields

Alpha separates prediction confidence into distinct fields:

- Research Confidence
- Prediction Confidence
- Opportunity Confidence

Research Confidence measures evidence quality, source reliability, data freshness, and completeness.

Prediction Confidence measures confidence in the expected direction, timing, magnitude, or scenario.

Opportunity Confidence measures whether the opportunity deserves continued attention based on evidence, timing, risk context, and scenario quality.

Execution Confidence must not be stored as part of the prediction judgment itself. Execution Confidence may be linked from the Instrument Ranking or Trading Plan record.

## 7. Prediction Freeze Rule

- A prediction must be finalized before execution.
- After execution begins, the original prediction is frozen.
- It may not be rewritten to match later market behavior.
- Corrections must create an explicit amendment with timestamp and reason.
- Strategy learning occurs after the prediction period or trade ends, not during execution.

The freeze rule protects Alpha from hindsight bias and preserves the quality of later review.

## 8. Allowed Prediction Statuses

- Draft: The prediction is being prepared and is not ready for evaluation.
- Active: The prediction is finalized and within its time horizon.
- Confirmed: Evidence currently supports the predicted scenario before final resolution.
- Invalidated: The prediction's invalidation condition has occurred.
- Expired: The time horizon ended before the prediction could be resolved cleanly.
- Resolved: The prediction has been evaluated against actual results.
- Cancelled: The prediction was withdrawn before activation or before meaningful evaluation.
- Amended: The prediction has an explicit correction or update with timestamp and reason.
- Archived: The record is retained for history and no longer active.

Status changes must be recorded in the audit trail.

## 9. Resolution Rules

After the prediction time horizon ends, Alpha must resolve the prediction using evidence from the defined period.

Resolution must record:

- Actual direction
- Actual magnitude
- Actual duration
- Benchmark result
- Whether the predicted scenario occurred
- Whether the prediction was directionally correct
- Whether timing was correct
- Whether magnitude was correct
- Whether invalidation occurred
- Resolution timestamp
- Resolution evidence

Do not reduce the result to only correct or incorrect when the prediction contains direction, timing, and magnitude components.

Partial correctness should be recorded explicitly.

## 10. Prediction Quality Review

After resolution, Alpha should evaluate:

- Evidence quality
- Thesis clarity
- Direction accuracy
- Timing accuracy
- Magnitude accuracy
- Scenario calibration
- Assumption quality
- Unknown management
- Whether the prediction was falsifiable
- Whether confidence was justified

The review should identify what was knowable at prediction time and what only became clear later.

## 11. Prediction Versus Trade Outcome

Each resolved prediction should be compared with any linked trade outcome.

The comparison must include:

- Prediction result
- Instrument selected
- Entry and exit
- Trade profit or loss
- Whether the trading plan was followed
- Whether execution improved or damaged the result
- Whether profit came from prediction skill, execution skill, or luck

Alpha must study four possible combinations:

1. Prediction correct and trade profitable
2. Prediction correct and trade unprofitable
3. Prediction incorrect and trade profitable
4. Prediction incorrect and trade unprofitable

All four combinations must be studied separately because prediction skill, execution skill, risk control, and luck can produce different outcomes.

## 12. Audit Trail

Every prediction record must preserve:

- Original prediction
- Amendments
- Status changes
- Resolution
- Review
- Linked research
- Linked decision
- Linked trade outcome
- Linked strategy version

No prediction history should be overwritten or silently deleted.

## 13. Integration

### Research Framework

The Prediction Log preserves the forecasts, confidence fields, evidence snapshots, assumptions, and unknowns produced through the Research Framework.

### Research Report Template

The Prediction Log links to completed research reports and can reuse their objective, scenario, confidence, evidence, unknowns, and assumption sections.

### Opportunity Score Engine

The Prediction Log records predictions associated with opportunities that advance beyond initial screening or require later quality review.

### Instrument Ranking Engine

The Prediction Log remains separate from instrument selection. Execution Confidence and selected instruments may be linked from Instrument Ranking records but should not alter the original prediction.

### Risk Engine

The Risk Engine provides risk context and invalidation evidence that may be linked to prediction records and resolution reviews.

### Decision Engine

The Decision Engine may use finalized predictions as inputs while preserving separate records for prediction, decision, and trade outcome.

### Future Trade Outcome Log

The Prediction Log should link to the future Trade Outcome Log so Alpha can compare prediction quality with actual execution and profitability.

### Alpha Journal

The Alpha Journal may summarize prediction lessons, recurring errors, and decision-quality insights without replacing the Prediction Log as the source record.

### Strategy Versioning

Each prediction should reference the strategy version active when the prediction was created so later reviews can compare strategy behavior over time.

### Research Lab

The Research Lab may use Prediction Log history for studies, experiments, and retrospective analysis.

### Future Learning Loop

The Learning Loop should use resolved predictions and trade outcomes to improve strategy design after the prediction period or trade ends.

### AI Router

The AI Router may route prediction creation, review, or resolution tasks based on complexity, evidence requirements, cost, and model capability while preserving provider independence.

## 14. Required Prediction Record Template

Use this reusable Markdown outline for prediction records:

- Prediction ID: `[Prediction ID]`
- Research ID: `[Research ID]`
- Opportunity ID: `[Opportunity ID]`
- Strategy Version: `[Strategy version]`
- Created Timestamp: `[YYYY-MM-DD HH:MM timezone]`
- Data Timestamp: `[YYYY-MM-DD HH:MM timezone]`
- Subject: `[Market / sector / company / ETF / event / macro subject]`
- Question: `[Exact question being predicted]`
- Time Horizon: `[Prediction time horizon]`
- Direction: `[Expected direction]`
- Expected Move: `[Expected magnitude or range]`
- Expected Duration: `[Expected duration]`
- Benchmark: `[Relevant benchmark]`
- Evidence Snapshot: `[Verified facts, calculated metrics, inferences, assumptions, unknowns, sources, timestamps, and data periods]`
- Bull Case: `[Bull case, confidence, expected move, duration, evidence, and failure conditions]`
- Base Case: `[Base case, confidence, expected move, duration, evidence, and failure conditions]`
- Bear Case: `[Bear case, confidence, expected move, duration, evidence, and failure conditions]`
- Research Confidence: `[Low / medium / high with rationale]`
- Prediction Confidence: `[Low / medium / high with rationale]`
- Opportunity Confidence: `[Low / medium / high with rationale]`
- Assumptions: `[Assumptions]`
- Unknowns: `[Unknowns]`
- Invalidation Conditions: `[Invalidation conditions]`
- Status: `[Draft / Active / Confirmed / Invalidated / Expired / Resolved / Cancelled / Amended / Archived]`
- Amendment History: `[Timestamped amendments with reasons]`
- Resolution: `[Actual direction, magnitude, duration, benchmark result, correctness review, timestamp, and evidence]`
- Prediction Quality Review: `[Evidence quality, thesis clarity, accuracy, calibration, assumptions, unknowns, falsifiability, and confidence review]`
- Linked Trade Outcome: `[Trade outcome link or none]`
- Lessons Learned: `[Lessons learned after resolution]`

## 15. Future Expansion

Future additions may include:

- Automated resolution
- Probability calibration
- Historical prediction comparison
- Prediction dashboards
- Model and provider attribution
- Cost tracking
- Strategy-version comparison
- Event replay
- Market timeline database
- Backtesting integration

Future expansion should preserve provider independence, auditability, and separation between prediction quality and trading profitability.

