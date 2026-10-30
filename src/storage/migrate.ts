/**
 * One-time, idempotent copy of persistent artifacts from data/out into the journal (npm run migrate:journal).
 * Never overwrites or deletes: existing journal files are kept (a differing copy is reported as a conflict),
 * alerts.jsonl lines already in the journal are not appended again. data/out is left untouched.
 */
import { appendFileSync, copyFileSync, constants, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ALERTS_JSONL, cardRel, flashRel, journalPath, outPath, planRel, writeAtomic } from "./paths.ts";
import { mergePlanDay } from "./plans.ts";

export interface MigrateReport { copied: string[]; skipped: string[]; conflicts: string[]; alertsAppended: number }

const lines = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : []);
function copyOnce(src: string, dst: string, r: MigrateReport): void {
  if (existsSync(dst)) { (readFileSync(dst).equals(readFileSync(src)) ? r.skipped : r.conflicts).push(dst); return; }
  mkdirSync(dirname(dst), { recursive: true }); copyFileSync(src, dst, constants.COPYFILE_EXCL);
  r.copied.push(dst);
}

export function migrateJournal(): MigrateReport {
  const r: MigrateReport = { copied: [], skipped: [], conflicts: [], alertsAppended: 0 };
  // alerts history: append only lines the journal does not have yet (keeps the legacy order)
  const have = new Set(lines(journalPath(ALERTS_JSONL)));
  const missing = [...new Set(lines(outPath(ALERTS_JSONL)))].filter((l) => !have.has(l));
  const rows = missing.filter((l) => { try { JSON.parse(l); return true; } catch { return false; } }); // verbatim, so a re-run matches them
  if (rows.length) { mkdirSync(dirname(journalPath(ALERTS_JSONL)), { recursive: true }); appendFileSync(journalPath(ALERTS_JSONL), rows.join("\n") + "\n", { flag: "a" }); }
  r.alertsAppended = rows.length;
  const names = existsSync(outPath()) ? readdirSync(outPath()) : [];
  // flash snapshots: data/out/flash-*.json → <journal>/flash/
  for (const f of names.filter((n) => /^flash-.*\.json$/.test(n))) copyOnce(outPath(f), journalPath(flashRel(f)), r);
  // plan cards: data/out/card-<SYM>.json/.md → <journal>/cards/<card id>.json/.md (same layout card.ts now writes)
  const cardJson = names.filter((n) => /^card-.*\.json$/.test(n)), paired = new Set<string>();
  for (const f of cardJson) {
    let id = f.replace(/\.json$/, "");
    try { id = (JSON.parse(readFileSync(outPath(f), "utf8")) as { id?: string }).id || id; } catch { /* keep file name */ }
    copyOnce(outPath(f), journalPath(cardRel(id, "json")), r);
    const md = f.replace(/\.json$/, ".md"); if (names.includes(md)) { paired.add(md); copyOnce(outPath(md), journalPath(cardRel(id, "md")), r); }
  }
  for (const f of names.filter((n) => /^card-.*\.md$/.test(n) && !paired.has(n))) copyOnce(outPath(f), journalPath(join("cards", f)), r);
  // trade plan: today's plan lived only in brief-latest.json → <journal>/plans/<date>.json when that day has no file yet
  try {
    const bf = existsSync(outPath("brief-latest.json")) ? JSON.parse(readFileSync(outPath("brief-latest.json"), "utf8")) : null;
    if (bf?.generatedAt) {
      const date = new Date(bf.generatedAt).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), dst = journalPath(planRel(date));
      if (existsSync(dst)) r.skipped.push(dst);
      else { writeAtomic(dst, JSON.stringify(mergePlanDay(null, { date, generatedAt: bf.generatedAt, verdict: bf.verdict ?? null, plan: bf.plan ?? [] }), null, 2) + "\n"); r.copied.push(dst); }
    }
  } catch { /* unreadable brief: nothing to migrate */ }
  return r;
}
