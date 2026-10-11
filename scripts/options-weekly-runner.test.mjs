import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {runWeeklyRunner,weeklyRunnerStatus,stopWeeklyRunner,recoverWeeklyRunner,weeklySourceDue} from './lib/options-weekly-runner.mjs';
import {readWeeklyRefreshes} from './lib/options-weekly-refresh.mjs';
import {runWeeklySources} from './options-weekly-sources.mjs';
const HOUR=3600000,initial=Date.parse('2026-10-11T05:00:00.000Z'),iso=t=>new Date(t).toISOString();
const temp=async f=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-weekly-runner-'));try{return await f(root);}finally{fs.rmSync(root,{recursive:true,force:true});}};
const xml='<rss><channel><item><title>TEST_FIXTURE official headline</title><link>https://www.federalreserve.gov/newsevents/example.htm</link></item></channel></rss>';
const ok=()=>new Response(xml,{headers:{'content-type':'application/rss+xml'}});
let passed=0,total=0;const check=(name,fn)=>{total++;test(name,async()=>{await fn();passed++;});};
after(()=>console.log(`Weekly source runner: ${passed}/${total} tests passed.`));
check('mandatory bounded expiry, minimum hourly interval, budget, scope and CLI duplicates reject before writes',async()=>temp(async root=>{
 const args={root,now:()=>iso(initial),until:iso(initial+10000),sourceIds:['fed'],evidenceContext:'TEST_FIXTURE'};
 for(const extra of [{until:undefined},{until:iso(initial+25*HOUR)},{intervalMinutes:59},{maxAttempts:101},{sourceIds:['coindesk']},{firstAt:iso(initial-1)}])await assert.rejects(runWeeklyRunner({...args,...extra}));
 assert.deepEqual(fs.readdirSync(root),[]);await assert.rejects(runWeeklySources(['--run','--until','a','--until','b']));
}));
check('read-only idle status creates no files and no network activity',async()=>temp(async root=>{
 assert.equal(weeklyRunnerStatus(root).state,'NOT_RUNNING');assert.deepEqual(fs.readdirSync(root),[]);
}));
check('delayed due execution and mandatory expiry use saved source receipt with no catch-up',async()=>temp(async root=>{
 let t=initial,calls=0;const now=()=>iso(t);
 const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),firstAt:iso(initial+4000),now,wait:async ms=>{t+=ms;},fetchImplementation:async()=>{calls++;assert(t>=initial+4000);return ok();},evidenceContext:'TEST_FIXTURE'});
 assert.equal(result.state,'EXPIRED');assert.equal(calls,1);assert.equal(weeklyRunnerStatus(root).state,'NOT_RUNNING');
 const saved=readWeeklyRefreshes(root,now());assert.equal(saved.records.length,1);assert.equal(saved.records[0].requestedAt,iso(initial+4000));assert.equal(result.configuration.evidenceContext,'TEST_FIXTURE');
 assert(result.events.some(e=>e.type==='ATTEMPT_FINISHED'));assert.equal(result.events.at(-1).details.attempts,1);
}));
check('duplicate instance cannot request or change active ownership; explicit stop preserves journal',async()=>temp(async root=>{
 let t=initial,duplicateChecked=false;const now=()=>iso(t);
 const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),firstAt:iso(initial+5000),now,evidenceContext:'TEST_FIXTURE',fetchImplementation:()=>assert.fail('no request before stop'),wait:async ms=>{
  const current=weeklyRunnerStatus(root,null,now);assert(current.activeRunId);
  if(!duplicateChecked){await assert.rejects(runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),now,evidenceContext:'TEST_FIXTURE',fetchImplementation:()=>assert.fail()}),e=>e.code==='EEXIST');duplicateChecked=true;stopWeeklyRunner(root,current.runId,now);}
  t+=ms;
 }});
 assert(duplicateChecked);assert.equal(result.state,'STOPPED_BY_REQUEST');assert.equal(result.events.filter(e=>e.type==='ATTEMPT_STARTED').length,0);
 assert.equal(weeklyRunnerStatus(root,result.runId,now).state,'STOPPED_BY_REQUEST');
}));
check('clean restart preserves cooldown and request-budget termination',async()=>temp(async root=>{
 let t=initial,calls=0;const now=()=>iso(t),fetchImplementation=async()=>{calls++;return ok();};
 const first=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),maxAttempts:1,now,fetchImplementation,evidenceContext:'TEST_FIXTURE'});assert.equal(first.state,'BUDGET_EXHAUSTED');
 t+=1000;const second=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+5000),now,fetchImplementation,wait:async ms=>{t+=ms;},evidenceContext:'TEST_FIXTURE'});
 assert.equal(second.state,'EXPIRED');assert.equal(calls,1);assert(second.events.some(e=>e.type==='WAITING'&&e.details.nextEligibleAt===iso(initial+HOUR)));
}));
check('failure receipts cause persistent exponential backoff; later success resets streak',async()=>temp(async root=>{
 let t=initial,calls=0;const now=()=>iso(t);
 const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+4*HOUR),maxAttempts:3,now,wait:async()=>{t+=HOUR;},fetchImplementation:async()=>++calls<3?new Response('TEST_FIXTURE unavailable',{status:503}):ok(),evidenceContext:'TEST_FIXTURE'});
 const rows=readWeeklyRefreshes(root,now()).records;assert.deepEqual(rows.map(r=>r.requestedAt),[iso(initial),iso(initial+HOUR),iso(initial+3*HOUR)]);assert.equal(result.state,'BUDGET_EXHAUSTED');assert.equal(rows[0].parsed.errorCode,'HTTP_503');
 const due=weeklySourceDue(rows,'fed',HOUR,iso(initial));assert.equal(due.consecutiveFailures,0);assert.equal(due.nextEligibleAt,iso(initial+4*HOUR));
 assert.equal(weeklySourceDue(rows.slice(0,2),'fed',HOUR,iso(initial)).delayMs,2*HOUR);
}));
check('stop signal cancels stalled transport and saves an explicit failure receipt',async()=>temp(async root=>{
 const controller=new AbortController();const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),now:()=>iso(initial),signal:controller.signal,evidenceContext:'TEST_FIXTURE',fetchImplementation:()=>{controller.abort();return new Promise(()=>{});}});
 assert.equal(result.state,'STOPPED_BY_SIGNAL');const row=readWeeklyRefreshes(root,iso(initial)).records[0];assert.equal(row.transportError,'CANCELLED');assert.equal(row.bodyComplete,false);
}));
check('unresolved source claims stop rather than retry or remove original claim',async()=>temp(async root=>{
 const path=join(root,'data/runtime/options-weekly-sources/refreshes');fs.mkdirSync(path,{recursive:true});fs.writeFileSync(join(path,'fed.lock'),'original incomplete request');
 await assert.rejects(runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),now:()=>iso(initial),evidenceContext:'TEST_FIXTURE',fetchImplementation:()=>assert.fail()}),/SOURCE_STORE_REQUIRES_REVIEW/);
 assert.equal(fs.readFileSync(join(path,'fed.lock'),'utf8'),'original incomplete request');assert.equal(weeklyRunnerStatus(root).state,'NOT_RUNNING');
}));
check('recovery cannot steal a live process lock',async()=>temp(async root=>{
 let t=initial;const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+10000),firstAt:iso(initial+5000),now:()=>iso(t),evidenceContext:'TEST_FIXTURE',wait:async ms=>{
  const current=weeklyRunnerStatus(root);assert.throws(()=>recoverWeeklyRunner(root,current.runId,()=>iso(t)),/NOT_PROVEN_ABSENT/);stopWeeklyRunner(root,current.runId,()=>iso(t));t+=ms;
 },fetchImplementation:()=>assert.fail()});assert.equal(result.state,'STOPPED_BY_REQUEST');
}));
check('sleep-like clock jump beyond expiry never backfills missed source slots',async()=>temp(async root=>{
 let t=initial,calls=0;const result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(initial+2*HOUR),firstAt:iso(initial+HOUR),now:()=>iso(t),wait:async()=>{t+=3*HOUR;},fetchImplementation:()=>{calls++;return ok();},evidenceContext:'TEST_FIXTURE'});
 assert.equal(result.state,'EXPIRED');assert.equal(calls,0);
}));
check('actual child interruption is reported honestly and explicit recovery releases only runner ownership',async()=>temp(async root=>{
 const start=Date.now(),child=spawn(process.execPath,['--import','tsx','scripts/options-weekly-sources.mjs','--run','--workspace',root,'--sources','fed','--first-at',iso(start+30000),'--until',iso(start+60000)],{cwd:process.cwd(),windowsHide:true,stdio:'ignore'});
 const exited=new Promise((yes,no)=>{child.once('exit',yes);child.once('error',no);});let owner;
 try{
  for(let i=0;i<80;i++){try{const state=weeklyRunnerStatus(root);if(state.activeRunId&&state.lastEvent){owner=state;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(owner);child.kill('SIGKILL');await exited;
  assert.equal(weeklyRunnerStatus(root,owner.runId).state,'INTERRUPTED_REQUIRES_RECOVERY');
  const recovery=recoverWeeklyRunner(root,owner.runId);assert.equal(recovery.state,'INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED');assert.equal(weeklyRunnerStatus(root).state,'NOT_RUNNING');
  assert.equal(readWeeklyRefreshes(root,new Date().toISOString()).records.length,0);assert.equal(weeklyRunnerStatus(root,owner.runId).events.at(-1).details.reason,recovery.state);
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}}
}));
check('absolute expiry cancels a real-time stalled request and retains its bounded receipt',async()=>temp(async root=>{
 const start=Date.now(),result=await runWeeklyRunner({root,sourceIds:['fed'],until:iso(start+150),fetchImplementation:()=>new Promise(()=>{}),evidenceContext:'TEST_FIXTURE'});
 assert.equal(result.state,'EXPIRED');const rows=readWeeklyRefreshes(root,new Date().toISOString()).records;assert.equal(rows.length,1);assert.equal(rows[0].transportError,'DEADLINE_EXCEEDED');
 assert(Date.now()-start<3000);
}));
