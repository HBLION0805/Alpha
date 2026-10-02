import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PointInTimeReplayEngine} from '../../src/engines/event-intelligence-replay/PointInTimeReplayEngine.ts';

const VERSION='OPTIONS_EVENT_OBSERVATION_V1';
const BASE='data/runtime/options-event-intelligence/observations';
const fail=code=>{throw Error('EVENT_INTELLIGENCE_OBSERVATION_'+code);};
const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{2,119}$/.test(value);
const clock=value=>{const n=Date.parse(value);if(!Number.isFinite(n))fail('CLOCK');return n;};
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validateEvidence(evidence){
  if(!safeId(evidence?.eventId)||!safeId(evidence?.evidenceId))fail('ID');
  const engine=new PointInTimeReplayEngine();
  engine.replay({
    eventId:evidence.eventId,caseType:'UNSCHEDULED',title:'Observation validation',
    eventTime:null,createdAt:evidence.receivedAt,evidence:[evidence],
    historicalDecisions:[],recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:[]
  },evidence.receivedAt);
  return evidence;
}
function baseDir(root,eventId,{create=false}={}){
  if(!safeId(eventId))fail('EVENT_ID');
  const rootReal=realpathSync(root),base=resolve(rootReal,BASE,eventId);
  if(!existsSync(base)){
    if(!create)return {rootReal,base,exists:false};
    mkdirSync(base,{recursive:true});
  }
  if(!lstatSync(base).isDirectory()||lstatSync(base).isSymbolicLink())fail('DIRECTORY');
  return {rootReal,base,exists:true};
}

export function saveEventObservation(root,evidence,savedAt=evidence?.receivedAt){
  validateEvidence(evidence);
  if(savedAt!==evidence.receivedAt)fail('NO_BACKFILL');
  clock(savedAt);
  const {rootReal,base}=baseDir(root,evidence.eventId,{create:true});
  const file=resolve(base,evidence.evidenceId+'.json');
  if(existsSync(file)) {
    const old=verifyEventObservation(root,file);
    if(old.fingerprint!==fingerprint(evidence))fail('CONFLICT');
    return {...old,path:file.slice(rootReal.length+1).replaceAll('\\','/'),alreadyRecorded:true};
  }
  const envelope={version:VERSION,savedAt,evidence,fingerprint:fingerprint(evidence)};
  writeFileSync(file,JSON.stringify(envelope,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  const verified=verifyEventObservation(root,file);
  return {...verified,path:file.slice(rootReal.length+1).replaceAll('\\','/'),alreadyRecorded:false};
}
export function verifyEventObservation(root,file){
  const rootReal=realpathSync(root),base=resolve(rootReal,BASE),resolved=resolve(file);
  if(!resolved.startsWith(base+(process.platform==='win32'?'\\':'/')))fail('PATH');
  const stat=lstatSync(resolved);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)fail('FILE');
  let value;try{value=JSON.parse(readFileSync(resolved,'utf8').replace(/^\uFEFF/,''));}catch{fail('JSON');}
  if(!value||Object.keys(value).sort().join(',')!=='evidence,fingerprint,savedAt,version'||value.version!==VERSION)fail('ENVELOPE');
  validateEvidence(value.evidence);
  if(value.savedAt!==value.evidence.receivedAt)fail('NO_BACKFILL');
  if(value.fingerprint!==fingerprint(value.evidence))fail('INTEGRITY');
  return value;
}

export function listEventObservations(root,eventId,asOf){
  const cutoff=clock(asOf),directory=baseDir(root,eventId);
  if(!directory.exists)return [];
  const {base}=directory,files=readdirSync(base,{withFileTypes:true});
  if(files.length>500)fail('LIMIT');
  return files.filter(x=>x.isFile()&&/^[a-z0-9][a-z0-9-]{2,119}\.json$/.test(x.name))
    .map(x=>verifyEventObservation(root,resolve(base,x.name)))
    .filter(x=>clock(x.evidence.receivedAt)<=cutoff)
    .sort((a,b)=>clock(a.evidence.receivedAt)-clock(b.evidence.receivedAt)||a.evidence.evidenceId.localeCompare(b.evidence.evidenceId));
}
