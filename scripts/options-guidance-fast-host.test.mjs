import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough,Readable} from 'node:stream';
import {ingestFastHost,finishFastHost,readCompactLine,compactContext} from './options-guidance-fast-host.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {capture,line,now} from './lib/options-fast-host-test-fixture.mjs';

let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temporary(fn){const root=mkdtempSync(join(tmpdir(),'alpha-fast-host-test-'));try{await fn(root);}finally{rmSync(root,{recursive:true,force:true});}}
await test('single compact line enforces size and frame without requiring EOF',async()=>{
  assert.equal((await readCompactLine(Readable.from([Buffer.from('{}\n')]),10)).toString(),'{}');
  const open=new PassThrough(),openRead=readCompactLine(open,10);open.write('{}\n');
  assert.equal((await Promise.race([openRead,new Promise((_,reject)=>setTimeout(()=>reject(Error('TIMEOUT')),500))])).toString(),'{}');
  open.destroy();
  for(const bytes of ['{}\n{}\n','{}','{}\r\n'])await assert.rejects(()=>readCompactLine(Readable.from([Buffer.from(bytes)]),10),/FRAME/);
  await assert.rejects(()=>readCompactLine(Readable.from([Buffer.alloc(11,65),Buffer.from('\n')]),10),/SIZE/);
});
await test('compact context carries bounded event facts and stays below 32 KiB',()=>{
  const metric={metric:'PAYROLLS',period:'2026-09',unit:'THOUSAND_JOBS',releaseVersion:'INITIAL',consensus:{value:'100',source:'Survey',reference:'table',receivedAt:now()},actual:{value:'101',source:'https://www.bls.gov/release',sourceAt:now(),receivedAt:now()},numericDifference:'1',qualitativeSurprise:'HIGHER_THAN_CONSENSUS',issues:[]};
  const context=compactContext({eventFacts:{events:Array.from({length:20},(_,n)=>({eventKey:'event-'+n,title:'Event',source:'BLS',scheduledAt:now(),metrics:Array.from({length:8},()=>metric)}))}});
  assert(context.eventFacts.length>0&&context.eventFacts.length<=12);assert.equal(context.eventFacts[0].metrics.length,6);
  assert.equal(context.eventFacts[0].metrics[0].numericDifference,'1');assert(Buffer.byteLength(JSON.stringify(context))<32768);
});
await test('CLI exits after one newline even when stdin remains open',()=>temporary(async root=>{
  const child=spawn(process.execPath,['--import','tsx','scripts/options-guidance-fast-host.mjs','--ingest','--workspace',root],{cwd:process.cwd(),stdio:['pipe','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});child.stdin.write('{}\n');
  const [code]=await Promise.race([once(child,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('CLI_TIMEOUT')),1500))]);
  assert.equal(code,2);assert.match(stderr,/GUIDANCE_FIELDS/);child.stdin.destroy();
}));
await test('nanosecond capture ingests, verifies, observes, stays compact and does not analyze or publish',()=>temporary(async root=>{
  const raw=capture();raw.receipts.at(-1).response.data.results[0].quote.updated_at=raw.capturedAt.replace(/\.\d{3}Z$/,'.123456789Z');
  const result=await ingestFastHost(root,line(raw));
  assert.equal(result.status,'INGESTED');assert.equal(result.coverage.selected,36);assert.equal(result.coverage.returned,36);
  assert.equal(result.assets.length,2);assert(result.identity.length===64);assert(Buffer.byteLength(JSON.stringify(result))<32768);
  assert(Array.isArray(result.context.eventFacts));
  assert.equal(JSON.parse(readFileSync(join(root,result.rawInputPath))).receipts.at(-1).response.data.results[0].quote.updated_at,raw.receipts.at(-1).response.data.results[0].quote.updated_at);
  const base=join(root,'data/runtime/options-daily-guidance');assert(!readdirSync(base).includes('reports'));assert(!readdirSync(base).includes('analysis'));
  await assert.rejects(()=>ingestFastHost(root,line(raw)),/COLLISION/);
}));
await test('invalid authority, call bound and partial coverage reject before persistence',()=>temporary(async root=>{
  for(const mutate of [r=>r.accountAccessed=true,r=>r.executionAllowed=true,r=>r.calls=25,r=>r.selectedIds.pop(),r=>r.failures.push({code:'MARKET_SOURCE_FAILED'}),r=>r.origin='SYNTHETIC_FIXTURE',r=>r.receipts.push({...r.receipts[0],tool:'get_positions'})]){
    const raw=capture();mutate(raw);await assert.rejects(()=>ingestFastHost(root,line(raw)));
  }
  await assert.rejects(()=>ingestFastHost(root,Buffer.alloc(8*1024*1024+1)),/SIZE/);
}));
await test('instrument pages must terminate, including the collector omitted-next form',()=>temporary(async root=>{
  const partial=capture();partial.receipts.find(r=>r.tool==='get_option_instruments').response.data.next='YWJj';
  await assert.rejects(()=>ingestFastHost(root,line(partial)),/PAGINATION/);
  const terminal=capture();delete terminal.receipts.find(r=>r.tool==='get_option_instruments').response.data.next;
  assert.equal((await ingestFastHost(root,line(terminal))).status,'INGESTED');
}));
await test('finish validates note and exact identity, then publishes bound capture',()=>temporary(async root=>{
  const first=await ingestFastHost(root,line(capture()));
  const note={assessedAt:now(),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'INSUFFICIENT_EVIDENCE',summary:'Isolated test assessment',supporting:[],opposing:[],invalidation:'Reassess with cited evidence',eventPlan:'No trade',sources:[]}))};
  await assert.rejects(()=>finishFastHost(root,first.identity,line({...note,unknown:true})),/FIELDS/);
  await assert.rejects(()=>finishFastHost(root,'0'.repeat(64),line(note)),/IDENTITY_MISMATCH/);
  const result=await finishFastHost(root,first.identity,line(note));
  assert.equal(result.status,'PASS');assert(result.identityMatch);assert(result.publicationCurrent);assert.equal(result.dispositions.length,2);
  assert.equal(result.predictionEvidence.status,'MATERIALIZED');assert.equal(result.predictionEvidence.candidateCount,2);
  const evidence=await runGuidanceCommand(['--prediction-evidence'],{workspaceRoot:root});
  assert.equal(evidence.identity,result.predictionEvidence.identity);assert.equal(evidence.provenance.report.path,result.reportPath);
  assert.equal(evidence.provenance.capture.path,first.capturePath);assert.equal(evidence.provenance.analysis.path,result.analysisPath);
  assert.deepEqual(evidence.candidates.map(c=>c.symbol),['GLD','IBIT']);
  assert(evidence.candidates.every(c=>c.directionCandidate===null&&c.blockingReasons.includes('NO_DIRECTION_CANDIDATE')&&c.executionAllowed===false));
  assert.equal(evidence.canonicalPredictionEligible,false);assert.equal(evidence.eventFacts.version,'OPTIONS_EVENT_FACTS_PROJECTION_V1');
  const {createWorkbenchData}=await import('./lib/options-workbench-data.mjs');
  const state=await createWorkbenchData({workspaceRoot:root}).state();
  assert.equal(state.predictionEvidence.state,'AVAILABLE');assert.equal(state.predictionEvidence.data.identity,evidence.identity);
  const {materializePredictionEvidence}=await import('./lib/options-prediction-evidence.mjs');
  assert.equal(materializePredictionEvidence(root,state).status,'ALREADY_MATERIALIZED');
  const unsafe=structuredClone(state);unsafe.guidance.data.history[0].path='../outside.json';
  assert.throws(()=>materializePredictionEvidence(root,unsafe),/UNSAFE_REFERENCE/);
  const stale=structuredClone(state);stale.guidance.data.interpretation.path=first.capturePath;
  assert.throws(()=>materializePredictionEvidence(root,stale),/STALE_OR_MISMATCHED_EVIDENCE|REFERENCE/);
  writeFileSync(join(root,evidence.path),'{"truncated":');
  const corrupted=await createWorkbenchData({workspaceRoot:root}).state();
  assert.equal(corrupted.predictionEvidence.state,'BLOCKED');
  assert.throws(()=>materializePredictionEvidence(root,corrupted),/SyntaxError|ARTIFACT/);
  assert.equal(JSON.parse(readFileSync(join(root,result.reportPath))).input.captureAt,JSON.parse(readFileSync(join(root,first.rawInputPath))).capturedAt);
  await assert.rejects(()=>finishFastHost(root,first.identity,line(note)),/IDENTITY_MISMATCH/);
}));
await test('a newer capture invalidates the earlier finish identity',()=>temporary(async root=>{
  const first=await ingestFastHost(root,line(capture()));
  await new Promise(resolve=>setTimeout(resolve,5));const secondRaw=capture();
  const second=await ingestFastHost(root,line(secondRaw));assert.notEqual(first.identity,second.identity);
  const note={assessedAt:now(),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'MIXED',summary:'Test',supporting:[],opposing:[],invalidation:'Test',eventPlan:'Test',sources:[]}))};
  await assert.rejects(()=>finishFastHost(root,first.identity,line(note)),/IDENTITY_MISMATCH/);
}));
await test('normal record path newer capture blocks finish and expected-capture publication',()=>temporary(async root=>{
  const first=await ingestFastHost(root,line(capture()));
  await new Promise(resolve=>setTimeout(resolve,5));
  const input='data/runtime/options-daily-guidance-inputs/later.json';
  writeFileSync(join(root,input),line(capture()));
  await runGuidanceCommand(['--record',input],{workspaceRoot:root});
  const note={assessedAt:now(),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'MIXED',summary:'Test',supporting:[],opposing:[],invalidation:'Test',eventPlan:'Test',sources:[]}))};
  await assert.rejects(()=>finishFastHost(root,first.identity,line(note)),/NEWER_CAPTURE/);
  await assert.rejects(()=>runGuidanceCommand(['--publish'],{workspaceRoot:root,expectedCapture:{path:first.capturePath,fingerprint:'0'.repeat(64)}}),/FAST_CAPTURE_MISMATCH/);
}));
await test('stale quotes and underlyings cannot produce operational PASS',()=>temporary(async root=>{
  const raw=capture(),stale=new Date(Date.parse(raw.capturedAt)-121000).toISOString();
  for(const receipt of raw.receipts){
    if(receipt.tool==='get_equity_quotes')for(const row of receipt.response.data.results)row.quote.venue_last_trade_time=stale;
    if(receipt.tool==='get_option_quotes')for(const row of receipt.response.data.results)row.quote.updated_at=stale;
  }
  const first=await ingestFastHost(root,line(raw));
  const note={assessedAt:now(),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'INSUFFICIENT_EVIDENCE',summary:'Stale isolated evidence',supporting:[],opposing:['Old source clocks'],invalidation:'Fresh independent evidence',eventPlan:'No trade',sources:[]}))};
  const result=await finishFastHost(root,first.identity,line(note));
  assert.equal(result.status,'FAIL');assert.equal(result.freshAtPublish,false);assert.equal(result.freshCoverage,false);assert.equal(result.publicationCurrent,true);
}));
await test('roughly 424 KiB isolated capture stays bounded and fast',()=>temporary(async root=>{
  const raw=capture();
  for(const receipt of raw.receipts.filter(r=>r.tool==='get_option_quotes'))for(const row of receipt.response.data.results)row.quote.provider_metadata='m'.repeat(11200);
  const bytes=line(raw),sizeKiB=Math.round(bytes.length/1024);assert(sizeKiB>=400&&sizeKiB<=450);
  const start=performance.now(),first=await ingestFastHost(root,bytes),ingestMs=Math.round(performance.now()-start);
  const note={assessedAt:now(),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'INSUFFICIENT_EVIDENCE',summary:'Isolated benchmark, no source inference',supporting:[],opposing:['Synthetic input'],invalidation:'Live attributed evidence',eventPlan:'No trade',sources:[]}))};
  const finishStart=performance.now(),result=await finishFastHost(root,first.identity,line(note)),finishMs=Math.round(performance.now()-finishStart);
  const ingestBytes=Buffer.byteLength(JSON.stringify(first)),finishBytes=Buffer.byteLength(JSON.stringify(result));
  assert(ingestBytes<32768&&finishBytes<16384);assert(ingestMs<5000&&finishMs<5000);
  console.log(JSON.stringify({sizeKiB,ingestMs,finishMs,ingestBytes,finishBytes,status:result.status}));
}));
console.log(passed+'/'+passed+' tests passed');
