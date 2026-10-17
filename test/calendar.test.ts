import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFredCalendar, parseBeaSchedule } from "../src/ingest/officialCalendar.ts";
import { parseFeed, clampFuture } from "../src/ingest/rss.ts";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

test("FRED CPI calendar (real page): 12 dates, CT→ET conversion", () => {
  const ev = parseFredCalendar(fx("fred-cpi-2026.html"), "CPI", "CPI (BLS)", "x");
  assert.equal(ev.length, 12);
  assert.deepEqual(ev.find((e) => e.date === "2026-11-10"), { kind: "CPI", title: "CPI (BLS)", date: "2026-11-10", timeEt: "08:30", source: "x" });
});

test("BEA schedule (real page): GDP and PCE dates", () => {
  const ev = parseBeaSchedule(fx("bea-schedule.html"), 2026);
  assert.ok(ev.some((e) => e.kind === "GDP" && e.date === "2026-10-29"));
  assert.ok(ev.some((e) => e.kind === "PCE" && e.date === "2026-10-29"));
  assert.ok(!ev.some((e) => /Multinational/.test(e.title)));
});

test("committed static release calendar has every kind and citations", () => {
  const j = JSON.parse(fx("../../calendar/releases-2026.json")) as { events: Array<{ kind: string; source: string }> };
  for (const k of ["FOMC", "CPI", "NFP", "PPI", "PCE", "GDP"]) assert.ok(j.events.some((e) => e.kind === k && e.source.startsWith("https://")), k);
});

test("CNN Google-News sitemap parses", async () => {
  const items = await parseFeed(fx("cnn-news-sitemap.xml"), "cnn");
  assert.ok(items.length >= 2);
  assert.match(items[0]!.url, /^https:\/\/www\.cnn\.com\//);
  assert.ok(items[0]!.title.length > 10);
});

test("future timestamps (zone-less feeds) clamp to fetch time", () => {
  assert.equal(clampFuture("2026-10-15T04:30:00.000Z", "2026-10-15T01:00:00.000Z"), "2026-10-15T01:00:00.000Z");
  assert.equal(clampFuture("2026-10-15T00:30:00.000Z", "2026-10-15T01:00:00.000Z"), "2026-10-15T00:30:00.000Z");
});
