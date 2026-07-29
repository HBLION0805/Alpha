# Personal Market Data Eleven-symbol Scope Correction v1.0

## Purpose

Personal MVP-T3G-C13 records the Owner's 2026-07-29 decision to withdraw
`MULS` from the active personal decision-support scope after both Alpaca and
Twelve Data failed to resolve it. The active scope contains eleven symbols.

This correction does not erase or rewrite the earlier twelve-symbol
qualification evidence. Those records remain immutable evidence of why the
Owner changed the prospective requirement.

## Active Scope

The exact ordered active set is:

`MU,MULL,TSLA,TSLL,TSLQ,SPCX,SPCH,SSPC,SKHY,SKUU,SKDD`

The four analysis themes remain `MU`, `TSLA`, `SPCX`, and `SKHY`. `MU` retains
its bullish `MULL` vehicle and has no approved inverse vehicle in this version.
The other three themes retain their approved bullish and inverse vehicles.

Any request containing `MULS`, omitting an active symbol, adding another
symbol, or changing the order fails closed.

## Provider Consequence

Alpaca Basic IEX is no longer blocked by a symbol that is outside the active
requirement. It returns only to `READY_FOR_BOUNDED_SMOKE`:

- the existing adapter and exact-host Transport remain available;
- all eleven symbols require a fresh bounded verification;
- P1D, PT1H, PT15M, PT5M, and latest two-sided Quotes must all pass;
- IEX remains single-venue evidence and cannot be labeled NBBO or consolidated
  United States volume.

C13 does not infer that the eleven symbols passed because an earlier P1D
response omitted only `MULS`. The earlier operation stopped on its first
failure, so the complete five-request path has not passed.

## Historical Compatibility

T3G-C5 through C12 continue to use the frozen legacy twelve-symbol set when
reconstructing their historical decisions. Active planning, watchlist mapping,
normalization, and provider readiness use the eleven-symbol set.

The prior Alpaca and Twelve Data `MULS` diagnostics remain available for audit,
but they grant no current collection or provider-selection authority.

## Authority and Exclusions

C13 adds no live-network authorization. A new live read requires a separate,
date-bound Owner approval after review and complete validation.

C13 adds no:

- Paper-account balance or position access;
- broker, order, or execution endpoint;
- persistence or automatic scheduling;
- recommendation or capital authority;
- Tradier account, credential, adapter, or request;
- automatic execution or commercialization.

## Acceptance

- The active watchlist has four analysis instruments and seven ETF vehicles.
- `MULS` is absent from the active mapping and exact Alpaca request set.
- The Alpaca request planner, validator, normalizer, Transport, and command bind
  the exact ordered eleven-symbol set.
- Alpaca Basic IEX is `READY_FOR_BOUNDED_SMOKE`, not collection-ready.
- Historical C5-C12 results continue to bind the legacy twelve-symbol set.
- Strict TypeScript, focused suites, and complete Alpha validation pass.
