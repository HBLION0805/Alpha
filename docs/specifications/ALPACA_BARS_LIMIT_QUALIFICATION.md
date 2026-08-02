# Alpaca Bars Limit Qualification Slice

Status: `MERGED_OFFLINE_ONLY; POST_MERGE_CORRECTION_OWNER_REVIEW_REQUIRED`

Schema: `1.1`

Policy: `phase1b-d3a-correction:1.0`

## Purpose

Phase 1B-D3A is a single-Owner, read-only qualification slice. It exists only
to observe, after a future separate Owner authorization, how Alpaca applies
`limit=2` to a multi-symbol Bars request. It is not the five-request Daily Scan,
does not build Canonical evidence, and cannot produce candidates, probabilities,
positions, orders, or execution instructions.

The exact future request is:

| Field | Authorized value |
| --- | --- |
| Method | `GET` |
| Host | `data.alpaca.markets` |
| Path | `/v2/stocks/bars` |
| Symbols | `MU,QQQ` in that order |
| Timeframe | `1Day` |
| Limit | `2` |
| Feed | `iex` |
| Adjustment | `raw` |
| Sort | `asc` |
| Currency | `USD` |
| Requests | exactly one |
| Retry / pagination | forbidden |
| Timeout | 10,000 ms |
| Maximum response | 1,048,576 bytes |

`start` is the prior approved trading session open and `end` is the approved
reference session close. The signed request additionally binds ordinal,
calendar fingerprint, mapping-registry ID/version/full-content fingerprint,
request fingerprint, and plan fingerprint.

## Authority and composition

The product entry has no arguments for a verifier, public key, fingerprint,
Provider authority, credential loader, or Transport. Its only path is:

```text
product-owned trust root and signed Calendar
-> exact signed one-request Owner Manifest
-> specialized C1 preflight verifier
-> exact request validator
-> product-owned raw HTTPS Transport
-> strict bounded response validator
-> sanitized qualification result
```

The product currently has no configured trust root and no signed one-shot
Manifest. It therefore returns `OWNER_NETWORK_AUTHORIZATION_REQUIRED` when the
Manifest is absent, or `OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE` when
the product trust root is absent, before credential access or network dispatch.
The isolated test factory can inject a Transport, but it is absent from every
product barrel and can emit only `TEST_INJECTED` with zero network lifecycle
counts. It cannot accept the product Transport capability or prove Provider
semantics. The product factory has no caller arguments and constructs its
verifier and raw Transport inside the fixed composition root.

## Raw boundary and lifecycle

The Transport may return only HTTP status, allow-listed headers, bounded raw
bytes, `startedAt`, and `endedAt`. It cannot return Canonical Bars or
`EvidenceResolution`. Credential preparation occurs only after authorization
and before a dispatch attempt. A preflight or credential failure is `0/0`.
Dispatch start is `attempted=1`; `completed=1` occurs only after the entire raw
response passes HTTP, byte, JSON, pagination, symbol, count, chronology, field,
and window validation. Timeout, HTTP failure, invalid JSON, excess bytes, or
invalid market data remain `1/0` for the real product Transport. Fixture and
test-injected paths always report `0/0` and zero network requests. A signed Manifest is process-locally
single-use; retry and a second dispatch are rejected.

The response must contain exactly `MU` and `QQQ`, exactly two ordered valid Bars
for each symbol, and an empty page token. No extra symbol or data is silently
discarded. A blocked result retains only sanitized actual per-symbol counts,
the sorted response-symbol set, and a boolean pagination-presence flag; it
never retains the token or raw payload. Test
responses always leave `providerLimitSemantics=UNPROVEN`. A future single real
observation may be reported as `OBSERVED_ONCE_NOT_PROVEN`; it is not sufficient
to authorize the full five-request / 43-evidence plan.

## Permanent boundaries

- No network request has been authorized or executed by D3A.
- No reusable authorization, private key, or credential is stored.
- No retry, pagination, polling, streaming, background task, or persistence.
- No account, balance, position, Broker, Paper Trading, Options, order, or
  automatic execution authority.
- `persistenceWrites=0`, `automatedExecutionAllowed=false`, and `candidates=[]`.
- D2-C3, full D3 acquisition, News/Macro, and the five-request Daily Scan remain
  separate, not-started work.
