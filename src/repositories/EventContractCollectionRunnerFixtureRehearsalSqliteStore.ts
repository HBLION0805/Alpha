import { existsSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  CollectionRunnerRehearsalPreparationStorePort,
} from "../engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPreparation";
import type {
  EventContractCollectionRunnerRepository,
} from "./EventContractCollectionRunnerRepository";
import {
  createNewCollectionRunnerFixtureRehearsalSqliteProfile,
  inspectCollectionRunnerFixtureRehearsalSqliteProfile,
  type CollectionRunnerFixtureRehearsalSqliteProfileReadiness,
} from "./EventContractCollectionRunnerFixtureRehearsalSqliteMigrationV3";
import type {
  OpenEventContractCollectionRunnerSqliteStoreOptions,
} from "./EventContractCollectionRunnerSqliteStore";
import {
  createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository,
  type DurableFixtureRehearsalRepository,
} from "./SqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository";
import {
  createSqliteEventContractCollectionRunnerRepository,
} from "./SqliteEventContractCollectionRunnerRepository";

const STORE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

export class EventContractCollectionRunnerFixtureRehearsalSqliteStore
  implements CollectionRunnerRehearsalPreparationStorePort {
  readonly #database: DatabaseSync;
  readonly #readiness: CollectionRunnerFixtureRehearsalSqliteProfileReadiness;
  readonly #frozen: boolean;
  #closed = false;

  private constructor(
    database: DatabaseSync,
    readiness: CollectionRunnerFixtureRehearsalSqliteProfileReadiness,
    frozen: boolean,
  ) {
    this.#database = database;
    this.#readiness = readiness;
    this.#frozen = frozen;
  }

  public static open(
    options: OpenEventContractCollectionRunnerSqliteStoreOptions,
  ): EventContractCollectionRunnerFixtureRehearsalSqliteStore {
    const storeId = options.storeId ?? "collection-runner";
    if (!STORE_ID.test(storeId)) {
      throw new Error("Fixture rehearsal SQLite store identity is invalid.");
    }
    const candidate = resolve(
      options.rootDirectory,
      `${storeId}.sqlite3`,
    );
    let readiness: CollectionRunnerFixtureRehearsalSqliteProfileReadiness;
    if (existsSync(candidate)) {
      if (lstatSync(candidate).isSymbolicLink() || !lstatSync(candidate).isFile()) {
        throw new Error("Fixture rehearsal SQLite store path is unsafe.");
      }
      readiness = inspectCollectionRunnerFixtureRehearsalSqliteProfile({
        rootDirectory: options.rootDirectory,
        storeId,
      });
    } else {
      readiness = createNewCollectionRunnerFixtureRehearsalSqliteProfile({
        rootDirectory: options.rootDirectory,
        storeId,
        applicationBuildFingerprint: options.applicationBuildFingerprint,
        appliedAtUtc: options.appliedAtUtc,
      });
    }
    const database = new DatabaseSync(readiness.storePath, {
      open: true,
      readOnly: false,
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
      timeout: 5000,
      defensive: true,
    });
    try {
      database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF;
PRAGMA temp_store = MEMORY;
`);
      const frozen = Number(Object.values(database.prepare(`
SELECT COUNT(*)
FROM fixture_rehearsals
WHERE lifecycle_state = 'EVIDENCE_FROZEN'
`).get() ?? {})[0]) > 0;
      database.exec(
        frozen
          ? "PRAGMA query_only = ON;"
          : "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
      );
      return new EventContractCollectionRunnerFixtureRehearsalSqliteStore(
        database,
        readiness,
        frozen,
      );
    } catch (error) {
      database.close();
      throw error;
    }
  }

  public getReadiness(): CollectionRunnerFixtureRehearsalSqliteProfileReadiness {
    this.#assertOpen();
    return this.#readiness;
  }

  public createRunnerRepository(): EventContractCollectionRunnerRepository {
    this.#assertOpen();
    this.#assertMutable();
    return createSqliteEventContractCollectionRunnerRepository(this.#database);
  }

  public createDurableRehearsalRepository():
    DurableFixtureRehearsalRepository {
    this.#assertOpen();
    this.#assertMutable();
    return createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
      this.#database,
    );
  }

  public isEvidenceFrozen(): boolean {
    this.#assertOpen();
    return this.#frozen;
  }

  public close(): void {
    if (this.#closed) return;
    this.#database.close();
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("Fixture rehearsal SQLite store is closed.");
    }
  }

  #assertMutable(): void {
    if (this.#frozen) {
      throw new Error(
        "EVIDENCE_FROZEN fixture rehearsal stores expose no mutable repository.",
      );
    }
  }
}
