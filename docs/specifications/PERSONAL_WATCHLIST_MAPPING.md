# Personal Watchlist Mapping v1.0

## Purpose

This module records the exact relationship between the Owner's four analysis
instruments and the leveraged or inverse ETF that may later become a personal
decision candidate.

It solves one narrow problem: Alpha must know what is being analysed and what
would actually be bought. It does not fetch live data, rank products, recommend
a trade, size a position, submit an order, or connect to Robinhood.

## Initial researched watchlist

| Analysis instrument | Bullish vehicle | Bearish vehicle | Daily target |
| --- | --- | --- | --- |
| MU | MULL | None in active scope | +2x only |
| TSLA | TSLL | TSLQ | +2x / -2x |
| SPCX | SPCH | SSPC | +2x / -2x |
| SKHY | SKUU | SKDD | +2x / -2x |

Each relationship is supported by issuer, SEC, or exchange evidence. Research
verification is not Owner approval. The built-in catalog therefore ships with
every relationship in `PENDING` Owner state. The Owner approved the complete
eight-mapping MVP set on 2026-07-26; runtime activation still requires the
structured approval command to bind all exact mapping identities.

## Activation rule

A mapping becomes usable by the Personal Candidate Scan only when all of the
following are true:

1. the analysis instrument is a valid canonical equity;
2. the trade vehicle is a different valid canonical ETF;
3. the signed exposure is exactly consistent with the declared +2x or -2x
   daily objective;
4. the vehicle is explicitly marked `DAILY` reset and `INTRADAY_ONLY`;
5. at least one issuer, SEC, or exchange authority record supports the
   relationship;
6. the authority research status is `AUTHORITY_VERIFIED`;
7. an explicit Owner decision is `APPROVED`.

Failing any condition produces blockers and no reviewed candidate mapping.

## Important product semantics

- Buying an inverse ETF is represented as a long purchase of the ETF with
  bearish exposure to the analysis instrument. It is not recorded as a direct
  short sale.
- The target applies to one trading day. Alpha must not infer that a two-day or
  longer return will equal the corresponding multiple of the underlying.
- Mapping approval says only that the instrument relationship is correct. It
  does not say that price, spread, liquidity, trend, trigger, or risk conditions
  are acceptable.
- Provider symbol support and real quote/bar retrieval remain separate gates.

## Authority sources reviewed on 2026-07-26

- GraniteShares issuer materials for MULL, SKUU, and SKDD.
- Direxion issuer materials for TSLL.
- Tradr issuer materials for TSLQ.
- Leverage Shares issuer materials for SPCH and SSPC.
- SEC filings for the SPCX and SKHY listed underlying identities.

Exact URLs and assertions are stored with each immutable mapping proposal.

## Deferred work

- Owner approval or rejection of the eight proposed relationships.
- Provider-specific symbol mapping and capability verification.
- Canonical P1D, PT1H, PT15M, and PT5M bar retrieval.
- Canonical current quote, spread, and deterministic liquidity assessment.
- Composition of verified market observations into the Personal Candidate
  Scan.
- Any decision recommendation remains advisory and read-only.
