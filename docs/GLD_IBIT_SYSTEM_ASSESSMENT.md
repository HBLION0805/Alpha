# GLD / IBIT system assessment and delivery

Date: 2026-09-06. This assessment uses repository inspection, deterministic
calculations and official product documentation. It does not claim personal
trading experience, a verified trading edge, or a guaranteed return.

## Assessment of the six-dimensional framework

As a conceptual checklist, **8.5/10** is a subjective assessment. It correctly
distinguishes a directional opinion from a specific option structure and adds
magnitude, timing, volatility, path and risk. It is not yet an executable policy.

| Dimension | What is right | What the system must additionally establish |
| --- | --- | --- |
| Direction | Bullish does not uniquely mean buying a call. | Compare eligible structures with the same thesis; never default to naked premium selling for a high win rate. |
| Magnitude | Small and large moves warrant different payoff shapes. | Compare the expected move with the move already priced into the premium and the net break-even. |
| Time | A correct eventual view can miss the option's usable life. | Separate thesis horizon, expiration, time exit and event date. Stocks also have permanent-loss and opportunity-cost risk. |
| Volatility | Uncertain direction can coexist with a volatility opinion. | Compare expected realized movement with implied volatility, skew and term structure; two purchased legs mean two premiums. |
| Path | The same endpoint can have very different interim outcomes. | Replay target/stop order, drawdowns, IV changes, overnight gaps and executable exit prices. |
| Risk | Survival precedes return. | Enforce total premium/structure risk, fees, liquidity, account eligibility, aggregate positions and a no-trade outcome. |

