# Local evidence export delivery

Task OPT-EXPORT-1, September 7, 2026 UTC. The first opening study and accumulated
paper reviews/context now have an independently verifiable local evidence copy.

## What changed and why

Added `src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts` and
tests, `scripts/options-evidence-export.mjs` and I/O tests, npm and full-validation
registrations, the ignored local export directory, specification and operational
documentation. Exact source allowlists cover the named plan/frames, attempts and
closeout reports plus six fixed journals. Source bodies cannot introduce new paths.

Creation checks source locks, bounds, path links, file identity and byte hashes;
copies exact bytes into one new package; then rechecks copies and source inventories
before writing the manifest last. Missing components are explicit. Same-ID repeats
refuse overwrite or resume. Partial packages remain untouched for inspection.
Verification reads only the package, checks its exact mappings/manifest and every
payload, and refuses missing, extra, changed, linked or unrecognized entries.
The [reviewed specification](specifications/OPTIONS_EVIDENCE_EXPORT_V1.md) records
limits, consistency semantics and acceptance criteria.

## Actual package

Created with
`node node_modules/tsx/dist/cli.mjs scripts/options-evidence-export.mjs --create gld-ibit-observe-open-20260908 gld-ibit-prewindow-20260907`.
Started **2026-09-07T05:23:29.757Z**, finished byte checks at **05:23:29.781Z**.
The manifest is
`data/runtime/options-evidence-exports/gld-ibit-prewindow-20260907/manifest.json`.
It covers **7 files / 522,292 bytes**: BTC, headlines, historical research, paper
reviews, Treasury, the frozen opening plan and the already saved closeout report.
Imported market evidence and actual collection attempts are explicitly missing.

Manifest fingerprint:
`1922da33ec4e58053ef429cc44b4c218aed9f222b7cd77f1e1c1e2fd7ae12f41`.
A new `--verify gld-ibit-prewindow-20260907` process returned
`PACKAGE_BYTES_VERIFIED` at **05:23:30.419Z**, without reading current source stores.
Its result is `data/runtime/options-evidence-exports/prewindow-verification.json`.

## Validation and remaining limits

Focused commands `npm run typecheck`, `npm run test:options-evidence-export`
(17 tests) and `npm run test:options-evidence-export-io` (22 tests) pass. A fixture
array initially widened its component string type; an explicit typed array fixed
the error without changing compiler rules. Tests include concurrent source changes,
new frames during copy, write/fsync failure, links/locks, tampering, missing/extra
payloads, partial-package retention, original CRLF/source clocks, corrupt source
bytes and verification after current sources disappear. `npm run alpha:validate`
passed **2,839/2,839 tests across 108 components** in 47,296 ms, including strict
typecheck, documentation, scope and Git checks. The
[checkpoint](status/evidence-export.json) binds all seven copied source hashes,
the independent verification and sixteen unchanged accepted artifacts. The active
host configuration is unchanged. No validation failures remain; warnings concern
uncommitted changes and Git line endings.

This local copy does not protect against loss of the computer/disk. Before/after
inventory matching is not an atomic cross-store transaction. The exporter does
not parse or repair source journals: even corrupt source bytes can be retained
as evidence, and a matching checksum does not certify semantic recovery or
publisher authenticity. Existing repository commands remain responsible for
semantic validation. No source journals, clocks, research plans, host scheduling,
accounts or orders were changed. No source request or paid resource was used.

Next keep the package intact and evaluate the prospective opening window when
actual data arrives. A later completed-window export needs a new package ID;
there is no automatic export/restore schedule. Git commit and push follow the
Owner's standing authorization after review and validation.
