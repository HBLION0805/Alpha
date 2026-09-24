# Owner Capital Shopping List V1

`OWNER_CAPITAL_SHOPPING_LIST_V1` is an Owner-supplied, static research universe in
`src/catalogs/OwnerCapitalShoppingList.ts`. It belongs to
`LONG_TERM_CAPITAL / STOCK_AND_ETF_RESEARCH`, separate from the GLD/IBIT options
workflow and the Personal Watchlist Mapping of analysis instruments to leveraged
or inverse ETFs. Its source order preserves the Owner's grouping and is not a
ranking. It creates no holdings, scores, target prices, sizes, allocation or
broker permission.

Each canonical symbol has one entry with display name, stock/ETF type, zero or
more Owner themes, Owner status, identity status and notes. `WATCH` means retain
for possible later research, not buy or approve. `FUTURE_WATCH` retains a concept
whose security identity and tradability are not accepted. `EXCLUDED` removes an
item only from this core list; other Alpha uses and history remain intact.
Every initial identity is `OWNER_SUPPLIED_PENDING_VERIFICATION`. No exchange,
issuer or provider verification was done in this revision. The CCXI / Agility
Robotics relationship and the expected AGLT ticker are Owner-supplied and
unverified; AGLT is not currently actionable. Names and mappings are retained
as supplied rather than silently corrected.

The current catalog has 39 unique `WATCH` stocks and eight `WATCH` ETFs, one
future-watch stock (AGLT), and two exclusions (NTR and SPCX): 50 unique symbols.
SANM is one instrument with both `US_MANUFACTURING` and `AI_INFRASTRUCTURE`
themes. The Owner's SPCX concentration concern and preference for UFO are
recorded as judgment, not independently verified facts. SPCX remains in the
separate Personal Watchlist Mapping.

If later authorized, the intended sequence is: shopping list → dated market,
company and macro observation → Research Lab → opportunity evaluation →
instrument evaluation → Capital Allocation → Owner decision. No import into
those engines is activated here. An options `NO_TRADE` leaves this research
universe available for a separate review; it does not trigger a stock purchase.

The catalog has no execution route. `executionAllowed`, `automaticExecution`,
`allocationAllowed` and `orderPermission` are all false. No market, account or
order tools were called; Owner allocation, risk rules, guidance, employment
case and capture schedule were not changed. Identity verification can be
considered separately when an instrument becomes a specific research candidate.
