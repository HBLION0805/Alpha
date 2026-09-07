import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";

export const EXPORT_VERSION = "OPTIONS_LOCAL_EVIDENCE_EXPORT_V1";
export const EXPORT_VERSION_V2 = "OPTIONS_LOCAL_EVIDENCE_EXPORT_V2";
export type ExportVersion = typeof EXPORT_VERSION | typeof EXPORT_VERSION_V2;
export const EXPORT_MAX_FILES = 400;
export const EXPORT_MAX_BYTES = 64 * 1024 * 1024;
export const EXPORT_COMPONENTS = ["paper", "historical", "imports", "headlines", "treasury", "btc", "study", "attempts", "closeout"] as const;
export const EXPORT_COMPONENTS_V2 = [...EXPORT_COMPONENTS, "blsCalendar", "fomcCalendar"] as const;
export type ExportComponent = typeof EXPORT_COMPONENTS_V2[number];
export const EXPORT_JOURNALS = {
  paper: "options-paper/sessions.ndjson", historical: "options-historical-replay/runs.ndjson",
  imports: "options-market-evidence/imports.ndjson", headlines: "options-driver-monitor/refreshes.ndjson",
  treasury: "options-treasury-rates/retrievals.ndjson", btc: "options-btc-context/retrievals.ndjson",
} as const;
export const EXPORT_JOURNALS_V2 = { ...EXPORT_JOURNALS, blsCalendar: "options-release-calendar/retrievals.ndjson", fomcCalendar: "options-fomc-calendar/retrievals.ndjson" } as const;
export function exportProfile(version: ExportVersion) {
  if (version !== EXPORT_VERSION && version !== EXPORT_VERSION_V2) fail("VERSION");
  return version === EXPORT_VERSION ? { components: EXPORT_COMPONENTS, journals: EXPORT_JOURNALS } : { components: EXPORT_COMPONENTS_V2, journals: EXPORT_JOURNALS_V2 };
}
export interface ExportFile { sourcePath: string; payloadName: string; component: ExportComponent; bytes: number; sha256: string }
export interface ExportManifestBody { version: ExportVersion; packageId: string; studyId: string; startedAt: string; completedAt: string;
  files: ExportFile[]; missingComponents: ExportComponent[]; totalBytes: number;
  consistency: "MATCHED_SOURCE_INVENTORIES_BEFORE_AND_AFTER_COPY_NOT_ATOMIC";
  semanticValidationPerformed: false; offDeviceBackup: false; sourceWritesAllowed: false; executionAllowed: false }
export type ExportManifest = ExportManifestBody & { manifestSha256: string };
function fail(code: string): never { throw Error("OPTIONS_EXPORT_" + code); }
function exact(value: unknown, keys: string[]) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("SHAPE"); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function exportId(value: unknown): asserts value is string { if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(value)) fail("ID"); }
export function exportClock(value: unknown): asserts value is string { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("CLOCK"); }
export const exportFingerprint = (value: unknown): string => createHash("sha256").update(canonicalizeDeterministicValue(value), "utf8").digest("hex");
export function exportSourcePolicy(studyId: string, sourcePath: string, version: ExportVersion = EXPORT_VERSION): { component: ExportComponent; maxBytes: number } {
  exportId(studyId);
  for (const [component, path] of Object.entries(exportProfile(version).journals)) if (sourcePath === "data/runtime/" + path) return { component: component as ExportComponent, maxBytes: (["treasury", "blsCalendar", "fomcCalendar"].includes(component) ? 32 : 16) * 1024 * 1024 };
  const sources: [ExportComponent, string, RegExp][] = [
    ["study", `data/runtime/options-robinhood-data/studies/${studyId}/`, /^(?:plan\.json|frame-\d{4}\.json)$/],
    ["attempts", `data/runtime/options-robinhood-data/collection-attempts/${studyId}/`, /^[a-z0-9][a-z0-9_-]{0,79}\.json$/],
    ["closeout", `data/runtime/options-robinhood-data/collection-reports/${studyId}/`, /^report-[0-9a-f]{64}\.json$/],
  ];
  for (const [component, prefix, pattern] of sources) if (typeof sourcePath === "string" && sourcePath.startsWith(prefix) && pattern.test(sourcePath.slice(prefix.length))) return { component, maxBytes: 2 * 1024 * 1024 };
  return fail("SOURCE_SCOPE");
}
export function validateExportManifest(value: ExportManifest): ExportManifest {
  exact(value, ["version", "packageId", "studyId", "startedAt", "completedAt", "files", "missingComponents", "totalBytes", "consistency", "semanticValidationPerformed", "offDeviceBackup", "sourceWritesAllowed", "executionAllowed", "manifestSha256"]);
  const profile = exportProfile(value.version); exportId(value.packageId); exportId(value.studyId); exportClock(value.startedAt); exportClock(value.completedAt);
  if (value.completedAt < value.startedAt) fail("CLOCK_ORDER");
  if (value.consistency !== "MATCHED_SOURCE_INVENTORIES_BEFORE_AND_AFTER_COPY_NOT_ATOMIC" || value.semanticValidationPerformed !== false || value.offDeviceBackup !== false || value.sourceWritesAllowed !== false || value.executionAllowed !== false) fail("AUTHORITY");
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > EXPORT_MAX_FILES) fail("FILE_COUNT");
  let total = 0, previous = "";
  for (const [index, file] of value.files.entries()) {
    exact(file, ["sourcePath", "payloadName", "component", "bytes", "sha256"]);
    const policy = exportSourcePolicy(value.studyId, file.sourcePath, value.version);
    if (file.component !== policy.component || file.sourcePath <= previous || file.payloadName !== `payload-${String(index + 1).padStart(4, "0")}.bin`) fail("FILE_MAPPING");
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > policy.maxBytes || typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) fail("FILE_METADATA");
    total += file.bytes; previous = file.sourcePath;
  }
  if (!value.files.some(file => file.sourcePath === `data/runtime/options-robinhood-data/studies/${value.studyId}/plan.json`)) fail("PLAN_REQUIRED");
  if (!Number.isSafeInteger(value.totalBytes) || total !== value.totalBytes || total > EXPORT_MAX_BYTES) fail("TOTAL_BYTES");
  const missing = profile.components.filter(component => !value.files.some(file => file.component === component));
  if (!Array.isArray(value.missingComponents) || value.missingComponents.join() !== missing.join()) fail("MISSING_COMPONENTS");
  const { manifestSha256, ...body } = value;
  if (manifestSha256 !== exportFingerprint(body)) fail("MANIFEST_HASH");
  return freeze(structuredClone(value));
}
export function createExportManifest(packageId: string, studyId: string, startedAt: string, completedAt: string, files: ExportFile[], version: ExportVersion = EXPORT_VERSION): ExportManifest {
  const body: ExportManifestBody = { version, packageId, studyId, startedAt, completedAt, files: structuredClone(files),
    missingComponents: exportProfile(version).components.filter(component => !files.some(file => file.component === component)), totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    consistency: "MATCHED_SOURCE_INVENTORIES_BEFORE_AND_AFTER_COPY_NOT_ATOMIC", semanticValidationPerformed: false, offDeviceBackup: false, sourceWritesAllowed: false, executionAllowed: false };
  return validateExportManifest({ ...body, manifestSha256: exportFingerprint(body) });
}
