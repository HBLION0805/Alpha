import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsResearchEvidenceCommand as run } from "./options-research-evidence.mjs";
import { runOptionsResearchObservationCommand as observation } from "./options-research-observation.mjs";
import { runOptionsResearchProtocolCommand as protocol } from "./options-research-protocol.mjs";
import { runOptionsContextCaptureCommand as capture } from "./options-context-capture.mjs";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
const root = resolve(import.meta.dirname, ".."), old = "2026-09-07T20:00:00.000Z", start = Date.parse("2026-09-07T21:00:00.000Z");
const id = "synthetic-pack-note", protocolId = "synthetic-protocol-storage-v1", captureId = "synthetic-pack-context", packageId = "synthetic-six-file-package";
const base = "data/runtime/options-research-evidence/" + packageId, note = "data/runtime/options-research-observations/" + id;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const tick = () => { let i = 0; return () => new Date(start + ++i).toISOString(); };
const create = (d, now = tick()) => run(["--create", id, packageId], { workspaceRoot: d, now });
const verify = (d, now = () => new Date(start + 100).toISOString()) => run(["--verify", packageId], { workspaceRoot: d, now });
const manifest = d => JSON.parse(readFileSync(join(d, base, "manifest.json"), "utf8"));
function writeManifest(d, value) { const { manifestSha256, ...body } = value; writeFileSync(join(d, base, "manifest.json"), JSON.stringify({ ...body, manifestSha256: readinessFingerprint(body) }, null, 2) + "\n"); }
function files(d) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { const q = join(p, e.name); if (e.isDirectory()) walk(q); else result[relative(d, q)] = sha(readFileSync(q)); } } walk(d); return result; }
async function temporary(work) { const d = mkdtempSync(join(tmpdir(), "alpha-package-test-")); try { await work(d); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(d)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-package-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(d, { recursive: true }); } }
async function seed(d) {
  copyFileSync(join(root, "fixtures/options-research-protocol/declaration.synthetic.json"), join(d, "protocol.json")); protocol(["--register", "protocol.json"], { workspaceRoot: d, now: () => old });
  await capture(["--capture", captureId], { workspaceRoot: d, now: () => old });
  writeFileSync(join(d, "note.json"), JSON.stringify({ version: "OPTIONS_RESEARCH_OBSERVATION_INPUT_V1", observationId: id, protocolId, captureId, symbol: "GLD", disposition: "NO_TRADE", reason: "Synthetic package test only." }));
  let i = 0; await observation(["--record", "note.json"], { workspaceRoot: d, now: () => new Date(Date.parse(old) + 100 + ++i).toISOString() });
}
let passed = 0; async function test(name, work) { await work(); passed++; console.log("PASS " + name); }
await test("help and invalid supplied times IDs or restore arguments do not read stores", async () => {
  const options = { workspaceRoot: join(root, "missing-package-root") }; assert.equal((await run(["--help"], options)).executionAllowed, false);
  for (const args of [["--restore", packageId], ["--create", id, packageId, "--at", old], ["--verify", "../escape"], ["--create"]]) await assert.rejects(run(args, options));
});
await test("package preserves exactly six original files and independently recomputes note semantics", () => temporary(async d => {
  await seed(d); const before = files(d), r = await create(d); for (const [p, hash] of Object.entries(before)) assert.equal(files(d)[p], hash);
  assert.equal(readdirSync(join(d, base)).length, 7); const m = manifest(d); for (const f of m.files) assert.deepEqual(readFileSync(join(d, base, f.payloadName)), readFileSync(join(d, f.sourcePath)));
  assert.equal(r.fileCount, 6); assert.equal(r.semanticValidationPerformed, true); assert.equal(r.temporaryWorkspaceRemoved, true); assert.equal(r.report.outcomeState, null); assert.equal(r.report.sampleCount, 0); assert.equal(r.executionAllowed, false);
}));
await test("copy clock occurs after six writes and before manifest write", () => temporary(async d => {
  await seed(d); let i = 0; const r = await create(d, () => { if (++i === 5) { assert.equal(readdirSync(join(d, base)).length, 6); assert(!existsSync(join(d, base, "manifest.json"))); } return new Date(start + i).toISOString(); }); assert.equal(i, 9); assert(r.verifiedAt > r.payloadsCopiedAt);
}));
await test("complete empty and partial package IDs cannot be reused", async () => {
  await temporary(async d => { await seed(d); await create(d); const before = files(d); await assert.rejects(create(d), /PACKAGE_ALREADY_EXISTS/); assert.deepEqual(files(d), before); });
  await temporary(async d => { await seed(d); mkdirSync(join(d, base), { recursive: true }); await assert.rejects(create(d), /PACKAGE_ALREADY_EXISTS/); writeFileSync(join(d, base, "observation-payload.json"), "partial"); await assert.rejects(create(d), /PACKAGE_ALREADY_EXISTS/); });
});
await test("failed copy clock leaves six immutable partial files", () => temporary(async d => {
  await seed(d); let i = 0; await assert.rejects(create(d, () => { if (++i === 5) throw Error("CLOCK_FAILURE"); return new Date(start + i).toISOString(); }), /CLOCK_FAILURE/); assert.equal(readdirSync(join(d, base)).length, 6); const before = files(d); await assert.rejects(create(d), /PACKAGE_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
await test("copy and package verification clocks cannot regress", async () => {
  for (const index of [4, 5, 8, 9]) await temporary(async d => { await seed(d); let i = 0; await assert.rejects(create(d, () => new Date(start + (++i === index ? 0 : i)).toISOString()), /CLOCK_ORDER/); });
});
await test("missing source dependency prevents any package claim", () => temporary(async d => {
  await seed(d); unlinkSync(join(d, "data/runtime/options-context-captures", captureId, "receipt.json")); await assert.rejects(create(d), /PAIR_INCOMPLETE_OR_MISSING/); assert(!existsSync(join(d, base)));
}));
await test("each missing packaged file and extra entries are rejected", () => temporary(async d => {
  await seed(d); await create(d); for (const f of manifest(d).files) { const p = join(d, base, f.payloadName), original = readFileSync(p); unlinkSync(p); await assert.rejects(verify(d), /PACKAGE_ENTRIES/); writeFileSync(p, original); }
  writeFileSync(join(d, base, "extra"), "keep"); await assert.rejects(verify(d), /PACKAGE_ENTRIES/);
}));
await test("rebound foreign source paths and IDs cannot select other data", () => temporary(async d => {
  await seed(d); await create(d); const m = manifest(d); writeManifest(d, { ...m, files: m.files.map((f, i) => i === 0 ? { ...f, sourcePath: "../secret" } : f) }); await assert.rejects(verify(d), /FILE_MAPPING_OR_BOUNDS/);
  writeManifest(d, { ...m, packageId: "foreign" }); await assert.rejects(verify(d), /PACKAGE_ID/);
}));
await test("rehashed payload tampering still fails original semantic recovery", () => temporary(async d => {
  await seed(d); await create(d); const m = manifest(d), f = m.files[0], p = join(d, base, f.payloadName), saved = JSON.parse(readFileSync(p, "utf8")); saved.inspection.executionAllowed = true;
  const bytes = Buffer.from(JSON.stringify(saved, null, 2) + "\n"); writeFileSync(p, bytes); await assert.rejects(verify(d), /PAYLOAD_MISMATCH/);
  f.bytes = bytes.length; f.sha256 = sha(bytes); m.totalBytes = m.files.reduce((n, x) => n + x.bytes, 0); writeManifest(d, m); await assert.rejects(verify(d), /PAYLOAD_BYTES_MISMATCH/);
}));
await test("strict manifest encoding keys bounds and unsupported metadata fail", () => temporary(async d => {
  await seed(d); await create(d); const m = manifest(d), p = join(d, base, "manifest.json");
  for (const b of [Buffer.from([0xff]), Buffer.from('{"x":1,"x":2}')]) { writeFileSync(p, b); await assert.rejects(verify(d), /JSON_ENCODING_OR_STRUCTURE/); }
  writeManifest(d, { ...m, activeRestoreAllowed: true }); await assert.rejects(verify(d), /MANIFEST_RECOMPUTATION_MISMATCH/); writeManifest(d, m); truncateSync(p, 65537); await assert.rejects(verify(d), /UNSAFE_FILE/);
}));
await test("hard links and junctions cannot redirect source or package IO", async () => {
  await temporary(async d => { await seed(d); await create(d); linkSync(join(d, base, "context-payload.json"), join(d, "alias")); await assert.rejects(verify(d), /UNSAFE_FILE/); });
  await temporary(async d => { await seed(d); mkdirSync(join(d, "elsewhere")); symlinkSync(join(d, "elsewhere"), join(d, "data/runtime/options-research-evidence"), "junction"); await assert.rejects(create(d), /UNSAFE_PATH|UNSAFE_DIRECTORY/); assert.deepEqual(readdirSync(join(d, "elsewhere")), []); });
});
await test("fresh process needs only seven package files and leaves active sources absent", () => temporary(async d => temporary(async isolated => {
  await seed(d); const original = await create(d); mkdirSync(join(isolated, base), { recursive: true }); for (const name of readdirSync(join(d, base))) copyFileSync(join(d, base, name), join(isolated, base, name)); const before = files(isolated);
  const code = `import {runOptionsResearchEvidenceCommand as run} from './scripts/options-research-evidence.mjs'; console.log(JSON.stringify(await run(['--verify','${packageId}'],{workspaceRoot:${JSON.stringify(isolated)}})));`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 0, child.stderr); const r = JSON.parse(child.stdout); assert.equal(r.manifestSha256, original.manifestSha256); assert.equal(r.report.observationAt, original.report.observationAt); assert.equal(r.activeRuntimeRestored, false); assert.deepEqual(files(isolated), before); assert(!existsSync(join(isolated, note)));
})));
console.log(`${passed}/${passed} tests passed.`);
