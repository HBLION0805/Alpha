# Daily guidance contract rationale

September 10, 2026. This F03/F04 increment explains each sampled GLD/IBIT
contract's expiry filter, strike, delta, reference moneyness, intrinsic/extrinsic
value and calendar exposure. The six-dimension check distinguishes direction,
magnitude, time, volatility, path and risk. Missing forecasts and trade-horizon
assumptions remain visible; the cheapest premium is not labeled the best trade.

Gross expiry breakeven and a separate declared-cost-reserve threshold use exact
microdollar arithmetic. Neither is a pre-expiry ETF target or exercise instruction.
Null costs, stale quotes, unavailable prices and unattainable put breakevens stay
explicit. A recent analyst note preceding newer market evidence needs reassessment.
These explanations do not change original rankings, dispositions or trading gates.

Current frontend and bounded Host brief use the same engine. Original captures,
issued reports and settings retain their fingerprints. An offline command derives
a separately labeled later explanation from a verified historical report:

```powershell
npm run options:guidance -- --explain-report <saved-report-path>
```

Twenty-four actual saved reports were verified and explained without changing
their bytes. Current sources are never substituted into those frozen inputs.

## Frontend correction found during acceptance

The one-minute local refresh closed an expanded explanation during browser QA.
Named disclosures now retain open/closed state and summary focus on same-page
renders, keyed by asset/contract identity. Route changes and removed contracts
cannot inherit another contract's state. This does not save a draft or trade.

## Actual remaining work

The saved sample has 36 requested contracts, 34 stale quotes and two unavailable
quotes. GLD and IBIT remain WATCH, each with two eligible prior official closes
versus the required five. The close-count change follows the assessment date;
this increment collected no new brokerage data. Expected price ranges, qualified
IV/path analysis, concrete trade horizons and current cost evidence remain missing.
No actual fill, new time exit, calibrated probability or real-price gate was created.

Ten workstreams remain four locally validated, four partial and two unvalidated.
The three real-price gates stay open; F03/F04 remain partial. Explanation usability
is not completion of daily actionable recommendations. See [specification](specifications/OPTIONS_GUIDANCE_RATIONALE_V1.md)
and [validation checkpoint](status/guidance-rationale.json).

## Existing market schedule recovery

The actual gld-ibit file again contained a 30-minute interval at turn start,
which could miss 09:50 inside the frozen paper window. Read-only installed-app
inspection confirmed support for the intended daily rule but did not establish
the cause of the previous overwrite. The supported app tool restored the exact
existing transitional fields at 05:12 UTC. Later file readbacks stayed identical.
Only recurrence/update time changed; prompts, bounds, notification intent, final
close restoration and both independent review jobs were preserved.

Configuration readback is not proof of a future run. An active task, unavailable
host or exhausted Codex allowance can prevent a market wake. The independent
local public-source process can continue while its host is available. No quota
reset, missed-window backfill or replacement market cron was authorized. See
[schedule evidence](status/market-schedule-recovery-20260910.json).
