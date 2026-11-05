# Routine: earnings coverage (Robinhood, READ-ONLY)

The card and brief read `data/in/earnings-by-symbol.json`; symbols never looked up show ❔ (never guessed).
`npm run earnings -- --need` prints the symbols (watchlist + journal + pending cards, ETFs excluded).
`npm run earnings` shows coverage and the missing list. Fed speakers need no MCP: `npm run fedspeak` (the brief also refreshes it).

## Routine prompt text (add to the daily premarket routine)

> Earnings refresh (READ-ONLY; never place/cancel/modify anything): in /workspace/Alpha run
> `npm run -s earnings -- --need` to get a comma list of symbols. For EACH symbol call Robinhood
> `get_earnings_results` (read-only) and write ONE file `data/in/earnings-by-symbol.json` shaped
> `{"fetchedAt":"<ISO time>","source":"robinhood.get_earnings_results","bySymbol":{"<SYM>":[<data.results verbatim>]}}`.
> Symbols that return empty results go in as `"<SYM>": []`. Do not edit dates, do not fill gaps, keep `report.verified`
> as given (false = estimated). Then run `npm run -s earnings` and report any ❔ missing symbols. Do not commit data/.
