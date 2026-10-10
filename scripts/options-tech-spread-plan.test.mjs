import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {mockSpreadPlanFixture} from './lib/options-tech-spread-plan-fixtures.mjs';
import {previewTechSpreadPlan,startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
import {SPREAD_PLAN_RECORD_KINDS,spreadPlanHash,mockSpreadEventFromOriginal,validateMockSpreadEventBinding} from './lib/options-tech-spread-plan-binding.mjs';
import {replayMockSpread,startMockSpread,appendMockSpread,recoverMockSpread} from './lib/options-tech-mock-spread.mjs';
import {techSpreadPlanCli} from './options-tech-spread-plan.mjs';
import {collectMockTechSpreadFixture} from './lib/options-tech-spread-quote-fixtures.mjs';
import {paperSpreadPlanFixture} from './lib/options-tech-spread-plan-fixtures.mjs';
import {prepareTechSpreadInput} from './lib/options-tech-spread-preparation.mjs';
import {spawnSync} from 'node:child_process';
let total=0,passed=0;
const test=(name,fn)=>{total++;nodeTest(name,async()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-spread-plan-'));try{await fn(root);passed++;}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});};
after(()=>console.log('Technology spread plans: '+passed+'/'+total+' tests passed.'));
const runId='mock-bound-test';
function edit(input,kind,fn){const r=input.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p);r.rawJson=JSON.stringify(p);r.sha256=spreadPlanHash(r.rawJson);return r;}
function repin(input){const records=Object.fromEntries(input.records.map(r=>[r.kind,r]));edit(input,'STRATEGY_REQUEST',p=>{p.researchSha256=records.RESEARCH.sha256;p.costModelSha256=records.COST_MODEL.sha256;p.contractEvidenceSha256=records.CONTRACT.sha256;for(const k of Object.keys(p.accountEvidenceHashes))p.accountEvidenceHashes[k]=records[k].sha256;});}
function blocked(input,code){const r=previewTechSpreadPlan(input);assert.equal(r.status,'BLOCKED');assert.equal(r.plan,null);assert.equal(r.entryEvent,null);assert.equal(r.actualTrades,0);if(code)assert(r.checks.some(c=>c.code===code&&c.status==='BLOCKED'),JSON.stringify(r.checks));return r;}
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test(structure+' existing durable lifecycle and recovered cash',async root=>{
 const f=await mockSpreadPlanFixture(structure),p=startTechSpreadPlan({root,runId,input:f.input});assert.equal(p.status,'MOCK_PLAN_READY');assert.equal(p.entryAutomaticallyAppended,false);
 const initial=recoverMockSpread({root,runId,asOf:f.input.at});assert.equal(initial.events.length,0);assert.equal(initial.report.orders.length,0);
 const opened=appendMockSpread({root,runId,event:p.entryEvent});assert.equal(opened.status,'OPEN_UNRESOLVED');assert.equal(opened.account.settledCashCents,8790);
 const event=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'mock-independent-exit',at:f.exitAt});const closed=appendMockSpread({root,runId,event});
 assert.equal(closed.status,'CLOSED_MODELED');assert.equal(closed.account.netPnlCents,-920);assert.equal(closed.account.unsettledProceedsCents,9990);assert.equal(closed.account.initialUnsettledCashCents,700);assert.equal(closed.actualTrades,0);
 assert.deepEqual(closed.orders.flatMap(o=>o.legs.map(l=>l.side)),['BUY_TO_OPEN','SELL_TO_OPEN','SELL_TO_CLOSE','BUY_TO_CLOSE']);assert.deepEqual(recoverMockSpread({root,runId,asOf:closed.assessedAt}).report,closed);
 assert(closed.planBinding.parentIds.includes('mock-bound-plan'));assert.notEqual(event.provenance.batchId,p.entryEvent.provenance.batchId);
});
test('preview is side effect free with UNKNOWN real authorities',async root=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);assert.equal(p.status,'MOCK_PLAN_READY');assert.deepEqual(fs.readdirSync(root),[]);assert.deepEqual(p.realAccountConfirmation,{permission:'UNKNOWN',funds:'UNKNOWN',entitlement:'UNKNOWN'});assert.equal(p.productionPaperAdmissionAllowed,false);assert.equal(p.economics.terminalRisk.maximumLossCents,10420);});
for(const kind of SPREAD_PLAN_RECORD_KINDS)test('missing '+kind+' cannot save plan',async root=>{const f=await mockSpreadPlanFixture();f.input.records=f.input.records.filter(r=>r.kind!==kind);blocked(f.input,kind+'_MISSING');assert.equal(startTechSpreadPlan({root,runId,input:f.input}).status,'BLOCKED');assert.deepEqual(fs.readdirSync(root),[]);});
for(const [label,kind,fn,code] of [
 ['unknown multiplier','CONTRACT',p=>delete p.contracts[0].multiplier,'CONTRACT_EVIDENCE'],
 ['unknown deliverable','CONTRACT',p=>delete p.contracts[0].deliverable,'CONTRACT_EVIDENCE'],
 ['unknown exercise style','CONTRACT',p=>delete p.contracts[0].exerciseStyle,'CONTRACT_EVIDENCE'],
 ['wrong contract','CONTRACT',p=>p.contracts[0].strike='330.00','CONTRACT_EVIDENCE'],
 ['unknown fee','COST_MODEL',p=>delete p.legs[0].entryFeeCents,'VERSIONED_COST_MODEL'],
 ['missing cost version','COST_MODEL',p=>delete p.version,'VERSIONED_COST_MODEL'],
 ['unknown permission','PRODUCT_PERMISSION',p=>p.enabled=null,'MOCK_SPREAD_PERMISSION'],
 ['single leg permission','PRODUCT_PERMISSION',p=>p.products=['LONG_CALL'],'MOCK_SPREAD_PERMISSION'],
 ['entitlement missing','DATA_ENTITLEMENT',p=>p.realtimeOptions=null,'MOCK_DATA_ENTITLEMENT'],
 ['unknown settled','ACCOUNT_FUNDS',p=>p.settledCashCents=null,'SETTLED_RESERVED_AND_UNSETTLED_FUNDS'],
 ['unknown unsettled','ACCOUNT_FUNDS',p=>delete p.unsettledCashCents,'SETTLED_RESERVED_AND_UNSETTLED_FUNDS'],
 ['unknown reserve','ACCOUNT_FUNDS',p=>p.reservedCashCents=null,'SETTLED_RESERVED_AND_UNSETTLED_FUNDS'],
 ['excess reserve','ACCOUNT_FUNDS',p=>p.reservedCashCents=30000,'SETTLED_RESERVED_AND_UNSETTLED_FUNDS'],
 ['insufficient settled despite unsettled','ACCOUNT_FUNDS',p=>{p.settledCashCents=10000;p.unsettledCashCents=999999;},'EXISTING_MOCK_ENTRY_MODEL'],
 ['recorded risk limit','RISK_LIMITS',p=>p.maximumLossCents=10000,'REQUEST_BUDGET_WITHIN_DOCUMENTED_LIMITS'],
 ['absent conditions','STRATEGY_REQUEST',p=>delete p.conditions,'EXPLICIT_CONDITIONS'],
 ['real account','STRATEGY_REQUEST',p=>p.accountId='REAL','SUPPORTED_PLAN_REQUEST'],
 ['absent research id','STRATEGY_REQUEST',p=>p.researchId='other','RESEARCH_REQUEST_ID_AND_HASH'],
 ['decision after quote','STRATEGY_REQUEST',p=>p.decisionAt='2026-10-09T15:30:11.000Z','PRIOR_REQUEST_BOUND_TO_SELECTION'],
 ['overnight','STRATEGY_REQUEST',p=>p.timeExitAt='2026-10-12T15:36:59.000Z',null],
])test(label+' rejected',async()=>{const f=await mockSpreadPlanFixture();edit(f.input,kind,fn);repin(f.input);blocked(f.input,code);});
for(const [label,fn]of [
 ['hash mismatch',r=>r.sha256='0'.repeat(64)],['late costs',r=>r.reviewedAt='2026-10-09T15:30:00.000Z'],
 ['missing cost source',r=>r.source=''],['unknown verdict',r=>r.verdict='UNKNOWN'],['real evidence in mock',r=>r.origin='HOST_MARKET_TOOL_RESPONSES'],
])test(label+' rejected at envelope',async()=>{const f=await mockSpreadPlanFixture();fn(f.input.records.find(r=>r.kind==='COST_MODEL'));blocked(f.input,'COST_MODEL_RECORD');});
test('changed cost hash cannot silently replace predecision request',async()=>{const f=await mockSpreadPlanFixture();edit(f.input,'COST_MODEL',p=>p.legs[0].entryFeeCents=6);blocked(f.input,'REQUEST_EVIDENCE_HASHES');});
test('same economics with different lineage produces a distinct plan identity',async()=>{const f=await mockSpreadPlanFixture(),first=previewTechSpreadPlan(f.input);edit(f.input,'STRATEGY_REQUEST',p=>p.parentIds.push('mock-second-parent'));const second=previewTechSpreadPlan(f.input);assert.equal(second.status,'MOCK_PLAN_READY');assert.notEqual(first.plan.provenance.planSha256,second.plan.provenance.planSha256);assert.throws(()=>replayMockSpread(second.plan,[first.entryEvent],f.input.at));});
test('coherent nonzero skew cannot be retimed for atomic MOCK',async()=>{const f=await mockSpreadPlanFixture(),batch=await collectMockTechSpreadFixture();f.input.originals=[batch.original];const r=blocked(f.input,'EXISTING_MOCK_EXACT_SYNCHRONY');assert.equal(r.preflight.quotePair.status,'COHERENT_BATCH_EVIDENCE_ONLY');assert.equal(r.preflight.quotePair.sourceClockDifferenceNs,'100000000');});
test('REAL mode cannot borrow synthetic permission or create lifecycle',async root=>{const f=await mockSpreadPlanFixture();f.input.mode='REAL_SAVED_SOURCE_REPLAY';blocked(f.input,'REAL_INPUT_HAS_NO_LIFECYCLE_AUTHORITY');assert.equal(startTechSpreadPlan({root,runId,input:f.input}).status,'BLOCKED');assert.deepEqual(fs.readdirSync(root),[]);});
for(const [label,fn]of [
 ['body cash',p=>p.account.settledCashCents++],['open action',p=>p.provenance.actions[0].open='SELL_TO_OPEN'],
 ['parent',p=>p.provenance.parentIds.push('unexpected')],['original hash',p=>p.provenance.original.sha256='0'.repeat(64)],
 ['cost provenance',p=>p.provenance.costModel.source='NEW_SOURCE'],['loss basis',p=>p.provenance.maximumLossBasis='GUARANTEED'],
 ['condition',p=>p.provenance.conditions.entry='Changed after decision'],
])test(label+' binding tamper fails',async root=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input).plan;fn(p);assert.throws(()=>startMockSpread({root,runId,input:p}));});
for(const [label,fn]of [
 ['price',e=>e.quote.legs[0].bidCents++],['source clock',e=>e.quote.legs[0].updatedAt='2026-10-09T15:30:09.600Z'],
 ['source hash',e=>e.provenance.original.sha256='0'.repeat(64)],['parent plan',e=>e.provenance.parentPlanSha256='0'.repeat(64)],
])test(label+' event tamper fails',async()=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);fn(p.entryEvent);assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent],f.input.at));});
test('rehashed price still cannot alter source evidence',async()=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);p.entryEvent.quote.legs[0].bidCents++;p.entryEvent.provenance.quoteSha256=spreadPlanHash(p.entryEvent.quote);assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent],f.input.at),/SOURCE_FIELDS_CHANGED/);});
test('entry source cannot be reused as an independent exit',async()=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input),e=structuredClone(p.entryEvent);e.id='mock-repeat';const r=replayMockSpread(p.plan,[p.entryEvent,e],f.exitAt);assert.equal(r.orders.length,1);assert.equal(r.account.netPnlCents,null);});
test('CLI exact original reader and plan-only start',async root=>{const f=await mockSpreadPlanFixture();fs.writeFileSync(join(root,'original.json'),f.input.originals[0].rawJson);f.input.originals=[{id:'mock-original',path:'original.json',sha256:f.input.originals[0].sha256}];fs.writeFileSync(join(root,'input.json'),JSON.stringify(f.input));const p=techSpreadPlanCli(['--start','input.json','--run-id',runId],{root});assert.equal(p.status,'MOCK_PLAN_READY');assert.equal(recoverMockSpread({root,runId,asOf:f.input.at}).events.length,0);assert.throws(()=>techSpreadPlanCli(['--arm'],{root}),/ARGUMENTS/);});
for(const [name,change]of [
 ['future original publication',r=>r.recordedAt='2026-10-09T15:37:40.000Z'],
 ['request after acquisition',r=>r.intent.requestedAt='2026-10-09T15:37:30.000Z'],
 ['wrong intent version',r=>r.intent.version='TECH_QUOTES_REQUEST_V1'],
 ['execution permission',r=>r.executionAllowed=true],
 ['account access',r=>r.intent.accountAccessed=true],
 ['original before capture',r=>r.recordedAt='2026-10-09T15:37:00.000Z'],
])test(name+' rehashed original fails both creation and early replay without releasing funds',async root=>{
 const f=await mockSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input});const open=appendMockSpread({root,runId,event:p.entryEvent});
 const e=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'mock-audit-exit',at:f.exitAt}),r=JSON.parse(f.exitOriginal.rawJson);change(r);r.captureSha256=spreadPlanHash(r.capture);const rawJson=JSON.stringify(r),original={id:'mock-audit-original',rawJson,sha256:spreadPlanHash(rawJson)};
 e.provenance.original={rawJson,sha256:original.sha256};e.provenance.quoteSha256=spreadPlanHash(e.quote);
 assert.throws(()=>mockSpreadEventFromOriginal({plan:p.plan,original,id:e.id,at:f.exitAt}));
 assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent,e],f.exitAt));
 if(name!=='future original publication')assert.throws(()=>appendMockSpread({root,runId,event:e}));
 const recovered=recoverMockSpread({root,runId,asOf:f.exitAt});assert.equal(recovered.events.length,1);assert.equal(recovered.report.status,'OPEN_UNRESOLVED');assert.equal(recovered.report.orders.length,1);assert.equal(recovered.report.account.netPnlCents,null);assert.equal(recovered.report.account.settledCashCents,open.account.settledCashCents);assert.equal(recovered.report.account.unsettledProceedsCents,700);
});
test('bound append uses original publication time without rewriting quote receipt',async root=>{const f=await mockSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input});const open=appendMockSpread({root,runId,event:p.entryEvent});assert.equal(open.assessedAt,'2026-10-09T15:30:12.000Z');assert.equal(open.orders[0].legs[0].receivedAt,'2026-10-09T15:30:10.000Z');assert.throws(()=>replayMockSpread(p.plan,[p.entryEvent],'2026-10-09T15:30:11.000Z'),/NOT_YET_VISIBLE/);});
function changedOriginal(original,fn){const r=JSON.parse(original.rawJson);fn(r);r.captureSha256=spreadPlanHash(r.capture);const rawJson=JSON.stringify(r);return {...original,rawJson,sha256:spreadPlanHash(rawJson)};}
const snapshotDir=root=>{const dir=join(root,'data/runtime/options-workbench-development',runId);return Object.fromEntries(fs.readdirSync(dir).sort().map(n=>[n,spreadPlanHash(fs.readFileSync(join(dir,n),'utf8'))]));};
async function threeEvents(root){
 const f=await mockSpreadPlanFixture(),p=startTechSpreadPlan({root,runId,input:f.input});
 const mid=changedOriginal({...f.exitOriginal,rawJson:f.exitOriginal.rawJson.replaceAll('T15:37:','T15:31:')},r=>{r.capture.batchId='mock-middle-batch';r.capture.selection.batchId='mock-middle-batch';r.intent.selection.batchId='mock-middle-batch';});
 const events=[p.entryEvent,mockSpreadEventFromOriginal({plan:p.plan,original:mid,id:'mock-middle-event',at:'2026-10-09T15:31:12.000Z'}),mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'mock-exit-event',at:f.exitAt})];
 let report;for(const event of events)report=appendMockSpread({root,runId,event});return {f,p,events,report};
}
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test(structure+' source between true decision and collection request remains valid through all routes',async root=>{
 const f=await mockSpreadPlanFixture(structure);f.input.originals[0]=changedOriginal(f.input.originals[0],r=>r.capture.receipts[4].response.structuredContent.data.results.forEach(q=>q.quote.updated_at='2026-10-09T15:29:59.500000001Z'));
 const p=startTechSpreadPlan({root,runId,input:f.input});assert.equal(p.status,'MOCK_PLAN_READY',JSON.stringify(p.checks));validateMockSpreadEventBinding(p.entryEvent,p.plan,f.input.at);const report=appendMockSpread({root,runId,event:p.entryEvent});assert.equal(report.status,'OPEN_UNRESOLVED');assert.equal(report.orders[0].legs[0].sourceAt,'2026-10-09T15:29:59.500000001Z');assert.deepEqual(recoverMockSpread({root,runId,asOf:f.input.at}).report,report);assert.deepEqual(replayMockSpread(p.plan,[p.entryEvent],f.input.at),report);
});
test('bound event validation requires its actual plan, never guessed request time',async()=>{const f=await mockSpreadPlanFixture(),p=previewTechSpreadPlan(f.input);assert.throws(()=>validateMockSpreadEventBinding(p.entryEvent),/EVENT_PLAN_CONTEXT_REQUIRED/);});
for(const index of [0,1,2])test('retry historical event '+index+' after exit verifies complete history and returns current state',async root=>{
 const s=await threeEvents(root),before=snapshotDir(root);const retry=appendMockSpread({root,runId,event:s.events[index],recordedAt:'2026-10-10T18:00:00.000Z'});assert.deepEqual(retry,s.report);assert.equal(retry.orders.length,2);assert.equal(retry.account.netPnlCents,-920);assert.deepEqual(snapshotDir(root),before);
});
for(const index of [0,1,2])test('conflicting historical event '+index+' cannot reuse an id',async root=>{
 const s=await threeEvents(root),before=snapshotDir(root),e=structuredClone(s.events[index]);e.quote.legs[0].bidCents++;e.provenance.quoteSha256=spreadPlanHash(e.quote);assert.throws(()=>appendMockSpread({root,runId,event:e}),/IDEMPOTENCY_CONFLICT/);assert.deepEqual(snapshotDir(root),before);assert.deepEqual(recoverMockSpread({root,runId,asOf:s.f.exitAt}).report,s.report);
});
test('new out-of-order event is not treated as an idempotent retry',async root=>{const s=await threeEvents(root),before=snapshotDir(root),e=structuredClone(s.events[0]);e.id='mock-new-old-clock';assert.throws(()=>appendMockSpread({root,runId,event:e}),/RECEIPT_ORDER/);assert.deepEqual(snapshotDir(root),before);});
test('an explicit old evaluation time still rejects a future original in valid history',async root=>{const s=await threeEvents(root);assert.throws(()=>recoverMockSpread({root,runId,asOf:s.f.input.at}),/EVENT_ORIGINAL_NOT_YET_VISIBLE/);assert.deepEqual(appendMockSpread({root,runId,event:s.events[0]}),s.report);});
test('corrupt journal hash cannot bypass verification through a duplicate',async root=>{const s=await threeEvents(root),p=join(root,'data/runtime/options-workbench-development',runId,'event-0002.json'),r=JSON.parse(fs.readFileSync(p));r.event.quote.legs[0].bidCents++;fs.writeFileSync(p,JSON.stringify(r));const before=snapshotDir(root);assert.throws(()=>appendMockSpread({root,runId,event:s.events[0]}),/EVENT_HASH_OR_ID/);assert.deepEqual(snapshotDir(root),before);});
test('rehashed but invalid original in later history cannot bypass semantic validation through an old duplicate',async root=>{const s=await threeEvents(root),p=join(root,'data/runtime/options-workbench-development',runId,'event-0003.json'),r=JSON.parse(fs.readFileSync(p));const o=changedOriginal(r.event.provenance.original,x=>x.intent.version='TECH_QUOTES_REQUEST_V1');r.event.provenance.original=o;r.sha256=spreadPlanHash(JSON.stringify(r.event,null,2)+'\n');fs.writeFileSync(p,JSON.stringify(r));const before=snapshotDir(root);assert.throws(()=>appendMockSpread({root,runId,event:s.events[0]}),/EVENT_SOURCE_PAIR/);assert.deepEqual(snapshotDir(root),before);});
test('duplicate latest event does not bypass corrupt start manifest',async root=>{const s=await threeEvents(root),p=join(root,'data/runtime/options-workbench-development',runId,'start.json'),r=JSON.parse(fs.readFileSync(p));r.input.account.settledCashCents++;fs.writeFileSync(p,JSON.stringify(r));assert.throws(()=>appendMockSpread({root,runId,event:s.events[2]}),/START_HASH/);});

