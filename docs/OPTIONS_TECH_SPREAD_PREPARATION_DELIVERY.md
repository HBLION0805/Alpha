# Local preparation for the existing spread-plan input

The existing plan CLI accepts `--prepare INPUT` to show missing fields across its
eight evidence records even when `STRATEGY_REQUEST` is absent. It prints an
unfrozen request body and calls the original plan preview on the original input.
It does not save a draft, create an evidence envelope, freeze a plan, append a
modeled fill, authenticate an account or acquire data. There is no new input
schema, admission gate, risk default or fill engine.

Use the supported strict launcher in PowerShell:

```powershell
cmd /d /c scripts\options-tech-mock-residual-readonly.cmd --prepare-plan "INPUT.json"
cmd /d /c scripts\options-tech-mock-residual-readonly.cmd --plan-preview "INPUT.json"
```

The launcher clears inherited Node cache/coverage/preload settings, disables
filesystem writes, child processes, workers and native addons, and transpiles
TypeScript in memory. It emits stdout/stderr only; it does not invoke npm or tsx.
The launcher accepts exactly these two plan dispatches plus its existing residual
preview arguments. Extra saving/start/append/recovery/arming flags are rejected.
Do not redirect output if verifying a strictly write-free invocation. Any later
draft saving must be a separate explicit action; no saving command was added here.

`INPUT.json` uses the existing `TECH_SPREAD_PLAN_INPUT_V2`, `REAL_QUOTE_PAPER` and
explicit evidence context. Preparation permits absent/empty `originals` so gaps
can be inspected before acquiring a quote. Supplied originals use the existing
`{id,path,sha256}` reader. Ordinary `--plan-preview` still requires one original.
Missing files, malformed JSON and hash mismatches fail without echoing raw paths.
Preparation returns `PARTIAL_UNKNOWN` or `FIELDS_SUPPLIED_UNVALIDATED`; neither
means entry permission. The original engine's result is shown separately.

Each record lists missing envelope and payload field paths and acceptable source
guidance. Null, absent, empty and `UNKNOWN` values remain gaps. This is a field
inventory, not exhaustive semantic validation: all existing clocks, reviewed
verdicts, research, source, contract, account and economics checks still apply.
Complete fields with a denied verdict or insufficient funds can still be blocked.

Only unique byte-matched records with an explicitly applicable origin and source
can supply research/evidence references to the unfrozen body. Their local hashes
mean byte integrity, not authentication or qualification. Conflicting existing
bindings remain conflicts. The preview never silently repins, selects a direction,
copies later quote selection into a prior decision, fills an account alias, sets
dates/conditions or invents a budget. Original research and uncertainty stay intact.
Raw documents, reviewer/source prose and account balances are not projected into
the preparation response. Explicit request conditions are local draft text, not
automatically sanitized prose for publication.

The eight existing record contracts and actual source requirements remain in
[the Paper delivery](OPTIONS_TECH_REAL_QUOTE_PAPER_DELIVERY.md). Missing entitlement,
permission, settled/reserved/unsettled funds, dated fees, contract specifications
and existing Owner risk limits need attributable evidence. Research alone does not
provide them. A specific prior request/selection and separately authorized future
two-leg batch in an eligible session are still required, followed by independent
later evidence for any modeled exit. No 20/30/50 allocation or two-week result is
introduced. A saved research hypothesis is not fresh market data or a Paper fill.

Validation extends the existing spread-plan suite with partial/unknown inputs,
binding conflicts, unchanged CDS/PDS fixture previews, document privacy and fresh
strict-launcher processes. Isolated trees retain originals, old npm logs, cache
directories and modification times on success and failure. Real saved research
dry-runs remain local under ignored development storage; no evidence is promoted
or production plan saved. The independently committed assessment-clock repair
remains separate. No CPI workspace, schedule, deployment or challenge ledger change.
