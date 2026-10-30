import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlash, flashPath, FLASH_SYMBOLS } from "../src/flash/flash.ts";
import { eciEvents } from "../src/ingest/officialCalendar.ts";
import { toYahooSymbol } from "../src/adapters/yahoo.ts";

test("Yahoo symbol: share classes BRK.B → BRK-B (QA C5); indices, futures, DXY, crypto untouched", () => {
  assert.equal(toYahooSymbol("BRK.B"), "BRK-B"); assert.equal(toYahooSymbol("BF.B"), "BF-B");
  for (const s of ["SPY", "^VIX", "ES=F", "DX-Y.NYB", "BTC-USD", "BRK-B"]) assert.equal(toYahooSymbol(s), s);
});

test("flash: data/out/flash-0830-YYYY-MM-DD.json with today's releases + quotes; failures recorded, never invented (QA C2)", () => {
  assert.equal(flashPath("data/out", "0830", "2026-10-30"), "data/out/flash-0830-2026-10-30.json");
  const quotes = Object.fromEntries(Object.keys(FLASH_SYMBOLS).map((k) => [k, { price: 100, at: "2026-10-30T12:30:00Z", prevClose: 99 }])) as Record<string, { price: number; at: string; prevClose: number | null } | Error>;
  quotes.BTC = new Error("timeout 8000ms");
  const f = buildFlash({ date: "2026-10-30", slot: "0830", now: new Date("2026-10-30T12:31:00Z"), calendar: eciEvents(), quotes });
  assert.deepEqual(f.releases.map((r) => [r.timeEt, r.kind, r.tier]), [["08:30", "ECI", 2]]);
  assert.deepEqual(f.market_yahoo.SPY, { price: 100, at: "2026-10-30T12:30:00Z", prev: 99, chgPct: 1.01 });
  assert.deepEqual(f.market_yahoo.BTC, { error: "timeout 8000ms" }); assert.deepEqual(f.failed, ["BTC"]);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(f)));
  assert.equal(buildFlash({ date: "2026-11-02", slot: "0900", now: new Date(), calendar: eciEvents(), quotes }).releases.length, 0);
});
