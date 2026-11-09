# Routine: daily option-chain refresh (Robinhood, READ-ONLY)

Volume alerts, the brief and the options dashboards read `data/in/<sym>-chain.json`. Scripts cannot call the Robinhood MCP, so the
routine agent saves the raw pages and `scripts/run.sh` (`npm run chains -- --build`) normalises them.

- **Symbols:** `npm run -s chains -- --need` = the optionable names in `data/in/watchlist.json` — the fixed 35-name macro universe
  (`knowledge/macro/fixed-watchlist-and-flows.md`; SPY/QQQ/IWM already in it and always first; GLDM excluded as no-options). Missing file →
  `FIXED_UNIVERSE` (src/macro/universe.ts). No mega-cap defaults.
- **Do NOT overwrite `data/in/watchlist.json`** from Robinhood `get_watchlists` / personal 自选. If it drifts, restore it from the knowledge list.
- **Freshness (QA C7):** on load, contracts expiring before today (ET) are always dropped. A chain more than 1 NYSE trading day old is
  labelled **过时（asOf …）** in the volume report, the brief and the options dashboard, and carries `freshness.stale: true` in
  `data/out/volume-latest.json` / `options-*-latest.json`. A stale chain raises no volume alarms.
- `npm run chains` prints the status per symbol (✅ / ⚠️ 过时 / ❔ 缺失).

## Routine prompt text (add to the daily premarket routine, before `scripts/run.sh`)

> Daily bars refresh (READ-ONLY, do this FIRST; QA C4; never write data/in/watchlist.json from Robinhood watchlists): run `npm run -s bars -- --need --through <last closed NYSE session YYYY-MM-DD>` to get the comma list of symbols that still need a completed daily bar. A missing file is fetched. A file whose last bar is already that session is skipped only when that bar is a real bar with volume. If the last bar is `interpolated: true`, or volume is 0 (including open=high=low=close), do not skip it — re-fetch.
> Fetch every symbol it prints (not just SPY/QQQ/IWM): call `get_equity_historicals` with up to 10 symbols per call,
> `interval=day`, start = one year ago. Do not write the raw response as-is. Pipe each symbol's JSON to `npm run -s bars -- --write <SYM>` so interpolated bars and flat zero-volume bars are dropped before `data/in/<SYM>-bars.json` is saved. List any skipped/failed symbol in your report. After saving (and after the chain build below) run
> `npm run -s chains -- --build` and refetch any symbol whose freshness is not ✅.
>
> Option-chain refresh (READ-ONLY; never place/cancel/modify anything): in /workspace/Alpha run `npm run -s chains -- --need`
> to get a comma list of symbols. For EACH symbol, independently (if one fails, note it and continue with the next):
> get the last price, call `get_option_instruments` (`chain_symbol=<SYM>`, expirations within ~60 days) and `get_option_quotes`
> for those ids (≤20 per call), then write `data/in/rh-chain/<SYM>.json` =
> `{"symbol":"<SYM>","spot":<last price>,"fetchedAt":"<ISO UTC>","instruments":[<instrument pages verbatim>],"quotes":[<quote pages verbatim>]}`.
> Then run `npm run -s chains -- --build` and report any ⚠️ 过时 / ❔ 缺失 symbols. Do not commit data/.
