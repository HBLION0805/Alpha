# Local context capture and isolated recovery

September 7, 2026. Task OPT-CONTEXT-MANIFEST-1, capture delivery.
Base `7acc6d5`. Automatic development routed at `2026-09-07T20:02:11.429Z`
with deadline `2026-09-07T20:12:11.429Z`.

## Delivered behavior

`npm run options:context-capture -- --inspect` reconstructs current local context
without saving. `--capture <new-id>` saves the five recovered source histories,
unchanged cutoff v2 output and exact member manifest in an exclusive payload.
Only after the existing writer has completed fsync and closed the payload does
the command read its save-observation clock. A separate immutable receipt binds
the payload's exact bytes, hashes and that clock. No historical capture-time
argument is accepted.

`--verify <id>` reads only the saved pair, recomputes the original context and
members, checks exact canonical envelopes and byte hashes, and reads an actual
verification clock after those checks. Captured source clocks remain unchanged.
The pure manifest itself still correctly has no save receipt; the separate pair
verification supplies the local save-observation evidence.

An exclusively created capture directory reserves the whole pair. Empty,
payload-only and receipt-only attempts cannot be resumed or overwritten. Recovery
rejects extra entries, unsafe paths/links, changed bytes, corrupt structures and
regressing clocks without repairing them. Payloads are capped at 64 MiB and
receipts at 64 KiB; strict UTF-8, duplicate-key and 32-level depth checks reuse
the existing parser. Limits can reject a large otherwise valid set and never
truncate it into apparently complete evidence.

## Actual evidence

Capture `context-first-local-20260907` selected existing source records at
`2026-09-07T20:07:38.974Z`, constructed at `20:07:39.057Z`, with payload-save
observation `20:07:39.199Z`. It retains 174 members across all five available
stores, with no missing or blocked store. This is a local context capture, not
a news refresh, a historical decision record or proof of sufficient freshness.

An independent process in a temporary workspace containing only the pair
recomputed it at `2026-09-07T20:08:30.198Z`. The temporary workspace was removed
after its path was checked; original files remain intact. The exact hashes,
validation totals and preservation checks are in [the checkpoint](status/context-capture.json).

## Changes, validation and review

Changed files: the new capture command and its tests; command/test registration
in package.json and the full validation bundle; a narrow runtime ignore; this
delivery and checkpoint; HANDOFF/ROADMAP continuation notes. Existing source,
cutoff, manifest, risk, collection and trade/review code remains unchanged.

Commands: the 19 capture tests through tsx, `node scripts/alpha-validate.mjs`,
actual `--capture`, isolated new-process `--verify`, protected-file hash checks,
JSON/link checks and `git diff --check`. Review covered save-before-clock ordering,
partial-pair preservation, strict recovery, source isolation and truthful missing
coverage. A preliminary one-off rehearsal command imported realpathSync from the
wrong built-in module and failed before creating files; the corrected rehearsal
above succeeded. No application test remains failed.

## Limits and continuation

Local wall clocks and checksums are consistency evidence, not external timestamp
attestations or provider authentication. Coherent manual rewrites of all local
evidence cannot be excluded. Stores remain non-atomic across sources. The new
receipt does not change earlier plans or fill the fifteen existing cases' missing
feature/protocol clocks. There is no trade decision, signal, calibrated win rate,
size increase, market call, brokerage transaction or automatic order.

Next bounded unit: specify prospective research decision/protocol references to
these receipts using the existing sample contracts; require actual saved evidence
before a new decision. Preserve all retrospective declarations and the frozen
opening study. Real-price paper execution still requires the pending quote
qualification. Saving, focused commit and push use the Owner's standing authority;
the final refs are verified in Git history.
