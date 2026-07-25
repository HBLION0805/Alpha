# Event Contract Collection Runner SQLite Recovery, Backup, and Restore v1

## Status

Day15-T3B10-T3C implements the local research-pilot startup recovery report, verified online backup, offline restore-to-new-path boundary, and network-free corruption drills. It is implemented locally and pending owner review.

## Startup recovery

Every store open performs full read-only recovery inspection after migration, schema, pragma, `quick_check`, and foreign-key validation. The immutable report checks full `integrity_check`, migration/schema identity, canonical-record fingerprints, current transition history, admitted provider/mapping authority, evidence/state agreement, attempts, leases, abandoned attempts, recomputed counters, committed-task outbox evidence, and operational pilot state.

Any issue blocks `createRunnerRepository()`. An `ACTIVE` or `STOP_REQUESTED` pilot after open explicitly requires owner resume; the store never silently resumes it.

## Backup and restore

Backups use Node's SQLite online backup API, never ordinary live-file copying. Existing backup or manifest identities are never overwritten. Each independently verified backup has an immutable canonical manifest binding source identity, exact paths, schema/migration lineage, page and byte counts, SHA-256 database digest, retention count, and manifest fingerprint.

Restore verifies the exact manifest file, manifest fingerprint, approved backup-root paths, regular-file identities, and backup digest. SQLite writes to a new traversal-free target only. The restored database must pass the complete recovery inspection. Success still declares `ownerSwitchRequired` and `operatorResumeRequired`; this task never changes configuration or resumes a pilot.

## Drills

The 11 focused temporary-store tests cover clean recovery, operational-pilot restart blocking, fingerprint and counter drift, independent backup verification, overwrite prevention, distinct-path restore, backup/manifest tampering, and truncated-database rejection.

## Exclusions

T3C adds no process lock, scheduler, worker, timer, heartbeat loop, automatic lease resolution, retry executor, real pilot activation/resume, provider request, outbox publisher, retention deletion, configured-store switch, repair, model, recommendation, portfolio, broker, order, or execution behavior.

## Related specifications

- [SQLite Schema and Transaction Boundaries](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md)
- [SQLite Dependency and Migration](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md)
- [SQLite Repository](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md)
