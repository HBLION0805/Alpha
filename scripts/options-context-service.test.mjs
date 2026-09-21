import assert from "node:assert/strict";
import {mkdtempSync,rmSync,realpathSync,readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join,relative,isAbsolute,resolve} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {contextWorkspaceArgs} from './lib/options-runtime-roots.mjs';
import {contextCommandResult} from './lib/options-context-diagnostics.mjs';
import {contextRefreshDiagnostics} from '../apps/options-workbench/focused-news.js';
import {contextRefreshSlots,runPublicContextOnce,startPublicContextService,runLocalPaperFinalization} from "./options-context-service.mjs";
let passed=0;async function test(name,fn){await fn();passed++;console.log("PASS "+name);}
async function temp(fn){const root=mkdtempSync(join(tmpdir(),"alpha-context-service-test-"));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith("..")||!rel.startsWith("alpha-context-service-test-"))throw Error("UNSAFE_TEST_CLEANUP");rmSync(full,{recursive:true,force:true});}}
await test("hourly public context runs overnight and on weekends",()=>{assert.deepEqual(contextRefreshSlots("2026-09-12T04:20:00.000Z")[0].sources,["headlines","btc"]);});
await test("09:00 New York includes the remaining original daily sources",()=>{assert.deepEqual(contextRefreshSlots("2026-09-08T13:00:00.000Z")[1].sources,["treasury","bls","fomc"]);});
await test("daily sources follow New York across DST",()=>{assert.equal(contextRefreshSlots("2026-11-09T13:00:00.000Z").length,2);assert.equal(contextRefreshSlots("2026-11-09T14:00:00.000Z").length,3);});
await test("hourly claims survive process-independent repeated calls",()=>temp(async root=>{const names=[],options={workspaceRoot:root,now:()=>"2026-09-08T05:20:00.000Z",issue:false,execute:async(name,args,spawnOptions)=>{names.push(name);assert.equal(args[0],resolve(import.meta.dirname,'../node_modules/tsx/dist/cli.mjs'));assert.equal(args[2],"--refresh");assert.deepEqual(args.slice(3),['--workspace',realpathSync(root)]);assert.equal(spawnOptions.cwd,realpathSync(resolve(import.meta.dirname,'..')));return {status:"OK"};}};const a=await runPublicContextOnce(options),b=await runPublicContextOnce(options);assert.deepEqual(names,["headlines","btc","focused_news"]);assert.equal(a.results[0].sources.length,2);assert.equal(b.results[0].status,"ALREADY_ATTEMPTED");assert.equal(b.results[0].previous.sources[0].status,'OK');assert.deepEqual(a.notYetEligible.map(s=>s.source),['treasury','bls','fomc','macro_context']);}));
await test("source failures remain explicit and do not prevent other sources",()=>temp(async root=>{const r=await runPublicContextOnce({workspaceRoot:root,now:()=>"2026-09-08T13:20:00.000Z",issue:false,execute:async name=>{if(name==="headlines")throw Error("SECRET_ERROR_DETAIL");return {status:"OK"};}});assert.equal(r.results[0].sources[0].status,"FAILED");assert.equal(r.results[0].sources[1].status,"OK");assert.equal(r.results[1].sources.length,3);assert(!JSON.stringify(r).includes("SECRET"));}));
await test("the next hour may collect again without rewriting old receipts",()=>temp(async root=>{let at="2026-09-08T05:20:00.000Z",calls=0;const o={workspaceRoot:root,now:()=>at,issue:false,execute:async()=>{calls++;return {status:"OK"};}};await runPublicContextOnce(o);const path=join(root,"data/runtime/options-context-service/2026-09-08/hourly-2026-09-08T05.receipt.json"),before=readFileSync(path);at="2026-09-08T06:20:00.000Z";await runPublicContextOnce(o);assert.equal(calls,6);assert(readFileSync(path).equals(before));}));
await test("two workers cannot duplicate one hourly refresh",()=>temp(async root=>{let calls=0;const options={workspaceRoot:root,now:()=>"2026-09-08T05:20:00.000Z",issue:false,execute:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {status:"OK"};}};await Promise.all([runPublicContextOnce(options),runPublicContextOnce(options)]);assert.equal(calls,3);}));
await test("an active in-process tick never overlaps itself",()=>temp(async root=>{let finish,calls=0;const wait=new Promise(r=>finish=r),service=startPublicContextService({workspaceRoot:root,now:()=>"2026-09-08T05:20:00.000Z",issue:false,execute:async()=>{calls++;await wait;return {status:"OK"};}});await service.tick();assert.equal(calls,1);service.stop();finish();await new Promise(r=>setTimeout(r,20));assert.equal(calls,3);}));
await test("a late startup reads the unattempted daily sources after 18:00",()=>temp(async root=>{
  const calls=[];
  const r=await runPublicContextOnce({workspaceRoot:root,now:()=>"2026-09-09T22:00:00.000Z",issue:false,execute:async name=>{calls.push(name);return {status:"OK"};}});
  assert.deepEqual(r.results.find(s=>s.slot==="daily-2026-09-09").sources.map(s=>s.source),["treasury","bls","fomc"]);
  for(const name of ["treasury","bls","fomc"])assert.equal(calls.filter(n=>n===name).length,1);
}));
await test("daily claims stay unique across UTC midnight in summer and winter",async()=>{
  for(const [first,later,date] of [["2026-09-09T23:30:00.000Z","2026-09-10T03:30:00.000Z","2026-09-09"],["2026-11-09T23:30:00.000Z","2026-11-10T04:30:00.000Z","2026-11-09"]])await temp(async root=>{
    const calls=[],o={workspaceRoot:root,now:()=>first,issue:false,execute:async name=>{calls.push(name);return {status:"OK"};}};
    await runPublicContextOnce(o);const path=join(root,`data/runtime/options-context-service/${date}/daily-${date}.receipt.json`),before=readFileSync(path);
    const b=await runPublicContextOnce({...o,now:()=>later});
    assert.equal(b.results.find(s=>s.slot===`daily-${date}`).status,"ALREADY_ATTEMPTED");
    for(const name of ["treasury","bls","fomc"])assert.equal(calls.filter(n=>n===name).length,1);
    assert(readFileSync(path).equals(before));
    assert(!existsSync(join(root,`data/runtime/options-context-service/${later.slice(0,10)}/daily-${date}.claim.json`)));
  });
});
await test("local midnight does not backfill yesterday and the next 09:00 opens a new date",()=>{
  assert(!contextRefreshSlots("2026-09-10T04:00:00.000Z").some(s=>s.key.startsWith("daily-")));
  assert(!contextRefreshSlots("2026-09-10T12:59:59.000Z").some(s=>s.key.startsWith("daily-")));
  assert.equal(contextRefreshSlots("2026-09-10T13:00:00.000Z").find(s=>s.key.startsWith("daily-")).key,"daily-2026-09-10");
});
await test("a failed morning daily receipt is not retried or rewritten in the evening",()=>temp(async root=>{
  const o={workspaceRoot:root,now:()=>"2026-09-09T13:00:00.000Z",issue:false,execute:async()=>({status:"FAILED",code:"REFRESH_FAILED"})};
  await runPublicContextOnce(o);const path=join(root,"data/runtime/options-context-service/2026-09-09/daily-2026-09-09.receipt.json"),before=readFileSync(path),calls=[];
  await runPublicContextOnce({...o,now:()=>"2026-09-10T02:00:00.000Z",execute:async name=>{calls.push(name);return {status:"OK"};}});
  assert(!calls.some(n=>["treasury","bls","fomc"].includes(n)));assert(readFileSync(path).equals(before));
}));
await test("an unfinished old daytime claim still blocks a late retry",()=>temp(async root=>{
  const parent=join(root,"data/runtime/options-context-service/2026-09-09"),path=join(parent,"daily-2026-09-09.claim.json");mkdirSync(parent,{recursive:true});writeFileSync(path,JSON.stringify({at:"2026-09-09T13:00:00.000Z",slot:"daily-2026-09-09",sources:["treasury","bls","fomc"],status:"STARTED"})+"\n");const before=readFileSync(path),calls=[];
  const attempt=await runPublicContextOnce({workspaceRoot:root,now:()=>"2026-09-10T02:00:00.000Z",issue:false,execute:async name=>{calls.push(name);return {status:"OK"};}});
  const html=contextRefreshDiagnostics({...attempt,status:'PARTIAL'});assert(html.includes('RECEIPT_UNAVAILABLE'));assert(html.includes('ALREADY_ATTEMPTED'));
  assert(!calls.some(n=>["treasury","bls","fomc"].includes(n)));assert(readFileSync(path).equals(before));assert(!existsSync(join(parent,"daily-2026-09-09.receipt.json")));
}));
await test("concurrent late workers still perform only one daily source group",()=>temp(async root=>{
  const calls=[],o={workspaceRoot:root,now:()=>"2026-09-10T02:00:00.000Z",issue:false,execute:async name=>{calls.push(name);await new Promise(r=>setTimeout(r,2));return {status:"OK"};}};
  await Promise.all([runPublicContextOnce(o),runPublicContextOnce(o)]);
  for(const name of ["treasury","bls","fomc"])assert.equal(calls.filter(n=>n===name).length,1);
}));
await test('local paper errors are sanitized before public source work and remain visible',()=>temp(async root=>{
  const dir=join(root,'data/runtime/options-snapshot-paper/observations/enrolled');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'broken.json'),'SECRET_BROKEN_SOURCE');
  let finish;const wait=new Promise(r=>finish=r),calls=[],service=startPublicContextService({workspaceRoot:root,issue:false,now:()=>"2026-09-08T05:20:00.000Z",execute:async name=>{calls.push(name);await wait;return {status:'OK'};}});
  try{const s=service.paperStatus();assert.equal(s.status,'FAILED');assert.equal(s.error,'LOCAL_PAPER_RECOVERY_FAILED');assert.equal(s.sourceReads,0);assert.deepEqual(calls,['headlines']);assert(!JSON.stringify(s).includes('SECRET'));s.status='MUTATED';assert.equal(service.paperStatus().status,'FAILED');}
  finally{service.stop();finish();await new Promise(r=>setTimeout(r,20));}
  assert.deepEqual(calls,['headlines','btc','focused_news']);assert.equal(service.paperStatus().enabled,false);
}));
await test('local paper recovery can run without public calls and returns explicit empty success',()=>temp(root=>{
  const r=runLocalPaperFinalization({workspaceRoot:root,now:()=>"2026-09-08T05:20:00.000Z"});assert.equal(r.status,'OK');assert.deepEqual(r.results,[]);assert.equal(r.sourceReads,0);assert.equal(r.executionAllowed,false);
}));
await test('separated code and Owner roots launch every collector without application files in data',()=>temp(async root=>{
  const codeRoot=join(root,'fixture-code-root'),workspaceRoot=join(root,'fixture-owner-workspace');
  mkdirSync(join(codeRoot,'node_modules/tsx/dist'),{recursive:true});mkdirSync(join(codeRoot,'scripts'));mkdirSync(workspaceRoot);
  // Test-only launcher, not copied node_modules or production dependencies.
  writeFileSync(join(codeRoot,'node_modules/tsx/dist/cli.mjs'),`import {pathToFileURL} from 'node:url';const target=process.argv[2];process.argv.splice(1,1);await import(pathToFileURL(target).href);`);
  const scripts={headlines:'drivers',btc:'btc-context',treasury:'treasury',bls:'release-calendar',fomc:'fomc-calendar',focused_news:'focused-news',macro_context:'macro-context'};
  for(const [name,file] of Object.entries(scripts))writeFileSync(join(codeRoot,`scripts/options-${file}.mjs`),`import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';const i=process.argv.indexOf('--workspace');if(i<0)throw Error('EXPLICIT_WORKSPACE_REQUIRED');const root=process.argv[i+1];mkdirSync(resolve(root,'data/runtime'),{recursive:true});writeFileSync(resolve(root,'data/runtime/fixture-${name}.json'),JSON.stringify({source:'${name}',executable:import.meta.url,cwd:process.cwd()}));console.log(JSON.stringify({status:'SAVED'}));`);
  const r=await runPublicContextOnce({codeRoot,workspaceRoot,issue:false,now:()=>"2026-09-08T21:20:00.000Z"});
  assert.deepEqual(r.results.flatMap(s=>s.sources??[]).map(s=>s.status),Array(7).fill('OK'));
  for(const name of Object.keys(scripts))assert.equal(JSON.parse(readFileSync(join(workspaceRoot,`data/runtime/fixture-${name}.json`))).cwd,codeRoot);
  assert(!existsSync(join(workspaceRoot,'scripts')));assert(!existsSync(join(workspaceRoot,'node_modules')));assert(!existsSync(join(codeRoot,'data/runtime')));
}));
await test('all real collector CLIs honor explicit data root with isolated denied HTTP and write guards',()=>temp(async root=>{
  const workspaceRoot=join(root,'fixture-owner-workspace');mkdirSync(workspaceRoot);
  const preload=join(root,'guard-and-http.mjs');
  writeFileSync(preload,`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {resolve,relative,isAbsolute} from 'node:path';const root=${JSON.stringify(workspaceRoot)};const guard=p=>{const r=relative(root,resolve(String(p)));if(isAbsolute(r)||r.startsWith('..'))throw Error('TEST_WRITE_OUTSIDE_OWNER_ROOT');};for(const key of ['mkdirSync','writeFileSync','appendFileSync','unlinkSync']){const original=fs[key];fs[key]=function(p,...a){if(typeof p!=='number')guard(p);return original(p,...a);};}const open=fs.openSync;fs.openSync=function(p,flags,...a){if(flags!=='r')guard(p);return open(p,flags,...a);};syncBuiltinESMExports();globalThis.fetch=async()=>new Response('',{status:503});`);
  const codeRoot=realpathSync(resolve(import.meta.dirname,'..'));
  const scripts={headlines:'drivers',btc:'btc-context',treasury:'treasury',bls:'release-calendar',fomc:'fomc-calendar',focused_news:'focused-news',macro_context:'macro-context'};
  for(const [source,file] of Object.entries(scripts)){
    const r=spawnSync(process.execPath,['--import','tsx','--import',pathToFileURL(preload).href,resolve(codeRoot,`scripts/options-${file}.mjs`),'--refresh','--workspace',workspaceRoot],{cwd:codeRoot,env:{...process.env,TSX_DISABLE_CACHE:'1'},encoding:'utf8',timeout:15000,windowsHide:true});
    assert.equal(r.status,3,source+' must save the injected HTTP failure in the selected workspace: '+r.stderr);
    const result=contextCommandResult(source,r.stdout,r.status);assert.equal(result.code,'SOURCE_HTTP_FAILURE',source);assert(result.evidencePath);assert(existsSync(join(workspaceRoot,result.evidencePath)));
    assert(!r.stderr.includes('TEST_WRITE_OUTSIDE_OWNER_ROOT'));
  }
  assert(!existsSync(join(workspaceRoot,'scripts')));assert(!existsSync(join(workspaceRoot,'node_modules')));
}));
await test('workspace CLI plumbing rejects duplicate or missing roots without changing legacy defaults',()=>temp(root=>{
  assert.deepEqual(contextWorkspaceArgs(['--report'],{defaultRoot:root}),{args:['--report'],workspaceRoot:realpathSync(root)});
  assert.throws(()=>contextWorkspaceArgs(['--workspace']),/ARGUMENTS/);
  assert.throws(()=>contextWorkspaceArgs(['--workspace',root,'--workspace',root]),/ARGUMENTS/);
}));
await test('diagnostics distinguish source HTTP, parse, unknown, store and executable failures without raw text',()=>{
  for(const [errorCode,code] of [['HTTP_STATUS','SOURCE_HTTP_FAILURE'],['SOURCE_SCHEMA','SOURCE_PARSE_FAILURE'],['SECRET_DETAIL','SOURCE_FAILURE_UNKNOWN']]){
    const r=contextCommandResult('btc',JSON.stringify({report:{latestRetrieval:{status:'FAILED',errorCode,sourceText:'SECRET_BODY'}}}),3);
    assert.equal(r.code,code);assert(!JSON.stringify(r).includes('SECRET'));
  }
  assert.equal(contextCommandResult('btc','SECRET_STDERR',2,JSON.stringify({code:'BTC_CONTEXT_WRITER_LOCKED'})).code,'STORE_FAILURE');
  assert.equal(contextCommandResult('btc','SECRET_STDERR',2,'SECRET').code,'REFRESH_LOCAL_FAILURE');
  assert.equal(contextCommandResult('btc','SECRET_STDERR',0).code,'REFRESH_OUTPUT_INVALID');
  for(const status of ['OBSERVED_CONTEXT','UNUSABLE_CONTEXT'])assert.equal(contextCommandResult('btc',JSON.stringify({report:{latestRetrieval:{status}}}),0).details[0].status,status);
});
await test('missing executable is recorded once and does not erase old receipts or expose paths',()=>temp(async root=>{
  const codeRoot=join(root,'empty-code');mkdirSync(codeRoot);const options={codeRoot,workspaceRoot:root,issue:false,now:()=>"2026-09-08T05:20:00.000Z"};
  const r=await runPublicContextOnce(options);assert(r.results.flatMap(s=>s.sources).every(s=>s.code==='EXECUTABLE_MISSING'));
  assert(!JSON.stringify(r).includes(codeRoot));const again=await runPublicContextOnce(options);assert(again.results.every(s=>s.status==='ALREADY_ATTEMPTED'));
  const html=contextRefreshDiagnostics({...again,status:'PARTIAL'});assert(html.includes('EXECUTABLE_MISSING'));assert(html.includes('ALREADY_ATTEMPTED'));assert(html.includes('NOT_YET_ELIGIBLE'));
}));
await test('top-level store errors remain visible through service status instead of disappearing',()=>temp(async root=>{
  mkdirSync(join(root,'data/runtime'),{recursive:true});writeFileSync(join(root,'data/runtime/options-context-service'),'blocked');
  const service=startPublicContextService({workspaceRoot:root,issue:false,now:()=>"2026-09-08T05:20:00.000Z",execute:async()=>{throw Error('must not call');}});
  try{await new Promise(r=>setTimeout(r,10));const s=service.status();assert.equal(s.status,'FAILED');assert.equal(s.error,'STORE_FAILURE');assert(!JSON.stringify(s).includes(root));}finally{service.stop();}
}));
console.log(passed+"/"+passed+" tests passed.");
