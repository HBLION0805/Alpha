# Daily guidance contract rationale v1

Reviewed September 10, 2026. F03/F04 increment under the Owner's current
conversation-only development request; module and frontend ship together.

The existing daily engine owns all dispositions, ordering, costs and blockers.
A deterministic explanation over those exact inputs adds strike moneyness,
reference intrinsic/extrinsic value, gross expiry breakeven and a separate
cost-reserve expiry threshold, plus calendar events through each expiry.
Use integer microdollars. The reserve threshold is a declared payoff comparison,
not verified exercise/settlement fees or a pre-expiry exit forecast. Unknown
costs stay null; impossible nonnegative put breakevens are explicit.

Show all six dimensions: observed direction, required move versus a price
forecast, expiry versus an undeclared trade horizon, missing IV/theta evidence,
missing qualified intraday path evidence, and the original premium/risk/cost
plan. An event after its known release time is not an upcoming catalyst.
Date-only events retain intraday uncertainty; no complete-calendar claim when
coverage is unavailable. Calendar exposure does not establish a suitable expiry.

Current UI and Host brief consume the same explanation. Original capture,
normalization, issued report, paper-plan and settings fingerprints stay unchanged.
An offline explain-report reader verifies an issued report and recomputes the
new explanation from its frozen inputs only, labeled as a later projection.
No new source, automation, order, model forecast, ranking or trading rule.

Acceptance: independent call/put arithmetic, fractional strikes, unknown fees,
unattainable breakevens, stale/future clocks, event boundaries, unchanged original
dispositions and fingerprints, historical input isolation, escaped UI, responsive
browser check and strict typecheck. Product counts and real-price gates stay open.

Formula reference: [OIC long call](https://www.optionseducation.org/strategies/all-strategies/long-call)
and [OIC long put](https://www.optionseducation.org/strategies/all-strategies/long-put).
Expiry breakeven is strike plus premium for calls and strike minus premium for
puts. Pre-expiry value also depends on time and volatility.
