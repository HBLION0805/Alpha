# Exact metadata query and remaining CONTRACT boundary

October 14, 2026 UTC. Development code is `a7f830b`; this follow-up is offline
documentation only. No new source request, account write, Paper start or deployment.

## Delivered result

One corrected code-mode invocation returned the original two SPY October 16
778/779 call UUIDs. Actual `functions.exec` code matches the saved wrapper, and
the runtime records one nested `get_option_instruments` dispatch and return.
Complete MCP text and structured responses agree. This establishes this exact
query's success, not acceptance of the full quote/Paper pipeline.

Private originals remain under
`data/runtime/options-workbench-development/contract-exact-metadata-20261014-01/metadata-two-exact-ids-code-mode-once`.
Its final manifest verifies 18/18 files. Response envelope SHA256:
`3203cdabfe16516ecc8c67c35557ccff4cdb79350b5ccecdf8097f9fb6293041`.
Both earlier failed attempts and the original stopped preflight remain unchanged.

## Clock diagnosis: no receipt-mapping repair needed

The existing validator is
[`inspectContractSourceBinding`](../scripts/lib/options-contract-source-binding.mjs).
It parses assessment time, `review.at`, then `window.from` and `window.through`.
The saved preview first fails on **`window.from = null`**, returning
`UNKNOWN / CONTRACT_SOURCE_CLOCK`, before reviewing source semantics.

| Clock | Saved value / meaning |
| --- | --- |
| Host process start / end | 23:36:56.648Z / 23:37:09.631Z on October 14 |
| Wrapper request / runtime dispatch | 23:37:05.641Z / 23:37:05.643089Z |
| Complete tool return | 23:37:05.807Z |
| `originals[0].observedAt` / `receivedAt` | Both 23:37:05.807Z, the local complete-return boundary; correctly copied |
| `review.at` / assessment | 23:38:52.169Z; review verdict remains UNKNOWN |
| `window.from` / `window.through` | Null: no prospective admission window was established |
| `originals[0].applicableFrom` / `applicableThrough` | Null: current deliverable applicability interval is unsupported |
| Source publication / update | Not returned; publication remains null, which the validator permits |
| Expiry / `sellout_datetime` | October 16 / October 16 19:45Z; expiry and broker closeout timing, not evidence validity or source-update clocks |

Required clocks must be valid UTC instants. The constraints are observation <=
receipt <= review <= assessment, review <= window start < window end, assessment
<= window end, and each original's applicability interval must cover that window.
If publication exists it must not follow receipt; null publication is allowed.
The current intake also requires the window to end before expiry-date midnight.
There is no metadata quote-freshness threshold or mandatory provider `updated_at`
in this check. Do not replace missing applicability with acquisition time, expiry,
broker closeout, another tool's quote clock, or an invented TTL.

Offline field checks confirm both copied receipt clocks parse successfully; the
two window fields and two applicability fields are absent. The preview's early
clock rejection is not a complete semantic-gate test. Separately, the actual
response has no deliverable basket, share quantity, settlement/currency, current
class, or exercise style. These remain independent evidence gaps.

## Saved interface capability

The saved catalog was captured at October 14 23:19:44.140Z, SHA256
`991b501373308f82fcd75fe9229b7a19893caabb281b7af4ec355dc1eb7ecb92`.
Relevant output objects use `additionalProperties: false`.

| Tool / output path | What it establishes; what it does not |
| --- | --- |
| `get_option_chains.data.chains[]` | `cash_component`, `trade_value_multiplier`, `underlying_instruments` containing instrument/symbol, and `settle_on_open`; no share quantity, complete basket or current contract class. AM/PM timing is not physical/cash settlement. |
| `get_option_instruments.data.instruments[]` | Exact identity, state, tradability and price rules; multiplier is monetary, not share quantity. No current deliverable/class fields. |
| `get_equity_quotes.data.results[]` | Equity quote/close values and clocks; no option deliverable evidence. |
| `get_option_quotes.data.results[]` | Option quote/close, Greeks and activity; `adjusted_mark_price` is not adjustment/deliverable applicability evidence. |

The successful response agrees with this capability boundary. This is a finding
about the saved MCP interfaces, not every possible provider service.

## Handoff: external evidence, not more UNKNOWN-handling code

No Alpha clock-mapping defect was found; no implementation change is warranted.
The minimum further market-request plan for these four tools is **zero**: another
instruments/chain/quote request cannot be justified as supplying fields their
saved schemas do not expose.

Use an existing saved original if it proves either the exact current series
deliverable or a current series-to-class mapping plus the corresponding class
rule. It must bind the same UUID or genuinely returned series identifier/full
tuple, establish the supported 100-SPY-share physical USD basket, and support its
applicability interval. Retain the existing SPY American product-rule review;
it supplies exercise style only. A bespoke certificate or proof of never having
been adjusted is not required.

If that evidence is absent, identify the specific official original and scope
before any new acquisition. No login, account tool or permission expansion follows
from this result. The existing intake supports original JSON and the bounded
saved SPY text rule; PDF/image or arbitrary prose cannot be relabeled as provider
JSON. A different representation would need its own bounded, reviewed adapter
decision. A documented applicability interval and prospective decision window
must then precede the existing zero-write `--preview`; never invent PASS or TTL.

No usable CONTRACT was created. Original accounts/preflight, historical clocks,
American-rule review, schedules and cancelled CPI workflow remain unchanged.
Private supporting audit: `contract-clock-boundary-audit.json` alongside the
query directory. This document contains no raw provider response or credentials.
