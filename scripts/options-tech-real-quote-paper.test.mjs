import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {paperSpreadPlanFixture} from './lib/options-tech-spread-plan-fixtures.mjs';
import {previewTechSpreadPlan,startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
import {spreadPlanHash,boundSpreadPlanHash,mockSpreadEventFromOriginal,SPREAD_PLAN_RECORD_KINDS} from './lib/options-tech-spread-plan-binding.mjs';
import {replayMockSpread,appendMockSpread,recoverMockSpread,startMockSpread} from './lib/options-tech-mock-spread.mjs';
import {techSpreadPlanCli} from './options-tech-spread-plan.mjs';
let total=0,passed=0;
const test=(name,fn)=>{total++;nodeTest(name,async()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-quote-paper-'));try{await fn(root);passed++;}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});};
after(()=>console.log('Technology real-quote Paper: '+passed+'/'+total+' tests passed.'));
const runId='paper-test-fixture';
const editOriginal=(o,fn)=>{const r=JSON.parse(o.rawJson);fn(r);r.captureSha256=spreadPlanHash(r.capture);o.rawJson=JSON.stringify(r);o.sha256=spreadPlanHash(o.rawJson);};
const editRecord=(input,kind,fn)=>{const r=input.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p);r.rawJson=JSON.stringify(p);r.sha256=spreadPlanHash(r.rawJson);};
function repin(input){const hash=k=>input.records.find(r=>r.kind===k).sha256;editRecord(input,'STRATEGY_REQUEST',p=>{p.researchSha256=hash('RESEARCH');p.costModelSha256=hash('COST_MODEL');p.contractEvidenceSha256=hash('CONTRACT');for(const k of Object.keys(p.accountEvidenceHashes))p.accountEvidenceHashes[k]=hash(k);});}
const quotes=r=>r.capture.receipts[4].response.structuredContent.data.results;
const blocked=f=>{const p=previewTechSpreadPlan(f.input);assert.equal(p.status,'BLOCKED',JSON.stringify(p.checks));assert.equal(p.plan,null);assert.equal(p.actualTrades,0);return p;};
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test(structure+' same existing journal completes labeled test fixture with independent clocks',async root=>{
 const f=await paperSpreadPlanFixture(structure),p=startTechSpreadPlan({root,runId,input:f.input});assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY',JSON.stringify(p.checks));assert.equal(p.testFixtureOnly,true);assert.equal(p.plan.candidate.origin,'SYNTHETIC_FIXTURE');assert.equal(p.plan.account.mode,'PAPER');assert.notEqual(p.plan.account.permission,'PASS');
 assert.equal(recoverMockSpread({root,runId,asOf:f.input.at}).events.length,0);const open=appendMockSpread({root,runId,event:p.entryEvent});assert.equal(open.status,'OPEN_UNRESOLVED');assert.equal(open.mode,'REAL_QUOTE_PAPER');assert.equal(open.evidenceContext,'TEST_FIXTURE');
 assert.notEqual(open.orders[0].legs[0].sourceAt,open.orders[0].legs[1].sourceAt);assert.equal(open.orders[0].legs[0].sourceAt,'2026-10-09T15:30:09.500000001Z');assert.equal(open.orders[0].legs[1].sourceAt,'2026-10-09T15:30:09.600000001Z');
 const e=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'paper-independent-exit',at:f.exitAt}),closed=appendMockSpread({root,runId,event:e});assert.equal(closed.status,'CLOSED_MODELED');assert.equal(closed.account.netPnlCents,-920);assert.equal(closed.realAcceptance,'NOT_TESTED');assert.equal(closed.actualTrades,0);assert.equal(closed.productionPaperAdmissionAllowed,false);assert.equal(closed.executionAllowed,false);assert.equal(closed.atomicFillsAreBrokerGuarantee,false);assert.equal(closed.account.initialUnsettledCashCents,700);assert.deepEqual(recoverMockSpread({root,runId,asOf:f.exitAt}).report,closed);
});
for(const kind of SPREAD_PLAN_RECORD_KINDS)test('missing '+kind+' is not filled from MOCK',async()=>{const f=await paperSpreadPlanFixture();f.input.records=f.input.records.filter(r=>r.kind!==kind);blocked(f);});
for(const [name,kind,fn]of [
 ['unknown funds','ACCOUNT_FUNDS',p=>p.settledCashCents=null],['unknown reserve','ACCOUNT_FUNDS',p=>delete p.reservedCashCents],['unsettled cannot fund entry','ACCOUNT_FUNDS',p=>{p.settledCashCents=10000;p.unsettledCashCents=999999;}],
 ['unknown fee','COST_MODEL',p=>p.legs[1].exitFeeCents=null],['MOCK costs not paper costs','COST_MODEL',p=>p.version='MOCK_FIXED_PER_LEG_COST_V1'],
 ['unknown permission','PRODUCT_PERMISSION',p=>p.enabled=null],['unknown entitlement','DATA_ENTITLEMENT',p=>p.realtimeOptions=null],['insufficient risk budget','RISK_LIMITS',p=>p.maximumLossCents=100],
 ['unknown multiplier','CONTRACT',p=>delete p.contracts[0].multiplier],['unknown deliverable','CONTRACT',p=>delete p.contracts[0].deliverable],['unknown exercise','CONTRACT',p=>delete p.contracts[0].exerciseStyle],
 ['no predefined skew','STRATEGY_REQUEST',p=>delete p.maxSourceSkewMs],['changed skew','STRATEGY_REQUEST',p=>p.maxSourceSkewMs=2000],['negative skew','STRATEGY_REQUEST',p=>p.maxSourceSkewMs=-1],
 ['late decision','STRATEGY_REQUEST',p=>p.decisionAt='2026-10-09T15:30:10.000Z'],['ratio request','STRATEGY_REQUEST',p=>p.quantity=2],['overnight request','STRATEGY_REQUEST',p=>p.timeExitAt='2026-10-12T15:36:59.000Z'],
 ['MOCK execution label','STRATEGY_REQUEST',p=>p.executionModel='ATOMIC_TWO_LEG_ASSUMPTION'],['missing exit condition','STRATEGY_REQUEST',p=>delete p.conditions.exit],
])test(name+' blocks plan',async()=>{const f=await paperSpreadPlanFixture();editRecord(f.input,kind,fn);repin(f.input);blocked(f);});
test('real context cannot inherit synthetic transport or account records',async()=>{const f=await paperSpreadPlanFixture();f.input.evidenceContext='ATTRIBUTED_REAL_EVIDENCE';const p=blocked(f);assert(p.checks.some(c=>c.code==='ACCOUNT_FUNDS_RECORD'&&c.status==='BLOCKED'));assert.equal(p.realAccountConfirmation.funds,'UNKNOWN');});
test('missing external evidence context fails closed',async()=>{const f=await paperSpreadPlanFixture();delete f.input.evidenceContext;blocked(f);});
test('LIVE mode is not supported',async()=>{const f=await paperSpreadPlanFixture();f.input.mode='LIVE';blocked(f);});
test('paper run cannot occupy a mock run directory',async root=>{const f=await paperSpreadPlanFixture();assert.throws(()=>startTechSpreadPlan({root,runId:'mock-wrong-scope',input:f.input}),/RUN_MODE_SCOPE/);assert.deepEqual(fs.readdirSync(root),[]);});
test('costs reviewed after decision reject even with recomputed request hashes',async()=>{const f=await paperSpreadPlanFixture();f.input.records.find(r=>r.kind==='COST_MODEL').reviewedAt='2026-10-09T15:30:00.000Z';repin(f.input);blocked(f);});
for(const [name,fn]of [
 ['future source',r=>quotes(r)[1].quote.updated_at='2026-10-09T15:37:40.000Z'],
 ['predecision source',r=>quotes(r)[1].quote.updated_at='2026-10-09T15:29:58.000Z'],
 ['stale source',r=>quotes(r)[1].quote.updated_at='2026-10-09T15:35:00.000Z'],
 ['missing leg',r=>quotes(r).pop()],
 ['wrong contract',r=>quotes(r)[1].quote.instrument_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
 ['future original',r=>r.recordedAt='2026-10-09T15:37:40.000Z'],
 ['intent version',r=>r.intent.version='TECH_QUOTES_REQUEST_V1'],
 ['request ordering',r=>r.intent.requestedAt='2026-10-09T15:37:40.000Z'],
 ['expanded later skew',r=>{r.intent.selection.maxSourceSkewMs=2000;r.capture.selection.maxSourceSkewMs=2000;}],
 ['excess source skew',r=>quotes(r)[0].quote.updated_at='2026-10-09T15:37:07.000Z'],
])test(name+' cannot create or rehash an exit and release funds',async root=>{
 const f=await paperSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input});const open=appendMockSpread({root,runId,event:p.entryEvent});const e=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'paper-exit',at:f.exitAt});editOriginal(f.exitOriginal,fn);e.provenance.original={rawJson:f.exitOriginal.rawJson,sha256:f.exitOriginal.sha256};
 assert.throws(()=>mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:e.id,at:f.exitAt}));assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent,e],f.exitAt));
 const recovered=recoverMockSpread({root,runId,asOf:f.exitAt});assert.equal(recovered.events.length,1);assert.equal(recovered.report.status,'OPEN_UNRESOLVED');assert.equal(recovered.report.account.netPnlCents,null);assert.equal(recovered.report.account.settledCashCents,open.account.settledCashCents);assert.equal(recovered.report.account.unsettledProceedsCents,700);
});
test('without a later quote time exit remains pending and exposure is retained',async root=>{const f=await paperSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input});appendMockSpread({root,runId,event:p.entryEvent});const r=recoverMockSpread({root,runId,asOf:f.exitAt}).report;assert.equal(r.status,'OPEN_UNRESOLVED');assert.equal(r.position.pendingExit,'TIME_EXIT');assert.equal(r.orders.length,1);assert.equal(r.account.netPnlCents,null);assert.deepEqual(r.position.modeledLegs.map(l=>l.signedQuantity),[1,-1]);assert.equal(r.quoteGapObserved,true);});
test('retiming quote cannot bypass saved original even after rehash',async()=>{const f=await paperSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);p.entryEvent.quote.legs[1].updatedAt=p.entryEvent.quote.legs[0].updatedAt;p.entryEvent.provenance.quoteSha256=spreadPlanHash(p.entryEvent.quote);assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent],f.input.at),/SOURCE_FIELDS_CHANGED/);});
test('changing plan tolerance and plan hash does not change pinned request',async root=>{const f=await paperSpreadPlanFixture(),p=previewTechSpreadPlan(f.input).plan;p.maxSourceSkewMs=2000;p.provenance.planSha256=boundSpreadPlanHash(p);assert.throws(()=>startMockSpread({root,runId,input:p}),/REQUEST_CONTENT/);});
test('existing CLI plan to original append to recovery remains isolated',async root=>{const f=await paperSpreadPlanFixture();const save=(n,v)=>fs.writeFileSync(join(root,n),typeof v==='string'?v:JSON.stringify(v));save('entry.json',f.input.originals[0].rawJson);save('exit.json',f.exitOriginal.rawJson);const o=f.input.originals[0];save('input.json',{...f.input,originals:[{id:o.id,path:'entry.json',sha256:o.sha256}]});
 const p=techSpreadPlanCli(['--start','input.json','--run-id',runId],{root});assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY');
 for(const [file,original,at,id]of [['entry.json',o,f.input.at,'paper-cli-entry'],['exit.json',f.exitOriginal,f.exitAt,'paper-cli-exit']]){save('ref.json',{id:original.id,path:file,sha256:original.sha256,eventId:id});techSpreadPlanCli(['--append-original','ref.json','--run-id',runId,'--at',at],{root});}
 const r=techSpreadPlanCli(['--recover','--run-id',runId,'--at',f.exitAt],{root});assert.equal(r.status,'CLOSED_MODELED');assert.equal(r.evidenceContext,'TEST_FIXTURE');assert.equal(r.actualTrades,0);
});
test('independent source clocks between actual decision and request remain valid',async root=>{const f=await paperSpreadPlanFixture();editOriginal(f.input.originals[0],r=>{quotes(r)[0].quote.updated_at='2026-10-09T15:29:59.100000001Z';quotes(r)[1].quote.updated_at='2026-10-09T15:29:59.200000001Z';});const p=startTechSpreadPlan({root,runId,input:f.input});assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY',JSON.stringify(p.checks));const report=appendMockSpread({root,runId,event:p.entryEvent});assert.equal(report.status,'OPEN_UNRESOLVED');assert.equal(report.orders[0].legs[0].sourceAt,'2026-10-09T15:29:59.100000001Z');});
for(const index of [0,1,2])test('paper retry sequence '+index+' returns latest complete state without a second fill',async root=>{
 const f=await paperSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input}),mid=structuredClone(f.exitOriginal);mid.rawJson=mid.rawJson.replaceAll('T15:37:','T15:31:');editOriginal(mid,r=>{r.capture.batchId='mock-paper-middle';r.capture.selection.batchId='mock-paper-middle';r.intent.selection.batchId='mock-paper-middle';});
 const events=[p.entryEvent,mockSpreadEventFromOriginal({plan:p.plan,original:mid,id:'paper-middle-event',at:'2026-10-09T15:31:12.000Z'}),mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'paper-exit-event',at:f.exitAt})];let closed;for(const event of events)closed=appendMockSpread({root,runId,event});assert.deepEqual(appendMockSpread({root,runId,event:events[index]}),closed);assert.equal(recoverMockSpread({root,runId,asOf:f.exitAt}).events.length,3);assert.equal(closed.orders.length,2);
});
for(const [tolerance,expected]of [[100,'REAL_QUOTE_PAPER_PLAN_READY'],[99,'BLOCKED']])test('explicit skew boundary '+tolerance+' milliseconds',async()=>{const f=await paperSpreadPlanFixture();editOriginal(f.input.originals[0],r=>{r.intent.selection.maxSourceSkewMs=tolerance;r.capture.selection.maxSourceSkewMs=tolerance;});editRecord(f.input,'STRATEGY_REQUEST',p=>{p.maxSourceSkewMs=tolerance;p.selectionSha256=spreadPlanHash(JSON.parse(f.input.originals[0].rawJson).intent.selection);});assert.equal(previewTechSpreadPlan(f.input).status,expected);});
test('bound event context cannot be relabeled as real after quote rehash',async()=>{const f=await paperSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);p.entryEvent.provenance.evidenceContext='ATTRIBUTED_REAL_EVIDENCE';p.entryEvent.origin='HOST_MARKET_TOOL_RESPONSES';p.entryEvent.quote.source='ROBINHOOD_OFFICIAL_MCP';p.entryEvent.provenance.quoteSha256=spreadPlanHash(p.entryEvent.quote);assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent],f.input.at),/EVENT_PLAN_POLICY/);});
