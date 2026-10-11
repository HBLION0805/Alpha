# Independent published checkout acceptance

October 10, 2026 (America/New_York). Development branch only.

A fresh clone of published commit c02e27a019e8b3b3e151de9a6c03379407679e24 was installed with Node 24.18.0, npm 11.16.0 and the official npm registry. It did not reuse the original checkout's node_modules, 23 uncommitted paths or private runtime. npm reported an unapproved esbuild lifecycle script; no script approval or global configuration change was needed for the tested commands.

## Concrete checkout repairs

The initial full validation failed. Windows core.autocrlf changed ten byte-sensitive files: three archived workflow sources, six approved macro research sources and one synthetic calendar. Their canonical Git blobs already contained the correct bytes. Narrow .gitattributes entries now preserve those bytes; no archived content, schedule or preserved hash changed.

Two technology-status tests also inspected newly written journal receipts at a fixed earlier clock, causing correct FUTURE_RECEIPT rejection. Journal-read tests now inspect after the write using the current clock (bounded below by the fixed fixture clock). Fixed-clock future/order rejection tests and all production validation remain unchanged. Integrity and alias-rejection tests use the same post-write inspection helper so they cannot pass merely because the receipt appears to be in the future.

## Local saved-data startup

From the repository root after npm ci, use PowerShell:

~~~powershell
node --import tsx --input-type=module -e 'import {startOptionsWorkbench} from "./scripts/options-workbench.mjs"; const app=await startOptionsWorkbench({port:4178,workspaceRoot:process.cwd(),refreshContext:false}); console.log(app.url+"/#event-research");'
~~~

Open the printed loopback URL; Ctrl+C stops the process. This existing exported entrypoint disables background source refresh. The ordinary options:workbench CLI defaults to refreshContext:true and is not the offline acceptance command. Use a different free port if 4178 is occupied.

## Acceptance scope

- Empty workspace: explicit missing/unknown research and NOT_TESTED real acceptance; no files created by reads. Static assets, health/state/status routes and rejection of unknown routes/query/origin checked.
- Published research engine plus preparation, preflight, plan and MOCK CLI processes: synthetic CDS and PDS each saved a plan without entry, explicitly appended one entry, ignored a duplicate event, closed on a later independent synthetic original and recovered identically in a new process.
- Standalone preflight remained BLOCKED with incomplete evidence. Separately supplied complete synthetic plan evidence reached MOCK_PLAN_READY. These are distinct inputs and layers, not a bypass or real qualification. Both synthetic modeled outcomes were -920 cents; real trades remained zero.
- Desktop 1440x1100 and mobile 390x844: empty and synthetic/error states, repeated refresh, navigation/back, browser reload, disclosures and viewport layout. No console.error, page exception, browser log error, network failure, HTTP error or external request was observed. Runtime file inventories stayed unchanged. Screenshots were inspected.
- The first browser harness had a reload waiting race; its failure record is retained separately from the corrected successful run.

Receipts, logs, fixture originals and screenshots remain ignored and local under data/runtime/options-workbench-development/published-e2e-20261010. Full validation outcomes and exact final version are in the final acceptance receipt there. This verifies engineering closure only: no market-data acquisition, account access, real Paper run, strategy validation, deployment, schedule change, CPI-workspace change or $160-ledger change occurred.
