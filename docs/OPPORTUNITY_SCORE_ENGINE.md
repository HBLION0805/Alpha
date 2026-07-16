# Alpha Opportunity Score Engine v1.0

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

The Alpha Opportunity Score Engine evaluates whether a market opportunity deserves further consideration before Alpha selects an execution instrument.

The engine exists to separate opportunity discovery from trade execution. It helps Alpha decide whether a market setup, company thesis, sector move, macro condition, or event-driven situation is worth deeper research and possible action.

The engine does not select the execution instrument. It evaluates the opportunity itself.

Alpha should maximize expected value instead of trading frequency. WAIT is a valid decision, and Cash is always a valid outcome.

## 2. Separation between Opportunity Quality and Execution Quality

Opportunity Quality answers:

- Is this opportunity worth further consideration?
- Is the thesis supported by evidence?
- Is the timing relevant?
- Are the potential outcomes meaningful enough to justify research or monitoring?
- Are unknowns and assumptions acceptable for the current stage?

Execution Quality answers:

- Which instrument should be used?
- Can the position be sized safely?
- Is liquidity acceptable?
- Is the spread acceptable?
- Is leverage appropriate?
- Is the holding period suitable?

The Opportunity Score Engine evaluates Opportunity Quality only.

Execution Quality belongs to the Instrument Ranking Engine. A high-quality opportunity may still result in WAIT or Cash if no suitable execution instrument exists.

## 3. Inputs

The engine may use the following inputs:

- Market environment
- Macro conditions
- Sector behavior
- Company fundamentals
- Price trend
- Relative strength
- Volatility environment
- Market breadth
- Liquidity context
- Catalyst timing
- Event risk
- Valuation context
- Downside scenario
- Rebound scenario
- Trend persistence potential
- Risk Engine output
- Research Confidence
- Prediction Confidence
- Verified facts
- Calculated metrics
- Inferences
- Assumptions
- Unknowns

Inputs must remain provider independent. The engine should depend on normalized research fields and validated data concepts rather than a single data vendor, model provider, broker, or market data source.

## 4. Opportunity Evaluation Factors

The engine evaluates each opportunity using architecture-level factors.

### Evidence Quality

Assess whether the opportunity is supported by verified facts, calculated metrics, and clearly identified sources.

### Thesis Clarity

Assess whether the opportunity has a clear, testable thesis and a defined decision it is meant to support.

### Timing Relevance

Assess whether the opportunity is relevant now or should remain on watch for a future trigger.

### Market Alignment

Assess whether broad market conditions support, conflict with, or weaken the opportunity.

### Sector Alignment

Assess whether sector behavior supports, conflicts with, or weakens the opportunity.

### Relative Strength

Assess whether the opportunity shows strength or weakness relative to the relevant benchmark, sector, or peer group.

### Catalyst Quality

Assess whether a meaningful catalyst exists and whether the catalyst timing is actionable.

### Risk Context

Assess whether the opportunity has unacceptable downside, excessive uncertainty, or risk conditions that should prevent further action.

### Scenario Balance

Assess whether bull, base, and bear cases are sufficiently defined and whether the opportunity has favorable asymmetry before execution details are considered.

### Unknowns and Assumptions

Assess whether unknowns and assumptions are explicit, material, and acceptable for the current research stage.

## 5. Opportunity Categories

The engine may classify opportunities into categories before downstream review.

Supported categories include:

- Market opportunity
- Macro opportunity
- Sector opportunity
- Company opportunity
- ETF opportunity
- Event-driven opportunity
- Rebound opportunity
- Breakdown opportunity
- Momentum continuation opportunity
- Defensive allocation opportunity
- Watchlist opportunity
- No opportunity

Categories should describe the nature of the opportunity, not the instrument used to execute it.

## 6. Opportunity Lifecycle

An opportunity may move through the following lifecycle:

1. Identified
2. Screened
3. Researched
4. Scored
5. Watchlisted
6. Advanced to instrument ranking
7. Approved for decision review
8. Rejected
9. Archived
10. Reopened

The lifecycle should preserve evidence, assumptions, unknowns, and state changes so future review can explain why an opportunity advanced or stopped.

## 7. Opportunity States

Opportunity states describe the current actionability of the opportunity.

Allowed states include:

- New
- Needs Research
- Under Review
- Watch
- Actionable
- Wait
- Rejected
- Archived
- Reopened

WAIT is a valid state when the opportunity has potential but does not yet meet the required evidence, timing, confidence, or risk conditions.

Rejected and Archived states should include a reason.

## 8. Confidence Framework

The Opportunity Score Engine uses confidence to describe evidence and thesis quality before execution is considered.

### Research Confidence

Research Confidence measures evidence quality, source reliability, data freshness, and completeness.

### Prediction Confidence

Prediction Confidence measures confidence in the expected scenario, direction, or outcome.

### Opportunity Confidence

Opportunity Confidence measures whether the opportunity deserves continued attention based on evidence, timing, risk context, and scenario quality.

### Execution Confidence

Execution Confidence is not assigned by this engine. It belongs to the Instrument Ranking Engine after execution instruments are evaluated.

Confidence must be explained with supporting evidence. Unsupported scores should not be presented.

## 9. Relationship with Other Alpha Systems

### Research Framework

The Opportunity Score Engine applies the Research Framework by requiring evidence separation, scenario analysis, confidence tracking, assumptions, unknowns, and a clear research objective.

### Instrument Ranking Engine

The Opportunity Score Engine decides whether an opportunity should advance to execution instrument review. The Instrument Ranking Engine then evaluates which execution instrument, if any, is suitable.

Opportunity scoring must be independent of execution instruments. A strong opportunity can still result in Cash if execution quality is poor.

### Risk Engine

The Risk Engine provides risk context that may weaken, block, or require additional review of an opportunity. Risk Engine output should not be ignored, but it should not be confused with execution instrument ranking.

### Decision Engine

The Decision Engine uses the opportunity state, confidence, risk context, and instrument ranking output to support the final capital decision. The Opportunity Score Engine provides upstream opportunity evaluation, not the final trade decision.

## 10. Decision Outputs

The engine may produce the following outputs:

- Advance to research
- Continue research
- Advance to instrument ranking
- Watch
- Wait
- Reject
- Archive
- Reopen
- Cash

WAIT is valid when the opportunity may become attractive later but is not ready now.

Cash is valid when no action is justified.

The engine should explain the reason for each output, including verified facts, inferences, assumptions, unknowns, and confidence level.

## 11. Future Expansion

The engine should remain extensible for future Alpha capabilities.

Future expansion may include:

- AI Router integration
- Provider-independent data adapters
- Opportunity history tracking
- Watchlist automation
- Research queue prioritization
- Scenario comparison across opportunities
- Portfolio context integration
- Strategy versioning
- Post-decision learning
- Dashboard opportunity views

Future AI Router integration should route tasks based on complexity, required evidence quality, cost, and the type of opportunity being evaluated. The engine should expose clear inputs and outputs so routing can occur without changing the core opportunity evaluation standard.

