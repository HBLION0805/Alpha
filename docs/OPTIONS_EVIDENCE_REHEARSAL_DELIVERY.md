# Isolated evidence recovery rehearsal delivery

Task OPT-EXPORT-2, September 7, 2026 UTC. The actual pre-window package was copied
into a fresh temporary workspace and successfully read by the existing source,
research and paper-review repositories. Active runtime data was not restored.

## Changes and rationale

Added `scripts/options-evidence-rehearsal.mjs` and its tests; exposed the existing
exporter's bounded byte/path helpers for internal reuse; registered the command
and aggregate test; updated the specification and operational documentation.
The [reviewed design](specifications/OPTIONS_EVIDENCE_REHEARSAL_V1.md) keeps the
operation separate from any production restore, network access or trading action.

The command first verifies the package, then reconstructs only allowlisted data
paths in one newly created temporary workspace. Existing readiness v2 and source
repositories perform recovery. A byte-valid package can still contain a corrupt
journal; blocked components remain visible. It rechecks the original package,
temporary inventory and all copied bytes, retaining the isolated workspace for
inspection. Errors do not trigger retries, record repair, cleanup or write-back.

## Actual evidence

`node node_modules/tsx/dist/cli.mjs scripts/options-evidence-rehearsal.mjs --rehearse gld-ibit-prewindow-20260907`
ran from **2026-09-07T05:41:17.438Z** through **05:41:17.565Z**.
It copied seven files / 522,292 bytes into a fresh local temporary directory and
returned `RESTORED_COMPONENTS_READABLE`:

- Six recovered components: selected study, paper, historical, headlines,
  Treasury and BTC. Imported market evidence remains missing; none are blocked.
- Five closed paper trades, five matching reviews, zero missing reviews, four
  candidate paper lessons and fifteen separate historical candidate entries.
- Original package fingerprint
  `1922da33ec4e58053ef429cc44b4c218aed9f222b7cd77f1e1c1e2fd7ae12f41`.
- Recovered readiness report fingerprint
  `49dac4956fde00afdd77c3764f049cc62e47363c617dad6b5ea620ed7a22585e`.

The complete result, including the retained temporary path and actual component
check clocks, is `data/runtime/options-evidence-exports/prewindow-rehearsal.json`.
The package and temporary source bytes are unchanged, and active runtime files
and host scheduling are independently checked before completion.

## Validation and limits

`npm run test:options-evidence-rehearsal` passes ten focused tests; the existing
export I/O suite retains all twenty-two passing tests. Tests cover real repository
recovery from synthetic packages, per-trade reviews, independent current-data
changes, missing/corrupt archived stores, zero HTTP calls, separate fresh copies,
failed-copy retention, tampering and strict CLI scope. `npm run alpha:validate`
passed **2,849/2,849 tests across 109 components**, including typecheck and scope/
documentation checks, in 49,096 ms. The [checkpoint](status/evidence-rehearsal.json)
records the recovery result and independently rechecked original package, active
source and temporary byte hashes. Sixteen accepted artifacts and the host
configuration remain unchanged. There are no remaining validation failures;
warnings concern the uncommitted task and Git line endings.

This is an isolated local recovery exercise. It does not make the package an
off-device backup, guarantee future compatibility, repair a corrupt source,
reconstruct missing market observations or establish profitable trading. Temporary
copies may eventually be removed by the operating system; the original package
remains the retained workspace artifact. No automatic restore/export schedule,
source request, account call, risk change or trade was introduced.

Next preserve the verified package and assess actual opening-window collection
when it runs. Continue checking execution dependencies without representing a
future scheduled wake as completed evidence. Git commit/push follows the Owner's
standing authority after review and validation.
