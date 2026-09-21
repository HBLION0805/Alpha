# Private case evidence export / isolated recovery V1

Scope: a bounded, private, local case-level orchestration layer. Reuse the existing
safe export IO, business validators, repositories and Prediction / Journal /
Research / Strategy exporters. No market, model, scheduler or lifecycle writes.

Preview pins a case, ledger, assessment clock and dependency fingerprint. Explicit
creation copies exact records, checks the source again and writes the manifest
last. Existing bundles are immutable. Limits remain 400 files / 64 MiB. Paths are
allowlisted; symlinks, credentials and unrelated case records are not exports.

The SHA-256 manifest covers all file bytes and the semantic snapshot. Existing
business IDs/fingerprints retain their original algorithms. Hashes detect change;
they do not authenticate an adversary who replaces the whole bundle and manifest.

Shared append-only stores cannot be copied wholesale or represented as intact
after filtering. Original case events, envelope fingerprints and receipt clocks
are retained. Recovery replays their business payloads into an isolated validation
projection using the existing repositories. Its local ordering wrappers are not
the original global chain. No writable production ledger is restored. The source
chain head is provenance, not proof of omitted unrelated events.

Recovery only creates a new temporary directory. Validate manifest, bytes,
business fingerprints and the exact dependency graph before comparing reconstructed
records, exports and evidence-loop view at the original assessment clock. Missing
source references remain explicit; a missing included bundle file fails. Original
UNKNOWN, conflict, coverage, lifecycle and privacy states cannot be promoted.

UI: existing Trade journal / Evidence loop, Preview then Create local evidence
bundle. Show counts, gaps, privacy and logical location only. Developer CLI performs
isolated recovery; it accepts no production restore destination.

Local evidence copy only. Not an off-device backup. No production restore or
trade permission. Real payloads remain in ignored runtime storage; Git contains
code, tests and sanitized acceptance only.
