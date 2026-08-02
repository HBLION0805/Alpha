# Personal Daily Scan Phase 1B-D2 Authorization and Calendar

Status: D2-C2-R2 implemented offline; Owner review required. This specification grants no network or credential authority.

## Boundary

D2 defines and verifies an Owner authorization manifest and exchange-calendar evidence. It does not read credentials, construct an HTTP transport, acquire market data, persist records, access an account, or enable execution. Phase 1B remains `NOT_STARTED` and D3 is not implemented.

Every preflight result reports zero attempted and completed network requests, zero persistence writes, and `automatedExecutionAllowed=false`. The absence of a configured trusted verification key returns `OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE` before any future credential boundary.

## Trust root

`authorizationBody` and `ownerApprovalEnvelope` are separate. The envelope's `ownerKeyId` and `ownerPublicKeyFingerprint` are selectors and consistency checks only. They are not trust roots. Verification requires either an Ed25519 public key pinned in product configuration or a future trusted external verifier. A caller-provided key, key ID, or fingerprint cannot authorize itself.

The implementation verifies that the SHA-256 fingerprint of the actual SubjectPublicKeyInfo bytes equals both the pinned value and the envelope value. It then verifies the Ed25519 signature using the actual trusted key.

D2-C1 removes all trust-root selection from `LiveReadonlyPreflightInput`. The
product composition root creates an `OwnerAuthorizationVerifier` from an
`OwnerTrustRootProvider` before a business request is evaluated, and the
verifier captures a defensive copy of the configured public identity. A
request can supply only `asOf`, Manifest, and Calendar evidence. Runtime or CLI
key, fingerprint, key-ID, source, or verifier overrides and signed Manifest
extensions fail closed. Missing product configuration returns
`OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE` with zero candidates and
zero side effects.

The exact manifest signing message is:

```text
UTF8("ALPHA_OWNER_NETWORK_AUTHORIZATION_V1\0")
|| RAW_32_BYTE_MANIFEST_SHA256
```

Calendar approval uses the independent `ALPHA_EXCHANGE_CALENDAR_EVIDENCE_V1\0` domain and the raw calendar-body SHA-256 bytes. Keys and reusable authorization artifacts are not stored in the repository.

## Canonicalization and hash

The authorization and calendar bodies use RFC 8785 JSON Canonicalization Scheme semantics: JSON-only values, lexicographically ordered object member names, ECMAScript JSON number serialization, no sparse arrays, no non-finite numbers, and no implicit `toJSON` transformation. SHA-256 is computed over UTF-8 canonical bytes and encoded as lowercase `sha256:<hex>`.

Unknown fields fail closed at the manifest, body, request, envelope, calendar, and session boundaries. Changing any signed field changes its hash and invalidates approval.

## Fixed future network plan

The signed plan contains exactly five ordered requests. D2 validates this plan but does not execute it:

1. P1D Bars: MU, QQQ, SKHY, SMH, SPCX, TSLA.
2. PT1H Bars: MU, SKHY, SPCX, TSLA.
3. PT15M Bars: MU, SKHY, SPCX, TSLA.
4. PT5M Bars: MU, SKHY, SPCX, TSLA.
5. Latest Quotes: MULL, SKDD, SKUU, SPCH, SSPC, TSLL, TSLQ.

Each entry binds ordinal, GET method, `data.alpaca.markets`, path, capability,
interval, sorted symbol set, IEX feed, USD currency, adjustment, sort, UTC
window, requested limit, timeout, maximum response bytes, exact maximum
evidence records, calendar fingerprint, mapping registry ID/version, and its
own request fingerprint. Expansion, mutation, repetition, reordering, retry,
pagination, polling, streaming, background execution, persistence, accounts,
positions, balances, orders, Broker, Paper Trading, and automated execution are
prohibited.

Bar requests structurally encode `limit=2`, but Alpha has no saved authoritative
Provider evidence proving that Alpaca applies this limit independently to every
symbol in a multi-symbol request. `limit=2` therefore cannot currently prove
the exact maxima of 12, 8, 8, and 8 records. The product path returns
`PROVIDER_LIMIT_SEMANTICS_UNPROVEN` before Transport or credential access.
Flat-mapped fixture responses test only Alpha's structure and never establish
real Provider capability.

### Provider request alternatives

| Option | Maximum requests | Maximum raw response | Extra consumer data | Pagination | Current decision |
| --- | ---: | --- | --- | --- | --- |
| A. Five multi-symbol batches | 5 | Not bounded to 43 until per-symbol limit semantics are proven | Unknown | Forbidden | `BLOCKED` |
| B. One request per Bar symbol/interval plus one Quote batch | 19 | Can be bounded to 36 Bars and 7 Quotes if single-symbol semantics are proven | None intended | Forbidden | Exceeds the approved five-request budget |
| C. Batch plus pagination | 5 plus an unknown number of pages | Provider-dependent and unbounded by the current manifest | Possible | Required when token present | Rejected by zero-pagination policy |
| D. Larger batch limit plus strict selection | 5 | Intentionally exceeds the 43-evidence consumer budget | Yes | Possibly | Rejected; Alpha may not over-read then trim |

