import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { runOptionsWorkContinuationCommand as run } from "./options-work-continuation.mjs";
const root = resolve(import.meta.dirname, ".."), read = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const host = read("docs/OPTIONS_WORK_CONTINUATION_HOST_V1.json"), phases = read("docs/OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json"), v6 = read("docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json");
let passed = 0; function test(name, work) { work(); passed++; console.log("PASS " + name); }
test("manifest preserves original frozen window and restore snapshots", () => { assert.equal(host.windowStartAt, phases.windowStartAt); assert.equal(host.windowEndAt, phases.windowEndAt); assert.deepEqual(host.suspendBeforeWindowFields, phases.armedFields); assert.deepEqual(host.suspendAfterWindowFields, v6.restoreFields); });
test("every phase updates the existing heartbeat identity and notification preference", () => {
  for (const fields of [host.activeFields, host.collectionFields, host.postWindowFields]) for (const key of ["mode", "id", "kind", "destination", "name", "status", "targetThreadId", "notificationPolicy"]) assert.deepEqual(fields[key], v6.restoreFields[key]);
});
test("collection retains one-minute cadence and the same routing prompt", () => { assert.equal(host.collectionFields.rrule, phases.collectionFields.rrule); assert.equal(host.collectionFields.prompt, host.activeFields.prompt); assert.notEqual(host.postWindowFields.prompt, host.activeFields.prompt); });
test("waiting for opening reduces cadence without losing post-closeout continuation", () => { assert.equal(host.waitingForOpeningFields.rrule, phases.armedFields.rrule); assert.equal(host.waitingForOpeningFields.prompt, host.activeFields.prompt); for (const key of ["id", "kind", "name", "targetThreadId", "notificationPolicy"]) assert.deepEqual(host.waitingForOpeningFields[key], host.activeFields[key]); });
test("quarter-hour schedule includes the exact original 09:00 and 09:30 wakes", () => {
  const fields = Object.fromEntries(host.activeFields.rrule.replace(/^RRULE:/, "").split(";").map(s => s.split("=")));
  assert.equal(fields.FREQ, "WEEKLY"); assert.equal(fields.BYHOUR.split(",").length, 24); assert.deepEqual(fields.BYMINUTE.split(","), ["0", "15", "30", "45"]); assert.equal(fields.BYDAY.split(",").length, 7); assert.equal(host.postWindowFields.rrule, host.activeFields.rrule);
});
test("original runbook phase v6 and prompt bytes retain their preserved hashes", () => {
  for (const [path, expected] of Object.entries(host.preservedSourceHashes)) assert.equal(createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"), expected);
});
test("current router performs no network or workspace mutation", () => {
  const old = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); }; try { const r = run(["--route", "armed"], { now: () => "2026-09-07T19:00:00.000Z" }); assert.equal(r.action, "DEVELOPMENT"); assert.equal(r.sourceCallExecuted, false); assert.equal(r.schedulerUpdated, false); } finally { globalThis.fetch = old; }
});
test("help and strict argument errors do not start host actions", () => {
  assert(run(["--help"]).usage); for (const args of [[], ["--route"], ["--refresh"], ["--route", "daily", "extra"], ["--route", "other"]]) assert.throws(() => run(args));
  const child = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-work-continuation.mjs", "--refresh", "PRIVATE_PAYLOAD"], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 2); assert(!child.stderr.includes("PRIVATE_PAYLOAD")); assert.equal(JSON.parse(child.stderr).executionAllowed, false);
});
console.log(`${passed}/${passed} tests passed.`);
