# Phase 1B-D3B Alpaca Bars Limit Live-Readonly Qualification Protocol

Status: `DESIGN_IN_REVIEW`

Protocol version: `phase1b-d3b-live-readonly-qualification:1.0-draft`

Authority: design only. Network, credential, Provider, account, Broker,
Options, Paper Trading, Order Execution, persistence, and automated execution
authority remain closed.

## 1. Purpose and non-goals

D3B defines one future, one-shot, Owner-gated protocol for observing how the
Alpaca historical Bars endpoint applies `limit=2` to single-symbol and
multi-symbol requests. It compares three exact requests over the same approved
completed-session window. It does not assume that `limit` is per-symbol or
global.

The protocol may qualify only the exact Provider/endpoint/feed/request shape
defined here. A conclusion is not a general guarantee about Alpaca, another
feed, another endpoint, another API version, or a later date. Owner review is
required before the conclusion can affect a later acquisition design.

D3B does not build Canonical Bars, a Verified Market Snapshot, Composition,
Candidate Scan, probability, position, order, recommendation, or execution
instruction. It does not implement the five-request / 43-evidence Daily Scan.
News, Macro, VIX, account, balance, position, Buying Power, Broker, Options,
Paper Trading, and orders remain outside this protocol.

## 2. Current authority state

Writing and reviewing this specification places D3B in `DESIGN_IN_REVIEW`.
That state does not authorize implementation or a live run.

- `Network=CLOSED` and `networkAuthority=NOT_GRANTED`.
- Alpaca credentials must not be read.
- No HTTPS request may be attempted.
- `persistenceWrites=0`.
- `automatedExecutionAllowed=false`.
- Provider limit semantics remain `UNPROVEN`.
- D3A fixtures and `TEST_INJECTED` responses are structural test evidence,
  never real Provider evidence.

## 3. Exact future request matrix

All three requests use one signed plan, one signed Exchange Calendar Evidence
artifact, one mapping-registry identity, one `asOf`, one reference completed
trading session, and one exact two-session request window ending at that
reference session. The future date-bound Manifest must replace the placeholders
with literal UTC timestamps before Owner approval. Ordinal and requested-symbol
scope are the only request-specific plan coordinates. At the HTTP request
identity layer, requested-symbol scope is the only field that differs: ordinal
is sequencing metadata owned by the signed plan, not a Provider query
parameter or a difference in the compared request identity. Every other
request parameter must be byte-for-byte identical.

| Ordinal | Symbols, exact order | Capability | Fixed query | Purpose |
| ---: | --- | --- | --- | --- |
| 1 | `MU` | `BARS` | `timeframe=1Day`, `limit=2` | Establish the single-symbol MU observation |
| 2 | `QQQ` | `BARS` | `timeframe=1Day`, `limit=2` | Establish the single-symbol QQQ observation |
| 3 | `MU,QQQ` | `BARS` | `timeframe=1Day`, `limit=2` | Compare multi-symbol behavior with both single-symbol observations |

Every request is additionally fixed to:

- method `GET`;
- host `data.alpaca.markets`;
- path `/v2/stocks/bars`;
- feed `iex`;
- adjustment `raw`;
- sort `asc`;
- currency `USD`;
- the exact signed `start` and `end` UTC timestamps;
- one exact `asOf` and reference completed-session date;
- timeout `10_000` milliseconds;
- maximum response `262_144` bytes per request;
- maximum request attempts `3` for the operation;
- retry count `0`;
- pagination follow count `0`.

The signed Exchange Calendar Evidence must identify the common reference
completed session and the immediately prior completed session needed to obtain
two daily Bars. It binds timezone, regular or early close, DST offset, closure
buffer, producer, policy version, approval, and fingerprint. `start` is bound
to the prior completed session open and `end` to the common reference completed
session close under the approved Provider window convention. All three requests
must use byte-identical `start`, `end`, and `asOf` values. Missing, stale,
conflicting, unsigned, or incomplete calendar evidence blocks before
credentials or dispatch.

The request order is immutable. A fourth request, repeated ordinal, retry,
poll, stream, background task, changed symbol order, changed window, changed
query, or any attempt to follow `next_page_token` is blocked.

