# GLD / IBIT Options Focus, Risk and Drivers v2

## Authority and reviewed design

The Owner's 2026-09-06 follow-up authorizes adding relevant gold/BTC drivers,
history, news and major-event tracking and removing unrelated product code.
Existing development/commit/push authorization persists. Product scope is GLD
and IBIT options on Robinhood. The USD 50,000 year-end aspiration is recorded
as a scenario goal, never an expected return or permission to increase risk.

This work has three independently reviewable boundaries: an offline risk/R
diagnostic, a source-attributed driver monitor, and dependency-reviewed removal
of obsolete product lanes. Root reviews the specification; delegated reviews
check financial assumptions and actual import dependencies before deletion.

## Risk diagnostic v2

The Owner asked whether 10% premium stop is suitable and explicitly changed
profit-taking preference to 1.5R-2R. There is no universally optimal fixed stop.
Record 10% as a comparison scenario and choose **20% premium stop as an initial
research default**, not a validated live rule. Inputs permit 10%-25% stops for
offline comparison. Preserve the former 2% profile as historical documentation.

Define one R as the planned dollar loss including round-trip fees and the
explicit exit slippage reserve. For the diagnostic, a requested premium-price
decline generates gross stop loss floor(premium * stopBps / 10000); then add
fees/slippage to obtain planned cash loss R. No stop is a guarantee. Limit
planned R to floor(current equity * 0.5%) by default, retain the separate USD 25
normal maximum full-premium-plus-fees stress cap and 5% allocation ceiling.
This conservative combination can accept suitable tightly quoted small
contracts; it can reject a USD 50 contract even when allocation alone fits.

Replace the v1 profitTargetBps field with stopLossBps (1000 through 2500) and
rewardMultipleMilliR (1500 through 2000); both required. No caller risk-budget
or legacy stress-cap override. The net cash gain target is ceil(R * multiple);
the gross premium gain target adds fees and exit slippage reserve. Report the
requested mathematical gain and an indicative limit price rounded upward to
the whole contract quote grid. Mark this price indicative, not an executable
order recommendation. Reject any rounded configured gain over 80% of premium.
Quantity is integral and all position-sized tick and money arithmetic uses
safe integer/BigInt operations. Account-wide event/drawdown/open-risk and
permissions remain unverified and executionAllowed is always false.

Unknown fees or slippage mean R and targets are unknown and the scenario is
blocked. Stop feasibility compares total friction with planned cash loss and
requires at least one additional full position tick of remaining capacity.
Unknown costs must not cause them to be counted as zero. Claimed probability
cannot raise effective allocation to 10% or extend holding time. A favorable
result is only ECONOMICALLY_FEASIBLE_SCENARIO.

Validation must include a feasible example: equity 100000 cents, bid 24/ask 25
cents, one 100-share contract, zero explicit costs, 20% stop, 2R gives premium 2500,
planned R 500, net target 1000, indicative exit 35 cents, stress 2500. $50 premium is
over the retained full-loss cap; known costs can push R over the $5 budget.
Test 10% versus 20%, 1.5R versus 2R, all-in cost consistency, tick rounding/target cap,
unknowns/overflow and unchanged no-execution/no-probability authority.

## Driver monitoring

Maintain an explicit, extensible catalog of economically plausible driver
families with source URLs, affected assets, mechanism, proposed refresh cadence
and coverage limitations. It is a coverage framework, not a claim to enumerate
every possible influence or a stable signed causal model. Gold and bitcoin
drivers can conflict and their sensitivities change by regime.

Include macro/rates/real yields/USD/inflation/growth/jobs, central-bank and
fiscal policy, global liquidity/risk sentiment, geopolitics/war/sanctions,
gold physical supply/demand and official reserves, ETF creations/redemptions,
futures positioning, crypto flows/on-chain/miners/stablecoins/security/regulation,
derivative leverage/liquidations, trading-session gaps, and options liquidity,
IV/skew/term structure/Greeks/expiry. Retain QQQ/SPY and rates only as explanatory
context, never as eligible option-trading assets.

Implement a bounded public-source feed command and local append-only observation
journal. Source configuration is code-owned and HTTPS allowlisted; accept no
arbitrary runtime URL, credentials, private network, redirect, paid subscription
or order endpoint. Limit bytes, timeout and item counts. Current public feeds
must be checked before activation. Report failures explicitly without treating
missing data as neutral or using stale output as fresh evidence.

Every observation binds source URL, source identity, headline, published time,
observed time, content fingerprint and origin (PUBLIC_FEED or MANUAL_SCENARIO).
Store first-seen times and preserve history; deduplicate exact same source/item
versions and preserve corrections as separate versions. Do not persist full
copyright articles. Headline keyword matching yields only candidate factor
tags, never confirmed fact verification, direction, probability or a trading
recommendation. Untimestamped/invalid/future/stale items cannot count as fresh.
Use UTC explicitly and count uncovered catalog factors as UNKNOWN. Coverage
and source health must remain separate from economic interpretation.

The monitor emits a GLD/IBIT contextual watch report with factors, source health,
recent candidate events, gaps and a required option-chain confirmation list.
Historical headlines are not a calibrated historical option-outcome dataset.
Ongoing operation requires invoking/scheduling the command; a successful one-shot
refresh is not a claim of a running background service.

An external hourly Codex heartbeat is configured for this task. It invokes the
one-shot command while the computer, app and worktree are available and alerts
only on meaningful changes or source failures/recovery. It cannot adjust risk
or execute orders. Headline history and health are committed together in one
size-bounded, hash-linked refresh batch with a single writer lock. A partial
or damaged batch blocks subsequent use; hashes detect mutation, not publisher
authenticity. Reversions (A to B to A) remain separate observed versions.

## Dependency-reviewed pruning

Remove obsolete Event Contract/Kalshi trading and collection-runner business
lanes, legacy Python product runtime and their unused CLI/integration/test
scaffolding, and frozen single-stock/ETF Daily Scan product selection lanes
only after import-closure review. Retain canonical market-data/provider code,
Options modules, generic historical evidence/journal/audit/risk/AI utilities
needed by the scoped product. Retained broad-market data are explanatory inputs.

Remove obsolete registrations and exports with their code. Update validation
to test every surviving module, plus import/entry-point exclusion regressions;
a smaller test total after legitimate deletion is expected and must be reported,
not misrepresented as a failed or weakened test run. Keep Git history and
historical decision/specification records as audit evidence; remove stale current
product commands and update current architecture/status truth. Before each
filesystem deletion verify absolute targets stay inside this worktree and never
delete user data, .git, dependencies or other checkouts.
