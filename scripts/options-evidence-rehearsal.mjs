import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, opendirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { runOptionsEvidenceExportCommand, optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsContextReadinessCommand } from "./options-readiness.mjs";
import { exportId, exportClock, validateExportManifest, exportSourcePolicy } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function fail(code) { throw Error("OPTIONS_REHEARSAL_" + code); }
function inventory(root) {
  const files = [];
  const walk = (path, depth) => {
    if (depth > 7) fail("UNEXPECTED_RESTORED_TREE");
    const dir = opendirSync(path);
    try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
      const file = join(path, entry.name), stat = lstatSync(file);
      if (stat.isSymbolicLink()) fail("RESTORED_LINK");
      if (stat.isDirectory()) walk(file, depth + 1);
      else { if (!stat.isFile() || stat.nlink !== 1 || files.length >= 400) fail("UNEXPECTED_RESTORED_TREE"); files.push(relative(root, file).split(sep).join("/")); }
    } } finally { dir.closeSync(); }
  };
  walk(root, 0); return files.sort();
}
export async function runOptionsEvidenceRehearsalCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString(), temporaryParent = tmpdir() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:evidence-rehearsal -- --rehearse <package-id>",
    meaning: "Verify a local package, reconstruct only data in a fresh temporary workspace and run existing repository recovery. No active restore, overwrite, network or trades.", executionAllowed: false };
  if (args.length !== 2 || args[0] !== "--rehearse") fail("ARGUMENTS");
  const packageId = args[1]; exportId(packageId); const startedAt = now(); exportClock(startedAt);
  const root = realpathSync(workspaceRoot), verified = runOptionsEvidenceExportCommand(["--verify", packageId], { workspaceRoot: root, now });
  const base = "data/runtime/options-evidence-exports/" + packageId;
  const manifest = validateExportManifest(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(io.readBytes(root, base + "/manifest.json", 262144))));
  if (manifest.manifestSha256 !== verified.manifestSha256) fail("PACKAGE_CHANGED");
  const parent = realpathSync(temporaryParent), isolatedWorkspace = realpathSync(mkdtempSync(join(parent, "alpha-evidence-rehearsal-")));
  const rel = relative(parent, isolatedWorkspace);
  if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-evidence-rehearsal-") || lstatSync(isolatedWorkspace).isSymbolicLink()) fail("UNSAFE_TEMPORARY_WORKSPACE");
  try {
    for (const file of manifest.files) {
      const policy = exportSourcePolicy(manifest.studyId, file.sourcePath), bytes = io.readBytes(root, base + "/" + file.payloadName, policy.maxBytes);
      if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) fail("PACKAGE_CHANGED");
      io.directory(isolatedWorkspace, file.sourcePath.slice(0, file.sourcePath.lastIndexOf("/")));
      io.writeExclusive(isolatedWorkspace, file.sourcePath, bytes);
    }
    const report = await runOptionsContextReadinessCommand(["--report", manifest.studyId], { workspaceRoot: isolatedWorkspace, now });
    if (report.assessedAt < startedAt) fail("CLOCK_ORDER");
    const expected = manifest.files.map(file => file.sourcePath).sort();
    if (inventory(isolatedWorkspace).join() !== expected.join()) fail("RESTORED_INVENTORY_CHANGED");
    for (const file of manifest.files) {
      const bytes = io.readBytes(isolatedWorkspace, file.sourcePath, exportSourcePolicy(manifest.studyId, file.sourcePath).maxBytes);
      if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) fail("RESTORED_BYTES_CHANGED");
    }
    const rechecked = runOptionsEvidenceExportCommand(["--verify", packageId], { workspaceRoot: root, now });
    if (rechecked.manifestSha256 !== manifest.manifestSha256) fail("PACKAGE_CHANGED");
    const completedAt = now(); exportClock(completedAt); if (completedAt < report.assessedAt) fail("CLOCK_ORDER");
    return { status: report.blockedStores.length ? "REHEARSAL_HAS_BLOCKED_COMPONENTS" : "RESTORED_COMPONENTS_READABLE", packageId,
      packageManifestSha256: manifest.manifestSha256, isolatedWorkspace, startedAt, completedAt, copiedFiles: manifest.files.length,
      copiedBytes: manifest.totalBytes, packageMissingComponents: manifest.missingComponents, report,
      originalPackageUnchanged: true, restoredSourceBytesUnchanged: true, activeRuntimeRestored: false,
      isolatedWorkspaceRetained: true, networkAccess: false, executionAllowed: false };
  } catch (error) {
    const code = /^OPTIONS_(?:EXPORT|REHEARSAL|READINESS|CONTEXT_READINESS)_[A-Z_]+$/.test(error?.message) ? error.message : "OPTIONS_REHEARSAL_LOCAL_FAILURE";
    const safe = Error(code); safe.isolatedWorkspace = isolatedWorkspace; throw safe;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const result = await runOptionsEvidenceRehearsalCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(result, null, 2)); if (result.status === "REHEARSAL_HAS_BLOCKED_COMPONENTS") process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "OPTIONS_REHEARSAL_ERROR", code: /^OPTIONS_(?:EXPORT|REHEARSAL|READINESS|CONTEXT_READINESS)_[A-Z_]+$/.test(error?.message) ? error.message : "OPTIONS_REHEARSAL_LOCAL_FAILURE", isolatedWorkspace: error?.isolatedWorkspace ?? null, executionAllowed: false })); process.exitCode = 2; }
}
