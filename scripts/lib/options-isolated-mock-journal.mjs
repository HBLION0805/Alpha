import fs from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
const check=(ok,code)=>{if(!ok)throw Error('TECH_MOCK_'+code);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const encode=v=>JSON.stringify(v,null,2)+'\n';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clock=t=>snapshotNs(t);
const read=p=>{
 const s=fs.lstatSync(p);check(s.isFile()&&!s.isSymbolicLink()&&s.size<2e6,'FILE');
 // A crash between link publication and staging unlink leaves both names. Only
 // matching inodes under this same run directory can complete that cleanup.
 if(s.nlink!==1){const pending=fs.readdirSync(dirname(p)).filter(n=>/^\.pending-[a-f0-9-]{36}$/.test(n)).map(n=>resolve(dirname(p),n)).filter(n=>{const t=fs.lstatSync(n);return t.isFile()&&!t.isSymbolicLink()&&t.ino===s.ino&&t.dev===s.dev;});check(s.nlink===pending.length+1,'FILE_LINKS');for(const n of pending)fs.unlinkSync(n);}
 return parseChainSurveyJson(fs.readFileSync(p,'utf8'));
};
function directory(root,runId,create=false){
 check(/^mock-[a-z0-9-]{1,60}$/.test(runId),'RUN_ID');
 const base=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development');
 fs.mkdirSync(base,{recursive:true});check(fs.realpathSync(base)===base,'OUTPUT_SCOPE');
 const out=resolve(base,runId);if(create)fs.mkdirSync(out,{recursive:true});
 check(fs.realpathSync(out)===out&&!fs.lstatSync(out).isSymbolicLink(),'OUTPUT_SCOPE');return out;
}
// Complete bytes are fsynced before exclusive publication. An interrupted staging file
// is retained but is not a committed event. No existing event can be overwritten.
function publish(path,value,interrupt){
 const bytes=encode(value);
 check(Buffer.byteLength(bytes)<2e6,'RECORD_BOUND');
 if(fs.existsSync(path)){check(fs.readFileSync(path,'utf8')===bytes,'IDEMPOTENCY_CONFLICT');return;}
 const staging=resolve(dirname(path),'.pending-'+randomUUID());
 const fd=fs.openSync(staging,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 if(interrupt==='BEFORE_PUBLICATION')throw Error('MOCK_SIMULATED_INTERRUPTION');
 try{fs.linkSync(staging,path);}catch(e){fs.unlinkSync(staging);if(e.code!=='EEXIST')throw e;check(fs.readFileSync(path,'utf8')===bytes,'CONCURRENT_CONFLICT');return;}
 if(interrupt==='AFTER_LINK')throw Error('MOCK_SIMULATED_INTERRUPTION');
 fs.unlinkSync(staging);
 if(interrupt==='AFTER_PUBLICATION')throw Error('MOCK_SIMULATED_INTERRUPTION');
}


/** Pure integrity/ordering verification shared by mutating recovery and read-only preview. */
export function verifyMockJournalRecords(manifest,rows,startVersion){
 check(manifest?.version===startVersion&&manifest.sha256===sha(encode(manifest.input)),'START_HASH');
 check(Array.isArray(rows)&&rows.length<=1000,'EVENT_BOUND');
 const events=[];let prior=manifest.sha256,last=manifest.input.research.asOf;const ids=new Set();
 for(const [i,{name,value:row}] of rows.entries()){
  check(name==='event-'+String(i+1).padStart(4,'0')+'.json','EVENT_SEQUENCE');
  check(row.previous===prior&&row.sha256===sha(encode(row.event))&&!ids.has(row.event.id),'EVENT_HASH_OR_ID');
  check(clock(row.event.quote.receivedAt)>clock(last),'RECEIPT_ORDER');last=row.event.quote.receivedAt;prior=sha(encode(row));ids.add(row.event.id);events.push(row.event);
 }
 return {manifest,events,tip:prior};
}

export function createIsolatedMockJournal({validateStart,calculate,validateEvent,startVersion,eventAvailableAt=e=>e.quote.receivedAt}) {
function recover({root,runId,asOf}){
 const out=directory(root,runId),manifest=read(out+'/start.json');check(manifest.version===startVersion&&manifest.sha256===sha(encode(manifest.input)),'START_HASH');
 const names=fs.readdirSync(out).filter(n=>/^event-/.test(n)).sort();check(names.length<=1000,'EVENT_BOUND');
 const state=verifyMockJournalRecords(manifest,names.map(name=>({name,value:read(out+'/'+name)})),startVersion);
 return {out,...state,report:calculate(manifest.input,state.events,asOf)};
}

function start({root,runId,input,recordedAt=new Date().toISOString(),interrupt}){
 validateStart(input);const report=calculate(input,[],input.research.asOf),out=directory(root,runId,true);
 const path=out+'/start.json';let manifest={version:startVersion,recordedAt,input,sha256:sha(encode(input))};
 if(fs.existsSync(path)){manifest=read(path);check(manifest.sha256===sha(encode(input)),'START_CONFLICT');}
 publish(path,manifest,interrupt);return {runId,report};
}
function append({root,runId,event,recordedAt=new Date().toISOString(),interrupt}){
 validateEvent(event);
 const availableAt=eventAvailableAt(event);
 const state=recover({root,runId,asOf:availableAt}),old=state.events.find(x=>x.id===event.id);
 if(old){check(same(old,event),'IDEMPOTENCY_CONFLICT');return state.report;}
 check(state.events.length<1000&&clock(event.quote.receivedAt)>clock(state.events.at(-1)?.quote.receivedAt??state.manifest.input.research.asOf),'RECEIPT_ORDER');
 const report=calculate(state.manifest.input,[...state.events,event],availableAt);
 const row={previous:state.tip,recordedAt,event,sha256:sha(encode(event))};
 publish(state.out+'/event-'+String(state.events.length+1).padStart(4,'0')+'.json',row,interrupt);return report;
}

return {start,append,recover};
}
