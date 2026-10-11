# October 12 bounded simulated-account trial

This is an operation handoff for the already authorized October 12, 2026 trial,
not a new strategy, schedule or collector. The private `oct12-readiness-20261010`
manifest pins the exact code commit, entrypoint hashes, workspace, account draft,
two existing automation IDs and evidence locations. Both scheduled prompts must
read that same manifest. Do not substitute a checkout or update code during the run.

## Finite readiness list

| Item | Offline state | Actual-session dependency |
| --- | --- | --- |
| Published code, npm dependencies, CLI/API and empty UI | Independently tested; manifest pins version | Verify exact HEAD, hashes, working tree and installed dependencies |
| Account and costs | Existing USD 1,000 settled simulation; zero old positions, deposits or borrowing | Verify original account draft hash and absence of another journal; never reset |
| Budget | Existing account/trade/maximum-loss ceilings: 100,000 cents | Explicit request may be smaller; must fit current available cash and original ceilings |
| Fees | Each leg: 65 cents entry, 65 cents exit, 5 cents/share adverse exit allowance | Bind exact IDs before decision; model assumptions, actual broker fees UNKNOWN |
| Research and selection | Private blank templates and published preparation command | Refresh facts, direction, conditions, horizon, exact contracts and numerical limits before T0 |
| Contract and data evidence | Official generic reference routes saved | Exact series adjustment/deliverable/exercise/tradability and applicable data rights must be evidenced |
| One writer, same run, storage and recovery | Paths/claims/receipt naming fixed below | Main claims once; review never silently takes over or starts another account |
| Lifecycle and failure behavior | Isolated TEST_FIXTURE rehearsal | Genuine later source clocks, bid/ask/size/ticks and independent exit |
| Host transport | Explicit private executable/SHA-256 pin; real Host startup/catalog probe | OS permission, connection, allowance, actual quote schema and regular session remain separate |
| Review/report | Same manifest and fixed journal alias | Actual result, uncertainty and any open exposure |

Only one equal-quantity CDS or PDS (one contract per leg), same underlying and
expiry, with entry and exit on the same session is supported. This does not require
expiration on October 12. AAPL/TSM are the account's permitted symbols; QQQ is
background only. No scale-in, 20/30/50 allocation, real broker account or $160 ledger.
Fees total $2.60 and the adverse exit allowance reserve is $10 for the two-leg
round trip. Debit plus these reserves must fit cash/budget; proceeds stay unsettled.
The maximum-loss calculation is a terminal model, not an assignment guarantee.

## Fixed workspace and writer

The private manifest's `codeRoot` is also the CLI working directory. The journal
run ID equals the existing account alias `paper-sim-tech-1000-20261010`; it is not
the capture batch ID. All runtime paths below are under that root's ignored
`data/runtime/options-workbench-development/`. Do not copy or edit an existing
account journal into another root. Inspect both the manifest root and the original
draft workspace for this alias before any start. If another journal exists, stop
and reconcile ownership rather than resetting capital.

The main run creates `oct12-20261012-control/writer-claim.json` exclusively (`wx`),
containing actual UTC/ET, manifest hash and its actual task identity. Repeated main
wakes inspect this file and existing receipts; they do not overwrite it, reacquire
data or claim another alias. The claim survives interruption. Never auto-delete a
claim on age alone. A parent-coordinated takeover first verifies the old writer is
stopped and appends a handoff record referencing the old claim; no concurrent
writers. This is a workflow ownership protocol, not a new OS-wide lock service.
The existing journal additionally enforces exclusive event publication and hashes.

The claim is an October 12 action, not today's preparation. From the pinned root,
set ALPHA_TRIAL_WRITER to the actual running task identity and
ALPHA_TRIAL_MANIFEST_SHA to the verified manifest hash, then create exclusively:

~~~powershell
node --input-type=module -e 'import fs from "node:fs"; const writer=process.env.ALPHA_TRIAL_WRITER, manifestSha256=process.env.ALPHA_TRIAL_MANIFEST_SHA; if(!writer||!manifestSha256)throw Error("CLAIM_IDENTITY_REQUIRED"); const dir="data/runtime/options-workbench-development/oct12-20261012-control"; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(dir+"/writer-claim.json",JSON.stringify({writer,manifestSha256,claimedAt:new Date().toISOString()},null,2),{flag:"wx"});'
~~~

The 10:30 task is a reader. First check the main task status and claim; do not call
mutating recovery while the writer is active (recovery can clean interrupted
publication staging). Use the existing read-only tech-status/API projection then.
After confirmed writer stop, recovery may verify the same journal. Never start a
new journal in review. If no main run exists, report NOT_RUN, not a zero-profit trade.

## Preparation at 09:45 America/New_York (13:45 UTC)

