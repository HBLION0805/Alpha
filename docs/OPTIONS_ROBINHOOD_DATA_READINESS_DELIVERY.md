# Robinhood Data Readiness Delivery

Date: 2026-09-06. Baseline: ef2e554. Scope: GLD/IBIT options data preparation.
The Owner deferred paid data and directed continued local work. This delivery
adds a public capability report, bounded local catalog inspection and an anonymous
endpoint check. It does not connect an account, obtain quotes or run a real-price
trade replay. The reviewed [specification](specifications/OPTIONS_ROBINHOOD_DATA_READINESS_V1.md)
defines the limits; [machine status](status/current.json) records current evidence.

## Official sources and candidate tools

Robinhood's current [tool catalog](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)
documents the five candidates below. These are public descriptions, not observed
response schemas or evidence that Alpha can access the Owner's GLD/IBIT data.

| Fixed candidate | Publicly described capability | Evidence still needed by Alpha |
| --- | --- | --- |
| `get_option_chains` | Option-chain lookup | GLD/IBIT coverage, chain identity and contract linkage |
| `get_option_instruments` | Contract lookup by expiry, strike or type | Exact identifiers, units and standard versus adjusted terms |
| `get_option_quotes` | Real-time option quotes | Actual bid/ask fields, size units/timing, quote clock, freshness and entitlement |
| `get_option_historicals` | Historical option OHLC bars | Historical quote sides and displayed sizes are not established by this description |
| `get_equity_quotes` | Real-time equity quotes | Underlying bid/ask and its source clock, including permitted alignment with option quotes |

The inspected public pages do not establish exact schemas, expired-contract
retention, sampling intervals, historical bid/ask sizes, quote venue/NBBO or cache
semantics, GLD/IBIT entitlements, fees, or a granular market-data-only OAuth scope.
Do not substitute an older launch announcement for the current catalog.

The official [connection and access overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)
identifies `https://agent.robinhood.com/mcp/trading`. It describes read visibility
across the customer's accounts, positions, balances, transactions, watchlists and
scans, and onboarding for a dedicated Agentic account. This delivery performs no
authentication or onboarding. The Owner has not consented to that authenticated
connection or opening an account. Any later login requires a concrete review of
the actual connection scope and the Owner's consent through official UI.

## Commands and output boundaries

```text
npm run options:robinhood-data -- --report
npm run options:robinhood-data -- --inspect-tools <local-tools-list.json>
npm run options:robinhood-data -- --probe-public
```

`--report` is offline. It reports dated capabilities, requirements, unresolved
evidence and the disabled configuration example. `--inspect-tools` is also offline:
it accepts a local MCP `tools/list` result object containing `tools`, with optional
pagination metadata. Local JSON remains an unverified declaration, even if it
contains all five names and schemas.

Inspection limits are 512 KiB, 256 uniquely named tools, depth 24 and 20,000 nodes.
Malformed plain-data/schema/annotation structures fail. External schema references
are never fetched. Output contains only the fixed candidates, presence, schema
fingerprints, read-only hints, excluded count and pagination presence. Missing
read-only hints stay unknown; an explicit false hint is a contradiction. A true
hint is a declaration, not a proof. Descriptions, arbitrary names, properties and
cursors are not rendered or executed. Partial catalogs and missing tools stay
explicitly unresolved; a schema hash establishes local change detection only.

`--probe-public` makes one unauthenticated GET to the fixed official endpoint.
It omits credentials, refuses redirects, reads no response body and applies one
12-second total deadline, including cancellation. It performs no MCP initialization,
tool discovery/invocation, login, account lookup, order preview or order. Output
retains actual request/completion times, numeric HTTP status and whether an
authentication header exists; it omits raw headers, body and server error text.
HTTP 401 means authentication is required, 403 means access denied, redirects are
refused, and even HTTP success means only that the endpoint responded with its
schema unverified. A network failure does not establish why access failed.