The current constraints of exactly five requests, exactly 43 consumed evidence
items, and no pagination are not jointly proven feasible. Resolving this needs
separate Owner approval for authoritative Provider documentation/evidence or a
revised request budget; tests cannot manufacture the missing fact.

## Product composition and network accounting

The only product operation is composed in this order:

```text
C1 verified authorization artifact
-> C2 compiled exact plan
-> product-owned unproven Provider-semantics gate
-> exact request validator
-> single-use product dispatcher
-> bounded raw HTTP response
-> strict raw parsing and response validation
-> product-owned Canonical normalization
-> product-owned provenance and ProviderRequestAttempt
-> product-owned EvidenceResolution
```

The raw Manifest body cannot mint a product plan, and the verified artifact is
module-branded only after the product-owned C1 verifier succeeds. The product
entry is a no-argument factory. It fixes the verifier configuration and
Provider-semantics authority inside the product composition root; business
arguments cannot replace either authority or inject a Transport. The separate
test factory is physically isolated and is not exported by the product barrel.
Before each dispatch it revalidates method, host, path,
ordinal, symbols, interval, query, time window, requested limit, byte/evidence
budgets, calendar identity, mapping identity, and request/plan fingerprints.
The legacy 12/13-symbol planner is not connected to this operation.

The Transport seam can return only request identity, bounded HTTP status,
allow-listed headers, started/ended timestamps, and a raw body. It cannot return
Canonical evidence, provenance, ProviderRequestAttempt, EvidenceResolution, or
lifecycle counters. Product code owns strict parsing, normalization,
provenance, attempt, and resolution construction.

Network counters belong to the single-use product dispatcher:
`attemptedNetworkRequests` increments when the dispatcher permits one request
start, while `completedNetworkRequests` increments only after the complete raw
response passes the outer byte, identity, header, status, and timing boundary.
A second start is blocked as a retry/multiple-attempt violation. HTTP error,
timeout, or oversize response preserves an attempt without completion. Parse,
schema, pagination, and evidence failures occur after bounded receipt and
therefore preserve both counts already incurred. These tests exercise a local
lifecycle model only; no real HTTP lifecycle has run. Offline fixture and
dry-run validation keep both counters at zero.

## Exact response and resolution budget

D2-C2-R2 provides an offline response gate and a test-only raw Transport seam.
No concrete Alpaca HTTPS Transport or credential reader is
wired, and the default unproven Provider-semantics evidence blocks before that
seam. A valid structural test envelope contains exactly five batch
`ProviderRequestAttempt` records,
36 finalized Bars, seven latest Quotes, and 43 successful
`EvidenceResolution` records. Each canonical evidence item binds exactly one
attempt through capability, interval, canonical ID/fingerprint, instrument,
provider symbol mapping, mapping registry ID/version/content fingerprint, evidence
window, provenance, and response-source reference. The three-part registry
identity participates in compiled-query, attempt, resolution, composition,
and deterministic fingerprints. The content fingerprint binds every normalized
approved mapping entry, canonical/provider identity, classification, leverage
semantics, relationship, approval/status field, and benchmark record. Entry
ordering does not change the fingerprint, while a semantic change with the same
registry ID/version does. Any drift is blocked.

The gate rejects missing or excess per-symbol records, unexpected capabilities
or symbols, response reordering, a response above its byte ceiling, non-final
or future Bars, window or session mismatches, duplicated evidence, ghost or
duplicate resolutions, mutated executable queries, changed request
fingerprints, repeated or exchanged ordinals, a sixth request, and any non-null
pagination token. A blocked result exposes no partial evidence or candidates
and retains zero credential, persistence, network, and execution authority.

## Exchange calendar evidence

`ExchangeCalendarEvidence` v1.0 is independently versioned, fingerprinted, and Owner-approved. It binds producer identity/version, authority source, New York timezone, validity window, closure buffer, and an explicit sorted session record for every relevant local date.

Trading sessions require an explicit 09:30 New York open and either 16:00 regular close or approved 13:00 early close. UTC offsets must therefore reflect DST. Weekends and holidays are explicit closed records; weekdays are never inferred. Missing, expired, conflicting, unsigned, wrongly signed, or date-incomplete evidence blocks preflight.

- Premarket and regular-session reads use the latest prior completed trading session.
- During the post-close buffer, the current session is not completed.
- After the closure buffer, the current session becomes the reference session.
- Weekends and holidays use the latest prior explicitly approved trading session.

Historical completed Bars and a current Quote must remain visibly different time authorities in D3. D2 does not construct a market snapshot.

## State and next boundary

Phase 1A remains `MERGED / OFFLINE_AVAILABLE`. Phase 1B remains `NOT_STARTED`;
D2-C1 is closed and D2-C2-R2 is an offline correction awaiting Owner review.
Network, credential access, D2-C3, D3 acquisition, VIX, macro/news, Options,
Broker, Paper Trading, Order Execution, persistence, and execution authority
remain closed.
