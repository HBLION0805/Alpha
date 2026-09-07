import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, opendirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsResearchObservationCommand as observation } from "./options-research-observation.mjs";
import { parseOptionsSampleJson } from "./options-sample-partition.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";

const BASE = "data/runtime/options-research-evidence", MANIFEST_MAX = 65536, TOTAL_MAX = 200 * 1024 * 1024;
const fail = code => { throw Error("RESEARCH_EVIDENCE_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function parse(bytes) { try { return parseOptionsSampleJson(bytes); } catch { fail("JSON_ENCODING_OR_STRUCTURE"); } }
function encode(value) { const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); if (bytes.length > MANIFEST_MAX) fail("MANIFEST_LIMIT"); return bytes; }
function layout(observationId, protocolId, captureId) {
  for (const id of [observationId, protocolId, captureId]) exportId(id);
  return [["observation", "options-research-observations", observationId, 128], ["protocol", "options-research-protocols", protocolId, 2], ["context", "options-context-captures", captureId, 64]].flatMap(([kind, store, id, limit]) =>
    ["payload", "receipt"].map(type => ({ sourcePath: `data/runtime/${store}/${id}/${type}.json`, payloadName: `${kind}-${type}.json`, maxBytes: type === "receipt" ? 65536 : limit * 1024 * 1024 })));
}
function manifest(packageId, observationId, protocolId, captureId, startedAt, sourceVerifiedAt, payloadsCopiedAt, files) {
  exportId(packageId); for (const at of [startedAt, sourceVerifiedAt, payloadsCopiedAt]) readinessClock(at);
  if (sourceVerifiedAt < startedAt || payloadsCopiedAt < sourceVerifiedAt) fail("CLOCK_ORDER");
  const paths = layout(observationId, protocolId, captureId);
  if (!Array.isArray(files) || files.length !== 6) fail("FILE_COUNT");
  let totalBytes = 0;
  const rebuilt = paths.map((path, i) => { const f = files[i];
    if (!f || f.sourcePath !== path.sourcePath || f.payloadName !== path.payloadName || !Number.isSafeInteger(f.bytes) || f.bytes < 1 || f.bytes > path.maxBytes || !/^[0-9a-f]{64}$/.test(f.sha256)) fail("FILE_MAPPING_OR_BOUNDS");
    totalBytes += f.bytes; return { sourcePath: path.sourcePath, payloadName: path.payloadName, bytes: f.bytes, sha256: f.sha256 };
  });
  if (totalBytes > TOTAL_MAX) fail("TOTAL_BYTES");
  const body = { version: "OPTIONS_RESEARCH_EVIDENCE_PACKAGE_V1", packageId, observationId, protocolId, captureId,
    startedAt, sourceVerifiedAt, payloadsCopiedAt, files: rebuilt, totalBytes,
    clockBasis: "LOCAL_CLOCK_AFTER_SIX_PAYLOAD_WRITES_BEFORE_MANIFEST_WRITE", offDeviceBackup: false, executionAllowed: false };
  return { ...body, manifestSha256: readinessFingerprint(body) };
}
function entries(root, base, expected) {
  const dir = opendirSync(resolve(root, base)), names = [];
  try { for (let e = dir.readSync(); e; e = dir.readSync()) { if (names.length >= 7 || !e.isFile() || e.isSymbolicLink()) fail("PACKAGE_ENTRIES"); names.push(e.name); } }
  finally { dir.closeSync(); }
  if (names.sort().join() !== [...expected].sort().join()) fail("PACKAGE_ENTRIES");
}
function readPackage(root, packageId) {
  const base = BASE + "/" + packageId, bytes = io.readBytes(root, base + "/manifest.json", MANIFEST_MAX), raw = parse(bytes);
  if (!raw || raw.packageId !== packageId) fail("PACKAGE_ID");
  const rebuilt = manifest(packageId, raw.observationId, raw.protocolId, raw.captureId, raw.startedAt, raw.sourceVerifiedAt, raw.payloadsCopiedAt, raw.files);
  if (!bytes.equals(encode(rebuilt))) fail("MANIFEST_RECOMPUTATION_MISMATCH");
  entries(root, base, ["manifest.json", ...rebuilt.files.map(f => f.payloadName)]);
  const paths = layout(raw.observationId, raw.protocolId, raw.captureId);
  const files = rebuilt.files.map((f, i) => { const data = io.readBytes(root, base + "/" + f.payloadName, paths[i].maxBytes); if (data.length !== f.bytes || sha(data) !== f.sha256) fail("PAYLOAD_MISMATCH"); return { ...f, data }; });
  return { manifest: rebuilt, files, bytes };
}
async function verify(root, packageId, now) {
  const saved = readPackage(root, packageId), parent = realpathSync(tmpdir());
  const temp = realpathSync(mkdtempSync(join(parent, "alpha-research-evidence-")));
  function safeTemporary() { const rel = relative(parent, realpathSync(temp)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-research-evidence-") || lstatSync(temp).isSymbolicLink()) fail("UNSAFE_TEMPORARY_ROOT"); }
  safeTemporary();
  try {
    for (const f of saved.files) { io.directory(temp, f.sourcePath.slice(0, f.sourcePath.lastIndexOf("/"))); io.writeExclusive(temp, f.sourcePath, f.data); }
    const report = await observation(["--verify", saved.manifest.observationId], { workspaceRoot: temp, now });
    const after = readPackage(root, packageId); if (!after.bytes.equals(saved.bytes)) fail("PACKAGE_CHANGED");
    const verifiedAt = now(); readinessClock(verifiedAt);
    if (report.verifiedAt < saved.manifest.payloadsCopiedAt || verifiedAt < report.verifiedAt) fail("VERIFICATION_CLOCK_ORDER");
    return { status: "RESEARCH_EVIDENCE_PACKAGE_RECOMPUTED", packageId, observationId: saved.manifest.observationId,
      path: BASE + "/" + packageId, manifestSha256: saved.manifest.manifestSha256, fileCount: 6, totalBytes: saved.manifest.totalBytes,
      payloadsCopiedAt: saved.manifest.payloadsCopiedAt, verifiedAt, report, semanticValidationPerformed: true,
      activeEvidencePairsRead: false, sourceStoresRead: false, sourceJournalAppends: 0, activeRuntimeRestored: false,
      temporaryWorkspaceRemoved: true, networkAccess: false, offDeviceBackup: false, replayAllowed: false, executionAllowed: false };
  } finally { safeTemporary(); rmSync(temp, { recursive: true }); }
}
export async function runOptionsResearchEvidenceCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:research-evidence -- --create <observation-id> <new-package-id>", "options:research-evidence -- --verify <package-id>"], meaning: "Preserve one observation and both prerequisites as six exact files. Verification restores only in an isolated temporary workspace. No active restore or trade.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") { exportId(args[1]); return verify(realpathSync(workspaceRoot), args[1], now); }
  if (args.length !== 3 || args[0] !== "--create") fail("ARGUMENTS");
  const [observationId, packageId] = args.slice(1); exportId(observationId); exportId(packageId);
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  const checked = await observation(["--verify", observationId], { workspaceRoot: root, now });
  const obsBytes = io.readBytes(root, checked.path + "/payload.json", 128 * 1024 * 1024);
  if (sha(obsBytes) !== checked.payloadSha256) fail("SOURCE_CHANGED");
  const original = parse(obsBytes).inspection, { protocolId, captureId } = original.input;
  const hashes = [checked.payloadSha256, checked.receiptSha256, original.protocol.payloadSha256, original.protocol.receiptSha256, original.context.payloadSha256, original.context.receiptSha256];
  const paths = layout(observationId, protocolId, captureId), files = paths.map((p, i) => { const data = io.readBytes(root, p.sourcePath, p.maxBytes); if (sha(data) !== hashes[i]) fail("SOURCE_CHANGED"); return { sourcePath: p.sourcePath, payloadName: p.payloadName, bytes: data.length, sha256: sha(data), data }; });
  const metadata = files.map(({ data, ...f }) => f);
  manifest(packageId, observationId, protocolId, captureId, startedAt, checked.verifiedAt, checked.verifiedAt, metadata);
  const parent = io.directory(root, BASE); try { mkdirSync(resolve(parent, packageId)); } catch (error) { if (error?.code === "EEXIST") fail("PACKAGE_ALREADY_EXISTS"); throw error; }
  const base = BASE + "/" + packageId;
  for (const f of files) io.writeExclusive(root, base + "/" + f.payloadName, f.data);
  files.forEach((f, i) => { if (!f.data.equals(io.readBytes(root, f.sourcePath, paths[i].maxBytes)) || !f.data.equals(io.readBytes(root, base + "/" + f.payloadName, paths[i].maxBytes))) fail("SOURCE_OR_COPY_CHANGED"); });
  const saved = manifest(packageId, observationId, protocolId, captureId, startedAt, checked.verifiedAt, now(), metadata);
  io.writeExclusive(root, base + "/manifest.json", encode(saved));
  return { ...await verify(root, packageId, now), status: "RESEARCH_EVIDENCE_PACKAGE_SAVED_AND_RECOMPUTED", activeEvidencePairsRead: true };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runOptionsResearchEvidenceCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "RESEARCH_EVIDENCE_ERROR", code: /^(?:(?:RESEARCH_EVIDENCE|RESEARCH_OBSERVATION|PROTOCOL_REGISTRATION|CONTEXT_CAPTURE|CONTEXT_CUTOFF|OPTIONS_EXPORT)_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "RESEARCH_EVIDENCE_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
