import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEarningsWeeks, renderEarningsWeek } from "../src/macro/earningsWeek.ts";

const files = loadEarningsWeeks(new URL("../knowledge/calendar/", import.meta.url));

test("earnings week 2026-10-26 registered with sources and themes", () => {
  const ev = files.flatMap((f) => f.events);
  assert.equal(ev.length, 30);
  assert.ok(ev.every((e) => e.source.startsWith("https://") && /^2026-10-(2[6-9]|30)$/.test(e.dateET)));
  assert.deepEqual(ev.find((e) => e.symbol === "MSFT"), { dateET: "2026-10-28", timing: "AMC", symbol: "MSFT", themes: ["Mag7"], source: ev.find((e) => e.symbol === "MSFT")!.source });
});

test("Tue brief shows today + Wed (tomorrow) incl. MSFT/GOOGL and reminders", () => {
  const l = renderEarningsWeek(files, "2026-10-27").join("\n");
  assert.match(l, /今日 2026-10-27 盘前 BMO：KO、UPS、SOFI/);
  assert.match(l, /明日 2026-10-28 盘后 AMC：MSFT【Mag7】、GOOGL【Mag7】、KLAC【semis\/SMH】/);
  assert.match(l, /spreads/);
});

test("Fri 10/23 brief previews Mon VZ; outside week → nothing", () => {
  assert.match(renderEarningsWeek(files, "2026-10-25").join("\n"), /明日 2026-10-26 盘前 BMO：VZ/);
  assert.deepEqual(renderEarningsWeek(files, "2026-11-05"), []);
});
