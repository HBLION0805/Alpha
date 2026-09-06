# First local GLD / IBIT trade lifecycle

Date: 2026-09-06. Baseline: 4e27789b297cc8bff759fe3d3a66396497fbc6af.
The Owner authorized continued development through a complete trade-process test,
records and reviews after each trade, and an actionable mistake notebook.

## Delivered behavior

The local process now runs from an exact GLD/IBIT option contract and timed quote
path through a frozen plan, risk checks, reserved cash, simulated limit entry,
position, stop/target/time exit, cash accounting, review and candidate lessons.
The first test uses explicitly synthetic prices and future scenario dates. It
is an engineering test, not a live market result, backtest or strategy win rate.

Supported scope: standard 100-share long calls/puts, intraday plans, 14-45 DTE,
one position, a USD 1,000 initial paper account. Fee/slippage inputs are explicit
assumptions. Entry uses a subsequent eligible ask; exits use eligible bids with
modeled adverse slippage. Displayed quantity does not guarantee a market fill.
Daily/weekly/monthly returns or automatic trend signals are not fabricated.

## First scripted process result

| Case | Outcome | Net modeled PnL |
| --- | --- | --- |
| GLD target | Target reached after entry | +USD 8.80 |
| IBIT ordinary stop | Stop exit | -USD 4.20 |
| GLD gap | Stop filled beyond planned R | -USD 10.20 |
| IBIT time exit | Time deadline reached | +USD 0.80 |
| GLD unfilled order | Entry expired; no position or fees | USD 0.00 |
| GLD delayed liquidity | Stop stayed pending across restart, then exited | -USD 5.20 |
| Next entry | Rejected by net session-loss guard | USD 0.00 |

Observed deterministic end balance: **USD 990.00**, net PnL **-USD 10.00**, five
closed trades, one cancelled entry and one rejected entry. Cash reconciles to
USD 899.00 settled plus USD 91.00 unsettled, with no open position, reservation
or synthetic settlement credit. These paths deliberately exercise both wins
and losses and are not evidence of a 40% strategy win probability.

The application actually ran `--record-demo`, persisted eight batches, reopened
the journal and reproduced the same balances and five reviews with `--report`.
Four scoped candidate notebook entries were produced: GLD exit-liquidity delay,
GLD and IBIT observation gaps, and GLD loss beyond planned R (two occurrences).
The pending-exit batch and its later resolution were processed through separate
repository instances. Independent tests also verify that a second demo command
adds zero batches and leaves the journal byte-for-byte unchanged.

## Recording and mistake prevention

Every closed trade saves the plan fingerprint, entry/exit quote references,
fees, gross/net result, realized R, exit reason and review. Both wins and losses
receive factual accounting explanations and explicitly unproven causal
hypotheses. Trend, IV or news cannot be named as a verified cause without the
corresponding point-in-time evidence and comparative outcomes.

A normal planned loss is not automatically a mistake. Rule violations remain
visible even on winning trades. Losses beyond planned R, delayed exit liquidity
and observation gaps create execution-risk candidates. The next entry consults
applicable prior lessons and validates quote quality, known costs, spread,
liquidity, frozen-plan integrity and risk. It cannot guarantee future liquidity
or prevent every gap. Lessons do not change risk budgets or strategy weights.

One append-only batch contains each scenario revision and its complete result
and review. Reopening recomputes outputs and checks linked hashes. Identical
commands are idempotent. Prior quotes and plans cannot change; new observations
must be received after the previously evaluated as-of cutoff. Repository handles
cannot outlive the writer lock. Corrupt, partial or conflicting history blocks
the command. Checksums detect inconsistency, not publisher authenticity.

## Trend and candle timeframes

Trend is an interpretation of price behavior; monthly/daily candles are input
timeframes. Their relative usefulness depends on the intended holding period,
and correlated signals should not be counted as independent confirmations.
For this first intraday test, monthly context, daily setup and intraday timing
are separate frozen thesis fields. No arbitrary 70/30 weighting is implemented.
See [Fidelity trend concepts](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/basic-concepts-trend).

An option also depends on time, volatility and price paid. Direction alone does
not establish an attractive option trade; see
[OIC option price behavior](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior).
The current model records these dimensions but does not calculate qualified
GLD/IBIT trend signals or optimize their weights from the scripted demo.

## Run and inspect

- `npm run options:paper -- --demo`: isolated in-memory scripted test.
- `npm run options:paper -- --record-demo`: save and resume the demonstration.
- `npm run options:paper -- --report`: recompute account, trades and notebook.
- `npm run options:paper -- --input fixtures/options-paper/gld-target.json`:
  append one scenario; pending/resumed example files are in the same directory.

Local history is excluded from Git under `data/runtime/options-paper/`. Do not
mix synthetic and unverified imported data in one paper account or erase a
damaged journal to make validation pass. This is single-writer development
persistence with 16 MiB and 2,000-batch limits, not a production brokerage ledger.

## Files, validation and publication

Changes include three new contracts, contract/quote validation, the local paper
engine and fixtures, trade review/notebook logic, local persistence, CLI and
focused tests. Exports, package scripts, aggregate validation and current status
1.17 were integrated. Architecture, handoff, roadmap and decisions now distinguish
local simulation from the remaining live product work.

`npm.cmd run alpha:validate` passed: **79 components, 2,047 tests executed,
2,047 passed, zero failed**, aggregate duration **24,642 ms**. This includes
strict typecheck, every surviving suite, scope/import registration, documentation
links, credential/runtime scans and staged/unstaged whitespace checks. Focused
new suites: contract/quote 35/35, paper engine 50/50, trade review 43/43, local
repository/CLI 16/16; current status 47/47. The local ignored aggregate log is
`alpha-local-lifecycle-validation.log`.

Independent review found and fixed retrospective quote insertion, pre-trigger
time-exit pricing, double-counted reservations, equal-time fill ambiguity,
unresumable displaced positions, escaped repository handles and inconsistent
identifier validation. Regression tests reproduce these failures. Expected
uncommitted-tree and Windows line-ending notices were the only aggregate warnings.

The result is recorded in `currentDeliveryValidation` in
[machine status](status/current.json). Earlier counts remain historical. Changes
are prepared for Owner-authorized commit/push on
`codex/gld-ibit-options-foundation`; the containing commit records the delivery.
The task reports the final commit and remote verification after publication.

## Limits and next gates

This delivery allows local trade-process testing. It does not make the system
ready to place real trades. No verified live/historical option provider, broker
account access, order routing, independent strategy outcomes or calibrated win
probability exists. Quote IV/delta are optional local inputs, not licensed
provider analytics; other Greeks and quantitative drivers remain future work.

The conservative weekday/session clock does not independently prove holidays
or early closes. The local engine lacks broker-specific permissions, settlement,
exercise and full event/portfolio policy. Time exits can remain unfilled and
expiry exposure remains unresolved instead of being assigned a fake closing
price. Robinhood notes that stop prices do not guarantee execution prices:
[options stop orders](https://robinhood.com/us/en/support/articles/stop-market-order-options/).

The next gate is qualification of an actual GLD/IBIT quote-path source, then
independent historical/forward replay and broker-specific risk/settlement
handling. No USD 50,000 target, successful test or notebook entry changes those
requirements or automatically grants real execution authority.