function preparationBoundary(r){
 assert.equal(r.fileSystemWrites,0);assert.equal(r.sourceCalls,0);assert.equal(r.planSaved,false);assert.equal(r.requestEnvelopeCreated,false);assert.equal(r.actualTrades,0);
 assert.equal(r.executionAllowed,false);assert.equal(r.productionPaperAdmissionAllowed,false);assert.equal(r.realAcceptance,'NOT_TESTED');assert.equal(r.requestDraft.kind,undefined);
 assert.deepEqual(r.enginePreview.realAccountConfirmation,{permission:'UNKNOWN',funds:'UNKNOWN',entitlement:'UNKNOWN'});
 assert.equal(r.accountAuthentication,'NOT_ESTABLISHED_BY_DOCUMENT_HASH');assert.equal(r.enginePreview.plan,undefined);assert.equal(r.enginePreview.entryEvent,undefined);
}
test('preparation shows all eight missing records before any quote or strategy request',()=>{
 const input={version:'TECH_SPREAD_PLAN_INPUT_V2',mode:'REAL_QUOTE_PAPER',evidenceContext:'ATTRIBUTED_REAL_EVIDENCE',at:'2026-10-10T19:00:00.000Z',records:[]},before=JSON.stringify(input),r=prepareTechSpreadInput(input);
 assert.equal(r.status,'PARTIAL_UNKNOWN');assert.equal(r.diagnostics.length,8);assert(r.diagnostics.every(d=>d.state==='MISSING'&&d.sourceGuidance&&d.missingFields.length));
 for(const k of ['id','accountId','structure','selectionSha256','decisionAt','budgetCents','quantity','maxSourceSkewMs'])assert.equal(r.requestDraft[k],null);
 assert(r.enginePreview.checks.some(c=>c.code==='STRATEGY_REQUEST_MISSING'));assert.equal(JSON.stringify(input),before);preparationBoundary(r);
});
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test('preparation preserves complete '+structure+' fixture and calls original engine',async()=>{
 const {input}=await paperSpreadPlanFixture(structure),before=JSON.stringify(input),r=prepareTechSpreadInput(input),original=previewTechSpreadPlan(input);
 assert.equal(r.status,'FIELDS_SUPPLIED_UNVALIDATED');assert.equal(r.enginePreview.status,original.status);assert.equal(original.status,'REAL_QUOTE_PAPER_PLAN_READY');assert.equal(r.evidenceContext,'TEST_FIXTURE');
 assert.equal(r.requestDraft.structure,structure);assert.equal(JSON.stringify(input),before);assert(r.bindingProposals.every(p=>p.status==='EXISTING_BINDING_MATCHES'));preparationBoundary(r);
});
test('preparation copies only explicit bindings into an unfrozen request with no policy defaults',async()=>{
 const {input}=await paperSpreadPlanFixture();input.records=input.records.filter(r=>r.kind!=='STRATEGY_REQUEST');input.originals=[];const r=prepareTechSpreadInput(input);
 assert.equal(r.requestDraft.researchId,'paper-fixture-research');assert.equal(r.requestDraft.researchSha256,input.records.find(r=>r.kind==='RESEARCH').sha256);
 assert.equal(r.requestDraft.selectionSha256,null);assert.equal(r.requestDraft.accountId,null);assert.equal(r.requestDraft.id,null);assert.equal(r.requestDraft.decisionAt,null);assert.equal(r.requestDraft.budgetCents,null);assert.equal(r.requestDraft.structure,null);assert.equal(r.requestDraft.executionModel,null);
 assert.deepEqual(r.requestDraft.conditions,{entry:null,exit:null,invalidation:null});assert.equal(r.enginePreview.status,'BLOCKED');preparationBoundary(r);
});
test('preparation keeps original conflicting research binding and does not repin the original',async()=>{
 const {input}=await paperSpreadPlanFixture();edit(input,'STRATEGY_REQUEST',p=>{p.researchSha256='a'.repeat(64);p.researchId='prior-research';});const before=JSON.stringify(input),r=prepareTechSpreadInput(input);
 assert.equal(r.status,'PARTIAL_UNKNOWN');assert.equal(r.requestDraft.researchId,'prior-research');assert.equal(r.requestDraft.researchSha256,'a'.repeat(64));assert(r.bindingProposals.some(p=>p.field==='researchSha256'&&p.status==='CONFLICT_RETAINED'));assert.equal(r.enginePreview.status,'BLOCKED');assert.equal(JSON.stringify(input),before);
});
for(const kind of SPREAD_PLAN_RECORD_KINDS)test('preparation names the missing '+kind+' contract without weakening admission',async()=>{
 const {input}=await paperSpreadPlanFixture();input.records=input.records.filter(r=>r.kind!==kind);const r=prepareTechSpreadInput(input),d=r.diagnostics.find(d=>d.kind===kind);
 assert.equal(d.state,'MISSING');assert(d.missingFields.includes('envelope.reviewedAt'));assert.equal(r.enginePreview.status,'BLOCKED');preparationBoundary(r);
});
for(const [name,change] of [
 ['duplicate',i=>{i.records=i.records.filter(r=>r.kind!=='RISK_LIMITS');i.records.push(structuredClone(i.records.find(r=>r.kind==='RESEARCH')));}],
 ['hash mismatch',i=>{i.records.find(r=>r.kind==='RESEARCH').sha256='0'.repeat(64);}],
 ['invalid JSON',i=>{const r=i.records.find(r=>r.kind==='RESEARCH');r.rawJson='{';r.sha256=spreadPlanHash(r.rawJson);}],
 ['unknown source',i=>{i.records.find(r=>r.kind==='RESEARCH').source='';}],
 ['unknown origin',i=>{i.records.find(r=>r.kind==='RESEARCH').origin='UNKNOWN';}],
 ['fixture relabeled real',i=>{i.evidenceContext='ATTRIBUTED_REAL_EVIDENCE';}],
])test('preparation will not derive a new research binding from '+name,async()=>{
 const {input}=await paperSpreadPlanFixture();change(input);input.records=input.records.filter(r=>r.kind!=='STRATEGY_REQUEST');const r=prepareTechSpreadInput(input);
 assert.equal(r.requestDraft.researchSha256,null);assert.equal(r.requestDraft.researchId,null);assert.equal(r.status,'PARTIAL_UNKNOWN');assert.equal(r.enginePreview.status,'BLOCKED');preparationBoundary(r);
});
for(const [kind,field,value]of [['COST_MODEL','legs.0.entryFeeCents',null],['ACCOUNT_FUNDS','settledCashCents','UNKNOWN'],['RISK_LIMITS','maximumLossCents',null],['RESEARCH','fundamental.direction','UNKNOWN']])test('preparation explicitly lists unknown '+kind+'.'+field,async()=>{
 const {input}=await paperSpreadPlanFixture();edit(input,kind,p=>{const keys=field.split('.');let v=p;for(const k of keys.slice(0,-1))v=v[k];v[keys.at(-1)]=value;});const r=prepareTechSpreadInput(input);
 assert(r.diagnostics.find(d=>d.kind===kind).missingFields.includes('payload.'+field));assert.equal(r.status,'PARTIAL_UNKNOWN');assert.equal(r.enginePreview.status,'BLOCKED');
});
test('preparation projects only known request values and does not echo raw documents or account balances',async()=>{
 const {input}=await paperSpreadPlanFixture();const canary='PRIVATE_EXTRA_CANARY';edit(input,'ACCOUNT_FUNDS',p=>p.privateRaw=canary);edit(input,'STRATEGY_REQUEST',p=>{p.accountId=canary;p.id={private:canary};p.parentIds=[{private:canary}];p.conditions.entry={private:canary};p.extra=canary;});
 const r=prepareTechSpreadInput(input),serialized=JSON.stringify(r);assert(!serialized.includes(canary));assert.equal(r.requestDraft.accountId,null);assert.equal(r.requestDraft.id,null);assert.equal(r.requestDraft.parentIds,null);assert.equal(r.requestDraft.conditions.entry,null);assert.equal(r.enginePreview.economics,undefined);preparationBoundary(r);
});
test('preparation does not fill malformed conflicting bindings',async()=>{
 const {input}=await paperSpreadPlanFixture();edit(input,'STRATEGY_REQUEST',p=>p.researchId={private:'MALFORMED_CANARY'});const r=prepareTechSpreadInput(input);assert.equal(r.requestDraft.researchId,null);assert(r.bindingProposals.some(p=>p.field==='researchId'&&p.status==='CONFLICT_RETAINED'));assert(!JSON.stringify(r).includes('MALFORMED_CANARY'));
});
test('preparation preserves explicit zero and false as supplied, not permission or solvency',async()=>{
 const {input}=await paperSpreadPlanFixture();edit(input,'ACCOUNT_FUNDS',p=>p.settledCashCents=0);edit(input,'PRODUCT_PERMISSION',p=>p.enabled=false);const r=prepareTechSpreadInput(input);
 assert(r.diagnostics.find(d=>d.kind==='ACCOUNT_FUNDS').providedFields.includes('settledCashCents'));assert(r.diagnostics.find(d=>d.kind==='PRODUCT_PERMISSION').providedFields.includes('enabled'));assert.equal(r.enginePreview.status,'BLOCKED');preparationBoundary(r);
});
function persistPreparation(root,input){
 const copied=structuredClone(input);copied.originals=copied.originals?.map((o,n)=>{const path=join(root,'original '+n+'.json');fs.writeFileSync(path,o.rawJson);return {id:o.id,path,sha256:o.sha256};});const file=join(root,'partial input.json');fs.writeFileSync(file,JSON.stringify(copied));return file;
}
function preparationTree(root){
 const entries=[];const walk=dir=>{for(const n of fs.readdirSync(dir).sort()){const p=join(dir,n),s=fs.lstatSync(p);entries.push({path:p.slice(root.length),directory:s.isDirectory(),mtimeMs:s.mtimeMs,nlink:s.nlink,sha256:s.isFile()?spreadPlanHash(fs.readFileSync(p).toString('base64')):null});if(s.isDirectory())walk(p);}};walk(root);return entries;
}
function strictPreparation(root,args){
 const home=join(root,'tool-home');fs.mkdirSync(home);const cache=join(home,'npm-cache'),logs=join(cache,'_logs');fs.mkdirSync(logs,{recursive:true});
 for(let i=0;i<15;i++)fs.writeFileSync(join(logs,'old-'+i+'.log'),'must remain');
 const env={...process.env,HOME:home,USERPROFILE:home,APPDATA:home,LOCALAPPDATA:home,TEMP:home,TMP:home,npm_config_cache:cache,npm_config_logs_max:'1',NODE_COMPILE_CACHE:join(home,'node-cache'),NODE_V8_COVERAGE:join(home,'coverage'),NODE_OPTIONS:'--require "'+join(home,'absent.cjs')+'"',NODE_REPL_HISTORY:join(home,'history'),TSX_DISABLE_CACHE:'0'};
 const launcher=resolve('scripts/options-tech-mock-residual-readonly.cmd'),command='""'+launcher+'" '+args.map(a=>'"'+a+'"').join(' ')+'"',before=preparationTree(root);
 const result=spawnSync('cmd.exe',['/d','/s','/c',command],{cwd:root,encoding:'utf8',env,windowsVerbatimArguments:true});assert.deepEqual(preparationTree(root),before);return result;
}
for(const kind of ['partial','complete','preview','malformed','missing','tampered-original'])test('strict supported plan launcher is actually read-only for '+kind,async root=>{
 const {input}=await paperSpreadPlanFixture();if(kind==='partial'){input.records=[];delete input.originals;}
 const file=persistPreparation(root,input);if(kind==='malformed')fs.writeFileSync(file,'{');if(kind==='tampered-original')fs.appendFileSync(join(root,'original 0.json'),' ');
 const r=strictPreparation(root,[kind==='preview'?'--plan-preview':'--prepare-plan',kind==='missing'?join(root,'PRIVATE_MISSING_PATH.json'):file]);
 if(['malformed','missing','tampered-original'].includes(kind)){assert.equal(r.status,1);assert(!r.stderr.includes('PRIVATE_MISSING_PATH'));assert(!r.stderr.includes(root));assert.match(r.stderr,/^[A-Z][A-Z0-9_]+\s*$/);return;}
 assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.launchReceipt.filesystemWritePermission,false);assert.equal(out.launchReceipt.childProcessPermission,false);assert.equal(out.launchReceipt.npmInvoked,false);assert.equal(out.launchReceipt.tsxInvoked,false);
 if(kind!=='preview')preparationBoundary(out);assert.equal(kind==='partial'?out.status:kind==='preview'?out.status:out.enginePreview.status,kind==='partial'?'PARTIAL_UNKNOWN':'REAL_QUOTE_PAPER_PLAN_READY');
});
for(const args of [['--prepare-plan','input','--save'],['--plan-preview','input','--start'],['--start','input','--run-id','paper-test'],['--append-original','input','--run-id','paper-test','--at','2026-10-09T15:00:00Z'],['--recover','--run-id','paper-test','--at','2026-10-09T15:00:00Z'],['--arm']])test('strict launcher refuses mutating dispatch '+args[0]+' '+args.at(-1),root=>{
 const r=strictPreparation(root,args);assert.equal(r.status,1);assert.match(r.stderr,/ARGUMENTS/);
});
test('prepare CLI allows no original but ordinary preview still requires one',root=>{
 const input={version:'TECH_SPREAD_PLAN_INPUT_V2',mode:'REAL_QUOTE_PAPER',evidenceContext:'ATTRIBUTED_REAL_EVIDENCE',at:'2026-10-10T19:00:00Z',records:[]},file=persistPreparation(root,input),before=preparationTree(root);
 assert.equal(techSpreadPlanCli(['--prepare',file],{root}).status,'PARTIAL_UNKNOWN');assert.throws(()=>techSpreadPlanCli(['--preview',file],{root}),/ORIGINAL_COUNT/);assert.deepEqual(preparationTree(root),before);
});
