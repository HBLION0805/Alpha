# Phase 1B-D3B Design Owner Review Material

Executive verdict: `READY_FOR_D3B_DESIGN_REVIEW`

Date: 2026-08-02

Branch: `codex/phase1b-d3b-live-readonly-design`

Source baseline and merge-base:
`608d9859bc480bf6bc39afc20f6d928e62544e67`

This material covers design, machine-readable status, authoritative-document
reconciliation, and offline design validation only. It does not implement D3B,
read credentials, call Alpaca, persist business data, grant network authority,
or add Broker, account, position, order, Options, Paper Trading, or automated
execution capability.

## 1. Owner-review correction

| Before | Corrected canonical meaning |
| --- | --- |
| `PROVEN_PER_SYMBOL` | `OBSERVED_PER_SYMBOL`: exact behavior observed only in one future authorized run |
| `PROVEN_GLOBAL` | `OBSERVED_GLOBAL`: exact behavior observed only in one future authorized run |
| Ambiguous response could be over-interpreted | `INCONCLUSIVE`; Provider semantics remain `UNPROVEN` |
| Security, identity, calendar, window, transport, or parsing failure | `BLOCKED`; no qualification authority |

No `PROVEN_PER_SYMBOL` or `PROVEN_GLOBAL` canonical output remains in the D3B
design. Even a future `OBSERVED_*` result requires Owner review and cannot be
treated as a permanent Alpaca contract.

## 2. Exact future request identity

The signed plan contains exactly three ordered requests:

| Ordinal | Ordered symbols | Method and endpoint | Query identity |
| ---: | --- | --- | --- |
| 1 | `MU` | `GET data.alpaca.markets/v2/stocks/bars` | `1Day`, `limit=2`, IEX, raw, ascending |
| 2 | `QQQ` | `GET data.alpaca.markets/v2/stocks/bars` | `1Day`, `limit=2`, IEX, raw, ascending |
| 3 | `MU,QQQ` | `GET data.alpaca.markets/v2/stocks/bars` | `1Day`, `limit=2`, IEX, raw, ascending |

At the HTTP identity layer, only requested-symbol scope differs. Ordinal is a
signed plan sequencing coordinate, not a Provider query difference. All three
requests bind byte-identical UTC start/end, `asOf`, completed reference session,
calendar evidence, mapping registry, Provider/adapter versions, timeout,
response-byte bound, retry ceiling zero, and pagination-follow ceiling zero.

## 3. Classification matrix

| Sanitized observations across all three requests | Conclusion |
| --- | --- |
| Singles each return two; multi returns `MU=2,QQQ=2`; no token; all identities match | `OBSERVED_PER_SYMBOL` |
| Singles each return two; multi returns `MU=1,QQQ=1`; no token; all identities match | `OBSERVED_GLOBAL` |
| `2+0`, missing or unexpected symbol, pagination present, abnormal/ambiguous bounded count | `INCONCLUSIVE` |
| Authorization, credential, HTTP, timeout, parser/validator, request-window, calendar/session, source/identity, or safety failure | `BLOCKED` |

`INCONCLUSIVE` never promotes to `OBSERVED_*`. A positive observation requires
all three strict responses and remains scoped to that exact run.

## 4. Evidence contract

Each future request observation must include:

- request-attempt ID, ordinal, request fingerprint, and response fingerprint;
- exact endpoint, method, feed, adjustment, timeframe, limit, sort, UTC window,
  requested-symbol order, and redacted request fingerprint;
- returned symbol set, raw per-symbol counts, total count, HTTP status, and only
  a boolean indicating pagination-token presence;
- Provider timestamps, received-at, common `asOf`, completed-session/calendar
  ID, version, and fingerprint;
- mapping-registry ID, version, and full-content fingerprint;
- Provider, adapter, schema, protocol, provenance, and response-source versions;
- product-owned attempted/completed lifecycle counts and stable sorted issue
  codes.

