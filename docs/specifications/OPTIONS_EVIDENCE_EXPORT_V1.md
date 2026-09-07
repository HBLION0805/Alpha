# Local options evidence export v1

Task OPT-EXPORT-1. Reviewed design, September 7, 2026 UTC. Use current agent
settings; bounded local persistence work under the Owner's development and
record-retention direction. No new source, credentials, service or paid resource.

## Purpose

Save an independently verifiable local copy of the selected prospective study
and six fixed context/research/trade journals before the first market window.
The package helps preserve original evidence and closed-trade reviews. It is
not an off-device backup, archive of every workspace file or automatic restore.

## Exact scope

`options:evidence-export -- --create <study-id> <package-id>` reads only:

- `options-paper/sessions.ndjson`
- `options-historical-replay/runs.ndjson`
- `options-market-evidence/imports.ndjson`
- `options-driver-monitor/refreshes.ndjson`
- `options-treasury-rates/retrievals.ndjson`
- `options-btc-context/retrievals.ndjson`
- The named Robinhood study's plan and numbered frame artifacts, matching
  collection-attempt artifacts and immutable closeout reports.

All sources are beneath fixed `data/runtime` paths. The selected plan must exist;
other missing components are recorded explicitly. Self-contained plan/frame and
research records preserve their embedded source evidence. Unrelated captures,
debug files, host OAuth/settings, environment files, code and other studies are
excluded. Do not follow paths found inside any source body.

One new directory under ignored `data/runtime/options-evidence-exports/<id>`
contains exact byte copies named `payload-0001.bin` etc., and a manifest with
fixed source mappings, byte counts, SHA-256 hashes, actual start/completion clocks,
explicit missing components and a manifest fingerprint. Write the manifest last
with exclusive creation after independently re-reading copied payloads. Existing
or partial package IDs cannot be overwritten, resumed, cleaned or deleted.

`--verify <package-id>` validates a bounded exact manifest, filename/source scope,
hashes, counts, clocks and every payload without consulting current source stores.
It refuses missing, extra, linked, malformed or changed package entries. The
command exposes no restore, source-file write, arbitrary URL/root or deletion.

## Consistency and limits

Before copying, check source locks and snapshot the bounded path inventory and
content hashes. After copying, repeat source inventory/lock/hash checks. Changed
or newly missing/added sources fail and leave an explicitly incomplete package.
This detects ordinary concurrent changes; it is not an atomic cross-store
transaction or a guarantee against a malicious writer changing and restoring
bytes between checks. The manifest must state this limit.

Use lstat/fstat identity/size checks, no symlinks/junctions/hard links, fixed file
limits (32 MiB Treasury; 16 MiB other journals; 2 MiB study artifacts), maximum
400 files and 64 MiB total. Keep errors fixed and source text out of error output.
No source re-parsing means corrupted source bytes can be preserved for analysis;
successful package verification confirms copied bytes, not journal semantic
recovery, authenticated market data, replay readiness or profitability.

## Acceptance

Test missing components, byte and timestamp preservation, strict IDs/paths,
bounded inventories, links/locks, source changes during copy, incomplete writes,
existing-ID refusal, corrupt/extra/missing payloads, manifest tampering and
independent verification after sources change. Run focused/full validation, create
one actual package, verify it in a new process and confirm all source hashes and
host scheduling unchanged. Do not automatically schedule exports in this version.