The main missing dimension is **price paid**. Underlying price, strike, time,
volatility and other pricing inputs jointly affect option value; direction
alone does not determine profit. [OIC pricing explanation](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior/).
Buying volatility also needs a sufficiently large move to offset its cost and
time decay. [OIC long straddle](https://www.optionseducation.org/strategies/all-strategies/long-straddle).

## Exact requested economics

These are hypothetical arithmetic examples, not current GLD/IBIT quotes. Costs
are excluded from this table and must be included in an actual assessment.

| Parameter | Normal requested scenario | Conditional requested scenario |
| --- | ---: | ---: |
| Equity | $1,000 | $1,000 |
| Allocation ceiling | 5% = $50 | 10% = $100, currently blocked |
| Planned stop, 2% of premium if fully allocated | $1 | $2 |
| Default 50% gross profit target | $25 | $50 |
| Conditional maximum configured 80% target | Not applicable | $80 |
| Long-option premium at risk before exercise | Up to $50 plus fees | Up to $100 plus fees |

Standard options commonly represent 100 shares; premiums are quoted per share.
One $0.50 option therefore costs $50 before fees, and whole contracts constrain
position sizing. Adjusted contracts need separate metadata validation.
[Robinhood options basics](https://robinhood.com/us/en/support/articles/options-knowledge-center/).

For an illustrative bid of $0.47 and ask of $0.50, buying one contract at the ask
and immediately selling at the bid loses **$3 before fees**. That already exceeds
the requested $1 stop. If a contract's tick is $0.01, one standard-contract tick
is $1. A stop is a trigger, not a guaranteed fill or hard loss cap. Robinhood
currently supports both stop-market and stop-limit options orders; market-stop
fills can be worse, while stop-limit orders can remain unfilled.
[Stop market](https://robinhood.com/us/en/support/articles/stop-market-order-options/),
[stop limit](https://robinhood.com/us/en/support/articles/stop-limit-order-options/).

The repository already recorded a $25 normal maximum actual-loss cap ($12.50
for event mode), separate from allocation. It has not been silently raised.
With a $25 premium cap, a 2% stop is at most $0.50; even a zero-cost whole-cent
standard contract needs at least a $1 tick. **No supported scenario satisfies
all these current constraints.** The diagnostic proves and reports this rather
than claiming an affordable, safe trade exists.

My recommended next policy design is to retain 5% as an allocation ceiling,
disable conditional escalation initially, and determine an exit from thesis
invalidation and executable liquidity, then size against an explicit hard
dollar stress-loss budget. Do not silently convert the Owner's 2% premium stop
to 2% of account equity. A revised stop or stress cap must be visibly recorded
as a policy change. If no whole contract fits, staying in cash is a valid result.

## Probability and survival

High win rate alone does not establish positive expectancy. At 80% wins,
winning $1 and losing $8 has expected value 0.8 * 1 - 0.2 * 8 = **-$0.80**
per trade before costs. If one assumed 80% wins at +50% premium and every loss
filled at -2%, the modeled expectation would be **+39.6% of premium per trade**
before costs. Neither assumption is evidence that such a strategy exists.

Robinhood's displayed chance of profit refers to modeled profitability at
expiration, using current mark prices; it does not estimate reaching a chosen
profit target before a tight stop. [Robinhood probability explanation](https://robinhood.com/us/en/support/articles/360001227566/).

The future gate must lock the option contract/structure, entry, target, stop,
time exit, fees and fill assumptions before collecting independent outcomes.
Define whether thresholds are gross premium returns or net cash P&L; this
diagnostic preserves the requested gross target and separately reports its net
equivalent. Do not mix these labels in probability estimates. Replay executable
bid/ask paths, conservatively resolve ambiguous same-bar target/stop ordering,
and keep time-exit outcomes separate. Walk-forward holdouts, calibration,
confidence intervals, drift checks and cost-adjusted expectancy are required.
Existing weighted confidence categories are not this evidence.

There is no guarantee of an 80% future win rate, stable profits or never being
financially eliminated. For illustration, ten complete premium losses while
resizing at 5% of current equity leave $1,000 * 0.95^10 = **$598.74**; at 10%
they leave **$348.68**. These are full-loss scenarios, not predictions that
every stop will fail. Remaining able to participate is different from always
holding a position. Capital preservation can require no trade.

## Robinhood and underlying-specific constraints

- GLD provides gold-bullion exposure through trust shares; IBIT provides bitcoin
  exposure through an exchange-traded product. ETF options are not direct gold
  or wallet BTC positions. [GLD](https://www.spdrgoldshares.com/usa/gld/),
  [IBIT](https://www.ishares.com/us/products/333011/ishares-bitcoin-trust).
- Bitcoin trades around the clock; IBIT/options have exchange sessions. Weekend
  and overnight moves can occur when option exits are unavailable. QQQ's
  session-local realized-volatility fixtures exclude those moves and cannot
  measure this full holding risk. [IBIT annual filing](https://www.ishares.com/us/literature/annual-filings/ibit-1231.pdf),
  [Robinhood option hours](https://robinhood.com/us/en/support/articles/options-trading-hours/).
- Robinhood Level 2 covers long calls/puts and Level 3 eligibility is needed for
  spreads. Cash accounts cannot use Level 3 and cannot reuse unsettled proceeds;
  do not assume the Owner's account type or permissions. [Permissions](https://robinhood.com/us/en/support/articles/360001227566/),
  [account types](https://robinhood.com/us/en/support/articles/robinhood-accounts/).
- Exercise and assignment can create share exposure and funding requirements.
  Theoretical spread expiration payoff is not sufficient operational control.
  Broker closeout attempts are not a guaranteed exit. [Exercise and assignment](https://robinhood.com/us/en/support/articles/expiration-exercise-and-assignment/).

## Repository findings and delivered changes

| Area | Verified current state | Gap or change |
| --- | --- | --- |
| News | Four offline source adapters and deterministic verification exist. | No live GLD/IBIT event coverage or provider-quality proof. |
| Market context | QQQ synthetic daily/hourly/15m/5m qualification, ATR/RV/volume and regime references now exist. | BroadMarket semantics do not cover GLD/IBIT; real underlying data remains pending. |
| Evidence integrity | Audit reproduced changed ATR/RV and forged self-rehashed context insertion. | Fixed raw-to-normalized content checks, exact issued input identities, feature recomputation and issued-context-only repository writes; 19 regressions. |
| Owner profile | Initial universe formerly included ten symbols and excluded IBIT. | Current status now restricts intended trades to GLD/IBIT and records exact premium-stop basis and blocked escalation. |
| Risk | The original Options risk policy was recorded, not enforced by a complete runtime. | Added a pure offline economics diagnostic; account, portfolio and expiry risk remain unverified. |
| Probability | Prediction Engine confidence is a weighted rule category. | No GLD/IBIT option target-before-stop calibration exists; claims cannot increase allocation. |
| Product | No Options Dashboard or brokerage integration exists. | Added `npm run options:feasibility -- --demo` and manual JSON input; this is a diagnostic only. |

This delivery includes the prior uncommitted Phase 2 foundation and its new
integrity correction. It does **not** claim that the full system is finished.

## Files and verification

New retail files: `src/contracts/OptionsRetailFeasibility.ts`,
`src/engines/options-retail-feasibility/OptionsRetailFeasibilityEngine.ts`, its
test file, `scripts/options-feasibility.mjs`, its test file, and the two JSON
scenarios in `fixtures/options-retail-feasibility/`.

Integrity changes: source authorization, candle-series qualification,
multi-timeframe composition, in-memory context repository and the new
`OptionsMarketContextIntegrity.test.ts`. The full initial Phase 2 file list is
in [its delivery record](OPTIONS_PHASE_2_DELIVERY_REVIEW.md).

Integration/documentation changes: `README.md`, `docs/ARCHITECTURE.md`,
`docs/HANDOFF.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`,
`docs/status/current.json`, its schema and validators/tests, this assessment,
the retail specification, market-context specification and integrity addendum,
delivery record, contract/engine exports, `package.json` and `scripts/alpha-validate.mjs`.

`npm.cmd run alpha:validate` passed: **151 components, 3,145/3,145 tests,
zero failures**, reported component duration 107,519 ms. Local evidence is
`alpha-gld-ibit-validation.log` (ignored, not GitHub CI). The bundle includes
strict TypeScript checks, 76 retail-engine tests, 6 CLI tests, 19 integrity
tests, 32 status tests and all existing registered regressions. The prior
baseline was 2,962 tests; the initial Phase 2 increment was 3,042 tests.
`node node_modules/tsx/dist/cli.mjs scripts/options-feasibility.mjs --demo`
also ran successfully and displayed the exact $1/$2 stops and specific blockers.
`git diff --check` passed. An intermediate schema edit omitted the
maximumUniverseSize property and one test expected the prior milestone name;
both were corrected and current-status tests pass. No dependency/lockfile or
Python business-logic change was made.

Assumptions: user-supplied equity/cash and quotes remain manual scenarios;
zero costs in demos are explicit unverified assumptions; standard 100-share
contracts and whole-cent ticks only; the prior dollar caps remain conservative
constraints. No current quotes, broker permissions or successful strategy are
invented. Technical test counts measure software behavior, not win rate.

Git: development, commit and push are explicitly Owner-authorized. Publication
uses `codex/gld-ibit-options-foundation` without merging or overwriting main. The
final response records the actual commit and remote outcome after verification.

Recommended next implementation: GLD/IBIT contract metadata and read-only
option-chain evidence, then deterministic portfolio/account/expiry risk,
persistent offline paper decisions and outcomes, conservative path replay,
calibration and the user interface. Stop/cap incompatibility must remain visible
throughout; development progress cannot justify silently relaxing the rules.
