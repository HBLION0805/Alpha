# Event Contract Collection Runner SQLite Dependency and Migration Foundation v1

## Status

Day15-T3B10-T3A implements the local research-pilot SQLite dependency decision, safe store opening, connection-profile verification, schema migration 001, and fail-closed migration/integrity checks. It is committed and pushed as `3191639fe268b1830ecc1cd70298ef9430db2b4e`.

The separately reviewed T3B repository now consumes this store through a private database boundary. T3A itself does not implement scheduler or worker processes, active lease execution, retries, provider requests, pilot activation, runtime configuration, backup or restore tooling, monitoring, models, recommendations, capital state, brokers, orders, or execution.

## Dependency decision

Alpha uses the `node:sqlite` standard-library module supplied by Node.js. It adds no third-party SQLite npm package.

The minimum supported runtime for this foundation is Node.js `24.12.0` because that release supplies the reviewed synchronous database options, including defensive mode. The package manifest and lockfile record this requirement.

This decision is approved only for the single-host local research pilot:

- the synchronous API keeps the migration boundary small and deterministic;
- no native addon download, separate package license, or additional package supply chain is introduced;
- Node owns the SQLite binary/runtime compatibility boundary;
- the module remains documented by Node as active development, so it is not approved as Alpha's commercial or production persistence boundary.

Production persistence still requires a separate database, security, operations, encryption, retention, backup, restore, and supportability decision.

## Official evidence reviewed

- Node.js v24.12.0 `node:sqlite` API: <https://nodejs.org/download/release/v24.12.0/docs/api/sqlite.html>
- SQLite PRAGMA reference: <https://www.sqlite.org/pragma.html>
- SQLite write-ahead logging: <https://www.sqlite.org/wal.html>
- SQLite STRICT tables: <https://www.sqlite.org/stricttables.html>

## Runtime boundary

The only public implementation surface:

1. validates a lowercase traversal-free store ID;
2. creates and canonicalizes the caller-approved runtime root;
3. rejects non-regular or symbolic-link database and sidecar identities;
4. opens `<store-id>.sqlite3` using `node:sqlite` with extensions and ambiguous parameter behavior disabled;
5. enables defensive mode;
6. applies and reads back the required pragma profile;
7. verifies SQLite `>= 3.37.0`, JSON validity functions, the Node online-backup API, and WAL checkpoint capability;
8. runs `quick_check` and `foreign_key_check`;
9. applies migration 001 atomically only to an empty unversioned store;
10. verifies the exact migration checksum, `user_version`, schema contract, table catalog, and `STRICT` status;
11. exposes immutable sanitized readiness metadata and the resolved store path;
12. closes idempotently.

No raw database handle or arbitrary SQL method is exposed. Domain engines and future repository adapters must not receive a `DatabaseSync` instance.

## Connection profile

The store requests read/write local open, foreign-key enforcement, disabled double-quoted string literals, disabled extension loading, a five-second busy timeout, bounded JavaScript integer representation, object rows, disabled ambiguous named parameters, and SQLite defensive mode.

It executes and verifies:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF;
PRAGMA temp_store = MEMORY;
```

Failure to read back the required values blocks the store.

## Migration 001

Migration `001_collection_runner_foundation` creates the exact 14-table `STRICT` schema specified by T3B10-T2. Its identity is the SHA-256 digest of the exact migration SQL. The migration and its metadata row execute in one `BEGIN IMMEDIATE` transaction.

The foundation fails closed when:

- an unversioned store already contains a user table;
- `user_version` is missing, inconsistent, or newer;
- migration history is absent, duplicated, altered, or has an unknown contract;
- the migration checksum differs;
- a required table is missing or an unexpected user table exists;
- any contract table is not `STRICT`;
- `quick_check` or `foreign_key_check` reports a problem;
- SQLite or required JSON capability is unavailable.

Migration code does not repair, delete, overwrite, or downgrade an existing store. A failed migration is rolled back and the original failure is preserved as its cause.

## Data and authority boundary

T3A authorizes no repository writes by itself. Its fixed store boundary is now consumed by the separately reviewed T3B named repository implementation. Tests create database files only in operating-system temporary directories and remove them afterward. The application creates no runtime store by default.

The runtime directory is Git-ignored:

```text
data/runtime/event-contract-collection/
```

No raw provider body, URL query, header, credential, personal financial record, portfolio state, probability, recommendation, P&L, broker content, order, or execution instruction belongs in this database.

## Validation

Network-free tests cover dependency metadata, approved-root placement, pragma readiness, all 14 `STRICT` tables, checksum/version history, idempotent reopen, invalid identities and configuration, future and altered migrations, missing history, unexpected and unversioned schemas, strict typing, foreign keys, malformed database bytes, immutable readiness, and absence of raw SQL/mutation methods.

## Deferred work

T3B10-T3B remains separately owner-gated and may implement only named repository ports and transactions T2 through T10 from the parent SQLite design.

T3B10-T3C remains separately owner-gated for read-only startup recovery, invariant verification, backup, restore, and corruption drills.

Active scheduling, clocks, lease renewal, retry execution, provider composition, live collection, monitoring, and pilot activation remain later tasks.

## Related specifications

- [Event Contract Collection Runner SQLite](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md)
- [Event Contract Collection Runner Contracts](EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md)
- [Event Contract Collection Runner Architecture](EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md)
- [Production Persistence and Recovery Architecture](../PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md)
