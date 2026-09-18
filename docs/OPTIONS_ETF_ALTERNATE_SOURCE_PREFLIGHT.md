# Alternate ETF source preflight

Reviewed September 17, 2026 New York. This is a documented acquisition plan,
not a connected data source, implemented adapter, or completed trend test.

## Finding and selected route

The Robinhood public tool listing still does not resolve the omitted
`interpolated` default or the four recorded cross-interval differences. The
existing evidence and unsent provider questions remain intact. No additional
Robinhood market call was made during this preflight.

Alpaca is the first alternative to test. Its current stock-data
[FAQ](https://docs.alpaca.markets/us/docs/market-data-faq) describes trade-based
minute bars, absent bars when eligible trades cannot populate OHLCV, and larger
intraday intervals built from minute bars. It distinguishes consolidated SIP
coverage from the single-exchange IEX feed. Historical SIP requests with an end
at least 15 minutes old can be made without the real-time subscription, subject
to authentication and entitlement. This supports historical research, not a
claim of live full-market access or this account's confirmed eligibility.

The [historical API reference](https://docs.alpaca.markets/us/reference/stockbars)
documents raw adjustment, explicit feed and timeframe, inclusive time endpoints,
ascending order and pagination. These REST parameters are not an assumed plugin
schema. The current connected plugin must expose enough equivalent information
before an acquisition can be evaluated.

Alpaca's [official integration announcement](https://alpaca.markets/blog/openai-integrates-alpacas-market-data-functionality-as-part-of-chatgpt-for-financial-services/)
confirms market-data access through its ChatGPT integration. The plugin directory
listed Alpaca as available but not installed; an installation/connection
suggestion was issued. No connection, login, entitlement or actual GLD/IBIT bars
have been verified. A plugin listing does not establish any of those facts.

## Bounded first acquisition after connection

Inspect the actual tool schema first. Use only read-only equity historical data;
do not install a self-hosted trading server or add account/order permissions.
If the tool cannot identify the feed, adjustment, full paging and source clocks,
record that limitation instead of treating its result as qualified.

The reference REST request for the first completed-session check is:

```json
{
  "endpoint": "https://data.alpaca.markets/v2/stocks/bars",
  "symbols": "GLD,IBIT",
  "timeframe": "1Min",
  "start": "2026-09-17T13:30:00Z",
  "end": "2026-09-17T19:59:59.999Z",
  "feed": "sip",
  "adjustment": "raw",
  "asof": "2026-09-17",
  "sort": "asc",
  "limit": 1000
}
```

Use the same window for a `5Min` comparison. These are two logical requests,
with at most four pages each if the returned pagination requires it. Record a
remaining-page token as incomplete at the bound; do not silently truncate.
The inclusive endpoint is deliberately before 16:00 New York so an after-hours
bar starting at 16:00 is excluded. Preserve raw responses, effective parameters,
request and receipt clocks, page sequence and symbol identity privately.
The JSON is a plan, not an executed API call or an input to the Robinhood adapter.

## Acceptance before any setup use

1. Verify actual GLD and IBIT coverage, explicit SIP/raw scope and resolved
   pagination. A single-exchange response must not be relabeled consolidated.
2. Check session/calendar, exact prices, order, duplicates, OHLC validity and
   volume. Report missing expected intervals. Provider-documented absence of
   an eligible-trade bar is not permission to forward-fill it.
3. Check one-minute aggregation against five-minute data with both receipt
   clocks. Retain corrections or discrepancies; do not choose whichever version
   creates a preferred signal. Missing interpolation flags require a documented
   source-specific meaning, never a global omitted-equals-false conversion.
4. Compare relevant intervals against the retained Robinhood observations.
   Different providers need not match exactly when documented coverage or trade
   filters differ. Agreement alone does not establish independence of upstream
   feeds, source finality, execution quality or strategy benefit.
5. Only after source review, implement a separate documented adapter and register
   a future setup rule. The September 17 history remains retrospective evidence;
   it must not become a backfilled prospective trigger or paper entry.
6. Track bar-end time, availability/receipt time and option quote time separately.
   Delayed historical SIP can support history/replay; current-bar triggers still
   require a suitably timely source. Never use a later revision as information
   available to an earlier decision.

## Current disposition

Waiting for Alpaca installation/connection and actual tool/entitlement inspection.
No market acquisition was executed, no new adapter or timer was installed, and
no paper/guidance/capital rule changed. No subscription or account opening was
performed. If access requires those steps, the Owner must complete them; do not
infer permission to pay or accept account terms. Do not request keys in chat.

The existing source qualification and actual trend-to-contract stage remain
open. The ten-workstream count remains 4 local / 4 partial / 2 unvalidated.
This documentation-only preflight adds no tests and makes no new test claim.

References were checked on the date above. Prefer the current FAQ's aggregation
rules over older tutorials; changes to provider semantics require a dated review.
