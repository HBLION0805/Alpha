import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read = p => JSON.parse(readFileSync(p, "utf8"));
const old = read("docs/OPTIONS_WORK_CONTINUATION_HOST_V1.json"), current = read("docs/OPTIONS_WORK_CONTINUATION_HOST_V2.json");
let passed = 0; function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
test("scheduled progress changes only active prompts and the waiting cadence", () => {
  for (const phase of ["activeFields", "collectionFields", "postWindowFields", "waitingForOpeningFields"]) {
    const { prompt: _a, ...a } = current[phase], { prompt: _b, ...b } = old[phase];
    if (phase === "waitingForOpeningFields") b.rrule = old.activeFields.rrule;
    assert.deepEqual(a, b);
  }
  assert.deepEqual(current.suspendBeforeWindowFields, old.suspendBeforeWindowFields);
  assert.deepEqual(current.suspendAfterWindowFields, old.suspendAfterWindowFields);
});
test("progress survives phase changes while original restore-before-evidence ordering remains", () => {
  for (const phase of ["activeFields", "collectionFields", "postWindowFields", "waitingForOpeningFields"]) {
    const p = current[phase].prompt;
    assert(p.includes("explicitly requested a development progress report every 15 minutes"));
    assert(p.includes("finish with NOTIFY")); assert(p.includes("OPTIONS_WORK_CONTINUATION_HOST_V2.json"));
    assert(!p.includes("OPTIONS_WORK_CONTINUATION_HOST_V1.json")); assert(p.includes("reading collection evidence before v6 restoration"));
  }
  const p = current.activeFields.prompt;
  assert(p.indexOf("submit restoreFields") < p.indexOf("install postWindowFields"));
  assert(p.indexOf("install postWindowFields") < p.indexOf("Only after restoration may you run"));
});
test("opening quote and guard times remain exact and collection does not send minute spam", () => {
  for (const key of ["windowStartAt", "windowEndAt", "developmentGuardStartAt", "developmentGuardEndAt"]) assert.equal(current[key], old[key]);
  assert.equal(current.collectionFields.rrule, old.collectionFields.rrule);
  assert.equal(current.collectionFields.prompt, current.activeFields.prompt);
  assert(current.collectionFields.prompt.includes("only after the authorized Host tick"));
  assert(current.collectionFields.prompt.includes("At most one scheduled progress report per New York quarter-hour"));
  assert.equal(current.waitingForOpeningFields.rrule, current.activeFields.rrule);
});
test("all original manifests runbook and restoration bytes are preserved", () => {
  for (const [p, expected] of Object.entries(current.preservedSourceHashes)) assert.equal(createHash("sha256").update(readFileSync(p)).digest("hex"), expected);
});
test("new progress requirements preserve execution and development bounds", () => {
  for (const phase of ["activeFields", "postWindowFields"]) {
    const p = current[phase].prompt;
    for (const required of ["allow at most ten minutes of new work", "No account/order tools", "no real-price replay", "do not promise uninterrupted"]) {
      if (required === "no real-price replay" && phase === "activeFields") continue;
      assert(p.includes(required), required);
    }
    assert(p.includes("Do not invent completion percentages")); assert(p.includes("actual blocker"));
  }
});
console.log(`${passed}/${passed} tests passed.`);
