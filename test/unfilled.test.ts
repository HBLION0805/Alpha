import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { splitUnfilled, unfilledNote, hasOpenedAt } from "../src/options/unfilled.ts";
import { readiness } from "../src/options/readiness.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const cwd = new URL("..", import.meta.url).pathname;
const example = JSON.parse(readFileSync(join(cwd, "examples/paper-journal.json"), "utf8"));
const filledEntries: JournalEntry[] = Array.isArray(example) ? example : example.entries;
const pending = { id: "weat-limit-pending", mode: "paper", symbol: "WEAT", strategy: "stock_long", openedAt: null, qty: 50, entry: 21.5, legs: null, stop: "21.00" };
const blank = { id: "jets-limit-blank", mode: "paper", symbol: "JETS", strategy: "stock_long", openedAt: "" };

test("splitUnfilled: null / missing / empty openedAt are unfilled, timestamps are filled", () => {
  const { filled, unfilled } = splitUnfilled([...filledEntries, pending, blank, { id: "no-field", mode: "paper" }] as never[]);
  assert.equal(filled.length, filledEntries.length);
  assert.deepEqual(unfilled.map((e: { id: string }) => e.id), ["weat-limit-pending", "jets-limit-blank", "no-field"]);
  assert.equal(hasOpenedAt({ openedAt: null }), false);
  assert.deepEqual(splitUnfilled(undefined), { filled: [], unfilled: [] });
});

test("unfilledNote lists ids and says they are excluded; empty when none", () => {
  assert.equal(unfilledNote([]), "");
  const n = unfilledNote([pending, { symbol: "XLE" }, {}]);
  assert.match(n, /未成交\/挂单 3 笔/);
  assert.match(n, /不计入已平仓、P&L 与准备度统计/);
  assert.match(n, /`weat-limit-pending`、`XLE`、`#3`/);
});

test("readiness on filtered journal equals readiness without the unfilled entry", () => {
  const capital = 5000;
  const base = readiness({ journal: filledEntries, capital, shockDates: [] });
  const { filled } = splitUnfilled([...filledEntries, pending] as never[]);
  assert.deepEqual(readiness({ journal: filled as JournalEntry[], capital, shockDates: [] }), base);
});

for (const week of [false, true]) {
  test(`review CLI${week ? " --week" : ""} does not crash on openedAt null and lists it as 未成交/挂单`, () => {
    const dir = mkdtempSync(join(tmpdir(), "review-unfilled-"));
    try {
      const journal = join(dir, "paper.json"), out = join(dir, "review.md");
      writeFileSync(journal, JSON.stringify({ capital: 5000, entries: [...filledEntries, pending] }));
      const args = ["src/cli/review.ts", "--journal", journal, "--date", "2026-11-06", "--out", out, ...(week ? ["--week"] : [])];
      execFileSync(process.execPath, args, { cwd, env: { ...process.env }, encoding: "utf8", stdio: "pipe" });
      const md = readFileSync(out, "utf8");
      assert.match(md, /未成交\/挂单 1 笔/);
      assert.match(md, /`weat-limit-pending`/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("readiness CLI does not crash on openedAt null and excludes it", () => {
  const dir = mkdtempSync(join(tmpdir(), "readiness-unfilled-"));
  try {
    const journal = join(dir, "paper.json"), out = join(dir, "readiness.md");
    writeFileSync(journal, JSON.stringify({ capital: 5000, entries: [...filledEntries, pending] }));
    execFileSync(process.execPath, ["src/cli/readiness.ts", "--journal", journal, "--out", out], { cwd, env: { ...process.env }, encoding: "utf8", stdio: "pipe" });
    assert.match(readFileSync(out, "utf8"), /未成交\/挂单 1 笔/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
