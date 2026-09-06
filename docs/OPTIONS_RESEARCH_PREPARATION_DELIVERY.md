# GLD/IBIT Research Preparation Delivery

Date: 2026-09-06. Baseline: `684a2625c0142fdb68472ff32ff49a44cc0e6922`.
[Specification](specifications/OPTIONS_RESEARCH_INPUT_PREPARATION_V1.md).

## What changed and why

The first actual-price run still needs entitled observations. This delivery
removes two preparation errors: separately supplied CSV/manifest/config files
could disagree, and arbitrary fee assumptions could be mistaken for Robinhood
charges. A new preflight links the supplied inputs and optionally preserves an
immutable preparation record. A separate dated fee calculator applies reviewed
public schedule arithmetic without rewriting existing replay assumptions.

`scripts/options-research-preflight.mjs` checks the extraction manifest, original
selection, child bytes and hash, counts, metadata, dataset ID, chosen contract,
Eastern session, source usage and required replay assumptions. Its saved record
keeps lineage and complete candidate evidence. The parent's hash is retained
from the extractor manifest; the parent file is not reread or authenticated.
`INPUTS_LINKED_FOR_RESEARCH` means that declared inputs agree, not that the source,
contract, fees, liquidity, affordability or trading strategy is verified.

Actual extraction/preparation clocks remain separate from historical timestamps.
Identical saved repeats retain their original preparation time; changed inputs,
corrupt output or changed child bytes cannot silently replace a record. All
existing market, historical-replay and paper journal formats/results are unchanged.
Preflight makes no trade and appends none of those journals.

## Commands

```text
npm run options:research-preflight -- --manifest <manifest.json> --metadata <metadata.json> --config <config.json>
npm run options:research-preflight -- --manifest <manifest.json> --metadata <metadata.json> --config <config.json> --save
npm run options:broker-reference -- --reference
npm run options:broker-reference -- --fees fixtures/options-broker-reference/buy.example.json
npm run options:broker-reference -- --fees fixtures/options-broker-reference/sell.example.json
```

Manifest input must be inside this workspace's ignored historical-replay extracts
directory. Metadata and config use the existing formats. Preparation reads are
bounded; saved preparation JSON is limited to 16 MiB and published exclusively at
`data/runtime/options-historical-replay/preparations/<SHA256-of-runId>.json`.
Neither no-save nor save mode imports data or runs a simulation. The next manual
import and replay steps remain explicit and subject to their existing checks.

## Dated broker findings

The [reference report](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md) records the official
sources and distinctions between public rules and actual account eligibility.

- The September 4, 2026 fee estimate covers a modeled single execution of ordinary
  nonprofessional GLD/IBIT long options. It uses integer/rational arithmetic for
  the combined ORF/OCC fee, SEC sale charge, TAF and CAT, preserving each published
  rounding rule. Other dates, fragmented executions or unknown customer status
  return BLOCKED with no fee estimate. Spread and slippage are additional costs.
- For one contract at the illustrative amounts in the examples, the opening fee
  estimate is USD 0.04 and the closing estimate USD 0.05. This is USD 0.09 total,
  not a broker-confirmed bill or a guaranteed exit charge. SEC varies with actual
  sale proceeds; the existing replay's fixed fees are never auto-replaced.
- Dated Nasdaq evidence supports scheduled 09:30-16:15 ET hours for both GLD and
  IBIT on September 4. Official reference data lists both in the penny program.
  Contract adjustments, expiry exceptions, halts and broker eligibility still
  require checking. September 4 T+1 settlement is derived as September 8 after
  Labor Day; this reference does not credit any account cash.
- Robinhood documents a June 4, 2026 transition away from its former PDT rules.
  Account type, options approval and settled funds remain unknown. Public order
  documentation also differs from the sampled bid-trigger model and contains a
  market-order time inconsistency. No native stop/target/OCO workflow is certified.

## Source acquisition and new alternative

No GLD/IBIT price path has been acquired. Existing free Cboe samples still contain
only other symbols. The newly downloaded Cboe September 4 penny-reference CSV
confirms tick-program membership; it is not an option quote file. It is 19,656
bytes, SHA-256 `0dec1fca5ee68599a833b1dd3f0ff21a6b13b857534f119604782aa681bb5458`.

