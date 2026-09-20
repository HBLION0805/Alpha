# Targeted held-position quote review

Status: local implementation and isolated verification complete; first real use
is unverified. The Owner ledger had zero open positions during this Saturday
development session. No live market tool was invoked and no Owner fill was added.
The separate routine 15:50 acceptance remains `PENDING_NATURAL_RUN`.

## Owner entry

Open **Trade journal → Position exit checks → On-demand position quotes**.
Select reported open positions and press **Prepare targeted quote request**.
The protected local API saves an immutable request, not a market observation or
queued job. Existing unexecuted preparation with the same ledger version/scope
is reused. Missing verified identities and excluded positions are explicit.
More than six distinct contracts requires choosing a subset. Empty, closed and
plan-only ledgers have zero market calls. Separately reported spreads are outside
this single-leg route.

Ask the existing authorized Host to execute the displayed review ID once during
the regular session. After its receipt is saved, **Reload saved data** displays
current checks and the expandable original saved evaluation. Reload itself has
zero market calls. A saved trigger is retained even when the current quote has
aged or a later attempt returns no quote. A trigger is not an actual exit.

Equivalent local commands (replace the IDs, never contract identity metadata):

```text
npm run options:position-quotes -- --scope owner-manual-gld-ibit
npm run options:position-quotes -- --prepare review-id owner-manual-gld-ibit trade-id,another-trade-id
npm run options:position-quotes -- --host-source review-id
npm run options:position-quotes -- --record review-id data/runtime/options-workbench-inputs/review-id-quotes.json
npm run options:position-quotes -- --results owner-manual-gld-ibit
```

Omitting the final trade list in `--prepare` means all supported open positions,
subject to explicit selection if more than six contracts are identified.
`--host-source` claims an existing shared Host slot; it is not a source call.
Synthetic ledgers cannot obtain a production permit. The 15:50–16:00 regular
routine window is reserved, with no changed wake, collector or automatic retry.
Other existing claimed slots also block this path. A failed/expired attempt is
retained; a later attempt requires a new explicit Owner request and available slot.

## Executable Host handoff

Use the same injected-tool mechanism as the daily-guidance runbook. The two
actual schemas inspected this stage accept `symbols: string[]` and
`instrument_ids: string[]`. Both support the required batch sizes (2 / 6);
the documented >20 close-lookup restriction is not reached. No chain or
instrument-discovery tool is on the allowlist below.

This example runs **only on an explicit Owner instruction** for a prepared ID.
It is not installed in an automation. Execute inside the existing equipped Host
with the Alpha workspace. Local commands use actual process time; response
source timestamps are preserved, including nanoseconds and clock problems.

```javascript
const root = 'C:/Users/liuha/.codex/worktrees/8f09/Alpha';
const reviewId = 'REPLACE_WITH_PREPARED_REVIEW_ID';
if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(reviewId)) throw Error('REVIEW_ID');
const local = args => tools.exec_command({
  cmd: 'node --import tsx scripts/options-position-quotes.mjs ' + args,
  workdir: root, max_output_tokens: 12000
});
const start = await local('--host-source ' + reviewId);
if (start.exit_code !== 0) throw Error('LOCAL_START_FAILED');
const permit = JSON.parse(start.output);
if (!permit.claimed) throw Error('ALREADY_CLAIMED_OR_SHARED_SLOT_BUSY');
const collect = new Function('return (' + permit.source + ')')();
const allowed = {
  get_equity_quotes: tools.mcp__robinhood_alpha_market_data__get_equity_quotes,
  get_option_quotes: tools.mcp__robinhood_alpha_market_data__get_option_quotes
};
const raw = await collect({
  clock: async () => (await tools.clock__curr_time({})).current_time,
  authorize: async index => {
    if (![0, 1].includes(index)) throw Error('CALL_INDEX');
    const r = await local('--authorize ' + reviewId + ' ' + index);
    if (r.exit_code !== 0) throw Error('CALL_NOT_AUTHORIZED');
    return JSON.parse(r.output);
  },
  call: async (name, request) => {
    if (!Object.hasOwn(allowed, name)) throw Error('TOOL_NOT_ALLOWED');
    const invoke = allowed[name];
    const r = await invoke(request);
    if (r.isError || !r.structuredContent?.data) throw Error('MARKET_SOURCE_FAILED');
    return r.structuredContent;
  }
});
store('position-quote-raw', raw);
// Exact raw handoff: new ignored file, not shell-interpolated provider text.
const input = 'data/runtime/options-workbench-inputs/' + reviewId + '-quotes.json';
await tools.apply_patch('*** Begin Patch\n*** Add File: ' + root + '/' + input +
  '\n' + JSON.stringify(raw, null, 2).split('\n').map(s => '+' + s).join('\n') +
  '\n*** End Patch');
const saved = await local('--record ' + reviewId + ' ' + input);
text({reviewId, calls: raw.calls, failures: raw.failures,
  recordExitCode: saved.exit_code,
  resultPath: 'data/runtime/options-position-quotes/' + reviewId + '/result.json'});
```

