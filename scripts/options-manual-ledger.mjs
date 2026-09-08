import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reconcileManualLedger, validateManualLedgerCommand, manualUsdUnits } from "../src/engines/options-manual-ledger/OptionsManualLedger.ts";
import { manualDemoCommands } from "../src/engines/options-manual-ledger/OptionsManualLedgerFixtures.ts";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { parseChainSurveyJson } from "../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsActivityStudyCommand } from "./options-activity-study.mjs";

export const MANUAL_LEDGER_BASE = "data/runtime/options-manual-ledger";
const MAX = 32 * 1024 * 1024;
const fail = code => { throw Error("MANUAL_STORE_" + code); };
const json = v => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const hash = b => createHash("sha256").update(b).digest("hex");
const decode = b => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(b);
const parse = b => parseChainSurveyJson(decode(b));
const clock = now => { const at = now(); readinessClock(at); return at; };
const read = (root, path) => io.readBytes(root, path, MAX);

export function readManualLedger(root, id, now, ownsLock = false) {
  exportId(id); const base = MANUAL_LEDGER_BASE + "/" + id, manifestBytes = read(root, base + "/manifest.json"), m = parse(manifestBytes);
  const expected = { version: "OPTIONS_MANUAL_LEDGER_STORE_V1", ledgerId: id, origin: m.origin, createdAt: m.createdAt, executionAllowed: false };
  if (!json(expected).equals(manifestBytes)) fail("MANIFEST");
  if (existsSync(resolve(root, base, "writer.lock")) && !ownsLock) fail("WRITER_LOCKED");
  const st = lstatSync(resolve(root, base)); if (!st.isDirectory() || st.isSymbolicLink()) fail("DIRECTORY");
  const names = readdirSync(resolve(root, base)); if (names.length > 2002) fail("FILE_BOUND");
  const events = [], files = [{path: base + "/manifest.json", bytes: manifestBytes}], payloads = [];
  let previousSha256 = hash(manifestBytes), lastSavedAt = m.createdAt;
  const required = ["manifest.json", ...(ownsLock ? ["writer.lock"] : [])];
  const count = names.filter(n => /^\d{6}\.json$/.test(n)).length;
  for (let n = 1; n <= count; n++) {
    const stem = String(n).padStart(6, "0"), path = base + "/" + stem + ".json", receiptPath = base + "/" + stem + ".receipt.json";
    required.push(stem + ".json", stem + ".receipt.json");
    const bytes = read(root, path), receiptBytes = read(root, receiptPath), p = parse(bytes), r = parse(receiptBytes);
    const command = validateManualLedgerCommand(parseChainSurveyJson(p.sourceText), p.recordedAt);
    if (p.recordedAt < lastSavedAt) fail("RECEIPT_ORDER");
    const payload = { version: "OPTIONS_MANUAL_EVENT_V1", ledgerId: id, sequence: n, recordedAt: p.recordedAt, previousSha256, sourceText: p.sourceText,
      sourceSha256: hash(Buffer.from(p.sourceText)), commandFingerprint: paperFingerprint(command) };
    if (!json(payload).equals(bytes)) fail("EVENT_RECOMPUTATION");
    readinessClock(r.savedAt);
    const receipt = { version: "OPTIONS_MANUAL_RECEIPT_V1", ledgerId: id, sequence: n, payloadSha256: hash(bytes), savedAt: r.savedAt, executionAllowed: false };
    if (!json(receipt).equals(receiptBytes) || r.savedAt < p.recordedAt) fail("RECEIPT");
    const event = { sequence: n, recordedAt: p.recordedAt, savedAt: r.savedAt, command }; events.push(event);
    reconcileManualLedger({ ledgerId: id, origin: m.origin, createdAt: m.createdAt, events }, r.savedAt);
    previousSha256 = hash(receiptBytes); lastSavedAt = r.savedAt; payloads.push(payload); files.push({path, bytes}, {path:receiptPath, bytes:receiptBytes});
  }
  if (required.sort().join("|") !== names.sort().join("|")) fail("PARTIAL_OR_UNEXPECTED_ENTRIES");
  const assessedAt = clock(now); if (assessedAt < lastSavedAt) fail("RECOVERY_CLOCK");
  const input = { ledgerId: id, origin: m.origin, createdAt: m.createdAt, events };
  const report = reconcileManualLedger(input, assessedAt);
  return { input, report, files, payloads, headSha256: previousSha256, lastSavedAt, base };
}
function create(root, id, origin, now) {
  exportId(id); const createdAt = clock(now), input = {ledgerId:id, origin, createdAt, events:[]}; reconcileManualLedger(input, createdAt);
  io.directory(root, MANUAL_LEDGER_BASE); const base = MANUAL_LEDGER_BASE + "/" + id; mkdirSync(resolve(root, base));
  io.writeExclusive(root, base + "/manifest.json", json({version:"OPTIONS_MANUAL_LEDGER_STORE_V1",ledgerId:id,origin,createdAt,executionAllowed:false}));
  return {status:"MANUAL_LEDGER_CREATED",ledgerId:id,origin,createdAt,tradeCount:0,executionAllowed:false};
}
function verifyReference(root, c, origin, now) {
  if (c.type !== "REGISTER_TRADE" || c.activityReference === null) return;
  const ref = c.activityReference;
  const verified = runOptionsActivityStudyCommand(["--verify", ref.studyId], {workspaceRoot:root,now});
  const p = parse(read(root, "data/runtime/options-activity-studies/" + ref.studyId + "/payload.json"));
  const candidate = p.study.candidates.find(x => x.candidate.id === ref.candidateId)?.candidate;
  if (verified.studyFingerprint !== ref.studyFingerprint || !candidate || candidate.symbol !== c.contract.symbol || candidate.expiry !== c.contract.expiry || candidate.type.toUpperCase() !== c.contract.optionType || manualUsdUnits(candidate.strike) !== manualUsdUnits(c.contract.strikeUsd) ||
    (origin === "SYNTHETIC_FIXTURE") !== (p.study.origin === "SYNTHETIC_FIXTURE")) fail("ACTIVITY_LINK");
}
function append(root, id, sourceBytes, now) {
  exportId(id); const base = MANUAL_LEDGER_BASE + "/" + id;
  // Validate the existing directory through the shared safe reader before creating a lock.
  read(root, base + "/manifest.json"); const lockPath = resolve(root, base, "writer.lock"), token = randomUUID();
  const fd = openSync(lockPath, "wx");
  try { writeFileSync(fd, token); fsyncSync(fd); } finally { closeSync(fd); }
  try {
    const loaded = readManualLedger(root, id, now, true), recordedAt = clock(now), sourceText = decode(sourceBytes);
    const command = validateManualLedgerCommand(parseChainSurveyJson(sourceText), recordedAt);
    const found = loaded.input.events.find(e => e.command.requestId === command.requestId);
    if (found) {
      if (paperFingerprint(found.command) !== paperFingerprint(command)) fail("REQUEST_ID_CONFLICT");
      return { status:"MANUAL_REQUEST_ALREADY_RECORDED",ledgerId:id,sequence:found.sequence,headSha256:loaded.headSha256,executionAllowed:false };
    }
    verifyReference(root, command, loaded.input.origin, now);
    const sequence = loaded.input.events.length + 1, event = {sequence,recordedAt,savedAt:recordedAt,command};
    if (recordedAt < loaded.lastSavedAt) fail("APPEND_CLOCK");
    const report = reconcileManualLedger({...loaded.input, events:[...loaded.input.events,event]},recordedAt);
    const payload = {version:"OPTIONS_MANUAL_EVENT_V1",ledgerId:id,sequence,recordedAt,previousSha256:loaded.headSha256,sourceText,
      sourceSha256:hash(sourceBytes),commandFingerprint:paperFingerprint(command)};
    const bytes = json(payload); if (bytes.length > MAX) fail("EVENT_SIZE");
    const stem = String(sequence).padStart(6,"0"); io.writeExclusive(root, base + "/" + stem + ".json", bytes);
    const savedAt = clock(now); if (savedAt < recordedAt) fail("SAVE_CLOCK");
    io.writeExclusive(root, base + "/" + stem + ".receipt.json", json({version:"OPTIONS_MANUAL_RECEIPT_V1",ledgerId:id,sequence,payloadSha256:hash(bytes),savedAt,executionAllowed:false}));
    const verified = readManualLedger(root,id,now,true);
    return {status:"MANUAL_EVENT_RECORDED",ledgerId:id,sequence,recordedAt,savedAt,headSha256:verified.headSha256,counts:report.counts,brokerVerified:false,executionAllowed:false};
  } finally {
    // Remove only the lock created by this invocation. Never clear a stale/foreign lock.
    if (decode(io.readBytes(root, base + "/writer.lock", 128)) !== token) fail("LOCK_OWNERSHIP");
    unlinkSync(lockPath);
  }
}
export function runOptionsManualLedgerCommand(args, {workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}) {
  if (args.length === 1 && args[0] === "--help") return {usage:["options:manual-ledger -- --create <new-owner-ledger-id>","options:manual-ledger -- --append <ledger-id> <workspace-command-json>","options:manual-ledger -- --verify <ledger-id>","options:manual-ledger -- --inspect <ledger-id>","options:manual-ledger -- --demo <new-synthetic-ledger-id>"],executionAllowed:false};
  const root = realpathSync(workspaceRoot);
  if (args.length === 2 && args[0] === "--create") return create(root,args[1],"OWNER_REPORTED_UNVERIFIED",now);
  if (args.length === 3 && args[0] === "--append") return append(root,args[1],read(root,args[2]),now);
  if (args.length === 2 && ["--verify","--inspect"].includes(args[0])) {
    const r = readManualLedger(root,args[1],now);
    return args[0] === "--inspect" ? r.report : {status:"MANUAL_LEDGER_RECOMPUTED",ledgerId:args[1],origin:r.input.origin,eventCount:r.input.events.length,headSha256:r.headSha256,counts:r.report.counts,brokerVerified:false,executionAllowed:false};
  }
  if (args.length === 2 && args[0] === "--demo") {
    create(root,args[1],"SYNTHETIC_FIXTURE",now);
    for (const c of manualDemoCommands()) append(root,args[1],json(c),now);
    return {status:"SYNTHETIC_MANUAL_DEMO_RECORDED",...readManualLedger(root,args[1],now).report};
  }
  fail("ARGUMENTS");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runOptionsManualLedgerCommand(process.argv.slice(2)),null,2)); }
  catch (e) { console.error(/^(MANUAL_|ACTIVITY_|OPTIONS_EXPORT_|BTC_CONTEXT_|READINESS_)[A-Z_]+$/.test(e.message) ? e.message : "MANUAL_STORE_OPERATION_FAILED"); process.exitCode=1; }
}
