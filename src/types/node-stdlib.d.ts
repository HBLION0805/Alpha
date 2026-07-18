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
  export function rmSync(
    path: string,
    options?: { readonly recursive?: boolean; readonly force?: boolean },
  ): void;
  export function statSync(path: string): { readonly size: number };
  export function writeFileSync(path: string | number, data: string): void;
  export function writeSync(fd: number, data: string): number;
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
