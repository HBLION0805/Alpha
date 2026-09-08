# Local options workbench delivery

The Owner requested the entire frontend phase before the next completion report.
The six-page workbench now composes the existing GLD/IBIT systems in a responsive
English interface. Development began September 7 and continued into September 8,
2026 New York. See [status](status/workbench.json), [operator guide](OPTIONS_WORKBENCH_GUIDE.md)
and the [reviewed specification](specifications/OPTIONS_WORKBENCH_V1.md).

## Delivered scope

| Page | Local acceptance |
| --- | --- |
| Overview | Declared baseline, ETF evidence counts, calendar and readable ten-workstream/six-gate readiness |
| Options & activity | 2,100 saved contracts; 224 candidates; ETF/expiry/side/search filters, sorting, 25-row pagination, source clocks, detail and scenario transfer |
| Trade planner | Original deterministic long-option engine; nullable costs, whole contracts, net R, stop/friction/stress blockers and editable plan transfer |
| Trade journal | Registration, optional original plan/activity reference, fills, partial exits, reviewed corrections/voids, durable idempotent saves and original events |
| Reviews & lessons | Owner records, separate paper/history audits, candidate notebook filtering and all 224 frozen activity comparisons |
| News & calendar | 118 saved headline versions, six source-health panels, Treasury/BTC context, BLS/FOMC precision and incomplete numeric factor coverage |

The visual design uses a dark navigation rail, restrained gold/green accents,
light cards, readable evidence labels, native forms and responsive tables.
There are no external fonts, remote assets, framework dependencies or model calls.
The single-process Node service listens on IPv4 loopback and exposes only fixed
local routes. Host/origin/fetch-site checks, a per-process mutation header, bounded
JSON, no-store responses and CSP protect the local interface. The launcher checks
workspace and ledger identity before reusing a running service.

## Files and reasons

- `apps/options-workbench/index.html`, `styles.css`, `icon.svg`: accessible shell,
  six-page navigation, dialogs, responsive layouts and local branding.
- `apps/options-workbench/app.js`, `views.js`, `forms.js`, `model.js`, `api.js`:
  page rendering, filters, draft retention, exact form conversion, readable errors,
  local preview/save, evidence downloads and same-origin requests.
- `scripts/lib/options-workbench-data.mjs`, `scripts/options-workbench.mjs`:
  existing-reader composition, isolated source failures, reviewed ledger-head
  checking and bounded loopback routing. Existing financial engines are unchanged.
- `scripts/start-options-workbench.mjs`, `Start Alpha.cmd`: a reusable local launch
  entry point; no automatic startup, scheduler or external deployment.
- `scripts/options-workbench.test.mjs`, `package.json`, `scripts/alpha-validate.mjs`:
  meaningful UI-model/service/HTTP integration tests and one exact approved local
  browser transport in the existing network guard.
- `.gitignore`: separate command-input and development/QA runtime stores.
- Specification, guide, delivery, status, progress and project navigation docs:
  distinguish frontend completion from the remaining market-validation gates.

## Verification

The focused suite covers exact/null decimal conversion, input scope, escaping,
filtering and pagination, missing/corrupt store isolation, original event recovery,
preview without writes, repeat requests, changed-head rejection, partial fills,
correction/void recovery, origin/session protection, malformed/oversized JSON,
fixed assets/routes, error messages and unchanged risk arithmetic. The full
`npm test` bundle includes it; exact final counts are in the status file.

Final commands: `npm run test:options-workbench` passed **57/57**;
`npm test` passed **3,809/3,809** across **154 components**, including strict
typechecking, network/credential guards, Markdown links and Git whitespace.
`node scripts/start-options-workbench.mjs --no-open` verified both starting and
reusing the owner service. Syntax checks, local HTTP probes and original-reader
recovery completed. The temporary QA service was stopped; the owner workbench
remains available on 127.0.0.1:4173.

Browser acceptance used the real local owner workspace for read-only pages and
an isolated synthetic ledger for mutations. The UI registered `browser-gld-01`,
recorded a two-contract purchase at $0.20 with $0.10 fees, then a one-contract sale
at $0.30 with $0.10 fees. The partial net was **$9.85**. Correcting that sale to
$0.10 produced **-$10.15**. Voiding it restored two open contracts without deleting
history. A later synthetic two-contract close at $0.15 with $0.10 fees produced
**-$10.20**, zero open contracts and four review candidates. It retained missing
plan/document evidence and an unknown market cause. This is an accounting test,
not actual execution or a strategy-return result.

An independent service restart recovered all twelve QA events (six original demo
events plus six UI events), both closed fixture trades, the original corrections
and the candidate notebook. The owner ledger remained empty. The original 561
protected files, including the owner manifest, old reviews/captures and the actual
`gld-ibit` automation configuration, matched their pre-work hashes.

Desktop browser checks covered every page, combined filters and empty search,
pagination, saved quote transfer, blocked blank costs, a declared $4.30 planned
loss/$8.70 rounded net target, draft transfer and clearing, notebook filtering and
news search. Responsive checks covered the mobile navigation, table containment
and forms. Missing-source states were exercised in the isolated workspace.
Browser viewport overrides were restored after QA.

Issues resolved during acceptance included a toast visibility class mismatch,
off-screen mobile navigation remaining keyboard reachable, readable progress and
source labels, original-event drilldown, explicit port-conflict errors and exact
workspace matching in the launcher. PowerShell could not terminate the initial
Node servers; automatic approval rejected an attempt using potentially stale IDs.
Fresh listener/command/creation-time checks then allowed termination and the
restart succeeded. No approval blocker remains.

## Limits and next step

This delivery assumes local single-user operation, standard purchased GLD/IBIT
options and owner-supplied records. It does not support multi-leg manual fills,
brokerage synchronization, real-time refreshing, automatic orders or an authenticated
account balance. Stops remain plans, not guaranteed fills. Missing fees remain
unknown, research controls remain independent, and candidate lessons cannot alter
a strategy. Stale September 4 quotes were never relabeled current.

The UI phase has six accepted pages. The fixed overall baseline remains **4 local
validated, 3 partial and 3 not validated**; the first real-price paper flow still
has **3 available local components and 3 open gates**. Inspect the already
authorized daily close evidence before determining whether it supports the
Robinhood paper adapter and frozen activity comparisons. The cancelled opening
pilot and automatic development remain disabled. No schedule was changed.

Standing owner authorization covers the reviewed commit and push. Runtime inputs,
synthetic QA data and server logs are excluded from Git. The final response records
the commit and clean remote status after validation.