## 4. Owner authorization protocol

The future live operation may be composed only as:

```text
product-owned Owner trust root
-> signed Exchange Calendar Evidence
-> exact date-bound three-request Manifest
-> C1 authorization verification
-> immutable D3B plan compilation
-> exact request validation
-> product-owned credential boundary
-> product-owned bounded raw HTTPS Transport
-> strict response validation
-> sanitized qualification result
```

The Manifest must bind:

- protocol and schema versions;
- authorization ID and execute date;
- not-before and expires-at timestamps;
- the exact three ordered requests and all fixed fields from section 3;
- request-attempt ceiling `3`, retry ceiling `0`, pagination ceiling `0`;
- per-request and operation-wide byte ceilings;
- Calendar Evidence ID and fingerprint;
- mapping-registry ID, version, and full-content fingerprint;
- Provider and adapter versions;
- the three redacted request fingerprints and one plan fingerprint;
- the product Owner key selector required by the pinned trust policy.

The Manifest is approved only by its canonical SHA-256 or external Owner
signature through the existing product-owned trust root. Caller-provided
keys, fingerprints, verifiers, Provider authority, Transport, credential
loader, response origin, or lifecycle counters cannot enter the product
operation. Changing any field invalidates the signed hash.

`DESIGN_APPROVED` authorizes neither implementation nor a run. The Owner must
first approve a separate D3B implementation task and independently review its
code and offline tests. Only after that implementation review may the Owner
approve a separate, short-lived, exact Manifest that moves one operation from
`LIVE_RUN_NOT_AUTHORIZED` to `LIVE_RUN_AUTHORIZED`. Absence, expiry, replay,
scope drift, invalid signature, missing trust root, or calendar mismatch keeps
the operation at `LIVE_RUN_NOT_AUTHORIZED` or produces `RUN_BLOCKED` before
credential access when possible.

## 5. Contract and interface draft

The following shapes are design references. Phase D3B design does not add
TypeScript contracts or exports.

```ts
type D3BQualificationConclusion =
  | "OBSERVED_PER_SYMBOL"
  | "OBSERVED_GLOBAL"
  | "INCONCLUSIVE"
  | "BLOCKED";

type D3BLifecycleState =
  | "DESIGN_IN_REVIEW"
  | "DESIGN_APPROVED"
  | "LIVE_RUN_NOT_AUTHORIZED"
  | "LIVE_RUN_AUTHORIZED"
  | "RUN_COMPLETED"
  | "RUN_BLOCKED"
  | "OWNER_REVIEW_REQUIRED"
  | "CLOSED";

interface D3BQualificationRequestDescriptor {
  readonly ordinal: 1 | 2 | 3;
  readonly method: "GET";
  readonly host: "data.alpaca.markets";
  readonly path: "/v2/stocks/bars";
  readonly symbols: readonly ["MU"] | readonly ["QQQ"] |
    readonly ["MU", "QQQ"];
  readonly timeframe: "1Day";
  readonly start: string;
  readonly end: string;
  readonly asOf: string;
  readonly referenceSessionDate: string;
  readonly limit: 2;
  readonly feed: "iex";
  readonly adjustment: "raw";
  readonly sort: "asc";
  readonly currency: "USD";
  readonly timeoutMs: 10_000;
  readonly maximumResponseBytes: 262_144;
  readonly retryLimit: 0;
  readonly paginationFollowLimit: 0;
  readonly calendarEvidenceFingerprint: string;
  readonly calendarEvidenceId: string;
  readonly calendarEvidenceVersion: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly providerVersion: string;
  readonly adapterVersion: string;
  readonly redactedRequestFingerprint: string;
}

interface D3BRequestObservation {
  readonly requestAttemptId: string;
  readonly requestOrdinal: 1 | 2 | 3;
  readonly requestFingerprint: string;
  readonly responseFingerprint: string;
  readonly attemptedNetworkRequests: 0 | 1;
  readonly completedNetworkRequests: 0 | 1;
  readonly httpStatus: number | null;
  readonly endpoint: "/v2/stocks/bars";
  readonly method: "GET";
  readonly feed: "iex";
  readonly adjustment: "raw";
  readonly timeframe: "1Day";
  readonly limit: 2;
  readonly sort: "asc";
  readonly requestedSymbols: readonly string[];
  readonly actualObservedBarsBySymbol: Readonly<Record<string, number>>;
  readonly totalObservedBars: number;
  readonly responseSymbols: readonly string[];
  readonly paginationTokenPresent: boolean;
  readonly requestWindow: Readonly<{ start: string; end: string }>;
  readonly providerTimestamps: readonly string[];
  readonly receivedAt: string;
  readonly asOf: string;
  readonly redactedRequestFingerprint: string;
  readonly calendarEvidenceId: string;
  readonly calendarEvidenceVersion: string;
  readonly calendarEvidenceFingerprint: string;
  readonly provenance: Readonly<{
    provider: "ALPACA";
    endpoint: "/v2/stocks/bars";
    feed: "iex";
    responseOrigin: "REAL_HTTPS";
  }>;
  readonly providerVersion: string;
  readonly adapterVersion: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly schemaVersion: string;
  readonly issueCodes: readonly string[];
}

interface D3BQualificationResult {
  readonly protocolVersion: string;
  readonly designFingerprint: string;
  readonly qualificationFingerprint: string;
  readonly runId: string;
  readonly state: "RUN_COMPLETED" | "RUN_BLOCKED";
  readonly conclusion: D3BQualificationConclusion;
  readonly observations: readonly D3BRequestObservation[];
  readonly attemptedNetworkRequests: 0 | 1 | 2 | 3;
  readonly completedNetworkRequests: 0 | 1 | 2 | 3;
  readonly providerLimitSemanticsBeforeRun: "UNPROVEN";
  readonly persistenceWrites: 0;
  readonly automatedExecutionAllowed: false;
  readonly issueCodes: readonly string[];
}
```

