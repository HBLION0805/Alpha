import assert from "node:assert/strict";
import {mkdtempSync,rmSync,realpathSync,readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join,relative,isAbsolute} from "node:path";
import {tmpdir} from "node:os";
import {contextRefreshSlots,runPublicContextOnce,startPublicContextService} from "./options-context-service.mjs";
let passed=0;async function test(name,fn){await fn();passed++;console.log("PASS "+name);}
async function temp(fn){const root=mkdtempSync(join(tmpdir(),"alpha-context-service-test-"));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith("..")||!rel.startsWith("alpha-context-service-test-"))throw Error("UNSAFE_TEST_CLEANUP");rmSync(full,{recursive:true,force:true});}}
await test("hourly public context runs overnight and on weekends",()=>{assert.deepEqual(contextRefreshSlots("2026-09-12T04:20:00.000Z")[0].sources,["headlines","btc"]);});
await test("09:00 New York includes the remaining original daily sources",()=>{assert.deepEqual(contextRefreshSlots("2026-09-08T13:00:00.000Z")[1].sources,["treasury","bls","fomc"]);});
await test("daily sources follow New York across DST",()=>{assert.equal(contextRefreshSlots("2026-11-09T13:00:00.000Z").length,2);assert.equal(contextRefreshSlots("2026-11-09T14:00:00.000Z").length,3);});
await test("hourly claims survive process-independent repeated calls",()=>temp(async root=>{const names=[],options={workspaceRoot:root,now:()=>"2026-09-08T05:20:00.000Z",issue:false,execute:async(name,args)=>{names.push(name);assert.equal(args[0],"node_modules/tsx/dist/cli.mjs");assert.equal(args[2],"--refresh");return {status:"OK"};}};const a=await runPublicContextOnce(options),b=await runPublicContextOnce(options);assert.deepEqual(names,["headlines","btc","focused_news"]);assert.equal(a.results[0].sources.length,2);assert.equal(b.results[0].status,"ALREADY_ATTEMPTED");}));
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
  await runPublicContextOnce({workspaceRoot:root,now:()=>"2026-09-10T02:00:00.000Z",issue:false,execute:async name=>{calls.push(name);return {status:"OK"};}});
  assert(!calls.some(n=>["treasury","bls","fomc"].includes(n)));assert(readFileSync(path).equals(before));assert(!existsSync(join(parent,"daily-2026-09-09.receipt.json")));
}));
await test("concurrent late workers still perform only one daily source group",()=>temp(async root=>{
  const calls=[],o={workspaceRoot:root,now:()=>"2026-09-10T02:00:00.000Z",issue:false,execute:async name=>{calls.push(name);await new Promise(r=>setTimeout(r,2));return {status:"OK"};}};
  await Promise.all([runPublicContextOnce(o),runPublicContextOnce(o)]);
  for(const name of ["treasury","bls","fomc"])assert.equal(calls.filter(n=>n===name).length,1);
}));
console.log(passed+"/"+passed+" tests passed.");
