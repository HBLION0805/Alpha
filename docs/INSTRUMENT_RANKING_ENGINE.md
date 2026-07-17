# Alpha Instrument Ranking Engine v1

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

The Alpha Instrument Ranking Engine exists to select the best execution instrument for a researched opportunity before any trade is considered.

Alpha does not recommend stocks directly. Alpha recommends the execution instrument that best converts a research thesis into a capital decision under controlled risk.

The engine solves the problem of separating opportunity quality from execution quality. A strong underlying stock or sector thesis may still produce a poor trade if the selected instrument has excessive volatility, poor liquidity, wide spreads, unsuitable leverage, or an inappropriate holding period.

The engine prioritizes capital protection, risk-adjusted return, and execution quality over maximum raw return.

## 2. Inputs

The engine evaluates each opportunity using research, market, risk, and execution inputs.

Core inputs include:

- Market trend
- Sector strength
- Stock trend
- Relative strength
- Volatility
- Liquidity
- Spread
- Expected holding period
- Risk Engine output
- Research Confidence
- Prediction Confidence
- Execution Confidence

Additional inputs may include:

- Market breadth
- Macro conditions
- Volatility regime
- Catalyst timing
- Downside scenario
- Rebound scenario
- Position size constraints
- Portfolio concentration
- Existing exposure
- Instrument availability

Inputs must distinguish verified facts, calculated metrics, assumptions, and unknowns.

## 3. Candidate Instruments

The engine compares all supported execution instruments that are relevant to the opportunity.

### Common Stock

Common stock provides direct exposure to the company. It may be suitable when the company thesis is specific, liquidity is acceptable, volatility is manageable, and the expected holding period fits the trade plan.

### Sector ETF

A sector ETF provides diversified exposure to a sector theme. It may be suitable when the sector thesis is stronger than the company-specific thesis or when single-company risk should be reduced.

### Leveraged Long ETF

A leveraged long ETF provides amplified long exposure, usually through daily leverage. It may be suitable only when the directional thesis is strong, the holding period is short, liquidity is acceptable, and the Risk Engine allows the added leverage.

### Inverse ETF

An inverse ETF provides exposure that benefits from a decline in the target index, sector, or asset. It may be suitable when downside direction is the primary thesis and short exposure is preferred without directly shorting a security.

### Leveraged Inverse ETF

A leveraged inverse ETF provides amplified inverse exposure, usually through daily leverage. It requires strict risk controls, short holding periods, strong execution confidence, and clear invalidation rules.

### Fractional Shares

Fractional shares allow position sizing when full-share purchases would exceed the intended risk or allocation. They may be suitable when precise sizing is more important than round-lot execution.

### Cash (No Trade)

Cash is a valid execution choice. It is appropriate when evidence is insufficient, risk-adjusted expected value is weak, execution quality is poor, or the opportunity does not meet Alpha standards.

## 4. Evaluation Criteria

Each candidate instrument must be evaluated using the same criteria.

### Expected Return

Assess the realistic upside the instrument may capture if the thesis plays out. Expected return should reflect the instrument, not only the underlying opportunity.

### Expected Risk

Assess the realistic downside if the thesis fails, including gap risk, adverse movement, volatility, and trade invalidation.

### Volatility

Assess whether the instrument's movement is compatible with the planned position size, stop loss, holding period, and portfolio risk.

### Liquidity

Assess whether the instrument can be entered and exited efficiently at the intended size.

### Execution Risk

Assess the risk that the trade cannot be executed as planned because of price movement, spread, liquidity, market conditions, or operational constraints.

### Holding Period Suitability

Assess whether the instrument is suitable for the expected holding period. Instruments with daily reset behavior require special caution.

### Leverage Risk

Assess whether leverage increases drawdown, stop-out probability, emotional pressure, or portfolio-level exposure beyond acceptable limits.

### Daily Reset Risk (ETF)

For leveraged and inverse ETFs, assess the risk created by daily reset behavior, compounding effects, volatility drag, and holding the instrument longer than intended.

