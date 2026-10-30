import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendJsonl, journalDir, journalPath, readPath, outPath } from "../src/storage/paths.ts";
import { savePlanDay, loadPlanDay, mergePlanDay } from "../src/storage/plans.ts";
import { migrateJournal } from "../src/storage/migrate.ts";
import type { PlanItem } from "../src/options/planlink.ts";

let root = "", jd = "", od = "";
const env0 = { j: process.env.ALPHA_JOURNAL_DIR, o: process.env.ALPHA_OUT_DIR };
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "alpha-journal-")); jd = join(root, "journal"); od = join(root, "out");
  mkdirSync(od, { recursive: true }); process.env.ALPHA_JOURNAL_DIR = jd; process.env.ALPHA_OUT_DIR = od;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  for (const [k, v] of [["ALPHA_JOURNAL_DIR", env0.j], ["ALPHA_OUT_DIR", env0.o]] as const) if (v == null) delete process.env[k]; else process.env[k] = v;
});
const put = (p: string, s: string) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, s); };
const jl = (p: string) => readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const item = (id: string): PlanItem => ({ id, ticker: id.split("-")[3]!, side: "short" } as unknown as PlanItem);

test("journalDir: ALPHA_JOURNAL_DIR override, default data/journal", () => {
  assert.equal(journalDir(), jd);
  delete process.env.ALPHA_JOURNAL_DIR; assert.equal(journalDir(), "data/journal"); assert.equal(journalPath("alerts.jsonl"), join("data/journal", "alerts.jsonl"));
});

test("readPath: journal first, then legacy data/out, else the journal path", () => {
  assert.equal(readPath("flash/flash-a.json", "flash-a.json"), join(jd, "flash/flash-a.json"));
  put(outPath("flash-a.json"), "{}"); assert.equal(readPath("flash/flash-a.json", "flash-a.json"), join(od, "flash-a.json"));
  put(journalPath("flash/flash-a.json"), "{}"); assert.equal(readPath("flash/flash-a.json", "flash-a.json"), join(jd, "flash/flash-a.json"));
});

test("appendJsonl: append-only — earlier history is never truncated; empty batch writes nothing", () => {
  const p = journalPath("alerts.jsonl");
  appendJsonl(p, []); assert.equal(existsSync(p), false);
  appendJsonl(p, [{ n: 1 }]); appendJsonl(p, [{ n: 2 }, { n: 3 }]);
  assert.deepEqual(jl(p).map((r) => r.n), [1, 2, 3]);
});

test("plans: latest plan kept per ET day; history row only when verdict/ids change", () => {
  const a = item("2026-10-30-SPY-short"), b = item("2026-10-30-QQQ-short");
  savePlanDay({ date: "2026-10-30", generatedAt: "2026-10-30T11:30:00Z", verdict: "RESEARCH_OK", plan: [a] });
  savePlanDay({ date: "2026-10-30", generatedAt: "2026-10-30T12:00:00Z", verdict: "RESEARCH_OK", plan: [a] }); // unchanged → no new history row
  savePlanDay({ date: "2026-10-30", generatedAt: "2026-10-30T12:30:00Z", verdict: "NO_TRADE", plan: [] });
  const d = loadPlanDay("2026-10-30")!;
  assert.deepEqual(d.plan, []); assert.equal(d.verdict, "NO_TRADE");
  assert.deepEqual(d.history.map((h) => h.ids), [[a.id], []]);
  assert.deepEqual(mergePlanDay(d, { date: d.date, generatedAt: "x", verdict: "RESEARCH_OK", plan: [a, b] }).history.at(-1)!.ids, [a.id, b.id]);
  assert.equal(loadPlanDay("2026-10-29"), null);
});

test("migrateJournal: copies flash/cards/plan/alerts from data/out; idempotent; never overwrites or duplicates", () => {
  const alerts = [{ at: "2026-10-29T13:00:00Z", headline: "a" }, { at: "2026-10-29T14:00:00Z", headline: "b" }];
  put(outPath("alerts.jsonl"), alerts.map((a) => JSON.stringify(a)).join("\n") + "\n");
  appendJsonl(journalPath("alerts.jsonl"), [alerts[0], { at: "2026-10-30T13:00:00Z", headline: "c" }]); // journal already has a + a newer one
  put(outPath("flash-2026-10-29.json"), '{"v":1}'); put(outPath("flash-2026-10-30.json"), '{"v":2}');
  put(journalPath("flash/flash-2026-10-30.json"), '{"v":"journal"}'); // differs → conflict, kept
  put(outPath("card-NVDA.json"), JSON.stringify({ id: "card-2026-10-29-NVDA-bear-abc" })); put(outPath("card-NVDA.md"), "# NVDA");
  put(outPath("card-AMD.md"), "# AMD (no json)");
  put(outPath("brief-latest.json"), JSON.stringify({ generatedAt: "2026-10-29T12:00:00Z", verdict: "RESEARCH_OK", plan: [item("2026-10-29-SPY-short")] }));
  put(outPath("macro-latest.json"), "{}"); // regenerable → not migrated

  const r1 = migrateJournal();
  assert.equal(r1.alertsAppended, 1);
  assert.deepEqual(jl(journalPath("alerts.jsonl")).map((a) => a.headline), ["a", "c", "b"]); // existing lines untouched, missing appended
  assert.equal(readFileSync(journalPath("flash/flash-2026-10-29.json"), "utf8"), '{"v":1}');
  assert.equal(readFileSync(journalPath("flash/flash-2026-10-30.json"), "utf8"), '{"v":"journal"}');
  assert.deepEqual(r1.conflicts, [journalPath("flash/flash-2026-10-30.json")]);
  assert.equal(readFileSync(journalPath("cards/card-2026-10-29-NVDA-bear-abc.md"), "utf8"), "# NVDA");
  assert.ok(existsSync(journalPath("cards/card-2026-10-29-NVDA-bear-abc.json")) && existsSync(journalPath("cards/card-AMD.md")));
  assert.deepEqual(loadPlanDay("2026-10-29")!.plan.map((p) => p.id), ["2026-10-29-SPY-short"]);
  assert.ok(!readdirSync(jd).includes("macro-latest.json"));
  assert.ok(existsSync(outPath("alerts.jsonl")) && existsSync(outPath("card-NVDA.md")), "data/out left untouched");

  const r2 = migrateJournal(); // re-run: nothing new
  assert.equal(r2.copied.length, 0); assert.equal(r2.alertsAppended, 0);
  assert.equal(jl(journalPath("alerts.jsonl")).length, 3);
});

test("migrateJournal: no data/out at all → empty report, no throw", () => {
  rmSync(od, { recursive: true, force: true });
  assert.deepEqual(migrateJournal(), { copied: [], skipped: [], conflicts: [], alertsAppended: 0 });
});

test("CLIs: no hard-coded data/journal or data/out artifact paths for persistent artifacts", () => {
  const src = (f: string) => readFileSync(new URL(`../src/cli/${f}`, import.meta.url), "utf8");
  for (const f of ["card.ts", "paper.ts", "brief.ts", "earnings.ts", "readiness.ts", "review.ts", "alerts.ts"]) assert.doesNotMatch(src(f).replace(/^\s*\*.*$/gm, ""), /"data\/journal\//, f);
  assert.doesNotMatch(src("card.ts"), /`data\/out\/card-/);
  assert.match(readFileSync(new URL("../scripts/run.sh", import.meta.url), "utf8"), /--jsonl "\$journal\/alerts\.jsonl"/);
});
