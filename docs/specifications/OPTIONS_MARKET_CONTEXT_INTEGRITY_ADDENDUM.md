# Options Market Context Integrity Addendum

Date: 2026-09-06

This addendum strengthens the in-memory integrity boundary of
[Options Market Context and Candle Analysis](OPTIONS_MARKET_CONTEXT_AND_CANDLE_ANALYSIS.md).
It does not change the synthetic QQQ benchmark scope, numerical policy,
fixture-only origin, or advisory authority.

## Validated construction and persistence

1. Source authorization compares the supplied canonical Bar batch with the
   canonical normalization of the manifest-bound raw fixture, in addition to
   validating source metadata. A successful batch is deeply frozen and its
   exact object instance is registered with the source binding and interval.
2. Qualification requires that issued batch, the exact immutable binding, and
   a source-effective evaluation time. It issues a deeply frozen series only
   after the existing calendar, history, freshness, and action checks pass.
3. Composition requires issued series and recomputes all technical features.
   Matching provenance fingerprints cannot authorize altered feature values.
   Existing Market Regime recomputation remains required.
4. The in-memory repository accepts only immutable contexts issued by the
   composer. A caller-created or deserialized object cannot gain write
   authority by recomputing its outer fingerprint. Issued queried contexts
   remain eligible for idempotent replay, and conflicting IDs cannot overwrite
   previously stored evidence.

## Limits

The issuance registries are module-private weak collections of exact in-process
object identities. They are not signatures, a cross-process trust root, or a
durable persistence format. Reloaded JSON must pass the authorized construction
pipeline again; it cannot be inserted as an already-qualified context.

Fixture configuration is still supplied at the existing trusted composition
boundary. Synthetic fixtures prove deterministic software behavior, not market
truth, provider authority, option-contract eligibility, or profitable outcomes.
No Robinhood account, credential, network request, order, or automatic execution
is introduced. Supporting GLD or IBIT requires a separately valid instrument
context design; neither may be relabeled as a broad-market benchmark.

## Regression evidence

`OptionsMarketContextIntegrity.test.ts` covers source batch issuance, raw-to-Bar
value correspondence, cross-instrument and cross-source substitutions,
qualification cloning, effective-window drift, altered feature values,
rehashed malformed contexts, immutable queries, and idempotent/conflicting
replay. These tests complement the existing contracts, numerical, and
end-to-end suites.
