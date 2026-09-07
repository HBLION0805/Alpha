# Selected observation evidence package delivery

September 7, 2026. OPT-RESEARCH-EVIDENCE-1 extends local workstream 04.

`options:research-evidence -- --create <observation-id> <new-package-id>` verifies
one observation and preserves it together with both exact prerequisite pairs.
`--verify <package-id>` needs only the seven-file package: it restores six data
files in a fresh temporary workspace and calls the existing observation verifier,
then checks the package again and removes only that verified temporary workspace.
Original study-based export v1/v2 behavior and all source journals remain unchanged.

Changed files: the [specification](specifications/OPTIONS_RESEARCH_EVIDENCE_PACKAGE_V1.md),
new CLI and 13 tests, package/bundle command registration, this delivery and
[checkpoint](status/research-evidence-package.json), plus handoff/roadmap/current
progress pointers. This prevents losing the protocol or context required to
recover a saved note; it adds no trade, source refresh or automatic strategy rule.

Focused command `node node_modules/tsx/dist/cli.mjs scripts/options-research-evidence.test.mjs`
passed 13/13. Coverage includes exact bytes, duplicate/partial packages, clocks,
missing files, foreign paths/IDs, rehashed corruption, unsafe links, encoding and
size limits, and fresh-process recovery with only the seven package files.
Full `node scripts/alpha-validate.mjs`, actual-clock rehearsal and protected-byte
results are recorded in the checkpoint. Final Git refs are in the completion report.

The copy clock is observed after six fsync/close writes and before the manifest
write; it is not the manifest's completed-write clock. Local hashes/clocks are
not externally attested, cross-store atomic or evidence of feature completeness.
This is a local package, not an off-device backup or active runtime restoration.
Existing partial packages remain untouched. NO_TRADE notes stay observations,
with unknown outcomes and zero samples, without replay or execution permission.

The overall baseline stays 4 LOCAL_VALIDATED / 3 PARTIAL / 3 NOT_VALIDATED out of
10 workstreams. No first-paper gate advanced: three local components are available,
while qualified quotes, the Robinhood source adapter and the real-price full run
remain open. Next useful work is a bounded adapter qualification checklist based
on existing schema evidence, to assess the frozen opening series when it arrives.
Do not implement assumed source semantics or advance a gate without that evidence.
