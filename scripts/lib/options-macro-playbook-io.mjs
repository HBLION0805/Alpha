import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {macroCatalog,MACRO_PLAYBOOK_VERSION} from '../../src/engines/options-knowledge/MacroKnowledgeCatalog.ts';
import {validateMacroNote,assessMacroNote} from '../../src/engines/options-knowledge/OptionsMacroPlaybook.ts';

const BASE='data/runtime/options-macro-playbook/notes',MAX=256*1024;
const fail=c=>{throw Error('MACRO_PLAYBOOK_'+c);};
const clock=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('CLOCK');return v;};
function entries(root){
  let current=resolve(root);
  for(const part of BASE.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())fail('DIRECTORY');}
  const all=readdirSync(current,{withFileTypes:true});if(all.length>500)fail('CATALOG_LIMIT');return all;
}
export function readMacroNote(root,path){
  if(!new RegExp('^'+BASE+'/[0-9a-f-]{36}\\.json$').test(path))fail('PATH');
  const record=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX)));
  const {fingerprint,...payload}=record;
  if(paperFingerprint(payload)!==fingerprint||payload.version!==MACRO_PLAYBOOK_VERSION)fail('INTEGRITY');
  clock(payload.recordedAt);validateMacroNote(payload.input,payload.catalog);
  if(path!==BASE+'/'+payload.input.requestId+'.json')fail('IDENTITY');
  if(paperFingerprint(assessMacroNote(payload.input,payload.catalog))!==paperFingerprint(payload.assessment))fail('RECOMPUTE');
  return {path,...record};
}
export function saveMacroNote(root,value,at=new Date().toISOString()){
  clock(at);const catalog=macroCatalog(),input=validateMacroNote(value,catalog),path=BASE+'/'+input.requestId+'.json';
  function retry(){const old=readMacroNote(root,path);if(paperFingerprint(old.input)!==paperFingerprint(input))fail('RETRY_CONTENT_CHANGED');return {path,recordedAt:old.recordedAt,alreadyRecorded:true,executionAllowed:false};}
  // Read through guarded IO even on retry; never overwrite an old record.
  if(existsSync(resolve(root,path)))return retry();
  const payload={version:MACRO_PLAYBOOK_VERSION,recordedAt:at,input,catalog,assessment:assessMacroNote(input,catalog)};
  const bytes=Buffer.from(JSON.stringify({...payload,fingerprint:paperFingerprint(payload)},null,2)+'\n');if(bytes.length>MAX)fail('SIZE');
  io.directory(root,BASE);
  try{io.writeExclusive(root,path,bytes);}catch(e){if(e?.code==='EEXIST')return retry();throw e;}
  readMacroNote(root,path);return {path,recordedAt:at,alreadyRecorded:false,executionAllowed:false};
}
export function macroPlaybookView(root){
  const notes=[],errors=[];
  for(const entry of entries(root)){
    const path=BASE+'/'+entry.name;
    try{if(!entry.isFile()||entry.isSymbolicLink())fail('FILE');notes.push(readMacroNote(root,path));}
    catch{errors.push({file:entry.name,status:'UNREADABLE_OR_INVALID_RECORD'});}
  }
  notes.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||a.input.requestId.localeCompare(b.input.requestId));
  return {catalog:macroCatalog(),notes,errors,executionAllowed:false};
}
