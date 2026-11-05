import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDailyBars } from "../src/adapters/bars.ts";

test("loadDailyBars: stale bars → Yahoo fallback warns on stderr", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  writeFileSync(join(dir, "NVDA-bars.json"), JSON.stringify([{ begins_at: "2026-11-02T00:00:00Z", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]));
  const errs: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => { errs.push(a.join(" ")); });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  await loadDailyBars("NVDA", dir, 30, new Date("2026-11-10T12:00:00Z")).catch(() => undefined);
  assert.ok(errs.some((e) => /\[bars\] WARN NVDA: .*stale \(last bar 2026-11-02\).*Yahoo fallback/.test(e)), errs.join("\n"));
});

test("loadDailyBars: fresh bars → no warning", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  writeFileSync(join(dir, "NVDA-bars.json"), JSON.stringify([{ begins_at: "2026-11-03T00:00:00Z", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]));
  const errs: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => { errs.push(a.join(" ")); });
  const r = await loadDailyBars("NVDA", dir, 30, new Date("2026-11-04T12:00:00Z"));
  assert.equal(r.source, "robinhood");
  assert.equal(errs.length, 0);
});
