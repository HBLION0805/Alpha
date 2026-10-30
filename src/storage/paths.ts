/**
 * Persistent vs regenerable storage. A box reboot wiped data/out (2026-10-30), so artifacts that cannot be regenerated —
 * plan cards, the daily trade plan, alerts history (append-only), flash snapshots, the paper journal — live under
 * journalDir() (env ALPHA_JOURNAL_DIR, default data/journal). data/out keeps only regenerable output (+ "latest" copies).
 * Readers use readPath(): journal first, then the legacy data/out copy. One-time copy: npm run migrate:journal.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const journalDir = () => process.env.ALPHA_JOURNAL_DIR || "data/journal";
export const outDir = () => process.env.ALPHA_OUT_DIR || "data/out";
export const journalPath = (...p: string[]) => join(journalDir(), ...p);
export const outPath = (...p: string[]) => join(outDir(), ...p);
/** journal copy if present, else the legacy data/out copy if present, else the journal path (for "missing" messages) */
export function readPath(journalRel: string, outRel = journalRel): string {
  const j = journalPath(journalRel), o = outPath(outRel);
  return existsSync(j) || !existsSync(o) ? j : o;
}
export const ALERTS_JSONL = "alerts.jsonl";
export const cardRel = (id: string, ext: "md" | "json") => join("cards", `${id}.${ext}`);
export const planRel = (dateEt: string) => join("plans", `${dateEt}.json`);
export const flashRel = (name: string) => join("flash", name);

/** atomic replace (tmp + rename) */
export function writeAtomic(p: string, body: string): void { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); }
/** append-only history: never opens the file for truncation */
export function appendJsonl(p: string, rows: unknown[]): void {
  if (!rows.length) return;
  mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", { flag: "a" });
}
