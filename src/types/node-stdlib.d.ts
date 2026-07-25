declare module "node:fs" {
  export function appendFileSync(
    path: string,
    data: string,
    options?: { readonly encoding?: "utf8"; readonly flag?: string },
  ): void;
  export function closeSync(fd: number): void;
  export function existsSync(path: string): boolean;
  export function fsyncSync(fd: number): void;
  export function mkdirSync(
    path: string,
    options?: { readonly recursive?: boolean },
  ): string | undefined;
  export function mkdtempSync(prefix: string): string;
  export function openSync(path: string, flags: string): number;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function lstatSync(path: string): {
    readonly size: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  export function realpathSync(path: string): string;
  export function rmSync(
    path: string,
    options?: { readonly recursive?: boolean; readonly force?: boolean },
  ): void;
  export function statSync(path: string): { readonly size: number };
  export function writeFileSync(path: string | number, data: string): void;
  export function writeSync(fd: number, data: string): number;
}

declare module "node:child_process" {
  export interface SpawnSyncError extends Error {
    readonly code?: string;
  }

  export interface SpawnSyncResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly status: number | null;
    readonly signal: string | null;
    readonly error?: SpawnSyncError;
  }

  export function spawnSync(
    command: string,
    args: ReadonlyArray<string>,
    options: {
      readonly cwd: string;
      readonly input: string;
      readonly encoding: "utf8";
      readonly shell: false;
      readonly timeout: number;
      readonly maxBuffer: number;
      readonly windowsHide: boolean;
      readonly killSignal: "SIGTERM";
    },
  ): SpawnSyncResult;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: ReadonlyArray<string>): string;
  export function resolve(...paths: ReadonlyArray<string>): string;
  export const sep: string;
}

declare module "node:process" {
  export const env: Readonly<Record<string, string | undefined>>;
  export const execPath: string;
  export const versions: Readonly<{ readonly node: string }>;
}

declare module "node:crypto" {
  export interface Hash {
    update(data: string, inputEncoding?: "utf8"): Hash;
    digest(encoding: "hex"): string;
  }

  export function createHash(algorithm: "sha256"): Hash;
}

declare module "node:sqlite" {
  export interface DatabaseSyncOptions {
    readonly open?: boolean;
    readonly readOnly?: boolean;
    readonly enableForeignKeyConstraints?: boolean;
    readonly enableDoubleQuotedStringLiterals?: boolean;
    readonly allowExtension?: boolean;
    readonly timeout?: number;
    readonly readBigInts?: boolean;
    readonly returnArrays?: boolean;
    readonly allowBareNamedParameters?: boolean;
    readonly allowUnknownNamedParameters?: boolean;
    readonly defensive?: boolean;
  }

  export interface StatementResultingChanges {
    readonly changes: number | bigint;
    readonly lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    get(...anonymousParameters: ReadonlyArray<unknown>): Record<string, unknown> | undefined;
    all(...anonymousParameters: ReadonlyArray<unknown>): Array<Record<string, unknown>>;
    run(...anonymousParameters: ReadonlyArray<unknown>): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export function backup(
    sourceDb: DatabaseSync,
    path: string,
    options?: {
      readonly rate?: number;
      readonly progress?: (
        progressInfo: Readonly<{
          readonly totalPages: number;
          readonly remainingPages: number;
        }>,
      ) => void;
    },
  ): Promise<void>;
}
