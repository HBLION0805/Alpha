import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,realpathSync,readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {seedEvidenceLoop,at,after} from './lib/options-evidence-loop-fixtures.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {readManualLedger} from './options-manual-ledger.mjs';
import {preparePredictionEvidence,resumePredictionEvidence,verifyPredictionIntent,predictionTradeMatrix,tradeEvidence} from './lib/options-evidence-loop.mjs';
import {paperFingerprint as fp} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {LocalNdjsonPredictionLogRepository} from '../src/repositories/LocalNdjsonPredictionLogRepository.ts';
import {PredictionLog} from '../src/engines/prediction-log/PredictionLog.ts';
import {validatePredictionSnapshot,createPredictionId} from '../src/contracts/PredictionValidation.ts';
import {evidenceLoopPanel,predictionPreview,updateEvidenceDraft,evidenceDetail} from '../apps/options-workbench/evidence-loop.js';
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-expectation-test-'));try{await fn(root);}finally{const path=realpathSync(root),r=relative(realpathSync(tmpdir()),path);if(isAbsolute(r)||r.startsWith('..')||!r.startsWith('alpha-expectation-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(path,{recursive:true,force:true});}}
const row=async f=>(await f.service.state()).evidenceLoop.data.rows[0];
const freeze=f=>f.save(f.prepared.command);
async function close(f,price,fees){f.setClock(after);for(const c of f.fills(price,fees))f.save(c);}
await test('draft and preview do not create authoritative predictions; exact provenance and historical EV preview',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);assert(!existsSync(join(root,'data/runtime/prediction-log',f.ledgerId+'.ndjson')));const s=await f.service.state();assert.equal(s.evidenceLoop.data.drafts[0].predictionStatus,'NOT_CREATED');assert.equal(s.manual.data.trades.length,0);
 const p=f.prepared.predictionPreview;assert.equal(p.expectation.fingerprint,f.expectation.fingerprint);assert.equal(p.scenario.fingerprint,f.scenario.fingerprint);assert.equal(p.confidence,null);assert.equal(p.strategyVersion,null);assert(p.contractFitFingerprint);assert(p.sourceComparisons.length);assert(predictionPreview(p).includes('Prediction evidence to be locked'));
}));
await test('freeze create submit lock, idempotent retry and restart restore the identical chain',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root),result=freeze(f);assert.equal(result.prediction.status,'LOCKED');const r=await row(f);assert.equal(r.prediction.manualOrigin.planFingerprint,r.planFingerprint);assert.equal(r.prediction.history.length,3);assert.equal(r.execution.execution,'NO_TRADE');assert.equal(r.prediction.confidence,null);assert.equal(r.prediction.aiVersion,null);
 const file=join(root,'data/runtime/prediction-log',f.ledgerId+'.ndjson'),bytes=readFileSync(file);freeze(f);await f.service.state();await f.service.state();assert(readFileSync(file).equals(bytes));
 const restart=createWorkbenchData({workspaceRoot:root,ledgerId:f.ledgerId,now:()=>at(90)}),s=await restart.state();assert.equal(s.evidenceLoop.data.rows[0].prediction.predictionId,r.predictionId);assert.equal(s.manual.data.trades[0].openContracts,0);
}));
await test('conflicting frozen plan or intent fails closed; no second prediction',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);const changed=structuredClone(f.prepared.command);changed.plan.thesis='Favorable hindsight';assert.throws(()=>verifyPredictionIntent(root,f.ledgerId,changed,at(90)),/INTENT_CONFLICT/);assert.throws(()=>f.service.preview(changed),/REQUEST_CONFLICT/);
 const before=fp((await row(f)).prediction);assert.throws(()=>preparePredictionEvidence(root,f.ledgerId,f.command,{...f.forecast,direction:'DOWN'},f.state,at(90)),/FROZEN_PLAN/);assert.equal(fp((await row(f)).prediction),before);
}));
await test('freeze remains valid on prediction-write interruption; reload explicit resume does not duplicate',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root),dir=join(root,'data/runtime/prediction-log');mkdirSync(dir,{recursive:true});const lock=join(dir,f.ledgerId+'.lock');writeFileSync(lock,'isolated injected interruption');
 const saved=freeze(f);assert.equal(saved.prediction.status,'PREDICTION_EVIDENCE_PENDING');const frozen=readManualLedger(root,f.ledgerId,()=>at(80));assert.equal(frozen.report.trades.length,1);assert.equal((await row(f)).predictionStatus,'PREDICTION_EVIDENCE_PENDING');
 rmSync(lock);const p=resumePredictionEvidence(root,f.ledgerId,f.command.tradeId,at(90));assert.equal(p.status,'LOCKED');assert.equal(readManualLedger(root,f.ledgerId,()=>at(90)).headSha256,frozen.headSha256);assert(resumePredictionEvidence(root,f.ledgerId,f.command.tradeId,at(91)).alreadyRecorded);
}));
await test('pending write cannot be resumed after reported entry or result window',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root),dir=join(root,'data/runtime/prediction-log');mkdirSync(dir,{recursive:true});const lock=join(dir,f.ledgerId+'.lock');writeFileSync(lock,'isolated');freeze(f);rmSync(lock);f.setClock('2026-09-08T19:41:00.000Z');f.save(f.fills()[0]);assert.throws(()=>resumePredictionEvidence(root,f.ledgerId,f.command.tradeId,'2026-09-08T19:42:00.000Z'),/PRE_ENTRY/);assert.throws(()=>resumePredictionEvidence(root,f.ledgerId,f.command.tradeId,after),/PRE_ENTRY/);assert.equal((await row(f)).prediction,null);
}));
for(const [accuracy,exit,expected]of [['ACCURATE','0.80','PREDICTION_CORRECT + TRADE_UNPROFITABLE'],['INACCURATE','1.40','PREDICTION_INCORRECT + TRADE_PROFITABLE']])await test('full isolated loop '+expected,()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);const original=fp((await row(f)).prediction);await close(f,exit);let r=await row(f);assert.equal(r.review,null);assert.equal(r.matrix,'MIXED_OR_UNSCORABLE');assert.equal(r.execution.status,'COMPLETE');
 await f.action('OUTCOME',{...f.outcome,actualDirection:accuracy==='ACCURATE'?'UP':'DOWN'});r=await row(f);assert.equal(r.prediction.status,'OUTCOME_KNOWN');assert.equal(r.review,null);
 await f.action('REVIEW',f.review(accuracy));r=await row(f);assert.equal(r.matrix,expected);assert.equal(r.review.score,null);assert.equal(r.journals.length,0);
 const p=await f.action('JOURNAL',f.journal,false);assert.equal((await row(f)).journals.length,0);assert.equal(p.draft.snapshot.metadata.approvedKnowledge,false);
 await assert.rejects(()=>f.service.evidenceLoop({action:'SAVE_JOURNAL',request:f.journal,previewFingerprint:p.previewFingerprint,ownerConfirmed:false}),/OWNER_CONFIRMATION/);
 await f.action('JOURNAL',f.journal);r=await row(f);assert.equal(r.journals[0].entry.status,'FINALIZED');assert.equal(r.journals[0].entry.entryType,'POST_TRADE_REVIEW');assert.equal(r.journals[0].entry.metadata.approvedKnowledge,false);assert.equal(r.journals[0].entry.metadata.causalStatus,'NOT_ESTABLISHED');
 const reread=createWorkbenchData({workspaceRoot:root,ledgerId:f.ledgerId,now:()=>after});const recovered=(await reread.state()).evidenceLoop.data.rows[0];assert.equal(recovered.matrix,expected);assert.equal(recovered.journals[0].entry.entryId,r.journals[0].entry.entryId);assert.deepEqual(recovered.prediction.manualOrigin,r.prediction.manualOrigin);assert.notEqual(fp(r.prediction),original);assert.equal(r.prediction.expectedDirection,'UP');assert.equal(r.prediction.confidence,null);assert.equal(r.intent.payload.scenario.fingerprint,f.scenario.fingerprint);
 const head=readManualLedger(root,f.ledgerId,()=>after).headSha256;await f.action('OUTCOME',{...f.outcome,actualDirection:accuracy==='ACCURATE'?'UP':'DOWN'});await f.action('REVIEW',f.review(accuracy));await f.action('JOURNAL',f.journal);assert.equal((await row(f)).journals.length,1);assert.equal(readManualLedger(root,f.ledgerId,()=>after).headSha256,head);
 assert(evidenceLoopPanel(await f.service.state()).includes(expected));
}));
await test('no trade prediction reviewed without manufactured P&L or post-trade journal',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);f.setClock(after);await f.action('OUTCOME',f.outcome);await f.action('REVIEW',f.review('ACCURATE'));const r=await row(f);assert.equal(r.prediction.status,'REVIEWED');assert.equal(r.execution.execution,'NO_TRADE');assert.equal(r.execution.netPnlUsd,null);assert.equal(r.review.profitability,'NOT_APPLICABLE');assert.equal(r.matrix,'MIXED_OR_UNSCORABLE');await assert.rejects(()=>f.action('JOURNAL',f.journal,false),/CLOSED_AND_REVIEWED/);
}));
await test('unknown direction cannot be promoted to accurate; neutral partial and break-even remain outside matrix',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);await close(f,'1.00','0');await f.action('OUTCOME',{...f.outcome,actualDirection:'UNKNOWN'});await assert.rejects(()=>f.action('REVIEW',f.review('ACCURATE')),/UNSCORABLE/);await f.action('REVIEW',f.review('INDETERMINATE'));const r=await row(f);assert.equal(r.execution.profitability,'BREAK_EVEN');assert.equal(r.matrix,'MIXED_OR_UNSCORABLE');for(const p of ['PARTIALLY_ACCURATE','INDETERMINATE',undefined])assert.equal(predictionTradeMatrix(p,'PROFITABLE'),'MIXED_OR_UNSCORABLE');
}));
await test('unknown fees do not produce profitability, even on a closed reported trade',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);await close(f,'1.40',null);const r=await row(f);assert.equal(r.execution.profitability,'INDETERMINATE');assert.equal(r.execution.netPnlUsd,null);assert.equal(r.review,null);
}));
await test('future / wrong identity / before-horizon outcome rejected; review never modifies original forecast',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);await assert.rejects(()=>f.action('OUTCOME',f.outcome,false),/HORIZON_PENDING/);f.setClock(after);
 for(const patch of [{symbol:'BTC'},{sourceAt:'2026-09-09T20:00:00.000Z'},{receivedAt:'2026-09-09T20:00:00.000Z'},{sourceAt:at(90)},{kind:'EVENT_NUMERIC',eventEvidence:{}}])await assert.rejects(()=>f.action('OUTCOME',{...f.outcome,...patch},false));
 const before=await row(f);await f.action('OUTCOME',f.outcome);const r=await row(f);for(const k of ['expectedDirection','confidence','statement','manualOrigin','evidence','createdAt','strategy','expectedTimeHorizon'])assert.deepEqual(r.prediction[k],before.prediction[k]);
 await assert.rejects(()=>f.action('OUTCOME',{...f.outcome,result:'Rewritten result'}),/RETRY_CONFLICT/);
}));
await test('legacy registration and reported fills remain readable without backfilled predictions',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);f.save(f.command);await close(f,'0.80');const r=await row(f);assert(r.legacy);assert.equal(r.predictionStatus,'PRE_ENTRY_PREDICTION_UNAVAILABLE');assert.equal(r.execution.execution,'CLOSED');assert.equal(r.prediction,null);assert.throws(()=>resumePredictionEvidence(root,f.ledgerId,f.command.tradeId,after),/PRE_ENTRY/);assert(evidenceLoopPanel(await f.service.state()).includes('LEGACY'));
}));
await test('journal preview binds current ledger; corrections cannot silently rewrite a reviewed result',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);await close(f,'0.80');await f.action('OUTCOME',f.outcome);await f.action('REVIEW',f.review('ACCURATE'));const p=await f.action('JOURNAL',f.journal,false);
 f.save({type:'CORRECT_FILL',requestId:'correct-loop-exit',tradeId:f.command.tradeId,fillId:'loop-fill-2',expectedRevision:1,reason:'Isolated correction',replacement:{...f.fills('1.40')[1].fill}});
 await assert.rejects(()=>f.service.evidenceLoop({action:'SAVE_JOURNAL',request:f.journal,previewFingerprint:p.previewFingerprint,ownerConfirmed:true}),/PREVIEW_CHANGED/);const r=await row(f);assert(r.reviewProfitabilityIsHistorical);assert.equal(r.review.profitability,'UNPROFITABLE');assert.equal(r.execution.profitability,'PROFITABLE');
}));
await test('protected HTTP preview freeze save recovery and rendering route; no refresh/execution permission',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root),app=await startOptionsWorkbench({workspaceRoot:root,ledgerId:f.ledgerId,port:0,refreshContext:false,now:()=>at(80)});
 try{const s=await fetch(app.url+'/api/state').then(r=>r.json()),post=b=>fetch(app.url+'/api/evidence-loop',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':s.session},body:JSON.stringify(b)});
 assert.equal((await fetch(app.url+'/api/evidence-loop',{method:'POST',body:'{}'})).status,403);const p=await post({action:'PREVIEW_FREEZE',command:{...f.command,requestId:'http-freeze'},forecast:f.forecast}).then(r=>r.json());assert.equal(p.executionAllowed,false);assert.equal(p.command.plan.predictionEvidence.fingerprint.length,71);assert.equal((await fetch(app.url+'/evidence-loop.js')).status,200);assert.equal((await fetch(app.url+'/api/state').then(r=>r.json())).evidenceLoop.data.rows.length,0);
 }finally{await app.close();}
}));

