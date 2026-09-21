import {existsSync,lstatSync,mkdtempSync,readdirSync,realpathSync,rmSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {exportId,exportClock,exportFingerprint,EXPORT_MAX_FILES,EXPORT_MAX_BYTES} from '../../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {evidenceLoopView} from './options-evidence-loop.mjs';
import {resolveCase,validateCaseRecords,reconstructCase,caseSha,caseJson,caseFail} from './options-case-records.mjs';

export const CASE_EXPORT_BASE='data/runtime/options-evidence-exports/cases';
export const CASE_EXPORT_VERSION='OPTIONS_PRIVATE_CASE_EXPORT_V1';
const LIMITATIONS=[
  'Local evidence copy only. Not an off-device backup.',
  'Isolated validation stores only; no production restore or trading permission.',
  'Original global event envelopes are retained; scoped local ordering is a derived validation projection, not a restored global ledger chain.',
  'Only selected case records and required lineage are copied; publisher caches and unrelated cases are excluded.',
  'SHA-256 checks integrity against this manifest, not authenticity against replacement of the entire bundle.',
  'Source before/after inventories match; this is not a multi-store transactional lock.'
];
const equal=(a,b)=>fp(a)===fp(b);
function strictJson(bytes){let v;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{caseFail('JSON');}if(!bytes.equals(caseJson(v)))caseFail('ENCODING');return v;}
function scope(ledgerId,caseId,at){exportId(ledgerId);exportId(caseId);exportClock(at);if(at>new Date().toISOString())caseFail('FUTURE_CLOCK');}
function privatePayload(value){
  const raw=JSON.stringify(value);
  if(/(?:sk-or-v1-[a-zA-Z0-9]+|Bearer\s+[a-zA-Z0-9._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i.test(raw))caseFail('SECRET_CONTENT');
  const check=v=>{if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(/^(?:api[_-]?key|authorization|cookie|password|access[_-]?token|refresh[_-]?token|credentials?|environmentVariables)$/i.test(k)&&x)caseFail('SECRET_FIELD');check(x);}};check(value);
}
function isolated(operation){
  const parent=realpathSync(tmpdir()),root=mkdtempSync(resolve(parent,'alpha-case-recovery-'));
  try{return operation(root);}finally{
    // Never accept a caller-provided restore/delete target.
    if(dirname(root)!==parent||!basename(root).startsWith('alpha-case-recovery-')||lstatSync(root).isSymbolicLink())caseFail('ISOLATION_PATH');
    rmSync(root,{recursive:true,force:false});
  }
}
function metadata(record,index,graph){
  const v=record.value,e=v.event,c=e?.command,p=v.payload??v,body=c?.draft??c?.plan??v;
  return {file:`records/${String(index+1).padStart(4,'0')}.json`,recordType:record.kind==='source'?v.kind:record.kind,recordId:record.id,
    recordVersion:v.version??v.schemaVersion??'OPTIONS_MANUAL_EVENT_V1',status:c?.type==='SAVE_PLAN_DRAFT'?'DRAFT':p.stage??p.request?.stage??v.eventType??c?.type??'PRESERVED_AS_RECORDED',
    sourceRepository:record.kind,sourcePath:record.sourcePath,fingerprint:v.fingerprint??v.payload?.commandFingerprint??fp(body),
    createdAt:e?.savedAt??v.savedAt??v.acceptedAt??v.prediction?.createdAt??null,updatedAt:null,
    referenceIds:graph.filter(r=>r.from===record.id).map(r=>r.target),privacyClass:'PRIVATE_LOCAL_ONLY'};
}
export function inspectCase(root,ledgerId,caseId,at){
  scope(ledgerId,caseId,at);const bundle=resolveCase(root,ledgerId,caseId,at);privatePayload(bundle);
  const sourceValidation=validateCaseRecords(bundle);
  const snapshot=isolated(temp=>reconstructCase(bundle,temp));
  const sourceView=evidenceLoopView(root,ledgerId,sourceValidation.report,at);
  if(!equal(sourceView,snapshot.evidenceLoop))caseFail('SOURCE_RECONSTRUCTION_MISMATCH');
  const sourceWorkspaceFingerprint=caseSha(Buffer.from(realpathSync(root)));
  const contentFingerprint=exportFingerprint({bundle,snapshot,sourceWorkspaceFingerprint});
  const records=bundle.records.map((r,i)=>metadata(r,i,snapshot.graph));
  const preview={caseId,ledgerId,asOf:at,previewFingerprint:contentFingerprint,sourceWorkspaceFingerprint,status:snapshot.status,recordCount:records.length,records,
    missingRecords:snapshot.missingRecords,unresolvedReferences:snapshot.unresolvedReferences,knownUnknowns:snapshot.knownUnknowns,limitations:LIMITATIONS,
    privacyClass:'PRIVATE_LOCAL_ONLY',destinationType:'PRIVATE_LOCAL_EXPORT',integrity:'SHA-256 files + manifest; existing business fingerprint and graph validation',executionAllowed:false};
  if(records.length+3>EXPORT_MAX_FILES||caseJson({bundle,snapshot}).length>EXPORT_MAX_BYTES)caseFail('BOUND');
  return {bundle,snapshot,preview};
}
export function previewCaseExport(root,ledgerId,caseId,at=new Date().toISOString()){return inspectCase(root,ledgerId,caseId,at).preview;}
function assertBundleEntries(root,base,manifest){
  const expected=new Set(['manifest.json',...manifest.files.map(f=>f.file)]),seen=[];
  const walk=(path,prefix='')=>{const st=lstatSync(resolve(root,path));if(st.isSymbolicLink()||!st.isDirectory())caseFail('UNSAFE_DIRECTORY');
    const entries=readdirSync(resolve(root,path),{withFileTypes:true});for(const e of entries){if(seen.length>EXPORT_MAX_FILES)caseFail('BOUND');const name=prefix+e.name;if(e.isSymbolicLink())caseFail('UNSAFE_DIRECTORY');if(e.isDirectory()){if(!['records','references'].includes(name))caseFail('UNEXPECTED_FILE');walk(path+'/'+e.name,name+'/');}else{if(!e.isFile()||!expected.has(name))caseFail('UNEXPECTED_FILE');seen.push(name);}}};
  walk(base);if(seen.length!==expected.size||seen.some(p=>!expected.has(p)))caseFail('FILE_SET');
}
export function verifyCaseBundle(root,id,expectedCaseId){
  exportId(id);exportId(expectedCaseId);const base=CASE_EXPORT_BASE+'/'+id;
  const manifest=strictJson(io.readBytes(root,base+'/manifest.json',1024*1024));
  const {manifestSha256,...unsigned}=manifest;
  if(manifestSha256!==caseSha(caseJson(unsigned)))caseFail('MANIFEST_HASH');
  if(manifest.schemaVersion!==CASE_EXPORT_VERSION||manifest.exportToolVersion!==1)caseFail('SCHEMA');
  if(manifest.exportId!==id||manifest.caseId!==expectedCaseId)caseFail('CASE_ID');
  scope(manifest.ledgerId,manifest.caseId,manifest.createdAt);exportClock(manifest.exportedAt);
  if(manifest.createdAt>manifest.exportedAt||manifest.privacyClass!=='PRIVATE_LOCAL_ONLY'||manifest.productionRestoreAllowed!==false)caseFail('MANIFEST_POLICY');
  if(!Array.isArray(manifest.records)||!Array.isArray(manifest.files)||manifest.files.length>EXPORT_MAX_FILES||manifest.files.length!==manifest.records.length+2)caseFail('BOUND');
  const files=new Map();let bytesTotal=0;
  for(const f of manifest.files){
    if(!/^(?:records\/\d{4}\.json|references\/case-view\.json|validation\.json)$/.test(f.file)||files.has(f.file))caseFail('FILE_PATH_OR_DUPLICATE');
    if(!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>EXPORT_MAX_BYTES)caseFail('BOUND');bytesTotal+=f.bytes;if(bytesTotal>EXPORT_MAX_BYTES)caseFail('BOUND');
    const bytes=io.readBytes(root,base+'/'+f.file,f.bytes);if(bytes.length!==f.bytes||caseSha(bytes)!==f.sha256)caseFail('FILE_HASH');files.set(f.file,strictJson(bytes));
  }
  assertBundleEntries(root,base,manifest);
  const records=manifest.records.map((r,i)=>{if(r.file!==`records/${String(i+1).padStart(4,'0')}.json`||!files.has(r.file))caseFail('RECORD_INDEX');return files.get(r.file);});
  const bundle={caseId:manifest.caseId,ledgerId:manifest.ledgerId,at:manifest.createdAt,metadata:manifest.sourceLedger,records};
  const validation=validateCaseRecords(bundle),snapshot=files.get('references/case-view.json');
  if(!snapshot||!equal(records.map((r,i)=>metadata(r,i,validation.graph)),manifest.records)||!equal(validation.graph,snapshot.graph)||!equal(validation.unresolvedReferences,snapshot.unresolvedReferences))caseFail('REFERENCE_GRAPH');
  const expected={status:'SOURCE_AND_ISOLATED_VIEWS_MATCH',sourceFingerprint:manifest.contentFingerprint,sourceMutation:false,productionRestore:false};
  if(!equal(files.get('validation.json'),expected)||manifest.contentFingerprint!==exportFingerprint({bundle,snapshot,sourceWorkspaceFingerprint:manifest.sourceWorkspaceFingerprint}))caseFail('SNAPSHOT_FINGERPRINT');
  for(const field of ['status','missingRecords','unresolvedReferences','knownUnknowns'])if(!equal(snapshot[field],manifest[field]))caseFail('SEMANTIC_METADATA');
  if(!equal(manifest.limitations,LIMITATIONS))caseFail('MANIFEST_POLICY');privatePayload(bundle);
  return {manifest,bundle,snapshot};
}
export function createCaseExport(root,request,now=()=>new Date().toISOString()){
  const {ledgerId,caseId,asOf,previewFingerprint}=request;
  if(Object.keys(request).sort().join()!=='asOf,caseId,ledgerId,previewFingerprint')caseFail('REQUEST_FIELDS');
  const before=inspectCase(root,ledgerId,caseId,asOf);if(before.preview.previewFingerprint!==previewFingerprint)caseFail('PREVIEW_CHANGED');
  const exportedAt=now();exportClock(exportedAt);
  const id=caseId.slice(0,38)+'-'+exportedAt.replace(/[-:.TZ]/g,'')+'-'+randomUUID().slice(0,8);exportId(id);
  const base=CASE_EXPORT_BASE+'/'+id;io.directory(root,CASE_EXPORT_BASE);if(existsSync(resolve(root,base)))caseFail('EXPORT_EXISTS');io.directory(root,base+'/records');io.directory(root,base+'/references');
  const files=[];let total=0;
  const write=(file,value)=>{const bytes=caseJson(value);total+=bytes.length;if(total>EXPORT_MAX_BYTES)caseFail('BOUND');io.writeExclusive(root,base+'/'+file,bytes);files.push({file,bytes:bytes.length,sha256:caseSha(bytes)});};
  before.bundle.records.forEach((r,i)=>write(before.preview.records[i].file,r));
  write('references/case-view.json',before.snapshot);
  write('validation.json',{status:'SOURCE_AND_ISOLATED_VIEWS_MATCH',sourceFingerprint:previewFingerprint,sourceMutation:false,productionRestore:false});
  const after=inspectCase(root,ledgerId,caseId,asOf);if(after.preview.previewFingerprint!==previewFingerprint)caseFail('SOURCE_CHANGED');
  const manifest={schemaVersion:CASE_EXPORT_VERSION,exportId:id,caseId,ledgerId,createdAt:asOf,exportedAt,sourceWorkspaceFingerprint:before.preview.sourceWorkspaceFingerprint,
    exportToolVersion:1,contentFingerprint:previewFingerprint,sourceLedger:before.bundle.metadata,status:before.snapshot.status,records:before.preview.records,files,
    missingRecords:before.snapshot.missingRecords,unresolvedReferences:before.snapshot.unresolvedReferences,knownUnknowns:before.snapshot.knownUnknowns,limitations:LIMITATIONS,privacyClass:'PRIVATE_LOCAL_ONLY',productionRestoreAllowed:false};
  io.writeExclusive(root,base+'/manifest.json',caseJson({...manifest,manifestSha256:caseSha(caseJson(manifest))}));
  const verified=verifyCaseBundle(root,id,caseId);
  return {status:'PRIVATE_LOCAL_EVIDENCE_EXPORTED',exportId:id,caseId,recordCount:manifest.records.length,fileCount:files.length+1,bytes:total,manifestSha256:verified.manifest.manifestSha256,
    logicalLocation:base,sourceUnchanged:true,privacyClass:'PRIVATE_LOCAL_ONLY',limitations:LIMITATIONS,executionAllowed:false};
}
export function recoverCaseExport(root,id,caseId){
  const verified=verifyCaseBundle(root,id,caseId);
  const result=isolated(temp=>{const recovered=reconstructCase(verified.bundle,temp);if(!equal(recovered,verified.snapshot))caseFail('RECOVERY_MISMATCH');
    // Re-open persisted authorities before success; the same files survive a new
    // repository instance. No production destination can be supplied.
    const reopenedBundle=strictJson(io.readBytes(temp,'case-evidence/original-records.json',EXPORT_MAX_BYTES));
    if(!equal(reopenedBundle,verified.bundle))caseFail('REOPEN_MISMATCH');
    const readback=evidenceLoopView(temp,reopenedBundle.ledgerId,validateCaseRecords(reopenedBundle).report,reopenedBundle.at);
    if(!equal(readback,recovered.evidenceLoop))caseFail('REOPEN_MISMATCH');
    return {status:'ISOLATED_RECOVERY_VERIFIED',exportId:id,caseId,manifestSha256:verified.manifest.manifestSha256,recordCount:verified.bundle.records.length,
      evidenceSemanticsMatched:true,reopened:true,caseStatus:recovered.status,missingRecords:recovered.missingRecords,unresolvedReferenceCount:recovered.unresolvedReferences.length};});
  return {...result,temporaryWorkspaceRemoved:true,productionRestore:false,executionAllowed:false};
}
