import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { PointInTimeReplayEngine } from '../../src/engines/event-intelligence-replay/PointInTimeReplayEngine.ts';

const VERSION='OPTIONS_EVENT_INTELLIGENCE_CATALOG_V1';
const BASE='data/runtime/options-event-intelligence/cases';
const fail=code=>{throw Error('EVENT_INTELLIGENCE_IO_'+code);};
const clock=value=>{const n=Date.parse(value);if(!Number.isFinite(n))fail('CLOCK');return n;};
const caseId=value=>{if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(value))fail('CASE_ID');return value;};

function safeBase(root){
  const base=resolve(root,BASE);
  if(!existsSync(base))return null;
  const stat=lstatSync(base);
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('BASE');
  return realpathSync(base);
}

function parseCase(path){
  const bytes=readFileSync(path);
  if(bytes.length>2*1024*1024)fail('SIZE');
  let value;
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}
  catch{fail('JSON');}
  return value;
}
export function eventIntelligenceCatalog(root,at){
  clock(at);
  const base=safeBase(root);
  if(base===null)return {version:VERSION,assessedAt:at,cases:[],executionAllowed:false};
  const files=readdirSync(base,{withFileTypes:true});
  if(files.length>50)fail('CATALOG_LIMIT');
  const engine=new PointInTimeReplayEngine();
  const cases=files.filter(entry=>entry.isFile()&&/^[a-z0-9][a-z0-9-]{2,79}\.json$/.test(entry.name))
    .map(entry=>{
      const value=parseCase(resolve(base,entry.name));
      caseId(value.eventId);
      if(entry.name!==value.eventId+'.json')fail('PATH_ID');
      const currentView=engine.replay(value,at);
      const clocks=[value.createdAt,at,...value.evidence.map(x=>x.receivedAt),...value.historicalDecisions.map(x=>x.generatedAt)].map(clock);
      return {eventId:value.eventId,caseType:value.caseType,title:value.title,eventTime:value.eventTime,
        createdAt:value.createdAt,replayStartAt:new Date(Math.min(...clocks)).toISOString(),
        replayEndAt:new Date(Math.max(...clocks)).toISOString(),currentView};
    })
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.eventId.localeCompare(b.eventId));
  return {version:VERSION,assessedAt:at,cases,executionAllowed:false};
}

export function eventIntelligenceReplay(root,eventId,asOf){
  caseId(eventId);clock(asOf);
  const base=safeBase(root);
  if(base===null)fail('CASE_MISSING');
  const path=resolve(base,eventId+'.json');
  if(!existsSync(path)||!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())fail('CASE_MISSING');
  const value=parseCase(path);
  if(value.eventId!==eventId)fail('PATH_ID');
  return new PointInTimeReplayEngine().replay(value,asOf);
}