1. Verify pinned HEAD and entrypoint hashes, clean tracked files, Node/npm and
   available Host using the manifest's private Host configuration. Run the local
   `check-readiness-v2.mjs` check (its hash is pinned in the manifest) and then
   `--check-host --host-config <manifest hostConfig.path>`
   on the same published `scripts/options-tech-quotes.mjs` entrypoint. A PASS means
   a real Codex process initialized and returned exactly the four allowed market
   tools with existing OAuth status. A null runtime status means connection remains
   UNKNOWN because a catalog can be cached; it is not a live connection guarantee.
   No model turn or market/account/order
   tool is called. Codex may write its ordinary runtime logs or refresh existing
   OAuth internally. This is not a fresh quote, model allowance or Paper test.
   Do not install, pull, reconnect, change permissions or reset
   allowance automatically. A disconnected/auth prompt is a concrete blocker.
2. Save actual UTC/ET, manifest/account hashes and unique main-writer claim. Inspect
   prior receipts before collecting. No new timer or repeated quote loop is used.
3. Refresh AAPL and TSM research from attributable current originals; QQQ is context.
   Separate operating trend from the holding-window price thesis. Retain publication,
   receipt, review, registration and assessment clocks, unresolved issuer/period
   matches, contrary evidence and stale/partial bars. The October 9 hypotheses are
   history. No required bullish/bearish direction or ranking is pre-frozen here.
4. Complete the existing THREE_FACET_INPUT_V1 research shape from the private blank
   template. Save actual-time hypothesis, trial, confirmation, invalidation and
   independent exit conditions. No technical input means UNKNOWN, not synthetic
   Fib or OHLCV. An early trial must still pass the existing research-trial engine;
   neither engine PASS nor aligned prose replaces the explicit frozen conditions.
5. Choose at most one supported pair only if research and evidence qualify. Obtain
   chain/contract identity with the existing official read-only Host tools using
   their actual schema. No guessed IDs, nearby replacements or whole-chain sweep.
   Save those preparation calls separately from the later five-call quote batch.
   If no defensible pair qualifies, save NO_TRADE with research retained.
6. Verify all eight existing evidence envelopes: STRATEGY_REQUEST, RESEARCH,
   CONTRACT, DATA_ENTITLEMENT, COST_MODEL, PRODUCT_PERMISSION, ACCOUNT_FUNDS,
   RISK_LIMITS. Keep the four simulation-origin kinds distinct from real records.
   Preserve source bytes/hash/reviewer and observed/received/reviewed/valid-through
   clocks. A generic source URL or a successful connection does not supply PASS.

Official generic routes (retrieved during preparation; undated pages are not
historical series certification):

