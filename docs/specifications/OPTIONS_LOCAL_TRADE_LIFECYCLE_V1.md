# GLD / IBIT Local Trade Lifecycle v1

Date: 2026-09-06. Reviewed implementation specification.

## Authority and outcome

The Owner authorized continued implementation through the first complete trade
process test, with a record, review and mistake notebook after every trade.
Development and commit/push authority persist. This supersedes the former blanket
paper-testing prohibition for local simulation only. No real money, brokerage
account, brokerage paper account, order routing or paid data is accessed.

Acceptance is a reproducible local sequence from contract/quote qualification
through a frozen plan, risk check, simulated order, position, exit, accounting,
review and persistent mistake notebook. Synthetic or unverified imported data
must never become market-validated performance or a claimed trading edge.

## Contract and quote boundary

Use separate option contracts rather than changing the generic ETF identity.
Only GLD/IBIT standard USD American long calls/puts, multiplier 100; reject
adjusted deliverables. Bind canonical contract id to symbol, expiry, type and
strike. Quotes carry observed/received timestamps, origin, source, bid/ask and
sizes in contracts, underlying price and nullable IV/delta. Sources are local
SYNTHETIC_FIXTURE or UNVERIFIED_IMPORT only; no caller field grants live authority.
Strict finite integer validation, freshness, session/expiry checks and immutable
snapshots are required. A quote is not proof of executable liquidity or a fill.

## Frozen plan and paper state

Plans record six thesis dimensions, strategy version/setup key, direction and
timeframe roles, limit entry, quantity, entry deadline, time exit, stop and net
R target. No learned weights or calibrated probability is asserted. Monthly
context, daily setup and intraday timing are distinct evidence roles. Research
parameters remain unchanged: 10%-25% premium stop, 20% default, 1.5R-2R target,
0.5% equity planned risk, 5% allocation and USD 25 full-premium stress limit.
The first lifecycle uses the existing tactical 14-45 calendar-day DTE range,
one position and intraday holding plans. Holding duration and contract expiry
are different concepts; this is not a 0DTE implementation.

Use the existing feasibility engine for entry economics, then enforce paper
account cash, one open position, net realized session-loss and drawdown
guards. Session gains offset losses; this is explicitly a net PnL counter, not
a gross losing-trade sum. New session-loss ceiling is 1% of initial paper equity and high-water
drawdown ceiling 5%; these are explicit conservative simulation assumptions,
not empirically validated production settings. Each new planned R must also fit
the remaining session-loss and drawdown capacity. Reserve entry cash; outstanding
orders or positions prevent a second entry. Unknown costs or missing required
evidence block entry. No conditional risk increase is supported.

Quote-path processing is deterministic and chronological. Submit before fill;
require a subsequent fresh regular-session quote, ask at or below limit and
sufficient displayed ask size. Conservative simulated buys use ask, sells bid,
with explicit per-side fees and adverse exit slippage. Quote-touch matching is
an assumption, not a reconstruction of exchange queue position. Stop exits can
realize worse than planned R. Once a stop/time exit is triggered it stays pending
until suitable bid liquidity exists; do not invent a price or mark an unclosed
position closed. Limit target fills must satisfy net R after actual modeled costs.

Do not fill from future-received data, stale/closed quotes, zero size or quotes
after the entry deadline. Time exits and entry expirations are independent of
new quotes. No forced fabricated expiry fill or exercise; unresolved expiry
exposure remains an incomplete test requiring review. Duplicate ids are
idempotent only for identical content; contradictions fail. A path revision may
only append observations, never rewrite previously observed history.

Paper cash and holdings reconcile after every event. Sale proceeds remain
unsettled through the session; v1 reports them separately and does not assume
same-day reuse or claim broker settlement compliance. A complete round trip can
end with unsettled proceeds. No fake settlement credit is emitted.

## Records, review and mistake prevention

Persist each accepted scenario revision plus its deterministic result and review
as one append-only hash-linked local batch, with a single writer lock, bounds,
fsync and corruption detection. On restart recompute the full state from stored
inputs and compare; checksums are integrity checks, not authentication. Repeated
commands cannot create duplicate fills, cash movements or notebook entries.

Every closed trade records entry/exit, plan, quote references, fees, gross/net
PnL, realized R, exit reason and observed path. Winning and losing trades both
receive reviews. Separate observed facts from causal hypotheses. A planned loss
is not automatically a mistake, and a lucky win does not excuse a violated rule.
Candidate lessons are not approved strategy knowledge; no automatic risk or
timeframe-weight change may follow one outcome. Deterministic pre-entry guards
consult applicable notebook lessons and prevent known, objectively checkable
process errors; uncertainty is recorded rather than an invented cause.

## First test and validation

Deliver a runnable local demo plus file-input/replay/report commands. Test target,
ordinary stop, gap loss, time exit, no fill, missing exit liquidity, stale or
wrong-contract quote, duplicate command, conflicting rewrite, restart recovery,
cash reconciliation, trade reviews and applicable mistake checks. Demo outcomes
are scripted engineering cases, not strategy win-rate estimates. Run focused
tests, strict typecheck, all surviving aggregate tests and document actual counts.

Live-read option data qualification, account-specific rules, full settlement and
exercise handling, independent historical/forward outcomes and any real execution
remain separate completion gates after this first local lifecycle test.
