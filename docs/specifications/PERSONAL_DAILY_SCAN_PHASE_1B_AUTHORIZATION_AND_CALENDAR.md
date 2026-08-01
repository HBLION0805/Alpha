# Personal Daily Scan Phase 1B-D2 Authorization and Calendar

Status: implemented offline; Owner review required. This specification grants no network or credential authority.

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

Each entry binds ordinal, GET method, `data.alpaca.markets`, path, capability, interval, sorted symbol set, IEX feed, adjustment, sort, UTC window, limit, timeout, maximum response bytes, calendar fingerprint, and mapping registry version. Expansion, mutation, repetition, reordering, retry, pagination, polling, streaming, background execution, persistence, accounts, positions, balances, orders, Broker, Paper Trading, and automated execution are prohibited.

## Exchange calendar evidence

`ExchangeCalendarEvidence` v1.0 is independently versioned, fingerprinted, and Owner-approved. It binds producer identity/version, authority source, New York timezone, validity window, closure buffer, and an explicit sorted session record for every relevant local date.

Trading sessions require an explicit 09:30 New York open and either 16:00 regular close or approved 13:00 early close. UTC offsets must therefore reflect DST. Weekends and holidays are explicit closed records; weekdays are never inferred. Missing, expired, conflicting, unsigned, wrongly signed, or date-incomplete evidence blocks preflight.

- Premarket and regular-session reads use the latest prior completed trading session.
- During the post-close buffer, the current session is not completed.
- After the closure buffer, the current session becomes the reference session.
- Weekends and holidays use the latest prior explicitly approved trading session.

Historical completed Bars and a current Quote must remain visibly different time authorities in D3. D2 does not construct a market snapshot.

## State and next boundary

Phase 1A remains `MERGED / OFFLINE_AVAILABLE`. Phase 1B remains `NOT_STARTED`; D2 is an offline contract foundation awaiting Owner review. Network, credential access, D3 acquisition, VIX, macro/news, Options, Broker, Paper Trading, Order Execution, persistence, and execution authority remain closed.