The product owns `requestAttemptId`, counters, response source, fingerprints,
provenance, and stable issue-code sorting. Business callers cannot populate or
override them. The result must not contain credentials, authorization headers,
the page token value, the complete raw response, account information, or a URL
containing secret query material.

`qualificationFingerprint` binds the canonical ordered tuple of all three
request fingerprints, all three response fingerprints, the Calendar Evidence
identity, mapping-registry identity, Provider/adapter/schema/protocol versions,
the common `asOf`, and the final conclusion. `runId` additionally binds the
authorization ID and qualification fingerprint. Reordering JSON object members,
response-map members, or raw response rows that normalize to the same strict
chronological evidence does not change the deterministic result. Changing the
approved request-symbol order, window, session, `asOf`, feed, adjustment,
Provider/adapter version, Calendar Evidence, mapping registry, any response
fingerprint, or conclusion must change the relevant fingerprint or block the
run.

Each redacted request fingerprint binds the exact HTTP identity—method, host,
path, ordered symbol scope, timeframe, start/end, feed, adjustment, sort,
limit, currency, timeout, response-byte bound, Calendar Evidence, mapping
registry, and Provider/adapter versions—but not the ordinal. The signed plan
fingerprint separately binds the ordered `(ordinal, requestFingerprint)` tuple,
so ordinal replay, duplication, or exchange is still rejected without making
ordinal look like a Provider query difference.

## 6. Raw response and lifecycle rules

The Transport may return only bounded raw bytes, HTTP status, allow-listed
headers, `startedAt`, and `endedAt`. It cannot create an observation or a
qualification conclusion.

- A preflight, calendar, trust-root, Manifest, credential-availability, or
  exact-request validation failure is `attempted=0`, `completed=0`.
- Dispatch start increments the relevant attempt and operation attempt count.
- Timeout, connection failure, HTTP failure, oversized response, invalid JSON,
  invalid schema, pagination, symbol, count, chronology, or window failure
  cannot be reset to zero or hidden.
- A request is `completed=1` only after a bounded successful HTTP response has
  been received and parsed into the strict diagnostic envelope. Pagination,
  missing/extra symbols, and ambiguous counts can therefore be a completed
  request with an `INCONCLUSIVE` operation conclusion. Timeout, connection,
  HTTP, byte-limit, parser, request-identity, window, Calendar Evidence, or
  response-source failures remain incomplete and `BLOCKED`.
