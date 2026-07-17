# Alpha Architecture

> Alpha System Architecture

---

# Vision

Alpha is a Personal Capital Operating System designed to help protect, allocate, grow, and compound capital over the long term.

Alpha is not a trading bot.

Alpha is not an automatic execution system.

Alpha is a decision-support platform that helps its owner make disciplined financial decisions.

---

# Mission

The mission of Alpha is to transform small amounts of capital into long-term wealth through:

- Capital protection
- Intelligent allocation
- Disciplined execution
- Continuous learning
- Long-term compounding

Short-term trading exists only to support long-term investing.

---

# System Philosophy

Protect Capital
|
v
Allocate Capital
|
v
Grow Capital
|
v
Compound Capital

---

# Core Architecture

Alpha consists of the following major systems.

## Portfolio System

Responsible for:

- Capital allocation
- Portfolio tracking
- Cash management
- Asset distribution

---

## Dashboard

Responsible for:

- Daily overview
- Opportunity monitoring
- Portfolio status
- Risk status

---

## Decision Engine

Responsible for:

- Combining research, opportunity, prediction, instrument, and risk outputs
- Producing the final capital decision
- Producing and preserving the final decision record
- Producing an approved trade plan when action is justified

The Decision Engine does not replace the specialized evaluation systems. It coordinates their outputs and may return WAIT, Cash, or NO TRADE.

---

## Config System

Responsible for:

- Global configuration
- Strategy settings
- Risk parameters
- System options

---

## Risk Engine

Responsible for:

- Position sizing
- Maximum daily loss
- Portfolio exposure
- Capital preservation

---

## Research Framework

Responsible for:

- Research methodology
- Evidence and source standards
- Separation of verified facts, inferences, assumptions, and unknowns
- Scenario and confidence requirements
- Research report structure

---

## Opportunity Score Engine

Responsible for:

- Evaluating opportunity quality
- Determining whether an opportunity deserves further consideration
- Tracking opportunity state and confidence
- Advancing, waiting, rejecting, or archiving opportunities

The Opportunity Score Engine evaluates the opportunity itself. It does not select an execution instrument.

---

## Instrument Ranking Engine

Responsible for:

- Comparing eligible execution instruments
- Evaluating execution quality and holding-period suitability
- Ranking instruments by capital protection, risk-adjusted return, and execution quality
- Returning WAIT or Cash when no instrument is suitable

---

## AI Router

Responsible for:

- Selecting the most appropriate AI model
- Balancing capability, cost, and speed
- Remaining provider-independent
- Supporting future AI models without redesign

---

## Prediction Log

Responsible for:

- Preserving finalized predictions before execution
- Preserving the evidence available when each prediction was created
- Resolving predictions independently from trade profitability
- Supporting later comparison with decisions and trade outcomes

---

## Trade Outcome Log

Responsible for:

- Recording completed trade results
- Comparing planned and actual execution
- Separating prediction quality, execution quality, and profitability
- Preserving risk, adherence, attribution, and lesson records

---

## Learning Loop

Responsible for:

- Reviewing completed predictions and trade outcomes
- Performing root cause analysis and pattern detection
- Validating candidate improvements
- Proposing evidence-based strategy changes

---

## Alpha Journal

Responsible for:

- Daily summaries
- Lessons learned
- Strategy reviews
- Development notes

---

## Strategy Versioning

Responsible for:

- Preserving strategy identity, lineage, and status
- Reviewing proposed strategy changes
- Comparing strategy versions
- Supporting owner-approved activation and rollback without rewriting history

---

## Research Lab

Responsible for:

- New strategy research
- Market studies
- AI experiments
- Statistical analysis

---

# Event Contract Framework

Event contracts are considered a temporary capital-building tool.

Their purpose is:

- Build capital
- Generate stable cash flow
- Improve execution discipline

They are NOT Alpha's final investment objective.

---

# Long-Term Investment Framework

As capital grows, Alpha gradually shifts toward:

- High-quality stocks
- Long-term ownership
- Dividend growth
- Capital appreciation

The percentage allocated to event contracts should decrease as long-term investments increase.

---

# Design Principles

Every module must satisfy:

- Small and independent
- Easy to test
- Easy to replace
- Easy to expand

Large refactoring should be avoided whenever possible.

---

# Decision Intelligence and Learning Flow

Research Framework
|
v
Opportunity Score Engine
|
v
Prediction Log (Forecast Freeze)
|
v
Instrument Ranking Engine
|
v
Risk Engine Review
|
v
Decision Engine
|
v
Execution
|
v
Trade Outcome Log
|
v
Learning Loop
|
v
Strategy Versioning
|
v
Future Decision Improvement

The Prediction Log precedes the final decision and execution so Alpha can preserve the original forecast without hindsight changes.

The Portfolio System and Config System provide control inputs across the flow. The Risk Engine provides constraints during instrument ranking and performs the final risk review before a capital decision. The Dashboard presents state and outputs but does not own decision logic. The Alpha Journal may summarize decisions and lessons but does not replace source records.

Execution is currently an external, owner-controlled action. Future broker integration must not bypass owner approval, the approved trade plan, or Risk Engine limits.

---

# Future Expansion

Future systems may include:

- AI Cost Governor
- Event Replay Database
- Portfolio Analytics
- Backtesting Engine
- Mobile Dashboard
- Multi-Broker Support

---

# Architecture Goal

Alpha should remain maintainable for many years.

Every new feature must strengthen the system instead of increasing unnecessary complexity.