No operation writes a journal, installs configuration or changes accepted research
inputs. Across all modes, `executionAllowed`, `marketDataConnected`,
`accountAccessPerformed` and `schemaSemanticsVerified` remain false;
`actualQuoteReplay` remains `NOT_RUN` and `winProbability` remains null.

## Disabled configuration example

The [review-only TOML](../fixtures/options-robinhood-data/codex.disabled.example.toml)
is stored under fixtures, outside installed Codex configuration. It contains the
fixed endpoint, `enabled = false`, and exactly the five candidate `enabled_tools`.
It leaves the user's existing tool-approval settings unchanged. The keys were checked against the
[official OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
No credentials, auth headers, account identifiers or invented OAuth scopes are
included. This file is not installed, enabled or an instruction to authenticate.

The tool-name filter limits what the client exposes. It cannot reduce Robinhood's
server-side authorization, establish that a tool is harmless, enforce GLD/IBIT
arguments, or authorize invocation. Approval prompts cannot replace those controls.
A future adapter needs independent symbol, operation and data-validation rules.

## Compatibility with Alpha's existing research

The following are Alpha requirements derived from its current contracts and
engines, not claims about Robinhood response fields.

| Concern | Existing sampled historical research | Future prospective capture requirement |
| --- | --- | --- |
| Contract identity | GLD/IBIT root, expiry, CALL/PUT, exact strike cents; declared standard 100-share American physical contract | Retain provider contract/underlying IDs and verify their mapping; adjusted contracts cannot inherit standard terms |
| Price units | Integer USD cents per share, with premiums calculated using the multiplier | Document native units; preserve raw precision and reject unsupported fractions rather than silently rounding |
| Option liquidity | Actual quote sides and positive sufficient recorded sizes for assumed fills; unknown and zero remain distinct | Verify bid/ask size units and when each size was observed; volume and open interest cannot replace displayed size |
| Underlying | Historical baseline and entry require underlying bid and ask | Preserve each underlying quote's own source clock and define an explicit maximum skew/freshness policy |
| Clocks | Source interval end, actual import and research recording are separate; selection is retrospective | Preserve source quote clock plus actual request/receipt clocks; receipt does not prove contemporaneous books or historical availability |
| Coverage | Declared 1-15 minute sampling, fresh decision baseline and strictly later entry/exit observations | Retain gaps, corrections and repeated source timestamps; never invent timestamps to force ordering |
| Integrity and use | Exact source-file hash, declared origin/usage, bounded source extraction and import | Preserve actual payload/provenance evidence and usage rights; a canonical response hash is not an original CSV file hash |
| Outcome authority | Counterfactual assumed fills, unresolved positions and unapproved candidate lessons | New observations remain unqualified until source, contract, calendar, costs and execution assumptions are reviewed |

The existing evidence source and adapter are explicitly Cboe DataShop. They embed
Eastern interval-end timing and a Cboe-specific size-timing cutoff; the current
historical engine also declares that source clock. A Robinhood response is therefore
incompatible with this path without a separately specified adapter and source
semantics. Do not manufacture Cboe CSV, relabel provider origin, overwrite
`importedAt`, or backdate prospective captures into previously available history.
OHLC, last and mark prices cannot stand in for missing bid/ask quotes.

Original market qualification still returns `NO_REPLAY`; old paper, review,
historical research and preparation records retain their versioned outputs and
fingerprints. The [previous preparation delivery](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md)
and [dated broker reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md) remain separate
evidence, including the September 4 single-execution fee assumptions. This module
does not update those fees, risk limits or accepted plans.

## Observed public probe

The one production `--probe-public` request ran from
`2026-09-06T23:49:45.521Z` to `2026-09-06T23:49:45.711Z`. It received HTTP 405,
with no `WWW-Authenticate` header. The bounded classification was
`HTTP_UNAVAILABLE` and the CLI exited 3. The server did not allow this GET method;
this observation does not establish an outage, whether credentials would work,
free entitlement, or any tool schema. The body was not read, and no OAuth or
authenticated session was started.

The local report is saved at
`data/runtime/options-robinhood-data/public-probe-2026-09-06.json`, excluded from
Git. Offline capability and empty-catalog fixture reports are saved separately
under the same ignored directory. No authenticated data access or actual quote
replay occurred.

The probe report's SHA-256 is
`83287386fc3e63102a9becb865a9b2067c813fd84f11ef24413c18b25c01e841`.
The offline empty-catalog check reported only local review blockers; it was an
explicit empty fixture, not a downloaded Robinhood catalog. Neither local report
created a connection or appended a trade or preparation record.

## Files changed

- New engine and tests: `src/engines/options-robinhood-data/RobinhoodDataReadinessEngine.ts`
  and `RobinhoodDataReadinessEngine.test.ts` implement local catalog assessment.
- New command and tests: `scripts/options-robinhood-data.mjs` and
  `scripts/options-robinhood-data.test.mjs` provide offline review and the fixed
  anonymous endpoint check. The two files under `fixtures/options-robinhood-data/`
  supply the disabled TOML and an explicitly empty catalog example.
- `.gitignore`, `package.json`, `scripts/alpha-validate.mjs` and
  `src/engines/index.ts` expose the commands, retain runtime outputs locally and
  include validation. No dependency was added.
- `docs/status/current.json`, its schema and `scripts/validate-current-status.mjs`
  plus tests record the new capability without changing historical evidence.
- This delivery, its specification, README, AGENTS, architecture, roadmap,
  handoff, decisions and changelog describe the same scope and remaining gaps.

## Validation evidence

`npm.cmd run alpha:validate` passed with **91 components, 2,429 tests passed,
zero failures, 43,738 ms**. The aggregate includes strict TypeScript checking,
31 catalog-engine tests, 22 command/transport tests and 72 current-status tests.
The initial aggregate also passed, but its counter omitted the new engine's
31 tests because the summary line lacked the established fraction format.
That line was aligned with existing suites and the full aggregate was rerun;
the final observed counters above include those tests. No validator was weakened.

Additional validation commands included `npm run typecheck`,
`node node_modules/tsx/dist/cli.mjs scripts/options-robinhood-data.test.mjs`, and
`node scripts/validate-current-status.test.mjs`. The status command and 72 tests
were rerun after inserting final counters. Python standard-library `tomllib`
also parsed the disabled example and confirmed five tools and unchanged approval
defaults. Git whitespace and runtime exclusion checks passed. Warnings were only
expected uncommitted changes and Windows line-ending notices.

The actual probe's exit 3/HTTP 405 remains a method limitation, not a passed data
connection. Network-free tests cover classifications, withheld body/header/error
text, fixed request scope and both unresponsive-fetch and cancellation deadlines.
Catalog tests cover bounds, pagination, contradictory hints, prototype pollution,
stable fingerprints, redaction, immutability and unchanged access flags.

The following SHA-256 values were checked before and after this delivery:

| Preserved local evidence | SHA-256 |
| --- | --- |
| Paper journal: five closed trades/reviews and four notebook records | `3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b` |
| Historical journal: eight research runs and 15 candidate notebook records | `f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62` |
| Accepted zero-target preparation artifact | `1f5c88db8d4f80a09ce46d47a425af334258dd352d6639ce4b406200054478a8` |

The market import journal remains absent. Six protected historical/status blocks
were compared against baseline `ef2e554` and remain semantically identical. No
real GLD/IBIT data, fill, win rate or account verification is claimed.

## Next milestone

Continue the Owner's no-purchase local preparation. Review actual authorized
catalog/schema and data semantics before designing a separate Robinhood adapter.
Authentication is a later, concrete consent step because the documented connection
has broader account visibility and onboarding implications. If qualified historical
quote sides and sizes are unavailable, evaluate prospective capture separately;
future observations cannot produce an earlier real-price replay. Without suitable
data, preserve the blocked outcome and continue local fixtures. No calibration,
80% win-rate claim, brokerage access or execution follows from this delivery.
