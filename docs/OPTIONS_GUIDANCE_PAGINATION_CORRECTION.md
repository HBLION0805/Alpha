# Option instrument pagination correction — September 24, 2026

The saved 14:56 EDT live GLD/IBIT capture returned `data.next` as an opaque
Base64 cursor for each first instrument page. The collector only recognized a
`cursor=` query parameter in a URL, so both lists stopped with `CURSOR_INVALID`
and `INSTRUMENT_LIST_PARTIAL`. Its original capture remains partial and unchanged.

The Host collector now accepts that observed raw cursor verbatim and the older
observed Robinhood instrument-page URL form. For URLs it validates the exact
provider origin, path and original request scope, then decodes the cursor query
value once. Empty, malformed, repeated or unsupported pagination fails closed;
only absent/null `next` ends a list. The existing eight-page, 24-call,
three-minute and 18-per-ETF/36-total selection limits remain in force.

Synthetic regression tests verify two-page completion and later-page selection.
No new live capture was made for this correction. A future separately authorized
capture is still needed to validate the changed parser against live pagination.
No strategy, schedule, risk, source-quality or historical capture rule changed.
