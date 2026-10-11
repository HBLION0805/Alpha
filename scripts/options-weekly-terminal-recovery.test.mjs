import {test,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {sourceHash,WEEKLY_SOURCE_BASE as BASE} from './lib/options-weekly-source-storage.mjs';
import {recoverWeeklyRunner,weeklyRunnerStatus} from './lib/options-weekly-runner.mjs';
import {recoverCompanyRunner,companyRunnerStatus} from './lib/options-weekly-company-runner.mjs';

const START='2026-10-11T10:00:00.000Z',END='2026-10-11T12:00:00.000Z',LATER='2026-10-11T13:00:00.000Z',FAKE_PID=87654321;
let passed=0,total=0;
const check=(name,fn)=>{total++;test(name,()=>{try{fn();passed++;}finally{mock.restoreAll();}});};
after(()=>console.log(`Weekly terminal recovery: ${passed}/${total} tests passed.`));
const write=(root,path,value)=>{fs.mkdirSync(join(root,path,'..'),{recursive:true});fs.writeFileSync(join(root,path),typeof value==='string'?value:JSON.stringify(value));};
const bytes=root=>{const out={};function walk(path){for(const e of fs.readdirSync(path,{withFileTypes:true})){const target=join(path,e.name);if(e.isDirectory())walk(target);else out[target.slice(root.length+1)]=sourceHash(fs.readFileSync(target));}}walk(root);return out;};
const temp=fn=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-terminal-recovery-'));try{return fn(root);}finally{const absolute=fs.realpathSync(root);assert(absolute.startsWith(resolve(tmpdir())+sep)&&absolute.includes('alpha-terminal-recovery-'));fs.rmSync(absolute,{recursive:true,force:true});}};
function fixture(root,family){
 const runId=randomUUID(),company=family==='company',prefix=company?'WEEKLY_COMPANY_RUNNER':'WEEKLY_RUNNER',base=BASE+'/'+(company?'company-runner':'runner'),runBase=base+'/runs/'+runId;
 const owner={version:prefix+'_OWNER_V1',runId,token:randomUUID(),pid:FAKE_PID};write(root,base+'/active.json',owner);
 const m={version:prefix+'_MANIFEST_V1',runId,startedAt:START,firstAt:START,until:END,sourceIds:[company?'msft_ir':'fed'],intervalMinutes:360,maxAttempts:20,evidenceContext:'TEST_FIXTURE',pid:FAKE_PID,executionAllowed:false},fingerprint=sourceHash(JSON.stringify(m));write(root,runBase+'/manifest.json',{...m,fingerprint});
 let sequence=0,previous=fingerprint;
 const f={runId,base,runBase,owner,append(type,details,at=END){const body={version:prefix+'_EVENT_V1',runId,sequence:++sequence,previousFingerprint:previous,at,type,details},row={...body,fingerprint:sourceHash(JSON.stringify(body))};previous=row.fingerprint;write(root,runBase+'/'+String(sequence).padStart(6,'0')+'.json',row);return row;}};
 f.append('STARTED',{state:'WAITING',firstAt:START},START);return f;
}
function processEvidence(observation='ABSENT',beforeProbe=null){
 return mock.method(process,'kill',(pid,signal)=>{assert.equal(pid,FAKE_PID);assert.equal(signal,0);beforeProbe?.();if(observation==='PRESENT')return true;throw Object.assign(Error('synthetic process evidence'),{code:observation==='ABSENT'?'ESRCH':'EPERM'});});
}
const ownerKey=f=>join(f.base,'active.json');
for(const family of ['public','company']){
 const recover=family==='public'?recoverWeeklyRunner:recoverCompanyRunner,status=family==='public'?weeklyRunnerStatus:companyRunnerStatus;
 check(`${family}: existing terminal and all original journal/source bytes survive owner cleanup`,()=>{
  for(const reason of ['BUDGET_EXHAUSTED','EXPIRED','STOPPED_BY_REQUEST','FAILED_REQUIRES_REVIEW',...(family==='company'?['HTTP_DENIAL_REQUIRES_REVIEW','NO_ELIGIBLE_SOURCES_REQUIRES_REVIEW']:[])])temp(root=>{
   const f=fixture(root,family),terminal=f.append('FINISHED',{reason,attempts:2});write(root,BASE+'/'+(family==='public'?'refreshes/fed.lock':'issuer-refreshes/msft_ir.lock'),'original unresolved source claim');
   const before=bytes(root),probe=processEvidence();const result=recover(root,f.runId,()=>assert.fail('terminal preservation must not append a new clock'));
   assert.equal(result.state,'TERMINAL_PRESERVED_OWNER_RELEASED');assert.deepEqual(result.originalTerminal,terminal);assert.equal(result.executionAllowed,false);assert.equal(probe.mock.callCount(),1);
   delete before[ownerKey(f)];assert.deepEqual(bytes(root),before);assert.equal(status(root,f.runId,()=>LATER).state,reason);assert.throws(()=>recover(root,f.runId),/RUNNER_NOT_ACTIVE/);assert.deepEqual(bytes(root),before);mock.restoreAll();
  });
 });
 check(`${family}: nonterminal interrupted run retains original recovery behavior`,()=>temp(root=>{
  const f=fixture(root,family);f.append('WAITING',{nextEligibleAt:END},START);const before=bytes(root);processEvidence();const result=recover(root,f.runId,()=>LATER);assert.equal(result.state,'INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED');assert.equal(result.originalTerminal,undefined);const after=bytes(root);delete before[ownerKey(f)];for(const [path,hash]of Object.entries(before))assert.equal(after[path],hash);assert.equal(Object.keys(after).length,Object.keys(before).length+1);const s=status(root,f.runId,()=>LATER);assert.equal(s.events.at(-1).details.reason,result.state);assert.equal(s.events.at(-1).at,LATER);
 }));
 check(`${family}: live and unknown process presence never remove terminal owner`,()=>{
  for(const presence of ['PRESENT','UNKNOWN'])temp(root=>{const f=fixture(root,family);f.append('FINISHED',{reason:'EXPIRED'});const before=bytes(root);processEvidence(presence);assert.throws(()=>recover(root,f.runId,()=>LATER),/RUNNER_PROCESS_NOT_PROVEN_ABSENT/);assert.deepEqual(bytes(root),before);mock.restoreAll();});
 });
 check(`${family}: owner token changed during process observation cannot be released`,()=>temp(root=>{
  const f=fixture(root,family);f.append('FINISHED',{reason:'EXPIRED'});const journalBefore=bytes(root);processEvidence('ABSENT',()=>write(root,f.base+'/active.json',{...f.owner,token:randomUUID()}));assert.throws(()=>recover(root,f.runId,()=>LATER),/RUNNER_OWNER_CHANGED/);const after=bytes(root);delete journalBefore[ownerKey(f)];delete after[ownerKey(f)];assert.deepEqual(after,journalBefore);assert(fs.existsSync(join(root,f.base+'/active.json')));
 }));
 check(`${family}: damaged hash chain and malformed terminal reason remain blocked`,()=>{
  for(const fault of ['hash','reason'])temp(root=>{const f=fixture(root,family),row=f.append('FINISHED',{reason:fault==='reason'?'UNKNOWN_REASON':'EXPIRED'});if(fault==='hash')write(root,f.runBase+'/000002.json',{...row,fingerprint:'0'.repeat(64)});const before=bytes(root);processEvidence();assert.throws(()=>recover(root,f.runId,()=>LATER),fault==='hash'?/RUNNER_JOURNAL_INTEGRITY/:/RUNNER_TERMINAL_INVALID/);assert.deepEqual(bytes(root),before);mock.restoreAll();});
 });
 check(`${family}: duplicate or followed terminal chains cannot be normalized by recovery`,()=>{
  for(const extra of ['FINISHED','WAITING'])temp(root=>{const f=fixture(root,family);f.append('FINISHED',{reason:'EXPIRED'});f.append(extra,{reason:'INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED'});const before=bytes(root);processEvidence();assert.throws(()=>recover(root,f.runId,()=>LATER),/RUNNER_TERMINAL_CHAIN_INVALID/);assert.deepEqual(bytes(root),before);mock.restoreAll();});
 });
}
