# Alpha Trade Outcome Log v1

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

The Alpha Trade Outcome Log is the permanent record of actual trade execution and results. It exists so Alpha can evaluate the complete trade process, preserve evidence, and improve future strategy decisions without confusing profitability with prediction quality.

Trade outcome is not the same as prediction quality.

A profitable trade may result from good prediction, good execution, risk control, or luck.

A losing trade may result from bad prediction, bad execution, poor risk control, or an unavoidable market event.

Alpha must evaluate the trade process, not only profit or loss.

## 2. Trade Identity

Every trade outcome record must include:

- Trade ID
- Prediction ID
- Research ID
- Opportunity ID
- Decision ID
- Strategy version
- Trade owner
- Created timestamp
- Entry timestamp
- Exit timestamp
- Market session
- Instrument
- Underlying subject
- Direction
- Status
- Broker or execution venue reference
- Related research report
- Related trading plan

## 3. Planned Trade Snapshot

Each trade outcome record must preserve the frozen trading plan created before execution:

- Thesis
- Direction
- Selected instrument
- Entry condition
- Entry range
- Planned position size
- Scaling plan
- Stop loss
- Take profit
- Partial profit-taking rules
- Maximum holding period
- Invalidation condition
- Exit rules
- Expected reward
- Expected risk
- Reward-to-risk ratio
- Research Confidence
- Prediction Confidence
- Execution Confidence

The planned trade snapshot must not be rewritten after execution begins.

Corrections or exceptions must be recorded separately in the audit trail.

## 4. Actual Execution

Each trade outcome record must preserve actual execution details:

- Actual entry price
- Actual entry timestamp
- Actual position size
- Number of entries
- Scaling actions
- Average entry price
- Actual exit price
- Actual exit timestamp
- Number of exits
- Average exit price
- Fees
- Spread
- Slippage
- Financing or borrowing cost when applicable
- Execution notes
- Exceptional events

Execution records should distinguish planned actions, rule-based exceptions, and unplanned deviations.

## 5. Trade Result

Each trade outcome record must preserve:

- Gross profit or loss
- Net profit or loss
- Return percentage
- Maximum favorable excursion
- Maximum adverse excursion
- Holding period
- Stop loss triggered
- Take profit triggered
- Partial profit rules followed
- Maximum holding period reached
- Invalidation condition triggered
- Exit reason
- Final trade status

Do not reduce the record to profit or loss only.

Profitability must be reviewed together with execution quality, plan adherence, risk control, and prediction quality.

## 6. Allowed Trade Statuses

- Planned: The trade plan exists, but execution has not begun.
- Open: The trade has at least one active position.
- Partially Closed: Part of the position has been exited while some exposure remains.
- Closed: The trade has fully exited under normal conditions.
- Stopped Out: The stop loss was triggered.
- Invalidated: The invalidation condition occurred.
- Cancelled: The planned trade was cancelled before execution or before meaningful completion.
- Expired: The trade opportunity or holding period expired.
- Error: The record contains an operational or execution issue that requires review.
- Archived: The record is retained for history and no longer active.

Status changes must be preserved in the audit trail.

## 7. Plan Adherence Review

Each trade review must evaluate:

- Was the planned entry followed?
- Was position sizing followed?
- Was the stop loss followed?
- Was the take-profit plan followed?
- Were partial exits followed?
- Was the maximum holding period respected?
- Was the invalidation condition respected?
- Was risk increased after entry?
- Was the plan changed because of emotion?
- Were predefined exceptional-event rules used correctly?

The review must separate deliberate rule-based changes from unauthorized plan changes.

Unauthorized changes should be recorded clearly and linked to lessons learned.

## 8. Prediction Versus Trade Outcome

Each trade outcome should be compared with the linked Prediction Log.

The comparison must record:

- Was the prediction direction correct?
- Was the prediction timing correct?
- Was the predicted magnitude reasonable?
- Was the selected instrument appropriate?
- Did execution improve or damage the outcome?
- Did risk control improve or damage the outcome?
- Did luck materially influence the result?

Alpha must study four possible combinations:

1. Prediction correct and trade profitable
2. Prediction correct and trade unprofitable
3. Prediction incorrect and trade profitable
4. Prediction incorrect and trade unprofitable

These combinations must be analyzed separately because prediction skill, execution skill, risk control, instrument selection, and luck can produce different outcomes.

## 9. Instrument Suitability Review

Each trade outcome should evaluate:

- Was the instrument appropriate for the thesis?
- Was leverage appropriate?
- Was daily reset risk acceptable?
- Was the holding period suitable?
- Was liquidity sufficient?
- Was the spread acceptable?
- Was slippage acceptable?
- Would a simpler instrument have produced a better risk-adjusted result?
- Would Cash or WAIT have been superior?

This section supports future Instrument Ranking Engine learning.

## 10. Risk Review

Each trade outcome should evaluate:

- Planned risk
- Actual risk
- Portfolio concentration
- Existing exposure
- Volatility impact
- Gap risk
- Liquidity risk
- Execution risk
- Strategy risk
- Maximum adverse excursion
- Whether the trade violated Risk Engine limits
- Whether risk controls prevented a larger loss

The review should identify whether risk was controlled by design, by discretionary action, or by luck.

## 11. Outcome Attribution

Each trade outcome must classify the primary drivers of the result:

- Prediction skill
- Research quality
- Instrument selection
- Entry quality
- Exit quality
- Position sizing
- Risk control
- Market regime
- External event
- Execution error
- Behavioral error
- Luck

Multiple drivers may be recorded, but each review must identify a primary attribution and supporting evidence.

## 12. Lessons Learned

Each trade outcome should record:

- What worked
- What failed
- What was known before entry
- What became known only later
- What should remain unchanged
- What should be tested in a future strategy version
- What should not be changed because the sample size is insufficient
- Whether the result justifies a strategy update

One trade must not automatically trigger a strategy change.

Strategy changes should be based on sufficient evidence, repeated patterns, or a clear risk-control need.

## 13. Audit Trail

Every trade outcome record must preserve:

- Original trading plan
- Entry events
- Scaling events
- Exit events
- Status changes
- Amendments
- Exceptional-event actions
- Resolution
- Review
- Linked prediction
- Linked research
- Linked decision
- Linked strategy version

No history should be overwritten or silently deleted.

## 14. Integration

### Research Framework

The Trade Outcome Log preserves the post-trade review required by the Research Framework and links outcome evidence back to the original research thesis.

### Research Report Template

The Trade Outcome Log can populate the Post-Trade Review Placeholder and link trade results to the original research report.

### Opportunity Score Engine

The Trade Outcome Log provides feedback on whether opportunities that advanced through scoring produced useful, actionable, and profitable outcomes.

### Instrument Ranking Engine

The Trade Outcome Log provides evidence for future instrument suitability review, including whether the selected instrument converted the thesis into controlled profit or avoidable loss.

### Risk Engine

The Trade Outcome Log records planned risk, actual risk, violations, adverse excursion, and whether risk controls protected capital.

### Decision Engine

The Decision Engine may use trade outcome history to improve future decision review while keeping historical records immutable.

### Prediction Log

The Trade Outcome Log links trade results to prediction records so Alpha can evaluate prediction quality separately from trading profitability.

### Alpha Journal

The Alpha Journal may summarize trade lessons and recurring patterns, but it should not replace the Trade Outcome Log as the source record.

### Strategy Versioning

Each trade outcome should reference the active strategy version so performance can be compared across strategy versions.

### Research Lab

The Research Lab may use trade outcome history for studies, experiments, and retrospective analysis.

### Learning Loop

The Learning Loop uses trade outcomes after trades close to improve research, instrument selection, risk controls, and strategy design.

### Dashboard

The Dashboard may display trade status, plan adherence, risk review, outcome attribution, and lessons learned.

### AI Router

The AI Router may route trade review, attribution, and learning tasks based on complexity, evidence requirements, cost, and model capability while preserving provider independence.

## 15. Required Trade Outcome Record Template

Use this reusable Markdown outline for trade outcome records:

- Trade ID: `[Trade ID]`
- Prediction ID: `[Prediction ID]`
- Research ID: `[Research ID]`
- Opportunity ID: `[Opportunity ID]`
- Decision ID: `[Decision ID]`
- Strategy Version: `[Strategy version]`
- Created Timestamp: `[YYYY-MM-DD HH:MM timezone]`
- Entry Timestamp: `[YYYY-MM-DD HH:MM timezone]`
- Exit Timestamp: `[YYYY-MM-DD HH:MM timezone]`
- Instrument: `[Instrument]`
- Underlying Subject: `[Underlying subject]`
- Direction: `[Long / short / neutral / no trade]`
- Planned Trade Snapshot: `[Frozen planned thesis, entry, sizing, stop, take profit, exit, confidence, expected reward, expected risk, and reward-to-risk ratio]`
- Actual Execution: `[Entries, exits, sizing, fees, spread, slippage, financing or borrowing cost, notes, and exceptional events]`
- Trade Result: `[Gross result, net result, return percentage, MFE, MAE, holding period, triggers, exit reason, and final status]`
- Plan Adherence Review: `[Entry, sizing, stop, take profit, partial exits, holding period, invalidation, risk changes, emotional changes, and exceptional-event review]`
- Prediction Versus Trade Outcome: `[Prediction direction, timing, magnitude, instrument, execution, risk control, luck, and outcome combination]`
- Instrument Suitability Review: `[Instrument fit, leverage, daily reset risk, holding period, liquidity, spread, slippage, simpler instrument comparison, Cash or WAIT comparison]`
- Risk Review: `[Planned risk, actual risk, exposure, volatility, gap, liquidity, execution, strategy risk, MAE, violations, and risk-control effect]`
- Outcome Attribution: `[Primary attribution, secondary drivers, and supporting evidence]`
- Lessons Learned: `[What worked, what failed, what was known, what became known later, what to preserve, what to test, what not to change, and strategy update judgment]`
- Status: `[Planned / Open / Partially Closed / Closed / Stopped Out / Invalidated / Cancelled / Expired / Error / Archived]`
- Audit Trail: `[Original plan, events, status changes, amendments, exceptions, resolution, review, and linked records]`
- Recommended Next Step: `[Recommended next action]`

## 16. Future Expansion

Future additions may include:

- Automated broker import
- Automated fee and slippage capture
- Trade replay
- Event replay
- Position timeline
- Portfolio impact analysis
- Strategy-version comparison
- Instrument performance history
- Behavioral pattern detection
- Probability calibration
- Backtesting integration
- Dashboard analytics
- Model and provider attribution
- AI cost tracking

Future expansion should preserve provider independence, auditability, and separation between prediction quality and trade outcome.