await test('repeated pre-freeze preview preserves the exact first intent and clocks',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root),again=preparePredictionEvidence(root,f.ledgerId,f.command,f.forecast,f.state,at(90));assert.deepEqual(again,f.prepared);
}));
await test('outcome and review interrupted between authoritative append and lifecycle history safely resume',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);await close(f,'0.80');
 for(const [kind,r,target]of [['OUTCOME',f.outcome,'OUTCOME_KNOWN'],['REVIEW',f.review('ACCURATE'),'REVIEWED']]){
  const original=LocalNdjsonPredictionLogRepository.prototype.persistEvent;let fired=false;
  LocalNdjsonPredictionLogRepository.prototype.persistEvent=function(event){if(event.eventType==='HISTORY_APPENDED'&&event.history.toStatus===target&&!fired){fired=true;throw Error('INJECTED_PARTIAL_WRITE');}return original.call(this,event);};
  try{await assert.rejects(()=>f.action(kind,r),/INJECTED_PARTIAL_WRITE/);}finally{LocalNdjsonPredictionLogRepository.prototype.persistEvent=original;}
  assert(fired);await f.action(kind,r);assert.equal((await row(f)).prediction.status,target);
 }
 assert.equal((await row(f)).prediction.history.length,5);
}));
await test('explicit manual null model/confidence support does not weaken old snapshot validation',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);const p=(await row(f)).prediction;assert(validatePredictionSnapshot(p,at(90)).valid);const old={...p};delete old.manualOrigin;assert.equal(validatePredictionSnapshot(old,at(90)).valid,false);const forged={...p,aiVersion:'claimed-model'};assert.equal(validatePredictionSnapshot(forged,at(90)).valid,false);assert.notEqual(createPredictionId(p),createPredictionId({...p,expectedDirection:'DOWN'}));
 const repo=new LocalNdjsonPredictionLogRepository(join(root,'data/runtime/prediction-log',f.ledgerId+'.ndjson')),stats=new PredictionLog(repo,{now:()=>at(90)}).statistics();assert.equal(stats.metrics.averageConfidence,undefined);assert.equal(stats.metrics.averageScore,undefined);
}));
await test('all four determinate combinations and partial/unknown axes remain independent',()=>{
 for(const a of ['ACCURATE','INACCURATE'])for(const b of ['PROFITABLE','UNPROFITABLE'])assert.equal(predictionTradeMatrix(a,b),`PREDICTION_${a==='ACCURATE'?'CORRECT':'INCORRECT'} + TRADE_${b}`);
 for(const b of ['BREAK_EVEN','NOT_APPLICABLE','INDETERMINATE'])assert.equal(predictionTradeMatrix('ACCURATE',b),'MIXED_OR_UNSCORABLE');
});
await test('a later reported retrospective entry preserves the locked record but marks current evaluation unscorable',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);f.setClock(after);f.save({...f.fills()[0],fill:{...f.fills()[0].fill,executedAt:at(79)}});const r=await row(f);assert.equal(r.prediction.status,'LOCKED');assert.equal(r.timingValid,false);await assert.rejects(()=>f.action('OUTCOME',f.outcome,false),/PRE_ENTRY/);
}));
await test('numeric outcome reuses original exact event identity and source clock validator',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);const c=structuredClone(f.command),t=c.plan.invalidation;
 // Test a distinct prospective numeric plan, without changing a frozen or production record.
 const condition=t.conditions[0];Object.assign(condition,{kind:'EVENT_NUMERIC',metric:'PAYROLLS',period:'2026-08',unit:'THOUSAND_JOBS',releaseVersion:'INITIAL',expectationRef:'isolated-expectation',expectationValue:'100',comparator:'AT_OR_ABOVE',threshold:'200'});
 delete t.scenarioSet;delete t.expectationSnapshot;delete t.eventEntry;t.holdThroughEvent='YES';
 c.requestId='numeric-freeze';const enriched=preparePredictionEvidence(root,f.ledgerId,c,f.forecast,f.state,at(80));f.save(enriched.command);f.setClock(after);
 const evidence={conditionId:condition.id,source:condition.source,sourceAt:condition.releaseAt,receivedAt:condition.releaseAt,eventKey:condition.eventKey,metric:condition.metric,period:condition.period,unit:condition.unit,releaseVersion:condition.releaseVersion,value:'220',judgment:'',explanation:'Owner fixture checked original release.',comparisonRef:''};
 const request={...f.outcome,kind:'EVENT_NUMERIC',source:evidence.source,sourceAt:evidence.sourceAt,receivedAt:evidence.receivedAt,eventEvidence:evidence,actualDirection:'UNKNOWN'};
 for(const patch of [{unit:'PERCENT'},{period:'2026-07'},{releaseVersion:'REVISED'},{eventKey:'other-event'},{receivedAt:'2026-09-10T12:00:00.000Z'}])await assert.rejects(()=>f.action('OUTCOME',{...request,eventEvidence:{...evidence,...patch}},false));
 const p=await f.action('OUTCOME',request,false);assert.equal(p.draft.factCheck.status,'INVALIDATED');assert.equal(p.draft.attribution,'OWNER_CONFIRMED_NOT_MACHINE_VERIFIED');await f.action('OUTCOME',request);assert.equal((await row(f)).prediction.status,'OUTCOME_KNOWN');
}));
await test('review confirmation survives render; editing evidence clears confirmation and stale preview',()=>{
 const ui={evidencePreviews:{'test:JOURNAL':{draft:{}}},evidenceIds:{'test:JOURNAL':'one'}};updateEvidenceDraft(ui,'test:JOURNAL','ownerConfirmed',true);assert.equal(ui.evidenceDrafts['test:JOURNAL'].ownerConfirmed,'on');assert(ui.evidencePreviews['test:JOURNAL']);updateEvidenceDraft(ui,'test:JOURNAL','rationale','Updated evidence');assert.equal(ui.evidenceDrafts['test:JOURNAL'].ownerConfirmed,'');assert.equal(ui.evidencePreviews['test:JOURNAL'],undefined);assert.equal(ui.evidenceIds['test:JOURNAL'],undefined);
});
await test('provenance details resolve exact original records and never substitute later versions',()=>temp(async root=>{
 const f=await seedEvidenceLoop(root);freeze(f);const state=await f.service.state(),r=state.evidenceLoop.data.rows[0];
 assert.equal(evidenceDetail(state,r,'expectation').fingerprint,f.expectation.fingerprint);
 assert.equal(evidenceDetail(state,r,'scenario').fingerprint,f.scenario.fingerprint);
 assert.equal(r.intent.payload.evidenceClocks.selectedQuote.sourceAt,f.scenario.payload.selectedQuote.updatedAt);
 assert.equal(r.intent.payload.evidenceClocks.expectations[0].receivedAt,f.expectation.payload.request.rows[0].forecasts[0].receivedAt);
 assert.equal(evidenceDetail(state,r,'research')[0].fingerprint,r.intent.payload.sourceComparisons[0].fingerprint);
 assert.deepEqual(evidenceDetail(state,r,'contractFit'),r.intent.payload.contractFit);
 state.marketExpectations.data.records=[{path:f.expectation.path,fingerprint:'changed'}];assert.equal(evidenceDetail(state,r,'expectation').status,'ORIGINAL_RECORD_UNAVAILABLE_NO_REPLACEMENT');
}));
console.log(`${passed}/${passed} tests passed`);
