# Alpha Strategy Versioning Architecture v1.0

Version: 1.0
Revision date: 2026-07-16

## 1. Purpose

Alpha versions strategies so strategy behavior can evolve under control without rewriting history.

Strategy Versioning preserves historical strategies, records why changes were made, and keeps old versions available for comparison, rollback, and learning. It protects Alpha from emotional reactions, hindsight bias, undocumented rule changes, and uncontrolled production strategy replacement.

The purpose of Strategy Versioning is controlled strategy evolution. Learning may identify candidate improvements, but a strategy only changes after review and owner approval.

## 2. Strategy Identity

Every strategy should include:

- Strategy ID
- Version
- Parent version
- Created date
- Status
- Owner
- Scope
- Description

Strategy identity must make it clear which rules were active at a given point in time and which strategy version influenced each prediction, decision, and trade.

## 3. Version Lifecycle

Strategy versions move through a controlled lifecycle:

Draft
|
v
Under Review
|
v
Approved
|
v
Active
|
v
Deprecated
|
v
Archived

Allowed statuses:

- Draft: The strategy version is being created and is not ready for review.
- Under Review: The strategy version is being evaluated against evidence, risk, architecture, and owner goals.
- Approved: The strategy version has passed review and is approved for activation or controlled use.
- Active: The strategy version is currently used for live decision support.
- Deprecated: The strategy version is no longer preferred but remains available for comparison or rollback.
- Archived: The strategy version is retained for historical record and is not active.

Allowed transitions:

- Draft may move to Under Review or Archived.
- Under Review may move to Draft, Approved, or Archived.
- Approved may move to Active, Under Review, Deprecated, or Archived.
- Active may move to Deprecated only after a replacement, rollback, or owner-approved retirement.
- Deprecated may move to Active through rollback approval or move to Archived.
- Archived may remain archived or be reopened into Under Review with owner approval.

No transition should overwrite prior status history.

## 4. Strategy Components

A strategy defines the decision rules and constraints that guide Alpha's research, opportunity review, trade planning, and learning.

Strategy components may include:

- Research assumptions
- Opportunity rules
- Instrument selection rules
- Risk rules
- Entry rules
- Exit rules
- Position sizing
- Holding period
- Confidence requirements
- Portfolio limits

Strategy components should remain explicit, reviewable, and linked to the evidence or principle that supports them.

## 5. Version Comparison

Alpha compares strategy versions to understand whether changes improved decision quality, risk control, and long-term capital outcomes.

Version comparison may evaluate:

- Prediction quality
- Trade profitability
- Risk-adjusted return
- Drawdown
- Plan adherence
- Win rate
- Opportunity quality
- Execution quality

Comparisons should separate prediction quality from execution quality and separate execution quality from profitability.

Do not invent formulas. Strategy comparison should describe the evidence reviewed, the records compared, and the interpretation limits.

## 6. Change Proposal

Every strategy update proposal should include:

- Problem
- Evidence
- Expected benefit
- Risk
- Cost
- Supporting records
- Learning source

Supporting records may include linked research reports, prediction records, trade outcome records, learning records, journal entries, dashboard observations, or future backtest results.

Change proposals should explain why the change is needed now, what it is expected to improve, and what unintended consequences may occur.

## 7. Approval Rules

Learning Loop proposes.

Strategy Versioning reviews.

Owner approves.

No automatic production strategy replacement is allowed.

Approval must confirm:

- The problem is clearly defined.
- The evidence is sufficient for the proposed change.
- Alternative explanations were considered.
- Risk impact was reviewed.
- Architecture compatibility was reviewed.
- The owner approved activation or further testing.

Rejected proposals should remain recorded with the reason for rejection.

## 8. Rollback

Old versions remain available.

Rollback should preserve history.

A rollback should create a clear record of:

- Version rolled back from
- Version rolled back to
- Rollback reason
- Evidence supporting rollback
- Owner approval
- Effective date
- Follow-up review needed

Rollback must not delete, rewrite, or obscure the version that was replaced.

## 9. Integration

### Learning Loop

The Learning Loop identifies candidate improvements and sends validated proposals to Strategy Versioning for review.

### Prediction Log

Prediction records should reference the active strategy version so Alpha can compare prediction quality across versions.

### Trade Outcome Log

Trade outcome records should reference the active strategy version so Alpha can compare trade profitability, execution quality, risk control, and plan adherence across versions.

### Opportunity Score Engine

Opportunity rules may be versioned so Alpha can compare how different strategy versions identify, reject, or advance opportunities.

### Instrument Ranking Engine

Instrument selection rules may be versioned so Alpha can compare instrument suitability and execution quality across strategy versions.

### Risk Engine

Risk rules and portfolio limits may be versioned, reviewed, and rolled back when evidence supports change.

### Decision Engine

The Decision Engine uses the active, owner-approved strategy version. Strategy changes affect future decisions only and must not rewrite historical decision records.

### Dashboard

The Dashboard may display the active strategy version, version status, pending proposals, performance comparisons, and rollback status.

### Research Framework

Research assumptions and strategy-specific research requirements should link to the strategy version that produced them.

### AI Router

The AI Router may assist with strategy drafting, review, comparison, and documentation while preserving provider independence and owner approval.

## 10. Required Strategy Record Template

Use this reusable Markdown outline for strategy records:

- Strategy ID: `[Strategy ID]`
- Version: `[Version]`
- Parent Version: `[Parent version or none]`
- Created Date: `[YYYY-MM-DD]`
- Status: `[Draft / Under Review / Approved / Active / Deprecated / Archived]`
- Owner: `[Owner]`
- Scope: `[Strategy scope]`
- Description: `[Strategy description]`
- Research Assumptions: `[Assumptions]`
- Opportunity Rules: `[Opportunity rules]`
- Instrument Selection Rules: `[Instrument selection rules]`
- Risk Rules: `[Risk rules]`
- Entry Rules: `[Entry rules]`
- Exit Rules: `[Exit rules]`
- Position Sizing: `[Position sizing rules]`
- Holding Period: `[Holding period rules]`
- Confidence Requirements: `[Confidence requirements]`
- Portfolio Limits: `[Portfolio limits]`
- Change Proposal: `[Problem, evidence, expected benefit, risk, cost, supporting records, and learning source]`
- Approval Record: `[Review status, owner approval, approval date, and notes]`
- Version Comparison: `[Compared versions, evidence reviewed, and interpretation]`
- Rollback Plan: `[Rollback target, conditions, and approval requirement]`
- Linked Records: `[Prediction, trade outcome, learning, research, decision, or journal records]`
- Recommended Next Step: `[Recommended next action]`

## 11. Future Expansion

Future additions may include:

- A/B strategy comparison
- Backtesting
- Strategy performance dashboard
- Automatic experiment tracking
- Portfolio-specific strategies
- AI-assisted strategy drafting
- Strategy lineage visualization
- Version-specific risk dashboards
- Strategy approval workflows
- Provider-independent strategy review tools

Future expansion should preserve provider independence, historical integrity, owner approval, and clear separation between learning, review, approval, and activation.
