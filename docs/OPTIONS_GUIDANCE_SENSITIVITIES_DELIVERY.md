# Saved option sensitivities delivery

September 12, 2026. Implements the reviewed
[specification](specifications/OPTIONS_GUIDANCE_SENSITIVITIES_V1.md).
Actual verification is recorded in [the checkpoint](status/guidance-sensitivities.json).

Daily guidance now displays saved IV, delta, gamma, theta and vega alongside
four signed illustrations for one standard long contract. The comparison keeps
every selected GLD/IBIT ID, including missing quotes, and each candidate has a
time/volatility drilldown. The Host brief uses at most six existing candidate IDs;
`npm run options:guidance -- --sensitivities` exposes the full local projection.

The separate adapter verifies the original raw record and canonical normalized
report before reading fields not previously used in guidance. Nanosecond source
clocks remain exact strings; only New York date derivation uses JS millisecond
precision. Invalid/missing fields do not become zero, and an IV decrease below
zero or a day beyond source-date expiry cannot produce a combined illustration.

No future option price or trade P&L is calculated. The illustrations hold local
Greeks and interest rates fixed, omit higher-order/cross effects and have no
validated accuracy range. The $1 shocks are unit comparisons, not forecasts or
equal percentage moves across ETFs. IV rank, historical IV comparisons and a
profitable-trade probability remain unavailable. See
[Robinhood's metric definitions](https://robinhood.com/us/en/support/articles/options-chain-metrics/)
for source units.

Actual saved capture: September 12 23:54:43 UTC, HOST_MARKET_TOOL_RESPONSES,
36 selected IDs, 24 quotes with all five model values, 12 missing quotes, zero
recent quote/receipt references. The quote update dates remain September 11.
Independent Greek timestamps are unknown. The readback uses only existing files.

Illustrative saved example: IBIT October 9 $43 call reports IV 38.974%, theta
-0.035836 per share/day and vega 0.045946 per share/IV percentage point. Its
one-contract unit changes are -$3.5836 for a day and -$4.5946 for IV down one
point. These are historical model illustrations, not expected future losses,
execution prices or amendments to the frozen September 15 engineering rehearsal.

F03/F04 gain local volatility/time context. F01–F06 remain partial, F07 locally
validated and F08 unvalidated. The ten workstreams remain 4 locally validated,
4 partial and 2 unvalidated; six gates remain 3 local available / 3 open.
No new market call, recurring job, paper enrollment, account/order access, fee
assumption, ranking change, probability claim or real-price gate advancement.
Original issued guidance/rationale, captures, paper reports, Owner ledger,
stored lessons, allocation policy and all three automation files are preserved.

Validation: aggregate `node scripts/alpha-validate.mjs` passed 4,539/4,539,
including typecheck. The final comparison-layout adjustment passed all 35 focused
sensitivity tests. Desktop and 390px mobile checks passed with no page script
errors or document overflow; stable screenshots were visually inspected.
All 166 pre-existing capture/guidance/paper/ledger files kept their hashes;
102 issued guidance records and nine paper plan/report records verified.
The original three automation hashes match. The workbench was restarted after
checking its exact workspace process and listener; current local UI state is
AVAILABLE. This does not establish outbound source reliability or a trading gate.