- A blocked operation emits no partial Provider qualification. It may retain
  only the sanitized facts listed in section 5.

`paginationTokenPresent` records only presence. The token value is discarded
before result construction and must never be logged or persisted. The protocol
does not issue a second-page request.

## 7. Qualification decision table

All three requests must use the same approved endpoint, method, feed,
adjustment, timeframe, limit, sort, UTC window, `asOf`, reference completed
session, Calendar Evidence, mapping registry, and Provider/adapter versions.
Only ordinal and requested-symbol scope may differ. A positive observation is
possible only when all three strict request identities match and no pagination
or response ambiguity exists.

| Exact observations | Conclusion | Authority effect |
| --- | --- | --- |
| MU single returns `MU=2`; QQQ single returns `QQQ=2`; multi returns `MU=2,QQQ=2`, total four; no token; all fixed identities match | `OBSERVED_PER_SYMBOL` | One exact-run observation only; Owner review still required |
| MU single returns `MU=2`; QQQ single returns `QQQ=2`; multi returns `MU=1,QQQ=1`, total two; no token; all fixed identities match | `OBSERVED_GLOBAL` | One exact-run observation only; Owner review still required |
| Multi returns total two as `2+0`; a requested symbol is missing; a token is present; a symbol is unexpected; a returned count is abnormal; or a valid bounded response cannot uniquely distinguish the hypotheses | `INCONCLUSIVE` | Fail closed; Provider semantics remain `UNPROVEN` |
| Authorization, credential, HTTP, timeout, parser/validator, request-window, completed-session/Calendar Evidence, response identity/source, lifecycle, or other safety gate fails | `BLOCKED` | Fail closed; no semantics authority |

A multi-symbol response that omits either symbol is `INCONCLUSIVE`, even if its
total count appears consistent with a global limit. Partial output cannot
establish global semantics. A pagination token is always `INCONCLUSIVE`, never
evidence for either hypothesis, and page two is never requested. An
`OBSERVED_*` result is limited to this exact authorized run and is not effective
for later design until the Owner reviews the sanitized report and closes the
run. Provider limit semantics remains `UNPROVEN` until that future run and
Owner review occur; even then, the observation is not a permanent Alpaca
contract guarantee.

## 8. State machine

```text
DESIGN_IN_REVIEW
  -> DESIGN_APPROVED
  -> LIVE_RUN_NOT_AUTHORIZED
  -> LIVE_RUN_AUTHORIZED
  -> RUN_COMPLETED | RUN_BLOCKED
  -> OWNER_REVIEW_REQUIRED
  -> CLOSED
```

Rules:

1. Only the Owner may approve design, separately authorize implementation,
   separately authorize the exact run, accept the sanitized outcome, or close
   the protocol.
2. `DESIGN_APPROVED` always transitions to `LIVE_RUN_NOT_AUTHORIZED`; it does
   not imply implementation, credentials, or network permission. An approved
   implementation also remains `LIVE_RUN_NOT_AUTHORIZED` until a second,
   date-bound network approval is verified.
3. `LIVE_RUN_AUTHORIZED` exists only for one unexpired signed Manifest and one
   foreground process. It cannot be reused, retried, resumed, scheduled, or
   broadened.
4. Any pre-dispatch authorization failure remains non-authorized. Any failure
   after a permitted dispatch produces `RUN_BLOCKED` with truthful lifecycle
   counts.
5. `RUN_COMPLETED` and `RUN_BLOCKED` both require
   `OWNER_REVIEW_REQUIRED`; neither automatically changes Provider authority.
6. `CLOSED` records the Owner's reviewed conclusion and permanently consumes
   the one-shot authorization. A later observation requires a new protocol
   version or newly approved run under an explicitly permitted repeat policy.
7. No transition changes Broker, account, trading, persistence, or execution
   authority.

The current repository state after drafting this document is
`DESIGN_IN_REVIEW`; Network remains `CLOSED`.

## 9. Stable issue-code draft

At minimum, the future implementation must produce deterministic, deduplicated,
lexicographically sorted codes for:

- `OWNER_NETWORK_AUTHORIZATION_REQUIRED`
- `OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE`
- `D3B_MANIFEST_INVALID`
- `D3B_MANIFEST_EXPIRED`
- `D3B_CALENDAR_EVIDENCE_INVALID`
- `D3B_REQUEST_PLAN_MISMATCH`
- `D3B_REQUEST_COUNT_EXCEEDED`
- `D3B_RETRY_PROHIBITED`
- `D3B_PAGINATION_PRESENT`
- `D3B_HTTP_FAILURE`
- `D3B_TIMEOUT`
- `D3B_RESPONSE_BYTES_EXCEEDED`
- `D3B_RESPONSE_PARSE_FAILED`
- `D3B_RESPONSE_SYMBOL_MISSING`
- `D3B_RESPONSE_SYMBOL_UNEXPECTED`
- `D3B_RESPONSE_BAR_COUNT_INVALID`
- `D3B_RESPONSE_WINDOW_MISMATCH`
- `D3B_RESPONSE_PROVENANCE_INVALID`
- `D3B_REDACTION_BOUNDARY_VIOLATION`

Exact codes and ownership must be reviewed before implementation. The design
does not add them to product contracts.

## 10. Threat model

| Threat | Required defense | Failure state |
| --- | --- | --- |
| Caller substitutes a verifier, key, fingerprint, Provider authority, Transport, credential loader, origin, or counter | No-argument product composition; pinned trust root; closed capability | `BLOCKED`, `0/0` before dispatch |
| Manifest field or query mutates after approval | JCS hash/signature and exact plan/request fingerprint validation | `BLOCKED`, no credential read |
| Authorization is replayed or used after expiry | Process-local single-use authorization ID plus date/time gate | `BLOCKED` |
| Fourth request, retry, background call, stream, poll, or page follow is attempted | Dispatcher-owned ordinal ledger and hard ceilings | `BLOCKED`; truthful counts retained |
| Provider returns a token | Record presence only; discard value; never request page two | `INCONCLUSIVE` |
| Provider returns a missing/unknown symbol or ambiguous valid count | Preserve sanitized count/set facts without promotion | `INCONCLUSIVE` |
| Provider returns future, duplicate, stale, invalid, or out-of-window Bars | Strict response and completed-window validation | `BLOCKED` |
| Raw response, secret, token, or account data escapes | Allow-listed sanitized result and log schema; redaction tests | `BLOCKED` |
| Fixture claims real Provider proof | Test factory restricted to `TEST_INJECTED`, zero lifecycle counts, no product export | `BLOCKED` |
| Partial observations are promoted | Three-request atomic qualification rule and Owner review gate | `INCONCLUSIVE` or `BLOCKED`, never `OBSERVED_*` |
| A one-run observation silently unlocks Daily Scan | Separate Owner-reviewed design and explicit authority transition required | Network and acquisition remain closed |

## 11. Test matrix for a future implementation

| Test | Expected result |
| --- | --- |
| Single requests return two Bars; multi returns two per symbol, total four | `OBSERVED_PER_SYMBOL`, then `OWNER_REVIEW_REQUIRED` |
| Single requests return two Bars; multi returns one per symbol, total two | `OBSERVED_GLOBAL`, then `OWNER_REVIEW_REQUIRED` |
| Multi returns total two as `2+0` | `INCONCLUSIVE`; no global observation |
| Multi response contains non-empty page token | `INCONCLUSIVE`; boolean retained; token value absent; no page-two request |
| One expected symbol has zero Bars or is absent | `INCONCLUSIVE`; no partial semantic conclusion |
| Extra or unknown symbol appears | `INCONCLUSIVE` |
| Returned total or per-symbol distribution is not an exact positive pattern | `INCONCLUSIVE` |
| Response is truncated or schema-incomplete | `BLOCKED` |
| HTTP error, timeout, invalid JSON | `BLOCKED`; attempted/completed counts match lifecycle |
| Response Bar lies outside the exact window | `BLOCKED` |
| The three request windows, feeds, adjustments, timeframes, limits, sorts, sessions, `asOf`, calendar, mapping, or Provider/adapter versions differ | `BLOCKED` |
| Operation is invoked outside `LIVE_RUN_AUTHORIZED` | Pre-network `BLOCKED`, `0/0` |
| Dispatcher receives a fourth request | `BLOCKED`; no fourth dispatch |
| Retry limit is non-zero or a retry is attempted | Pre-network `BLOCKED` or post-attempt block with truthful count |
| Result/log contains page-token value, credential, authorization header, or raw body | Redaction test fails closed |
| Preflight, timeout, HTTP, parse, pagination, and success paths | Exact attempted/completed counts |
| Identical signed inputs and sanitized responses are replayed in a deterministic test | Same run ID, fingerprints, issue-code order, and conclusion |
| JSON member order, response map order, or equivalent normalized row input changes | Same deterministic result and fingerprint |
| Request field, approved symbol order, window, calendar, mapping, Provider/adapter version, response fingerprint, or conclusion changes | Different run/design/qualification fingerprint or authorization rejection |
| Test-injected response claims `REAL_HTTPS` or `OBSERVED_*` | Rejected; zero network counts; `UNPROVEN` |
| Design state is changed to `DESIGN_APPROVED` without a separate implementation approval | Network remains closed; no implementation authority |
| A future implementation is approved without a separate exact live Manifest | `LIVE_RUN_NOT_AUTHORIZED`; zero network |