- [OCC equity specifications](https://www.theocc.com/clearance-and-settlement/clearing/equity-options-product-specifications): standard equity contracts, including ADS/ADR, normally deliver 100 shares and have American exercise. Corporate actions can change this. Use exact selected provider instruments plus applicable OCC/exchange series and adjustment records, including [OCC information memos](https://infomemo.theocc.com/), to resolve the selected series. Absence of a found memo alone is not proof of standard terms.
- [Robinhood tool catalog](https://robinhood.com/us/en/support/articles/trading-with-your-agent/): get_option_chains, get_option_instruments, get_option_quotes and get_equity_quotes. Described real-time capability is not actual quote freshness, exact series deliverable, or user-specific entitlement.
- [Robinhood access overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/) and [terms](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood%20Terms%20and%20Conditions.pdf): preserve the applicable current data agreement/permission supporting this user's real-time options access and local private retention. Generic personal-use wording and connectivity do not resolve all additional agreements. If evidence is unavailable, DATA_ENTITLEMENT remains UNKNOWN and entry is blocked. Do not buy, accept agreements or open an account.

## Prospective request and quote sequence

Every real capture below must append `--host-config <manifest hostConfig.path>`.
The same resolver and four-tool restriction are used by capture and startup check.
`ALPHA_TECH_QUOTE_HOST_CONFIG` is an optional process-local alternative; do not
change global environment variables. The private JSON has version
`TECH_QUOTE_HOST_CONFIG_V1`, an absolute `executable` path and its reviewed
`sha256`. Verify the installed OpenAI publisher before pinning it. Missing or
changed binaries stop with a named error before creating a capture. No PATH,
mtime search, sandbox-folder fallback or automatic re-pin is performed. Legacy
callers must supply the explicit config too; fixture-only injected transport stays
separate. This pin verifies file identity, not OS permission: a denied launch must
use the normal approval process, never a sandbox bypass or new credentials.

Before any entry batch, save the chosen selection with its future batch ID
`oct12-20261012-entry-01`, actual contracts and explicit `maxSourceSkewMs`. Persist
the actual decision T0, request/envelopes and hashes **before** launching capture.
T0 is near 10:00 ET (14:00 UTC), never a prefilled future timestamp. The request
pins research/selection/cost/contract/account hashes, quantity one, explicit budget,
maximum loss, debit limit, max leg spread and source-skew limit. Price/spread/skew
limits are selected and recorded before the batch, not widened after rejection.
They are run assumptions within existing schema/engine bounds, not new Owner rules.
Save `decision.json`, `selection-entry.json`, `plan-input.json` and eight envelopes
under `oct12-20261012-control/`; before quote capture the plan input has no original
and remains preparation only. After capture, create plan-input-entry-01.json with
the exact original reference; keep the earlier plan-input.json and all decision
envelopes unchanged. Use exclusive files/revisions, never replace T0.

Set entryDeadlineAt = actual T0 + 2 minutes, timeExitAt = actual T0 + 7 minutes.
If the existing morning opportunity is missed, do not restart the clock to manufacture
entry. At or after the intended 10:02 cutoff without a saved timely decision/entry,
record NO_TRADE/LATE_START. Never reconstruct 10:00 from later high/low/open values.
This operational morning cutoff does not loosen the engine's stricter T0 windows.

Commands from the pinned root (INPUT/REF are saved JSON files, UTC is an actual
ISO clock). Use `node --import tsx` directly to avoid package-script ambiguity:

```text
node --import tsx scripts/options-tech-spread-plan.mjs --prepare INPUT
node --import tsx scripts/options-tech-quotes.mjs --capture-spread --request SELECTION --run-id oct12-20261012-entry-01 --host-config HOST_CONFIG
node --import tsx scripts/options-tech-spread-plan.mjs --preview INPUT
node --import tsx scripts/options-tech-spread-plan.mjs --start INPUT --run-id paper-sim-tech-1000-20261010
node --import tsx scripts/options-tech-spread-plan.mjs --append-original REF --run-id paper-sim-tech-1000-20261010 --at UTC
node --import tsx scripts/options-tech-spread-plan.mjs --recover --run-id paper-sim-tech-1000-20261010 --at UTC
```

For strict no-write preparation, use the existing
`cmd /d /c scripts\options-tech-mock-residual-readonly.cmd --prepare-plan INPUT`.
Neither prepare nor preview freezes or fills. A plan starts only if the original
engine reports REAL_QUOTE_PAPER_PLAN_READY. Starting creates NO_ENTRY; entry is a
separate explicit append of the saved eligible original. The REF contains id,
path, sha256, eventId and action OBSERVE. The original path is the entry capture's
`capture.json`. Use eventId `paper-oct12-entry-01` exactly once; identical retry is a
journal replay, not another source call or fill. Reject changed-content retries.

The collector allows five market calls per V2 batch: chain, two instruments,
underlying and one two-ID quote request; no pagination/retry/substitution.
Host hard call-count enforcement is unavailable; excess is detected after calls.
Preserve host.jsonl, stderr, host-run.json, request and capture on every outcome.
Do not use a partial leg or cross-batch composite. No capture file means blocked,
not permission to rebuild one from stdout by inventing missing fields.

## Exit, late data, interruption and 10:30 review

After entry keep the main task alive using bounded waits and actual clock checks;
there is no claim of continuous monitoring. Around actual T0+7, obtain the same
two exact contracts with batch `oct12-20261012-exit-01` and the same frozen skew
limit. Preserve sequential source clocks. Save an exit REF with eventId
`paper-oct12-exit-01`, action OBSERVE (existing time exit) or explicit CLOSE if the
already saved manual invalidation condition was actually met. Append at actual
original availability; never retime it to the scheduled instant.

- Failed/late/missing entry: no fill and no P&L; no new retry batch to chase a fill.
- Eligible entry but missing/invalid exit: OPEN_UNRESOLVED, pending TIME_EXIT,
  P&L unknown, actual exposure and cash still visible. Never turn missing data
  into flat or reuse unsettled proceeds. Do not use an earlier price at 10:30.
- Later genuinely new same-session exit evidence may close the existing position
  at its actual later time under unchanged checks; it does not backfill 10:07.
  Coordinate with the main writer before any already-authorized additional exit
  observation; no autonomous retry loop or expansion beyond the existing trial.
- Interruption: retain all originals and pending publication files. Verify the
  same journal at an actual clock after its originals exist. Exact duplicate
  start/event resumes the identity; conflicting input stops. Do not overwrite,
  remove a broken journal, create a new account alias or redeclare $1,000.

At 10:30 ET/14:30 UTC, locate the same manifest, control claim and journal. Save
an exclusive `review-<actual UTC>.json` under the control directory. Distinguish
research, quote, plan and Paper status; report exact T0/cutoff/entry/exit clocks,
legs, costs, settled/reserved/unsettled cash, net P&L or UNKNOWN, open/residual
exposure, blockers, source gaps and hashes. No entry is not a loss. One short
engineering observation does not establish a two-week win rate.

All originals, Host logs, simulated account data and actual results remain local
and ignored. Public Git gets only reviewed code/instructions, not runtime files.
No production deploy, main merge, security change, real account/order operation,
CPI freeze/date change, 15:50 change or $160-ledger write is authorized here.
