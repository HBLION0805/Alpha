import nodeTest,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {join,resolve,sep} from 'node:path';import {tmpdir} from 'node:os';
import {collectTechOptionQuotes,normalizeTechOptionCapture as normalize,validateTechQuoteSelection,techQuoteCollectorSource} from './lib/options-tech-quote-adapter.mjs';
import {mockTechSpreadQuoteFixture as fixture,collectMockTechSpreadFixture as collect,mockBatchStamp as stamp} from './lib/options-tech-spread-quote-fixtures.mjs';
import {assessTechSpreadPreflight as assess} from './lib/options-tech-spread-preflight.mjs';
import {saveTechQuoteCapture,reviewTechQuoteCapture,buildTechQuoteHostPrompt,techQuotesCli,captureTechQuotes} from './options-tech-quotes.mjs';
import {EventEmitter} from 'node:events';
let total=0,passed=0;const test=(n,fn)=>{total++;nodeTest(n,async()=>{await fn();passed++;});};after(()=>console.log('Explicit two-strike quote batches: '+passed+'/'+total+' tests passed.'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const locked=r=>{assert.equal(r.paperAdmissionAllowed,false);assert.equal(r.executionAllowed,false);assert.equal(r.fills,0);assert.equal(r.quotePair.economics,null);assert.equal(r.realPaperAcceptance,'NOT_TESTED');};
const rewrite=(run,fn)=>{fn(run.record);run.record.captureSha256=sha(JSON.stringify(run.record.capture));run.original.rawJson=JSON.stringify(run.record);run.original.sha256=sha(run.original.rawJson);};
const notCoherent=r=>{assert.notEqual(r.quotePair.status,'COHERENT_BATCH_EVIDENCE_ONLY');locked(r);};
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test(structure+' explicit same-batch quote evidence is not atomic or admission',async()=>{
 const f=fixture(structure),r=await collect(f),n=normalize(r.capture,stamp('12')),p=assess(r.preflight);
 assert.equal(r.calls.length,5);assert.deepEqual(r.calls.at(-1).args.instrument_ids,f.selection.legs.map(l=>l.id));
 assert.equal(n.pair.status,'COHERENT_BATCH_EVIDENCE_ONLY');assert.equal(n.pair.atomicSnapshot,false);assert.equal(n.pair.sourceClockDifferenceNs,'100000000');
 assert.notEqual(n.quotes[0].acquisition.instrumentRequestedAt,n.quotes[1].acquisition.instrumentRequestedAt);assert.equal(n.quotes[0].acquisition.quoteReceivedAt,n.quotes[1].acquisition.quoteReceivedAt);
 assert.equal(p.staticStructure.structure,structure);assert.equal(p.quotePair.status,'COHERENT_BATCH_EVIDENCE_ONLY');assert.equal(p.quotePair.batchId,f.selection.batchId);assert.equal(p.quotePair.atomicSnapshot,false);locked(p);
});
test('self-contained Host source evaluates the same request validator and collector',async()=>{const f=fixture(),collector=(0,eval)('('+techQuoteCollectorSource(f.selection)+')'),r=await collect(f,{collector});assert.equal(normalize(r.capture,stamp('12')).pair.status,'COHERENT_BATCH_EVIDENCE_ONLY');assert.match(buildTechQuoteHostPrompt(f.selection),/five market calls/);assert.match(buildTechQuoteHostPrompt(f.selection),/not an atomic snapshot/);});
for(const [name,change]of [
 ['missing ID',s=>delete s.legs[0].id],['duplicate ID',s=>s.legs[1].id=s.legs[0].id],['same strike',s=>s.legs[1].strike=s.legs[0].strike],['fractional cent',s=>s.legs[0].strike='335.001'],
 ['wrong type',s=>s.type='put'],['wrong structure',s=>s.structure='BEAR_CALL_CREDIT'],['credit strike order',s=>s.legs.reverse().forEach((l,n)=>l.direction=n?'SHORT':'LONG')],
 ['missing skew',s=>delete s.maxSourceSkewMs],['negative skew',s=>s.maxSourceSkewMs=-1],['skew above inherited freshness ceiling',s=>s.maxSourceSkewMs=60001],['fractional skew',s=>s.maxSourceSkewMs=.1],
 ['extra leg',s=>s.legs.push(s.legs[0])],['missing batch',s=>delete s.batchId],['unsupported symbol',s=>s.symbol='GLD'],['invalid expiry',s=>s.expiry='2026-02-30'],
])test(name+' is rejected before any source call',async()=>{const f=fixture();change(f.selection);let calls=0;assert.throws(()=>validateTechQuoteSelection(f.selection));await assert.rejects(collectTechOptionQuotes({selection:f.selection,origin:'SYNTHETIC_FIXTURE',clock:async()=>stamp('00'),call:async()=>{calls++;}}));assert.equal(calls,0);});
for(const failAt of [0,1,2,3,4])test('transport failure at '+failAt+' never retries or reuses prior legs',async()=>{const r=await collect(fixture(),{failAt});assert.equal(r.calls.length,failAt+1);assert.equal(r.capture.status,'BLOCKED');assert.equal(normalize(r.capture,stamp('12')).quotes.length,0);notCoherent(assess(r.preflight));});
for(const [name,change]of [
 ['wrong strike',f=>f.data[2].data.instruments[0].strike_price='345.00'],['wrong expiry',f=>f.data[2].data.instruments[0].expiration_date='2026-10-23'],['wrong type',f=>f.data[2].data.instruments[0].type='put'],
 ['wrong selected ID',f=>f.data[2].data.instruments[0].id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'],['pagination',f=>f.data[2].data.next='opaque'],['wrong multiplier',f=>f.data[2].data.instruments[0].trade_value_multiplier='10'],
])test(name+' response blocks the batch without guessing another contract',async()=>{const f=fixture();change(f);const r=await collect(f);assert.equal(r.capture.status,'BLOCKED');assert(r.calls.length<=3);notCoherent(assess(r.preflight));});
for(const [name,change]of [
 ['missing one leg',f=>f.data[4].data.results.pop()],['stale leg',f=>f.data[4].data.results[1].quote.updated_at='2026-10-09T15:20:00.000Z'],
 ['future leg',f=>f.data[4].data.results[1].quote.updated_at=stamp('59')],['missing source clock',f=>delete f.data[4].data.results[1].quote.updated_at],
 ['crossed book',f=>f.data[4].data.results[1].quote.bid_price='2.00'],['no displayed quantity',f=>f.data[4].data.results[1].quote.ask_size=0],
 ['skew outside explicit tolerance',f=>f.selection.maxSourceSkewMs=99],['one nanosecond above limit',f=>{f.selection.maxSourceSkewMs=100;f.data[4].data.results[1].quote.updated_at='2026-10-09T15:30:09.600000002Z';}],
])test(name+' cannot qualify a combined batch',async()=>{const f=fixture();change(f);const r=await collect(f);assert.equal(normalize(r.capture,stamp('12')).pair.status,'BLOCKED_PAIR');notCoherent(assess(r.preflight));});
test('exact skew boundary passes only batch evidence',async()=>{const f=fixture();f.selection.maxSourceSkewMs=100;const r=await collect(f);assert.equal(normalize(r.capture,stamp('12')).pair.status,'COHERENT_BATCH_EVIDENCE_ONLY');});
for(const [name,fn]of [
 ['batch label changed',r=>r.capture.batchId='mock-other'],['atomic claim',r=>r.capture.atomicSnapshot=true],
 ['request ID replaced',r=>r.capture.receipts[4].request.instrument_ids.reverse()],['request strike changed',r=>r.capture.receipts[2].request.strike_price='350.00'],
 ['backward receipt',r=>r.capture.receipts[2].receivedAt=stamp('01')],['backward request',r=>r.capture.receipts[2].requestedAt=stamp('01')],
 ['quote before supplied decision',r=>{}],
])test(name+' is rejected by preflight',async()=>{const r=await collect();rewrite(r,fn);if(name==='quote before supplied decision')r.preflight.decisionAt=stamp('11');notCoherent(assess(r.preflight));});
test('different batch originals cannot be stitched even with identical clocks',async()=>{const a=await collect(),f=fixture();f.selection.batchId='mock-second-batch';const b=await collect(f);b.original.id='mock-second-original';a.preflight.originals.push(b.original);a.preflight.legs[1].originalId=b.original.id;const p=assess(a.preflight);assert.equal(p.staticStructure.status,'VALID_STATIC_DEBIT_VERTICAL');notCoherent(p);assert(p.checks.some(g=>g.code==='SAME_EXPLICIT_BATCH'&&g.status==='BLOCKED'));});
test('an expired later assessment cannot refresh the saved batch',async()=>{const r=await collect();r.preflight.at='2026-10-19T15:30:12.000Z';notCoherent(assess(r.preflight));});
test('collector rejects a backward acquisition clock without an extra market call',async()=>{let n=0;const r=await collect(fixture(),{clock:async()=>{const t=n++;return stamp(String(t===5?1:t).padStart(2,'0'));}});assert.equal(r.capture.status,'BLOCKED');assert.equal(r.calls.length,2);notCoherent(assess(r.preflight));});
test('MOCK sink keeps complete original envelopes and refuses overwrite after failure',async()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-spread-batch-'));try{
 const r=await collect(),run=join(root,'data/runtime/options-workbench-development',r.capture.batchId);fs.mkdirSync(run,{recursive:true});fs.writeFileSync(join(run,'request.json'),JSON.stringify(r.intent));
 const preview=reviewTechQuoteCapture(root,run,r.capture,()=>stamp('12'));assert.equal(fs.existsSync(join(run,'capture.json')),false);assert.equal(preview.version,'TECH_QUOTES_RECEIPT_V2');
 saveTechQuoteCapture(root,run,r.capture,()=>stamp('12'));const before=fs.readFileSync(join(run,'capture.json'));const failure=await collect(fixture(),{failAt:4});assert.throws(()=>saveTechQuoteCapture(root,run,failure.capture,()=>stamp('12')),/EEXIST/);assert.deepEqual(fs.readFileSync(join(run,'capture.json')),before);
 const next=join(root,'data/runtime/options-workbench-development/mock-new-attempt');fs.mkdirSync(next);failure.intent.selection.batchId='mock-new-attempt';failure.capture.batchId='mock-new-attempt';fs.writeFileSync(join(next,'request.json'),JSON.stringify(failure.intent));saveTechQuoteCapture(root,next,failure.capture,()=>stamp('12'));assert.equal(JSON.parse(fs.readFileSync(join(next,'capture.json'))).normalized.quotes.length,0);
 assert.deepEqual(fs.readFileSync(join(run,'capture.json')),before);
 }finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});
test('CLI exposes actual bounded entry while invalid arguments cannot launch a Host',async()=>{assert.match((await techQuotesCli(['--help'])).usage,/capture-spread/);await assert.rejects(techQuotesCli(['--capture-spread','--arm']));await assert.rejects(captureTechQuotes({root:process.cwd(),selection:fixture().selection,runId:'different',codexPath:'UNUSED'}),/BATCH_RUN_ID/);});
test('expired contracts with otherwise current quote clocks are blocked',async()=>{const f=fixture();f.selection.expiry='2026-10-08';f.data[0].data.chains[0].expiration_dates=[f.selection.expiry];for(const n of [1,2])f.data[n].data.instruments[0].expiration_date=f.selection.expiry;const r=await collect(f);assert(normalize(r.capture,stamp('12')).quotes.every(q=>q.blockers.includes('OUTSIDE_MODEL_SESSION')));notCoherent(assess(r.preflight));});
test('missing terminal acquisition clock is preserved as null, never manufactured',async()=>{let n=0;const r=await collect(fixture(),{clock:async()=>{const t=n++;return t===11?'invalid':stamp(String(t).padStart(2,'0'));}});assert.equal(r.capture.capturedAt,null);assert.equal(r.capture.status,'BLOCKED');assert.equal(r.capture.receipts.length,5);notCoherent(assess(r.preflight));});
test('decimal-cent strikes are not rejected by binary floating multiplication',()=>{const f=fixture();f.selection.legs[0].strike='335.29';assert.equal(validateTechQuoteSelection(f.selection),f.selection);});
function mockHost(capture,{wrongResponse=false}={}){
 let starts=0;const start=()=>{starts++;const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
 child.stdin={end:prompt=>{assert.match(prompt,/No retry/);queueMicrotask(()=>{
 const items=capture.receipts.map(r=>({type:'item.completed',item:{type:'mcp_tool_call',server:'robinhood_alpha_market_data',tool:r.tool,status:'completed',arguments:structuredClone(r.request),result:structuredClone(r.response)}}));
 if(wrongResponse)items.at(-1).item.result.structuredContent.data.results[0].quote.ask_price='9.99';
 items.push({type:'item.completed',item:{type:'mcp_tool_call',server:'alpha_tech_quotes',tool:'review_capture',status:'completed',arguments:{capture},result:{}}});
 child.stdout.emit('data',Buffer.from(items.map(x=>JSON.stringify(x)).join('\n')+'\n'));child.emit('close',0);
 });}};return child;};return {start,get starts(){return starts;}};
}
for(const kind of ['complete','missing-leg','wrong-host-response'])test('actual parent capture path with explicit MOCK Host transport: '+kind,async()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'alpha-spread-host-'));try{
  fs.mkdirSync(join(root,'data/runtime/options-workbench-development'),{recursive:true});const f=fixture();if(kind==='missing-leg')f.data[4].data.results.pop();const r=await collect(f),host=mockHost(r.capture,{wrongResponse:kind==='wrong-host-response'});let n=0;
  const options={root,selection:f.selection,runId:f.selection.batchId,codexPath:'MOCK_NOT_EXECUTED',origin:'SYNTHETIC_FIXTURE',spawnHost:host.start,clock:()=>stamp(n++<2?'00':'12')};
  const result=await captureTechQuotes(options);assert.equal(host.starts,1);assert.equal(result.origin,'SYNTHETIC_FIXTURE');assert.equal(result.executionAllowed,false);
  assert.equal(result.status,kind==='complete'?'COHERENT_BATCH_EVIDENCE_ONLY':kind==='missing-leg'?'BLOCKED_PAIR':'BLOCKED_HOST_NO_RECEIPT');
  const run=join(root,'data/runtime/options-workbench-development',f.selection.batchId);assert(fs.existsSync(join(run,'host.jsonl')));
  if(kind==='wrong-host-response'){assert.equal(result.persistenceError,'TECH_QUOTES_HOST_RESPONSE_BINDING');assert.equal(fs.existsSync(join(run,'capture.json')),false);}
  else {const saved=JSON.parse(fs.readFileSync(join(run,'capture.json')));assert.equal(saved.capture.origin,'SYNTHETIC_FIXTURE');assert.deepEqual(saved.capture.receipts,r.capture.receipts);}
  const names=fs.readdirSync(run).sort(),before=names.map(p=>sha(fs.readFileSync(join(run,p))));await assert.rejects(captureTechQuotes(options),/EEXIST/);assert.equal(host.starts,1);assert.deepEqual(fs.readdirSync(run).sort(),names);assert.deepEqual(names.map(p=>sha(fs.readFileSync(join(run,p)))),before);
 }finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}
});
test('MOCK capture cannot silently invoke the real Host transport',async()=>{const f=fixture();await assert.rejects(captureTechQuotes({root:process.cwd(),selection:f.selection,runId:f.selection.batchId,codexPath:'UNUSED',origin:'SYNTHETIC_FIXTURE'}),/MOCK_TRANSPORT_REQUIRED/);});
