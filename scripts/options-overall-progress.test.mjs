import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const old = JSON.parse(readFileSync("docs/OPTIONS_WORK_CONTINUATION_HOST_V2.json", "utf8"));
const current = JSON.parse(readFileSync("docs/OPTIONS_WORK_CONTINUATION_HOST_V3.json", "utf8"));
let passed = 0; function test(name, work) { work(); passed++; console.log("PASS " + name); }
test("overall reports change only phase prompts and retain original suspended fields", () => {
  for (const key of ["activeFields", "collectionFields", "postWindowFields", "waitingForOpeningFields"]) {
    const { prompt: a, ...aa } = current[key], { prompt: b, ...bb } = old[key]; assert.deepEqual(aa, bb);
    assert(a.startsWith(b.replaceAll("OPTIONS_WORK_CONTINUATION_HOST_V2.json", "OPTIONS_WORK_CONTINUATION_HOST_V3.json")));
    for (const part of ["complete scope", "fixed workstream denominator", "not a project-completion percentage", "first real-price paper-flow acceptance gates", "If no gate advanced"]) assert(a.includes(part));
  }
  for (const key of ["suspendBeforeWindowFields", "suspendAfterWindowFields", "windowStartAt", "windowEndAt", "developmentGuardStartAt", "developmentGuardEndAt"]) assert.deepEqual(current[key], old[key]);
});
test("all earlier manifests runbook and v6 bytes remain immutable", () => {
  for (const [path, hash] of Object.entries(current.preservedSourceHashes)) assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash);
});
test("the exact shared quote prompt and original ordering still survive reporting", () => {
  assert.equal(current.activeFields.prompt, current.collectionFields.prompt);
  const p = current.activeFields.prompt; assert(p.indexOf("submit restoreFields") < p.indexOf("install postWindowFields")); assert(p.indexOf("install postWindowFields") < p.indexOf("Only after restoration may you run"));
  assert(p.includes("At most one scheduled progress report per New York quarter-hour")); assert(p.includes("No account/order tools"));
});
console.log(`${passed}/${passed} tests passed.`);
