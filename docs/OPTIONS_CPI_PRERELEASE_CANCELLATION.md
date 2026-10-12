# CPI pre-release workflow cancelled

The Owner cancelled the CPI pre-release prediction, probability, freeze and
forecast-versus-outcome task on October 12, 2026. Old instructions to prepare or
freeze that forecast no longer authorize work. After publication, CPI remains
an observed macro event for analysis of macro conditions and affected stocks.

## Applied local changes

The operational `scripts/options-cpi-research.mjs` entrypoint is deactivated in
`Alpha-edge-review-development-20261007` and its isolated
`Alpha-cpi-window-fix-20261009` copy. All six command modes return
`CPI_PRERELEASE_WORKFLOW_CANCELLED` before loading research dependencies or an
input. Existing exports and shared research libraries remain for historical
offline replay; they are not authorization to restart the cancelled workflow.
The `options:cpi-research` alias therefore also stops. No generic decision,
macro, BLS data-receiving, Paper or account module was removed.

The code change is separately committed in the original development repository:
`55600661420223b653ced305f113bed41f30e0cb`. Its three files are the CPI CLI,
six CLI deactivation tests and the current AGENTS cancellation notice. Existing
unrelated modifications in that checkout were not staged or changed. The window
fix directory is a non-Git experiment copy with the same guarded CLI bytes.
This is separate from the pending weekly adapter release `89c5db7`.

Nineteen items containing 277 original files were moved to recoverable private
archives; every archived file matches its pre-move SHA-256:

- Three October 12 weekly-workspace CPI freeze/research preparation directories.
- Two October 7 original-workspace CPI draft/research directories.
- Three CPI window-fix runtime directories, including original-apply evidence.
- Seven CPI rehearsal/mock/preview/report/validation directories.
- Four recovery-root draft/input/preview files.

The former directories contain only `DEACTIVATED.json` with their archive location.
Root markers identify the retired recovery and rehearsal workflows. Historical
logs, original HTML and input bytes were preserved, not rewritten or permanently
deleted. Current readiness/candidate status in this checkout is deactivated;
the previous status JSON and affected entry files were backed up before editing.
Historical delivery documents remain dated history under the current cancellation.

The private recovery authority is:
`data/runtime/options-workbench-development/cpi-prerelease-deactivated-20261012-01/withdrawal-index.json`.
It records each original absolute path, archive path and original-file SHA-256;
`before-files` contains exact pre-edit files. Recovery must first validate those
hashes and restore only specifically requested items without overwriting newer
files. Restoring an audit original does not reactivate prediction or schedules.
No permanent deletion occurred.

## Retained behavior and verification

There is no dedicated CPI research/forecast UI route in the current tracked app.
Its generic macro actual-value and source-comparison UI remains unchanged. The
official BLS CPI RSS reader, release calendar, saved actual observations, general
research modules and Paper/account records remain available. The Windows
`AlphaCpiPreflightV1` task only reads BLS source health; its definition and the
protected `Alpha1550FastHost` definition were read and retained unchanged. The
parent task reports that the October 13 freeze automation is stopped and the
October 14 automation now requests post-release analysis; local work did not
repeat or replace those app changes.

Validation: six native CLI deactivation tests pass; 12 historical CPI replay and
10 shared decision-research tests pass in each of the two code copies (44 replay
checks). Twelve actual CLI probes reject before reading a nonexistent input.
All 277 archive hashes and nine pre-edit backups match. The 25,910 protected
original/account files are unchanged. Logs and receipts remain local beside the
withdrawal index. No source calls were made during cancellation, and there was no
account write, website deployment, push or change to the 15:50 schedule.

## Replacement workflow

After the actual release, retain the official data's metric, period, seasonal
adjustment, vintage, publication and acquisition clocks. Separate reported facts
from interpretation of inflation, growth and rate conditions. Then assess affected
stocks using evidence observed after release, including their actual technical
structure, confirmation and invalidation conditions. Missing or conflicting data
stays UNKNOWN. This workflow does not resume a CPI forecast, probability score or
freeze requirement and does not infer a stock direction from CPI alone. Quotes,
Paper and trading authority remain separate.
