# Alpha Core Principles

> Every decision made by Alpha must follow these principles.

---

# 1. Protect Capital First

Capital protection always has higher priority than capital growth.

A missed opportunity is acceptable.

A large loss is not.

---

# 2. Stable Growth Beats Maximum Growth

Alpha seeks repeatable and sustainable profits instead of chasing the highest possible return from a single trade.

Consistency is more valuable than excitement.

---

# 3. Every Trade Requires a Plan

No position may be opened without:

- Entry plan
- Profit-taking plan
- Risk limit
- Exit conditions

If there is no plan, there is no trade.

---

# 4. Freeze the Plan After Entry

Once a trade has been entered, the original plan should not be modified because of:

- Fear
- Greed
- Regret
- FOMO

Only predefined exceptional conditions may justify changes.

---

# 5. Lock In Profits

Realized profit is always more valuable than unrealized profit.

Alpha prefers securing gains over chasing perfect outcomes.

---

# 6. Defined-Risk Options May Build Operating Capital

The current early product may recommend only explicitly allowed, defined-risk
option structures under the versioned Options risk policy.

Options are temporary tools for increasing investable capital. They are not
Alpha's long-term objective, and no return is promised. The earlier Event
Contract product entry is frozen with its code retained.

---

# 7. Long-Term Investing Is the Destination

As capital grows, Alpha gradually shifts toward:

- Quality stocks
- Long-term ownership
- Compound growth

Short-term trading should support this transition.

The Personal ETF Daily Scan and Event Contract product entries are frozen.
Their evidence and infrastructure may be reused, but neither is a current
product entry or an authorization to trade.

---

# 8. Learn After the Trade

Trading decisions are executed according to plan.

Learning and strategy improvements happen only after the trade has finished.

---

# 9. Prediction Accuracy Is Not Profitability

Being correct is not enough.

Alpha evaluates:

- Risk
- Position sizing
- Execution quality
- Profit realization

A profitable system is more important than a highly accurate predictor.

---

# 10. No Evidence, No Decision

A decision request must fail closed unless its required evidence has been explicitly assessed as sufficient under a versioned deterministic policy.

`INSUFFICIENT`, `CONFLICTING`, or `UNAVAILABLE` required evidence blocks downstream decision evaluation. Required conflicts cannot be averaged away, and AI cannot override the evidence gate.

`SUFFICIENT` evidence is necessary but not sufficient for action. The Decision Engine must still evaluate the opportunity, the Risk Engine may reject or constrain it, frozen plan rules remain authoritative, and human approval or later execution controls may still be required. Optional evidence may remain unavailable when the applicable policy does not require it.

---

# 11. No Strategy Change Without Approved Knowledge

A strategy change must fail closed unless it is supported by current, applicable knowledge approved through a versioned policy and an auditable owner decision.

Facts, interpretations, Candidate Knowledge, Approved Knowledge, Strategy Change Proposals, and Strategy Versions remain separate. One outcome may create a candidate, but it does not normally establish permanent knowledge. AI may draft or challenge a candidate; it cannot approve knowledge, override evidence blockers, or mutate a strategy.

Approved Knowledge is necessary but does not itself require or authorize a strategy change. Any change must proceed through a separate proposal, validation, owner approval, and new immutable Strategy Version. Active frozen plans remain unchanged.

---

# 12. Every Decision Must Be Recorded

Alpha maintains complete records of:

- Assumptions
- Decisions
- Outcomes
- Lessons learned

Future improvements should always be based on evidence.

---

# Alpha Motto

Protect Capital.

Build Capital.

Compound Capital.

---

# Permanent Mission Hierarchy

Alpha's permanent mission is:

1. Protect capital through explicit evidence, strict risk limits, and
   fail-closed decisions.
2. Build operating capital through bounded short-term opportunities without
   treating short-term trading as the destination.
3. Move capital only under Owner-approved rules into long-term ownership of
   quality stocks.
4. Compound long-term capital until durable passive income can support
   financial freedom.

Short-term gains never create automatic authority to increase risk or transfer
capital. Risk limits, bucket allocations, and transfers remain deterministic,
versioned, auditable, and Owner-controlled. Alpha must not automatically
allocate, migrate, or transfer funds among `OPERATING_CAPITAL`,
`LONG_TERM_COMPOUNDING_CAPITAL`, and `CASH_RESERVE`.