The result cannot contain a page-token value, credential, authorization header,
complete raw body, secret-bearing URL, or account information. Callers cannot
inject response source, Transport, Provider authority, verifier, key material,
credential loader, or network counters. Test inputs remain `TEST_INJECTED`,
zero-network structural evidence and cannot produce `REAL_HTTPS` or
`OBSERVED_*`.

The qualification fingerprint binds all three ordered request fingerprints,
all three response fingerprints, the final conclusion, Calendar Evidence,
mapping registry, Provider/adapter/schema/protocol versions, and common
`asOf`. The run ID also binds the authorization ID. Normalized equivalent input
order replays deterministically; a real critical input change changes the
fingerprint or blocks.

## 5. Lifecycle and authority boundary

```text
DESIGN_IN_REVIEW
  -> DESIGN_APPROVED
  -> LIVE_RUN_NOT_AUTHORIZED
  -> LIVE_RUN_AUTHORIZED
  -> RUN_COMPLETED | RUN_BLOCKED
  -> OWNER_REVIEW_REQUIRED
  -> CLOSED
```

Two later Owner approvals remain independent:

1. approve a future implementation task after design review;
2. after independent implementation review, approve one exact, short-lived,
   signed live-run Manifest.

Design approval grants neither implementation nor network authority.
Implementation approval grants no live-run authority. Current state remains:

- D3B: `DESIGN_IN_REVIEW`;
- Network: `NOT_GRANTED` / `CLOSED`;
- credentials: `PROHIBITED`;
- persistence writes: `0`;
- Provider limit semantics: `UNPROVEN`;
- Broker, account, Options, Paper Trading, and Order Execution: `CLOSED`;
- automated execution: `false`.

## 6. Validation evidence

| Validation | Result | Exit code |
| --- | --- | ---: |
| Current Status validator | PASS | 0 |
| Current Status tests | 21/21 passed | 0 |
| D3B design validation | 18/18 passed | 0 |
| TypeScript strict typecheck | PASS | 0 |
| D3A qualification | 20/20 passed | 0 |
| Personal Daily Scan application | 26/26 passed | 0 |
| Owner process commands | 4/4 passed | 0 |
| Markdown links, paths, and fences | PASS | 0 |
| Full `alpha:validate` | 140 components; 2833/2833 passed; 0 failed | 0 |
| Unstaged Git whitespace check | PASS | 0 |
| Staged Git whitespace check | PASS | 0 |

The full bundle also passed Provider/network-code, dependency, credential,
runtime-data, Python-scope, merge-marker, and tracked-file checks. The working
tree warning is expected because this review set is intentionally uncommitted.
Line-ending notices are informational; the whitespace checks passed.

## 7. Files in the review set

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/reviews/PHASE1B_D3B_DESIGN_OWNER_REVIEW.md`
- `docs/specifications/ALPACA_BARS_LIMIT_D3B_LIVE_READONLY_QUALIFICATION_PROTOCOL.md`
- `docs/status/current.json`
- `docs/status/current.schema.json`
- `package.json`
- `scripts/alpha-validate.mjs`
- `scripts/validate-current-status.mjs`
- `scripts/validate-current-status.test.mjs`
- `scripts/validate-d3b-design.test.mjs`

No runtime engine, Transport, integration, credential, market-data, Candidate
Scan, Broker, account, order, Options, Paper Trading, or persistence file is in
the review set.

## 8. Side-effect and scope statement

- Real network requests: `0`.
- Alpaca credential reads or configuration: `0`.
- Business persistence writes: `0`.
- Broker/account/position/order access: `0`.
- Package installations, `npx`, dependency changes, or lockfile changes: `0`.
- Commits, pushes, merges, or pull requests: `0`.
- D3B runtime implementation: not started.
- News/Macro, Options, Event Contract, and later-stage expansion: not started.
- Frozen original worktree, T3B15-C5, and `ALPHA_AUDIT_PACKET.md`: unchanged
  and absent from this worktree.

## 9. Known limitation and stop point

This design does not prove Alpaca limit semantics and does not make live market
data usable. The next permitted action is independent Owner review of this
design material. No implementation or live-run authorization follows
automatically.