### Risk-Adjusted Expected Value

Assess whether the instrument offers a favorable balance of expected return, expected risk, execution quality, and confidence. The highest possible return is not automatically the best choice.

## 5. Ranking Rules

Alpha ranks instruments by overall suitability for the current opportunity.

Ranking must prioritize:

1. Capital protection
2. Risk-adjusted return
3. Execution quality

Ranking must not prioritize maximum raw return.

Rules:

- Exclude instruments that fail mandatory risk controls.
- Exclude instruments that cannot support the expected holding period.
- Penalize instruments with poor liquidity or wide spreads.
- Penalize leveraged and inverse instruments when confidence or holding-period fit is weak.
- Prefer simpler instruments when expected value is similar.
- Prefer cash when evidence is insufficient or execution quality is unacceptable.
- Prefer smaller exposure when the thesis is valid but confidence is limited.
- Require stricter controls for leveraged long, inverse, and leveraged inverse ETFs.
- Do not rank an instrument highly unless the trade can include entry condition, position size, stop loss, take profit, invalidation condition, confidence, and evidence.

The best instrument is the one with the strongest risk-adjusted expected value after risk controls and execution constraints are applied.

## 6. Output

The engine output should rank every evaluated candidate.

Use this structure:

### Rank 1

- Instrument: `[Instrument name]`
- Reason: `[Why this instrument ranks first]`
- Strengths: `[Primary strengths]`
- Weaknesses: `[Primary weaknesses]`
- Execution Confidence: `[Low / medium / high with rationale]`

### Rank 2

- Instrument: `[Instrument name]`
- Reason: `[Why this instrument ranks second]`
- Strengths: `[Primary strengths]`
- Weaknesses: `[Primary weaknesses]`
- Execution Confidence: `[Low / medium / high with rationale]`

### Rank 3

- Instrument: `[Instrument name]`
- Reason: `[Why this instrument ranks third]`
- Strengths: `[Primary strengths]`
- Weaknesses: `[Primary weaknesses]`
- Execution Confidence: `[Low / medium / high with rationale]`

Continue the ranking until all candidates have been evaluated.

## 7. Decision Rules

The engine may recommend:

- Buy
- Small Position
- Wait
- Cash

Decision rules:

- Buy is appropriate only when the selected instrument has favorable risk-adjusted expected value, acceptable execution quality, and sufficient confidence.
- Small Position is appropriate when the thesis is valid but risk, volatility, uncertainty, or confidence limits exposure.
- Wait is appropriate when the thesis may become actionable but entry conditions, evidence, or execution quality are not yet sufficient.
- Cash is appropriate when no candidate instrument meets Alpha standards.

WAIT and Cash are valid outputs.

The engine does not maximize trading frequency. The engine supports disciplined capital allocation.

## 8. Integration

### Research Framework

The Instrument Ranking Engine implements the instrument comparison standard defined by the Research Framework. It uses research evidence, scenarios, confidence levels, and risk rules to evaluate execution instruments.

### Research Report Template

The engine output maps directly to the Instrument Comparison, Execution Instrument Ranking, Trading Plan, Decision, Confidence, Unknowns, and Assumptions sections of the Research Report Template.

### Risk Engine

The Risk Engine provides risk constraints and risk warnings used to exclude, penalize, or limit instruments. No instrument should receive a high ranking if it violates Risk Engine limits.

### Dashboard

The Dashboard should display the selected instrument, ranking rationale, execution confidence, major risks, and current decision. It should make WAIT and Cash visible as valid outcomes.

### Opportunity Score Engine

The Opportunity Score Engine identifies opportunities that deserve further consideration. The Instrument Ranking Engine remains responsible for selecting the best execution instrument after an opportunity has been evaluated.

### Prediction Log

The Prediction Log provides the frozen thesis, expected scenario, and Prediction Confidence used during instrument evaluation. Instrument selection must not rewrite the original prediction.

### Decision Engine

The Decision Engine consumes the completed instrument ranking together with research, opportunity, prediction, and Risk Engine outputs to produce the final capital decision.
