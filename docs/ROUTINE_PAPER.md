# Routine step: refresh paper-ledger quotes (Robinhood, READ-ONLY)

Scripts cannot call the Robinhood MCP, so the routine agent does this **before** `scripts/run.sh` on weekdays between 15:45 and 16:59 ET.
Only these read-only tools are used: `get_option_instruments` and `get_option_quotes`. Never place, cancel or modify anything.

1. Run `node src/cli/paper.ts legs`. It writes `data/in/paper-open-legs.json` = `{generatedAt, legs:[{underlying,type,strike,expiration}]}`.
2. For each leg, call `get_option_instruments` with `chain_symbol=<underlying>`, `expiration_dates=<expiration>`, `type=<type>`, `strike_price=<strike with 4 decimals>` and take `instruments[0].id`.
   - VIX and other index chains work the same way.
   - Skip a leg if no instrument is found.
3. Call `get_option_quotes` with all ids (≤20 per call).
4. Write `data/in/rh-option-quotes.json` exactly in this shape (no account numbers, nothing else):
   ```json
   {"source":"robinhood get_option_quotes (read-only)","fetchedAt":"<now, ISO UTC>",
    "quotes":[{"underlying":"NVDA","type":"call","strike":220,"expiration":"2026-10-23",
               "mark":<mark_price>,"bid":<bid_price>,"ask":<ask_price>,"iv":<implied_volatility or null>,"updatedAt":"<quote.updated_at>"}]}
   ```
5. VIX expiry days only (VIX options settle at the open on the expiration date, e.g. 2026-10-21): if the official VIX settlement value (VRO) is published, write
   `data/in/settle.json` = `{"date":"<YYYY-MM-DD ET>","VIX":<VRO>}`. Otherwise write nothing. The VIX trade stays open with `settlePending`. Never use the VIX close.

`scripts/run.sh` then does the rest:
- **`paper mark`:** one mark per trade per ET day. It warns if the quotes file is >60 min old; missing legs fall back to Black-Scholes, marked 估算.
- **`paper expire`:**
  - Equity/ETF expiries settle at the Yahoo close after 16:00 ET.
  - VIX settles from `settle.json`.
  - Friday 15:45+: the mentor weekend rule.
- **`npm run review`:** writes `data/out/review-<date>.md`.
