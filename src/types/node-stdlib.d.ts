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
  export function readFileSync(path: string): Uint8Array;
  export function lstatSync(path: string): {
    readonly size: number;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  export function realpathSync(path: string): string;
  export function readdirSync(path: string): string[];
  export function renameSync(oldPath: string, newPath: string): void;
  export function rmdirSync(path: string): void;
  export function rmSync(
    path: string,
    options?: { readonly recursive?: boolean; readonly force?: boolean },
  ): void;
  export function statSync(path: string): { readonly size: number };
  export function truncateSync(path: string, length?: number): void;
  export function unlinkSync(path: string): void;
  export function statSync(
    path: string,
    options: { readonly bigint: true },
  ): {
    readonly dev: bigint;
    readonly ino: bigint;
    readonly size: bigint;
    readonly mtimeNs: bigint;
  };
  export function writeFileSync(
    path: string | number,
    data: string | Uint8Array,
    options?: { readonly encoding?: "utf8"; readonly flag?: string },
  ): void;
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
      readonly env?: Readonly<Record<string, string>>;
    },
  ): SpawnSyncResult;

  export interface ChildProcessWithoutNullStreams {
    readonly stdout: {
      setEncoding(encoding: "utf8"): void;
      on(event: "data", listener: (chunk: string) => void): void;
    };
    readonly stderr: {
      setEncoding(encoding: "utf8"): void;
      on(event: "data", listener: (chunk: string) => void): void;
    };
    readonly exitCode: number | null;
    kill(signal?: "SIGTERM"): boolean;
    once(event: "exit", listener: (code: number | null) => void): void;
  }

  export function spawn(
    command: string,
    args: ReadonlyArray<string>,
    options: {
      readonly stdio: readonly ["ignore", "pipe", "pipe"];
      readonly windowsHide: boolean;
    },
  ): ChildProcessWithoutNullStreams;
}

declare module "node:events" {
  export function once(
    emitter: {
      once(event: "exit", listener: (code: number | null) => void): void;
    },
    event: "exit",
  ): Promise<readonly [number | null]>;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function basename(path: string, suffix?: string): string;
  export function dirname(path: string): string;
  export function join(...paths: ReadonlyArray<string>): string;
  export function resolve(...paths: ReadonlyArray<string>): string;
  export const sep: string;
}

declare module "node:process" {
  export const argv: readonly string[];
  export function cwd(): string;
  export const env: Readonly<Record<string, string | undefined>>;
  export const execPath: string;
  export let exitCode: number | undefined;
  export function kill(pid: number, signal?: 0 | string): true;
  export const pid: number;
  export const hrtime: {
    bigint(): bigint;
  };
  export const versions: Readonly<{ readonly node: string }>;
  export const stdout: { write(value: string): boolean };
  export const stderr: { write(value: string): boolean };
  const process: {
    readonly argv: readonly string[];
    exitCode: number | undefined;
    readonly stdout: { write(value: string): boolean };
    readonly stderr: { write(value: string): boolean };
  };
  export default process;
}

declare module "node:crypto" {
  export interface Hash {
    update(data: string, inputEncoding?: "utf8"): Hash;
    update(data: Uint8Array): Hash;
    digest(encoding: "hex"): string;
  }

  export function createHash(algorithm: "sha256"): Hash;
  export function randomBytes(size: number): Uint8Array;
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
