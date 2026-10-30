/** npm run migrate:journal — one-time, idempotent copy of data/out artifacts into the journal (src/storage/migrate.ts). Safe to re-run. */
import { backupJournal, migrateJournal } from "../storage/migrate.ts";
import { journalDir, outDir } from "../storage/paths.ts";

// snapshot the journal first (never overwritten); no snapshot → no migration
const backup = backupJournal();
console.log(`[migrate:journal] 备份 ${backup ?? "（journal 目录不存在，无需备份）"}`);
const r = migrateJournal();
for (const f of r.copied) console.log(`+ ${f}`);
for (const f of r.conflicts) console.log(`⚠️ 已存在且内容不同，未覆盖：${f}`);
console.log(`[migrate:journal] ${outDir()} → ${journalDir()}：复制 ${r.copied.length} · 已存在 ${r.skipped.length} · 冲突 ${r.conflicts.length} · alerts.jsonl 追加 ${r.alertsAppended} 行`);
