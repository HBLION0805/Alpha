# Capital policy preflight delivery

Daily guidance and Trade planner now explain a conflict that fresh quotes cannot
resolve: the saved $100–$500 all-in range exceeds the independent $25 full-premium
stress cap. At $1,000 declared equity, the planned-loss cap also remains $5.
The new preflight is separate from original guidance and trade calculations.
See [specification](specifications/OPTIONS_CAPITAL_POLICY_V1.md) and
[checkpoint](status/capital-policy.json).

At the saved 20% premium stop, the three one-contract capital illustrations show:

| All-in capital | Planned loss with current unknown costs | Full-premium stress |
| --- | --- | --- |
| $100 | Unknown; at least $20 | $100 |
| $300 | Unknown; at least $60 | $300 |
| $500 | Unknown; at least $100 | $500 |

These are capital illustrations, not quoted contracts or entries. Exact planned
loss stays null. Known fees are subtracted from all-in capital to obtain premium
and counted once in planned loss; slippage enters planned loss only. For an
unsaved $1 fee / $2 exit-reserve example, the $100 row gives $99 premium and
$22.80 planned loss. This example was discarded after browser verification.

The shared fixed-risk function uses the original 0.5% / $25 rules. Necessary
bounds preserve integer-cent floor behavior; the zero-known-cost planned-capital
bound is $25.04, but the independent stress bound limits combined capacity to
$25. Neither bound proves a listed whole contract or an executable stop. A
nonempty interval is labeled capital checks only. No cap is editable here.

## Implementation and validation

- Added `OptionsCapitalPolicy.ts`; extracted unchanged fixed limits in
  `OptionsRetailFeasibilityEngine.ts` to avoid competing sources of risk policy.
- Added `capital-policy.js`, saved-setting panels in guidance/planning, and a
  protected calculation-only `/api/capital-policy` route through the original
  service and client allowlists. No persistence or source route was added.
- The assumptions form can preview without saving. Editing, discarding or
  saving clears its old preview. Saved settings and planner drafts are labeled
  separately. The existing settings-save operation retains its original meaning.
- Added a 32-case test suite and package/aggregate registration. Specification,
  architecture, operating guides and current-state documents link this delivery.

`npm run test:options-capital-policy` passed **32/32**. The final
`node scripts/alpha-validate.mjs` passed **4,148 tests across 163 components**, zero
failures, including TypeScript. Its log is
`data/runtime/options-workbench-development/capital-policy-final-validation.log`.
An independent comparison with the original engine from commit `1bd5202`
confirmed identical complete outputs for **1,084** valid/invalid scenarios.

Browser testing initially caught a missing client allowlist entry. It was fixed
and covered by an actual client-to-local-server test. Final browser checks
verified preview, $22.80 cost arithmetic, edit invalidation and discard/reset.
Desktop width/scroll width were both 1265px; at 390x844 mobile both were 375px.
The 533px table stayed inside its 307px scrolling container. No browser console
errors remained. Temporary form edits and the viewport override were reset.

## Actual local evidence and remaining work

The existing service was restarted through the approved network execution path,
after matching only the exact Alpha process and loopback listener. PID 13452
serves the new projection; hourly public context remains enabled. No additional
source acquisition or Host schedule change was performed for this development.
The preserved 23:00 public receipts retain their actual original source clocks.

The exclusive artifact
`data/runtime/options-workbench-development/capital-policy-after-20260909.json`
was recorded at **2026-09-09T03:25:53.575Z**. SHA-256:
`bb61444a39e6a71cae1d29c159515d052480c3c58b266677b4de69e29151b4a0`.
It independently recomputes the live projection and checks **20** preserved file
hashes, including prior failed/recovered collection receipts, original reports,
settings, candidate snapshots and frozen event plans. Owner ledger events remain
zero, with head
`a9d04c6517e2143e9d74dac740a1a2fd92511b1324392f4ec0a2816e52784e1c`.
Runtime artifacts remain excluded from Git. `git diff --check` passed; expected
CRLF normalization warnings are informational.

No unresolved implementation failure remains. The actual capital conflict is
still active: no risk setting was changed. The Owner was asked to clarify the
acceptable planned dollar loss and full-premium dollar exposure before any
separate policy change. Eligible quote/session/cost evidence still gates a
Robinhood real-price paper adapter. No account/order call, trade, outcome,
probability or first-real-price gate was created by these diagnostics.

Workstream 01 gains this bounded local preflight. The fixed overall comparison
remains **4 local / 3 partial / 3 not validated**; first-paper-flow gates remain
**3 available / 3 open**. Change set is based on `1bd5202` on
`codex/gld-ibit-options-foundation`; the Owner's standing authorization covers
the reviewed commit/push. The final conversation reply records its Git result.
