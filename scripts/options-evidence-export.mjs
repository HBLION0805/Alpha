import { createHash } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, opendirSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createExportManifest, validateExportManifest, exportSourcePolicy, exportFingerprint, exportId, exportClock, exportProfile, EXPORT_VERSION, EXPORT_VERSION_V2, EXPORT_MAX_BYTES, EXPORT_MAX_FILES } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";

const BASE = "data/runtime/options-evidence-exports", MANIFEST_MAX = 256 * 1024;
const fail = code => { throw Error("OPTIONS_EXPORT_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function stat(path) { try { return lstatSync(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
function safePath(root, relativePath) {
  const path = resolve(root, relativePath), rel = relative(root, path);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep)) fail("PATH_ESCAPE");
  let cursor = root;
  for (const [index, part] of rel.split(sep).entries()) {
    cursor = resolve(cursor, part); const s = stat(cursor);
    if (s && (s.isSymbolicLink() || index < rel.split(sep).length - 1 && !s.isDirectory())) fail("UNSAFE_PATH");
  }
  return path;
}
function readBytes(root, relativePath, maximum) {
  const path = safePath(root, relativePath), before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximum) fail("UNSAFE_FILE");
  const same = s => s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.dev === before.dev && s.ino === before.ino && s.size === before.size && s.mtimeMs === before.mtimeMs && s.ctimeMs === before.ctimeMs;
  const fd = openSync(path, "r");
  try {
    if (!same(fstatSync(fd)) || !same(lstatSync(path))) fail("FILE_CHANGED");
    const bytes = Buffer.alloc(before.size + 1); let length = 0;
    while (length < bytes.length) { const count = readSync(fd, bytes, length, bytes.length - length, null); if (!count) break; length += count; }
    if (length !== before.size || !same(fstatSync(fd)) || !same(lstatSync(path))) fail("FILE_CHANGED");
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}
function directory(root, relativePath) {
  const target = safePath(root, relativePath); let cursor = root;
  for (const part of relative(root, target).split(sep)) {
    cursor = resolve(cursor, part); if (!stat(cursor)) mkdirSync(cursor);
    const s = lstatSync(cursor); if (!s.isDirectory() || s.isSymbolicLink()) fail("UNSAFE_DIRECTORY");
  }
  return target;
}
function assertUnlocked(root, relativeDirectory) {
  if (stat(safePath(root, relativeDirectory + "/writer.lock"))) fail("SOURCE_LOCKED");
}
function list(root, relativeDirectory, maximum) {
  const path = safePath(root, relativeDirectory), s = stat(path);
  if (!s) return [];
  if (!s.isDirectory() || s.isSymbolicLink()) fail("UNSAFE_DIRECTORY");
  const dir = opendirSync(path), names = [];
  try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
    if (names.length >= maximum || !entry.isFile() || entry.isSymbolicLink()) fail("DIRECTORY_LIMIT_OR_ENTRY");
    names.push(entry.name);
  } } finally { dir.closeSync(); }
  return names.sort();
}
function sourceInventory(root, studyId, version) {
  const paths = [];
  for (const source of Object.values(exportProfile(version).journals)) {
    const rel = "data/runtime/" + source; assertUnlocked(root, rel.slice(0, rel.lastIndexOf("/")));
    if (stat(safePath(root, rel))) paths.push(rel);
  }
  for (const [kind, limit] of [["studies", 121], ["collection-attempts", 120], ["collection-reports", 120]]) {
    const rel = `data/runtime/options-robinhood-data/${kind}/${studyId}`; assertUnlocked(root, rel);
    for (const name of list(root, rel, limit)) { const path = rel + "/" + name; exportSourcePolicy(studyId, path, version); paths.push(path); }
  }
  if (!paths.includes(`data/runtime/options-robinhood-data/studies/${studyId}/plan.json`)) fail("PLAN_REQUIRED");
  if (paths.length > EXPORT_MAX_FILES) fail("FILE_COUNT");
  let total = 0;
  return paths.sort().map((sourcePath, index) => {
    const policy = exportSourcePolicy(studyId, sourcePath, version), bytes = readBytes(root, sourcePath, policy.maxBytes);
    total += bytes.length; if (total > EXPORT_MAX_BYTES) fail("TOTAL_BYTES");
    return { sourcePath, payloadName: `payload-${String(index + 1).padStart(4, "0")}.bin`, component: policy.component, bytes: bytes.length, sha256: sha(bytes) };
  });
}
function writeExclusive(root, path, bytes) {
  const fd = openSync(safePath(root, path), "wx");
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
// Internal bounded byte/path helpers for isolated recovery rehearsals; CLI scope is unchanged.
export const optionsEvidenceExportStorage = Object.freeze({ readBytes, directory, writeExclusive });
function verify(root, packageId, now) {
  const base = BASE + "/" + packageId, raw = readBytes(root, base + "/manifest.json", MANIFEST_MAX);
  let parsed;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { fail("MANIFEST_JSON"); }
  const manifest = validateExportManifest(parsed);
  if (manifest.packageId !== packageId) fail("PACKAGE_ID_MISMATCH");
  // Canonical serialized envelope also rejects hidden duplicate JSON keys or byte edits.
  if (!raw.equals(Buffer.from(JSON.stringify(manifest, null, 2) + "\n"))) fail("MANIFEST_ENCODING");
  const expected = ["manifest.json", ...manifest.files.map(file => file.payloadName)].sort();
  if (list(root, base, EXPORT_MAX_FILES + 1).join() !== expected.join()) fail("PACKAGE_ENTRIES");
  for (const file of manifest.files) {
    const bytes = readBytes(root, base + "/" + file.payloadName, exportSourcePolicy(manifest.studyId, file.sourcePath, manifest.version).maxBytes);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) fail("PAYLOAD_MISMATCH");
  }
  const verifiedAt = now(); exportClock(verifiedAt); if (verifiedAt < manifest.completedAt) fail("VERIFICATION_CLOCK");
  return { status: "PACKAGE_BYTES_VERIFIED", packageId, studyId: manifest.studyId, path: base, manifestSha256: manifest.manifestSha256,
    fileCount: manifest.files.length, totalBytes: manifest.totalBytes, missingComponents: manifest.missingComponents,
    startedAt: manifest.startedAt, completedAt: manifest.completedAt, verifiedAt, sourceStoresRead: false,
    semanticValidationPerformed: false, offDeviceBackup: false, executionAllowed: false,
    ...(manifest.version === EXPORT_VERSION_V2 ? { exportVersion: manifest.version } : {}) };
}
export function runOptionsEvidenceExportCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:evidence-export -- --create <study-id> <package-id>", "options:evidence-export -- --create-v2 <study-id> <package-id>", "options:evidence-export -- --verify <package-id>"],
    meaning: "Exact local evidence copy and independent byte verification. No network, source writes, restore, deletion or trades.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") { exportId(args[1]); return verify(realpathSync(workspaceRoot), args[1], now); }
  if (args.length !== 3 || !["--create", "--create-v2"].includes(args[0])) fail("ARGUMENTS");
  const version = args[0] === "--create-v2" ? EXPORT_VERSION_V2 : EXPORT_VERSION;
  const studyId = args[1], packageId = args[2]; exportId(studyId); exportId(packageId);
  const startedAt = now(); exportClock(startedAt); const root = realpathSync(workspaceRoot), base = BASE + "/" + packageId;
  if (stat(safePath(root, base))) fail("PACKAGE_ALREADY_EXISTS");
  const before = sourceInventory(root, studyId, version);
  directory(root, BASE); mkdirSync(safePath(root, base));
  for (const file of before) {
    const bytes = readBytes(root, file.sourcePath, exportSourcePolicy(studyId, file.sourcePath, version).maxBytes);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) fail("SOURCE_CHANGED");
    writeExclusive(root, base + "/" + file.payloadName, bytes);
    if (sha(readBytes(root, base + "/" + file.payloadName, bytes.length)) !== file.sha256) fail("COPY_CHANGED");
  }
  const after = sourceInventory(root, studyId, version);
  if (exportFingerprint(before) !== exportFingerprint(after)) fail("SOURCE_CHANGED");
  const completedAt = now(); exportClock(completedAt);
  const manifest = createExportManifest(packageId, studyId, startedAt, completedAt, before, version), encoded = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  if (encoded.length > MANIFEST_MAX) fail("MANIFEST_LIMIT");
  writeExclusive(root, base + "/manifest.json", encoded);
  return { ...verify(root, packageId, now), sourceStoresRead: true, sourceInventoriesMatched: true };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsEvidenceExportCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "OPTIONS_EXPORT_ERROR", code: /^OPTIONS_EXPORT_[A-Z_]+$/.test(error?.message) ? error.message : "OPTIONS_EXPORT_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
