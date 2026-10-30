# Routine: daily option-chain refresh (Robinhood, READ-ONLY)

Volume alerts, the brief and the options dashboards read `data/in/<sym>-chain.json`. Scripts cannot call the Robinhood MCP, so the
routine agent saves the raw pages and `scripts/run.sh` (`npm run chains -- --build`) normalises them.

- **Symbols:** `npm run -s chains -- --need` = SPY, QQQ, IWM + every optionable symbol in `data/in/watchlist.json` (no hardcoded list).
- **Freshness (QA C7):** on load, contracts expiring before today (ET) are always dropped. A chain more than 1 NYSE trading day old is
  labelled **过时（asOf …）** in the volume report, the brief and the options dashboard, and carries `freshness.stale: true` in
  `data/out/volume-latest.json` / `options-*-latest.json`. A stale chain raises no volume alarms.
- `npm run chains` prints the status per symbol (✅ / ⚠️ 过时 / ❔ 缺失).

## Routine prompt text (add to the daily premarket routine, before `scripts/run.sh`)

> Option-chain refresh (READ-ONLY; never place/cancel/modify anything): in /workspace/Alpha run `npm run -s chains -- --need`
> to get a comma list of symbols. For EACH symbol, independently (if one fails, note it and continue with the next):
> get the last price, call `get_option_instruments` (`chain_symbol=<SYM>`, expirations within ~60 days) and `get_option_quotes`
> for those ids (≤20 per call), then write `data/in/rh-chain/<SYM>.json` =
> `{"symbol":"<SYM>","spot":<last price>,"fetchedAt":"<ISO UTC>","instruments":[<instrument pages verbatim>],"quotes":[<quote pages verbatim>]}`.
> Then run `npm run -s chains -- --build` and report any ⚠️ 过时 / ❔ 缺失 symbols. Do not commit data/.
