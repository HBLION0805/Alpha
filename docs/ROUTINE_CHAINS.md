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
> Option-chain refresh (READ-ONLY; never place/cancel/modify anything; never write data/in/watchlist.json): in /workspace/Alpha run
> `npm run -s chains -- --need`. It prints **all 34** optionable universe names (SPY QQQ IWM DIA RSP TLT IEF SHY UUP HYG LQD USO UCO GLD
> CPER SMH XLK XLE XLF XLI XLB XLY XLP XLV XLU XLRE XLC IYT JETS EWY FXI KWEB LEN KRE; GLDM excluded). Fetch EVERY symbol it prints —
> not SPY/QQQ/IWM, not the 6-name subset of 2026-11-10. Window per symbol (`src/options/chainWindow.ts`):
> 1. Spot: `get_equity_quotes`, ≤20 symbols per call, last trade price (mark if no last).
> 2. Expirations: `get_option_chains` → `expiration_dates`; take the nearest 3 on or after today (ET), preferring ≤60 days
>    (SPY/QQQ/IWM dailies → 0/1/2 DTE; others → next 3 weeklies). 2 or 1 is fine if that is all there is. Never a past date.
> 3. `get_option_instruments` with `chain_symbol=<SYM>` and `expiration_dates=<the 3 dates, comma-separated>`; follow `next` until the
>    near-spot strikes are in hand (or pages run out). Save every page verbatim.
> 4. Per expiration, 6 strikes: 3 strictly below spot + 3 at-or-above, **calls and puts** (≈12 contracts × 3 = 36). A short side is
>    filled from the other side; fewer than 6 strikes → all of them.
> 5. `get_option_quotes` for those ids, **≤20 per call**.
> 6. Write `data/in/rh-chain/<SYM>.json` =
>    `{"symbol":"<SYM>","spot":<last price>,"fetchedAt":"<ISO UTC>","instruments":[<instrument pages verbatim>],"quotes":[<quote pages verbatim>]}`.
>
> Rate limits: one symbol at a time (at most 2), ~200ms between calls, on an error retry up to 3 times with backoff (0.5s, 1s, …).
> If a symbol still fails, note it with the error and **continue with the next symbol** — never stop the run. Then run
> `npm run -s chains -- --build`, report every ⚠️ 过时 / ❔ 缺失 symbol and the failures, and refetch them. Do not commit data/.

## Library path: `npm run chains -- --refresh`

`src/options/chainRefresh.ts` (`refreshOptionChains`) runs the same window, throttle (concurrency 1 default / max 4, `--delay` 200ms),
retry (3 attempts, exponential backoff) and continue-on-error over all 34 names, writes the raw file and the built chain atomically,
then prints the status block plus wall time and call counts (total, by kind, per symbol; one call = one client invocation, retries
included). Node cannot call the Robinhood MCP, so `--refresh` needs a READ-ONLY source module: `--source <module>` or
`ALPHA_CHAIN_SOURCE=<module>` exporting `createChainSource()` → `{ equityQuotes(symbols≤20), optionChain(symbol),
optionInstruments({symbol, expirationDates, cursor}), optionQuotes(ids≤20) }`, each returning the MCP tool output verbatim.
Without one it exits 2 and prints the `--need` list and the window policy. No unofficial Robinhood REST client, no Alpaca for
chains, no secrets read.