All failure tests must also assert `persistenceWrites=0`,
`automatedExecutionAllowed=false`, no candidates, no account/Broker/order
access, no partial Provider conclusion, and stable issue-code ordering.

## 12. Acceptance criteria

Design review may pass only if:

1. The exact three-request comparison and fixed bounds are unambiguous.
2. No conclusion presupposes per-symbol or global semantics.
3. Product composition, Owner authorization, calendar evidence, credential
   timing, request validation, Transport, response validation, and result
   redaction have distinct ownership.
4. Every `OBSERVED_*` conclusion requires all three strict responses and later
   Owner review.
5. Pagination, retry, request expansion, persistence, background work, and
   account/trading access are prohibited.
6. Attempted/completed counts cannot be supplied by the caller or fixture.
7. The output preserves bounded diagnostic facts without token, raw response,
   credential, or account leakage.
8. Current machine state remains `DESIGN_IN_REVIEW`, Network remains closed,
   and no implementation or live authorization is implied.

Implementation acceptance is explicitly out of scope for this task. It will
require a separate Owner-approved task, code review, offline tests, and status
review before any live-run authorization can be requested.

## 13. Estimated future implementation file scope

This list is a forecast, not authorization to modify the files:

- `src/contracts/AlpacaBarsLimitQualification.ts` or a new dedicated D3B
  contract with no broadening of existing product exports;
- a dedicated D3B deterministic plan/result engine under
  `src/engines/personal-daily-scan/`;
- a product-owned D3B composition root and isolated test-only Transport factory;
- focused D3B authorization, lifecycle, response, redaction, and process tests;
- one Owner command that defaults to zero-network plan display;
- `package.json` and `scripts/alpha-validate.mjs` only to register approved
  local commands/tests;
- current status, schema, validator/tests, README, Roadmap, Handoff,
  Architecture, Changelog, and Decisions as required by the approved slice.

No dependency or lockfile change is expected. A future implementation must
stop if existing Alpaca interfaces cannot express the exact bounds without
over-read, retry, or pagination.

## 14. Rollback and abort plan

Before a live dispatch, rollback is simply revocation or expiry of the one-shot
Manifest; Network remains closed and no credential is read. During a future
authorized foreground run, the operation may stop only between requests. It
must never cancel and pretend an already dispatched request did not occur.
Truthful attempted/completed counts and a sanitized `RUN_BLOCKED` result are
returned for Owner review.

Because this design permits no persistence, background process, account
mutation, or order, there is no capital-state rollback. Removing a future D3B
product entry and reverting its code leaves D3A and the offline Daily Scan
unchanged. Any Provider conclusion remains non-authoritative until explicitly
accepted by the Owner and recorded through a later approved status change.

## 15. Explicit stop point

After this specification and design-state reconciliation are validated, work
stops for independent Owner review. No HTTPS Transport implementation,
credential read, network request, commit, push, PR, D3B implementation,
News/Macro work, Options work, or trading capability is authorized.
