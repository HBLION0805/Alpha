# Private case evidence export and isolated recovery V1

Delivered September 20, 2026 (New York). This adds case orchestration to the
existing authorities; it does not change trading, research or scheduling rules.

## Use

In **Trade journal → Evidence loop → Export private case evidence**, choose
**Preview private export**, review included / missing records, unresolved
references and privacy, then **Create local evidence bundle**. Merely opening or
refreshing the page creates nothing. The protected local API uses the existing
origin/session checks. The result shows an export ID and logical private location,
without a user-home path. Preview pins its evidence and clock; changes require a
new preview. Repeated explicit exports create distinct immutable packages.

Developer commands:

```text
npm run options:case-export -- --preview <ledger-id> <case-id>
npm run options:case-export -- --create <ledger-id> <case-id> <preview-fingerprint> <as-of>
npm run options:case-export -- --verify <export-id> <case-id>
npm run options:case-export -- --recover-isolated <export-id> <case-id>
```

Recovery accepts no destination. It creates a new temporary validation workspace,
reopens recovered authorities, compares the original-clock view and removes only
that temporary workspace. It never restores into the production workspace.

## Evidence boundaries and implementation

- Existing safe export IO, 400-file / 64-MiB limits, business fingerprints,
  manual reconciler, source/expectation/scenario validators, Prediction Log,
  Alpha Journal, and conditional Research / Strategy exporters are reused.
  No dependency or second export engine was added.
- The resolver follows exact case/plan bindings, source paths, pinned
  fingerprints and revision lineage. It excludes unrelated cases and source
  caches. Existing bounded comparison excerpts retain their original coverage
  and attribution. Uncopied provenance links remain unresolved **in the bundle**;
  that does not assert the original local file is missing.
- Bundles contain `manifest.json`, `records/`, `references/case-view.json` and
  `validation.json`. SHA-256 covers file bytes and the manifest; original business
  IDs retain their algorithms. Hashes are not authentication against replacing an
  entire package and its manifest. Known secrets and credential fields are rejected.
- Original manual payloads, receipts, global sequences and business events are
  retained. A selected case cannot reproduce an unrelated shared ledger chain.
  Isolated replay therefore uses local ordering wrappers in validation projections,
  while preserving the original envelopes separately. It is not a writable
  production-ledger restore. Source head hashes are provenance, not proof of
  omitted unrelated events.
- Missing original dependencies remain missing, including transitive gaps.
  Such records explicitly retain fingerprint-only / unavailable-reference
  qualification. A missing file that the manifest says was included fails.
  No absent Prediction, trade, outcome or Journal is synthesized.

## Actual acceptance

The real employment case was exported through the actual-workspace workbench at
`2026-09-21T02:40:46.482Z`. Export ID:
`gld-employment-20261002-20260921024046482-b1544fdd`.

The 14 records / 17 files include three original manual draft events, three Host
analysis drafts, four saved comparisons, two copied source selections, one
expectation snapshot and one scenario record. No original body cache or raw market
history was bundled. Nineteen provenance edges remain unresolved in the bundle,
including saved historical capture references; they were not promoted to inputs.

SHA-256 manifest:
`b4da293970e5dec2251370f6cddab8ca07cb9b435a5b713b852a4844b8e785d0`.

Independent CLI recovery and re-open passed. The private acceptance receipt is
`data/runtime/options-workbench-development/case-export-recovery-gld-employment-20261002-20260921024046482-b1544fdd.json`
(checked `2026-09-21T02:44:15.270Z`). Source inventories still match the export;
original ledger head and case versions remain unchanged. Temporary recovery
workspaces were removed; the real export remains in the ignored private area.

Preserved: **DRAFT / Prediction NOT_CREATED / NO_TRADE / null P&L /
Assumption EV NOT_CALCULABLE / Validated EV UNKNOWN**. The case remains waiting
for external conditions. Routine natural acceptance and first real targeted
quote acceptance retain their independent pre-existing states.

Browser acceptance used the actual workspace on port 4173, saved data only
(`refreshContext=false`, no installed configuration changed). Desktop 1271px
and mobile 390px showed preview, privacy, included/missing evidence and the created
ID. The export region measured 341px client/scroll width on mobile; no console
errors. **Whole-page mobile overflow is not passed:** the pre-existing reported
spread table extends to 718px outside the new region. It was left unchanged under
this task's narrow scope. The temporary development server is stopped afterward.

## Tests, costs and limits

- New focused suite: **26 passed, 0 failed**. Full synthetic closed case includes
  frozen plan, locked prediction, fills, outcome, review, ledger trade review and
  Journal. Legacy no-prediction, mixed-case isolation, missing original package,
  exact version recovery, source immutability and repeat exports also pass.
- Missing/modified manifest, missing/tampered/truncated file, wrong hash,
  duplicate/foreign record, wrong case, unsupported schema, invalid pinned
  reference, extra file, secret content and path traversal fail closed.
- Existing Evidence Loop: **22/22 passed**. TypeScript passed. Final product-code
  full Alpha validation: **5,025 passed, 0 failed**, including existing Prediction,
  Journal, Research/Strategy export, Manual Ledger, Scenario and Source suites.
  Working and staged whitespace checks pass. Full output stays private in
  `data/runtime/options-workbench-development/case-export-validation.log`.
- Initial local failures were an assertion-style ID validator used as a return
  value, import paths, and fixture assumptions about precision/frozen edits. They
  were fixed before final verification; no frozen production rule was loosened.
- Market calls **0**, public source reads **0**, external model calls **0**;
  Jev Phase 2 samples/calls **0**. No subscription, cloud service or dependency.
  Dollar cost **UNKNOWN** without billing evidence. Complexity is a bounded
  cross-store adapter and verification path, not a backup platform.

**Local evidence copy only. Not an off-device backup. Isolation only; no production
restore, trading permission, lifecycle rewrite or change to the frozen case.**

Production conflict/merge restore, off-device backup and broader store mappings
remain separate future work. The old mobile spread-table layout is a disclosed
unrelated limitation; no future market observation is claimed by this delivery.