Do not re-execute market calls to repair local record processing. Retain the raw
handoff if parsing/saving fails. `--record` can retry the **same saved response**;
once a result exists, exact replay is idempotent and a conflicting replacement is
rejected. Original failures remain failures. The local reader cannot independently
authenticate caller-supplied exports; Host provenance is not broker-account proof.

## Storage and evaluation

Existing fingerprinting, safe exclusive filesystem writes, ledger reconstruction,
session calendar, snapshot quote gates and original exit/thesis evaluators are
reused. A narrowly scoped targeted record is stored outside guidance captures:
`data/runtime/options-position-quotes/<review-id>/` contains request, claim, up to
two consumed call permits and result. The result contains raw replies, normalized
targeted frame, ledger binding, counts and evaluation. The original raw input
file is retained privately too. There is no second database or history cleanup.
The store is bounded to 100 reviews, 8 MiB/record and 64 MiB total; existing source
store limits are unchanged. Space for a result is checked before authorization.

Complete contract identity comes from verified saved capture metadata, with its
original file hash and receipt clocks. Old metadata is labeled identity-only;
it is never represented as a new chain response. Matching UUID and all contract
fields is required. Original fractional-dollar ETF precision now reaches Position
watch through its existing V3 exact-price validator; legacy frames without the
exact-dollar field retain the original cent-price behavior.

Before each call the Host consumes a separate exclusive permit and rechecks the
ledger. Before save it rechecks again. A changed position produces
`POSITIONS_CHANGED`, with no price-based current binding; due time and factual
checks remain independent. Later current views also compare position versions.
Saved thesis triggers join existing append-only review triggers. No costs are
invented: original net-target checks remain unknown without explicit exit costs.
The existing cost preview / Save evaluation workflow can use the targeted quote.

These records cannot become Daily guidance samples, paper fills, a 36/36 coverage
claim or frozen trend evidence. No source conflict/unknown interpolation flag,
capital setting, original plan, automation or account/order permission changed.

## Validation and cost

See `docs/status/position-quotes.json` for the final-code verification receipt.
The focused injected-tool suite covers no positions, deduplication, ambiguous
identity, >6 selection, two-call bounds, repeated claims, stale/future/wrong-ID
replies, ledger races, preserved exits, protected API, restart, historical cutoff,
and new ETF evidence reaching the original thesis evaluator and saved review.

Browser acceptance used a clearly labeled isolated synthetic ledger: page prepare
→ injected two-tool Host → saved stop trigger → same review after server restart.
The actual ledger remained empty. Isolated receipts are not forward observations.
Development failures corrected: duplicate execution references / noncanonical
manifest in test setup, shared-slot collision in a second-round fixture, and an
older UI test expecting title-case Unknown. No unresolved product failure is
claimed away by these test corrections.

Per complete round: **2 market calls**, up to **2 ETF response rows + 6 option
response rows**, not one row per call. Null/missing/conflicted rows remain explicit.
The normal local store writes are **6** (request, shared slot, claim, two permits,
result); the documented Host handoff adds **1** raw input write, for **7** total.
Failure/zero-call paths differ and receipt counts are reported separately.
Clock/local command invocations are not market-tool calls. USD tool fees remain
`UNKNOWN`; no new subscriptions, model calls or services were added. This session
used **0 real market calls, 0 real quote rows, 0 production review records**.

This is a medium-complexity local cross-layer change: bounded Host source, CLI and
receipt store, existing evaluator plumbing, and a compact panel. First real use
still needs an actual supported holding with verified identity and an explicit
regular-session request. It provides no continuous monitoring or fill assurance.

Recovery: revert only this feature's commit on the development branch if needed;
do not delete private evidence, change the Host V4 schedule or rewind old plans.
Existing guidance captures and manual ledger entries require no migration.