The Cboe product page was configured through its public browser form for GLD and
IBIT, September 4, one-minute basic historical quotes without calculations or
open interest, grouped per day. It displayed USD 48. An attempt to add this item
to the cart was rejected by automatic approval review: creating paid purchase
state was outside the recorded development authorization. Nothing was added,
purchased or paid. The Owner subsequently chose to defer paid data and continue
local preparation. No further cart or checkout action is authorized by that
answer. A displayed subtotal is not an invoice.

There is also a newly verified public source route: Robinhood's official Trading
MCP documentation lists option chains, instruments, live quotes and historical
OHLC bars. It is not connected here. The public description does not establish
historical bid/ask sizes, retention, schemas or specific entitlements, so it does
not yet satisfy the sampled replay input contract. Authentication exposes a
broader account scope and requires separate explicit connection authorization.
Its order tools are outside Alpha's current scope. Review its read-only market
data capabilities before assuming a paid Cboe file is the only possible route.
[Official tool list](https://robinhood.com/us/en/support/articles/trading-with-your-agent/),
[connection and scope](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).

The available tool inventory contains no connected Robinhood market-data tools.
The plugin-management skill was checked, but its catalog search/suggestion tools
are not exposed in this session. Recommended plugin names are not evidence of
installed tools, market entitlements or authenticated access.

## Files and verification

- New preflight command/tests and a validation-only export from the existing
  extractor link inputs and preserve preparation artifacts.
- New `src/engines/options-broker-reference/OptionsBrokerFeeEngine.ts` and tests,
  broker-reference command/tests and two examples provide dated fee research.
- Package commands, engine exports and aggregate registrations expose the work.
- Specification, public broker references, status/schema/validator and current
  project documents state the same implementation and access boundaries.

`npm.cmd run alpha:validate` passed: 89 components, 2,369 tests passed, zero
failures, 41,060 ms. This includes strict typechecking, 29 fee-engine tests,
29 preflight tests, six broker-reference CLI tests and 65 current-status tests.
Warnings were the expected uncommitted work and Windows line-ending notices.
Historical validation counts remain labeled as historical evidence. No real-market
win rate or successful quote replay is claimed.

The actual public-sample preflight was run twice in separate CLI processes with
`--save`. The first returned `saved: true, changed: true`; the second returned
`saved: true, changed: false`, retaining `2026-09-06T23:34:11.209Z` and exactly the
same artifact bytes. The ignored preparation artifact is
`data/runtime/options-historical-replay/preparations/f1a45bb2168775c446761a4a33cb88b5cd841227c29354d16106e7f358ae7b67.json`,
SHA-256 `1f5c88db8d4f80a09ce46d47a425af334258dd352d6639ce4b406200054478a8`.
It correctly reports BLOCKED, zero trades and no evidence candidate: the actual
60-minute sample has no target quotes or selected contract, lacks declared
contract/session/cost assumptions, has unknown usage rights and no counterfactual
acknowledgement, and exceeds the supported research interval. No values were
invented to bypass those eight blockers.

Existing journals were reopened and rehashed after the preparation:

| Preserved evidence | Observed state | SHA-256 |
| --- | --- | --- |
| Local paper journal | Five closed trades, four notebook records, USD 990 equity, no open positions | `3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b` |
| Historical research journal | Eight runs, four closed modeled outcomes, 15 candidate notebook records | `f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62` |
| Market import journal | Still absent | Not applicable |

The two fee CLI examples independently returned ESTIMATED, four cents for the buy
and five for the sell, with `brokerFeesConfirmed: false`. Current status and its
65 tests were rerun after recording validation results and the Owner's decision
to defer payment. The update initially exposed a stale expected next-step list;
the validator and its assertions were aligned with that decision. This did not
change the research or fee engines.

## Remaining work

Acquire an entitled GLD/IBIT quote path, or explicitly authorize a Robinhood
read-only capability assessment and verify it supplies the necessary fields.
Then use the linked input package, review the contract/session/cost assumptions,
import actual evidence and run the separately versioned counterfactual research
model. A successful one-day process check does not establish a reliable strategy.
Independent market samples, account/portfolio enforcement, broker operational
reconciliation and calibration remain necessary before live readiness.

The standing Owner authorization covers reviewed code saving, commits and pushes.
It does not itself provide data subscriptions, account credentials or brokerage
transaction authority. No account, order, credential or payment action occurred.
