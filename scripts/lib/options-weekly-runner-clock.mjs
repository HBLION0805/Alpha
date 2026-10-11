// Pure clock diagnostics and due-floor helpers; no source readers or TypeScript dependency.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {sourceHash,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';
const check=(v,c)=>{if(!v)throw Error('RUNNER_CONTINUATION_'+c);};
const folders={public:'runner',company:'company-runner'};
function directory(root,path){let current=fs.realpathSync(root);for(const p of path.split('/')){current=resolve(current,p);if(!fs.existsSync(current))fs.mkdirSync(current);const s=fs.lstatSync(current);check(s.isDirectory()&&!s.isSymbolicLink(),'UNSAFE_DIRECTORY');}return current;}
export function continuationDueFloor(due,continuation){
 if(!continuation||due.blockedReason)return due;
 const floor=continuation.nextEligibleAt[due.sourceId];check(typeof floor==='string','SOURCE_FLOOR');
 return {...due,nextEligibleAt:new Date(Math.max(Date.parse(due.nextEligibleAt),Date.parse(floor))).toISOString()};
}
export function writeRunnerClockDiagnostic({root,family,runId,diagnostic}){
 const base=WEEKLY_SOURCE_BASE+'/'+folders[family]+'/clock-diagnostics';directory(root,base);
 check(fs.readdirSync(resolve(root,base)).length<100,'CLOCK_DIAGNOSTIC_LIMIT');
 const body={version:'WEEKLY_RUNNER_CLOCK_DIAGNOSTIC_V1',runId,...diagnostic},record={...body,fingerprint:sourceHash(JSON.stringify(body))};
 const fd=fs.openSync(resolve(root,base,runId+'.json'),'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(record,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {path:base+'/'+runId+'.json',fingerprint:record.fingerprint};
}
