# Robinhood Data Readiness v1

Date: 2026-09-06. Baseline: ef2e554. Owner direction: continue local preparation,
defer paid data, assess the official Robinhood options data route.

## Scope and decision

Official documentation lists options tools but publishes no exact data schemas.
Existing Cboe evidence and replay engines embed source-specific timing and size
semantics. A Robinhood response must never be relabeled as a Cboe file. Build a
separate data-access preparation command, not a quote adapter or trading client.
Do not modify accepted preparations, journals, risk limits or frozen fee inputs.

The deliverable has three operations:

- `--report`: dated public capability facts, Alpha's minimum data requirements,
  missing evidence, and a disabled example Codex MCP configuration.
- `--inspect-tools <JSON>`: inspect a local MCP tools/list result envelope
  `{tools: [...], nextCursor?: string}`. This is an unverified local declaration,
  not an authenticated server discovery. No external schema references are fetched.
- `--probe-public`: one unauthenticated GET to the fixed official endpoint
  `https://agent.robinhood.com/mcp/trading`, checking HTTP reachability/auth response
  only. No MCP initialize, tools/list/call, OAuth, credentials, cookies, account,
  order, onboarding or arbitrary endpoints. An HTTP success cannot mean data ready.

No operation writes a journal or an installed MCP configuration. CLI output may
be saved by the caller beneath ignored runtime storage. Raw response bodies,
headers, descriptions, cursors and arbitrary schema text are not echoed.

## Fixed local tool filter

Only `get_option_chains`, `get_option_instruments`, `get_option_quotes`,
`get_option_historicals`, and `get_equity_quotes` are candidates for a future
authorized market-data connection. All other names, including account reads,
order previews, orders, watchlists, scans and spot crypto, remain excluded.
This is a client tool-name filter. It does not reduce the server's OAuth scopes,
prove tool behavior, enforce GLD/IBIT arguments or authorize any invocation.

The example is stored outside .codex/config.toml, disabled by default, with the
fixed URL, exact enabled_tools and no secrets, auth headers, scopes or account IDs.
It must not be installed or enabled during this delivery. Confirm current Codex
configuration keys against official OpenAI documentation before writing it.

## Local catalog assessment

Use a pure TypeScript engine and a bounded local-file CLI reader. Accept at most
256 tools, unique ASCII identifiers of length 1..128, a root object with tools
and optional nonempty nextCursor (at most 2048 chars), and optional MCP _meta.
Require each tool to have an object inputSchema with type object; outputSchema,
if supplied, also has type object. Other standard descriptor fields may be
present but are never executed or rendered. Validate JSON-compatible plain data,
no getters, symbols or cycles, maximum depth 24, maximum 20,000 nodes and at most
512 KiB serialized UTF-8. Reject malformed annotations; missing readOnlyHint
stays unknown, explicit false is a contradiction for a candidate tool.

Emit only fixed candidate names and missing/present/schema fingerprints,
read-only hint TRUE/FALSE/UNKNOWN, excluded tool count and pagination presence.
Never echo arbitrary tool names, descriptions, schema properties or cursor.
Fingerprints are local change detection, not source identity or semantic proof.
Schema presence is not field compatibility; response samples and timestamp/unit
documentation are still required. Empty or paginated catalogs and missing tools
produce explicit review blockers. No catalog result is called CONNECTED or READY.

All outputs keep executionAllowed false, marketDataConnected false,
accountAccessPerformed false, schemaSemanticsVerified false, actualQuoteReplay
NOT_RUN and winProbability null. Inspection must not change these flags even if
all candidate names and schemas are present.

## Anonymous public probe

Use GET, credentials omit, redirect manual, fixed Accept and User-Agent headers,
and a 12-second total timeout, enforced even when an injected transport or body
cancellation ignores AbortSignal. Do not read response bodies; cancel any body
under the same deadline. Retain numeric HTTP status and only whether a WWW-Authenticate
header is present; never expose its value, cookies, Location or server error text.
401 means AUTHENTICATION_REQUIRED, 403 ACCESS_DENIED, redirects REDIRECT_REFUSED,
2xx ENDPOINT_RESPONDED_SCHEMA_UNVERIFIED, other HTTP statuses HTTP_UNAVAILABLE;
transport/timeouts become NETWORK_UNAVAILABLE without inventing a diagnosis.
Injected transports are for deterministic tests only. Production accepts no
caller URL, headers, bearer variable or retry loop. Keep actual request/finish
clocks and reject invalid/backward clocks. Record no authenticated session.

## Data and connection gaps

Public historical OHLC supports price context only. A sampled option execution
study needs actual option bid/ask, displayed size and size timing, source quote
time and receipt time, linked standard contract terms, underlying bid/ask with
its own clock and explicit temporal alignment/skew policy, completeness/interval
semantics, rights, and costs. Matching receipt times cannot prove synchronization.
Zero size is distinct from missing. Last/mark/OHLC, volume or open interest cannot
fill missing quote sides or displayed size. Prospective capture cannot be
backdated into previously available history. No Robinhood adapter is implemented.

The official connection exposes broad all-account read visibility and may start
Agentic-account onboarding. The Owner has not authorized that authenticated
connection or opening an account. Finish this reviewable preparation first;
any later login must be performed by the Owner through official UI, with the
tool filter reviewed and the actual schemas/capabilities checked before use.

## Validation and ownership

Test invalid/cyclic/deep/oversized input, duplicates, pagination, contradictory
hints, unknown/dangerous tool exclusion, absence of output schemas, determinism,
immutability and no authority escalation. Test fixed request behavior, HTTP/error
classification, timeout, no body/header disclosure and no network in local modes.
Run typecheck, focused tests, aggregate validation and exact old-journal hashes.
Root owns CLI/config/status/integration, delegated agent owns the pure engine
and focused tests, and independent review covers spec, source findings and code.

Spec review completed before implementation: independent reviewer confirmed scope
and required a total deadline including cancellation plus explicit underlying
clock/skew semantics. Both clarifications are incorporated above.
