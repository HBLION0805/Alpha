import fs from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {verifyMockJournalRecords} from './options-isolated-mock-journal.mjs';
import {previewMockSpreadResidual,unavailableResidualPreview} from './options-tech-mock-residual.mjs';

const check=(v,c)=>{if(!v)throw Error('MOCK_RESIDUAL_READ_'+c);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const stamp=s=>[s.ino,s.dev,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join('|');
function reader(){
 let total=0;const fingerprints=[];
 const read=path=>{
  const before=fs.lstatSync(path);check(before.isFile()&&!before.isSymbolicLink()&&before.size<2e6,'FILE');
  // Verify same-directory staging links without removing or renaming either name.
  if(before.nlink!==1){const matching=fs.readdirSync(dirname(path)).filter(n=>/^\.pending-[a-f0-9-]{36}$/.test(n)).map(n=>fs.lstatSync(resolve(dirname(path),n))).filter(s=>s.isFile()&&!s.isSymbolicLink()&&s.ino===before.ino&&s.dev===before.dev);check(before.nlink===matching.length+1,'EXTERNAL_HARDLINK');}
  total+=before.size;check(total<=32*1024*1024,'TOTAL_BOUND');const bytes=fs.readFileSync(path);
  check(stamp(before)===stamp(fs.lstatSync(path)),'CHANGED_DURING_READ');fingerprints.push({name:path.slice(dirname(path).length+1),sha256:sha(bytes),bytes:bytes.length});
  return parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 };
 return {read,fingerprints};
}

/** Only stat/list/read operations. Never calls recover, mkdir, publish or staging cleanup. */
export function readMockResidualPreview({root,runId,asOf,evidence=null}){
 try{
  check(/^mock-[a-z0-9-]{1,60}$/.test(runId),'RUN_ID');const canonical=fs.realpathSync(root);
  let path=canonical;for(const segment of ['data','runtime','options-workbench-development',runId]){path=resolve(path,segment);const s=fs.lstatSync(path);check(s.isDirectory()&&!s.isSymbolicLink()&&fs.realpathSync(path)===path,'PATH');}
  const names=fs.readdirSync(path).sort();check(names.length<=2100,'FILE_COUNT');const r=reader(),manifest=r.read(path+'/start.json');
  const rows=names.filter(n=>n.startsWith('event-')).map(name=>({name,value:r.read(path+'/'+name)}));
  const state=verifyMockJournalRecords(manifest,rows,'TECH_MOCK_SPREAD_START_V1');
  check(JSON.stringify(names)===JSON.stringify(fs.readdirSync(path).sort()),'DIRECTORY_CHANGED_DURING_READ');
  return {...previewMockSpreadResidual({input:manifest.input,events:state.events,asOf,evidence}),runId,journalIntegrity:'VERIFIED_LOCAL_ORDERING_AND_HASHES_NOT_SOURCE_AUTHENTICATION',
   readReceipt:{files:r.fingerprints,pendingNamesRetained:names.filter(n=>n.startsWith('.pending-')),fileSystemMutationPerformed:false}};
 }catch(e){const code=e?.code==='ENOENT'?'JOURNAL_PATH_MISSING':/^(?:MOCK_RESIDUAL|TECH_MOCK|SPREAD_MOCK|SNAPSHOT_PAPER)_[A-Z_]+$/.test(e?.message)?e.message:'JOURNAL_OR_INPUT_INVALID';return {...unavailableResidualPreview(code),runId};}
}

export function readMockResidualEvidence(path){
 const full=resolve(path);check(fs.realpathSync(full)===full,'EVIDENCE_PATH');return reader().read(full);
}
