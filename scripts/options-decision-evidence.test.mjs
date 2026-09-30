import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ingestFastHost,finishFastHost} from './options-guidance-fast-host.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {materializeDecisionEvidence,validateDecisionEvidence,verifyDecisionEvidenceArtifact} from './lib/options-decision-evidence.mjs';
import {capture,line,note,now} from './lib/options-fast-host-test-fixture.mjs';
import {assessOptionsCapitalPolicy} from '../src/engines/options-retail-feasibility/OptionsCapitalPolicy.ts';

let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temporary(fn){const root=mkdtempSync(join(tmpdir(),'alpha-decision-evidence-test-'));try{await fn(root);}finally{rmSync(root,{recursive:true,force:true});}}
const disk=(root,path)=>JSON.parse(readFileSync(join(root,path)));
const state=root=>createWorkbenchData({workspaceRoot:root}).state();
async function completed(root,biases){const first=await ingestFastHost(root,line(capture()));const finish=await finishFastHost(root,first.identity,line(note(biases)));assert.equal(finish.status,'PASS');return {first,finish};}

await test('read before materialization creates no artifact, with explicit dependency',()=>temporary(async root=>{
  const first=await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root});
  assert.equal(first.status,'NOT_MATERIALIZED');assert.equal(first.reason,'PREDICTION_EVIDENCE_UNAVAILABLE');
  await ingestFastHost(root,line(capture()));
  const second=await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root});
  assert.equal(second.status,'NOT_MATERIALIZED');
  assert.equal(existsSync(join(root,'data/runtime/options-decision-evidence')),false);
}));
await test('Fast Host binds actual saved GLD/IBIT bullish and bearish projection',()=>temporary(async root=>{
  const {first,finish}=await completed(root,['BULLISH','BEARISH']);
  assert.equal(finish.identity,first.identity);
  assert.equal(finish.decisionEvidence.candidateCount,2);assert.equal(finish.decisionEvidence.executionAllowed,false);
  assert(Buffer.byteLength(JSON.stringify(finish))<16384);
  const value=await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root});
  const pe=await runGuidanceCommand(['--prediction-evidence'],{workspaceRoot:root});
  assert.equal(value.identity,finish.decisionEvidence.identity);assert.equal(value.path,finish.decisionEvidence.path);
  assert.deepEqual(value.candidates.map(c=>c.directionCandidate),['UP','DOWN']);
  assert.deepEqual(value.candidates.map(c=>c.decision),['NO_TRADE','NO_TRADE']);
  assert(value.candidates.every(c=>c.blockingReasons.includes('OWNER_AUTHORITY_REQUIRED')&&c.confirmedEntryTrigger===null&&c.numericTarget===null&&c.exactTimeExit===null));
  assert(value.candidates.every(c=>c.referenceContracts.every(r=>r.chosenTrade===false)));
  assert.equal(value.provenance.predictionEvidence.identity,pe.identity);assert.equal(value.provenance.report.path,finish.reportPath);
  assert.equal(value.provenance.capture.path,first.capturePath);assert.equal(value.provenance.analysis.path,finish.analysisPath);
  assert.deepEqual(value.eventFacts,pe.eventFacts);assert.deepEqual(value.capitalPolicy,assessOptionsCapitalPolicy(disk(root,finish.reportPath).input.settings));
  assert.equal(validateDecisionEvidence(value,pe).status,'VERIFIED');assert.equal(verifyDecisionEvidenceArtifact(root,pe).identity,value.identity);
  const forbidden=structuredClone(value);forbidden.candidates[0].decision='TRADE';
  assert.throws(()=>validateDecisionEvidence(forbidden,pe),/DECISION_EVIDENCE_/);
  assert.equal((await state(root)).decisionEvidence.data.identity,value.identity);
  assert.equal(existsSync(join(root,'data/runtime/options-manual-ledger')),false);
  assert.equal(existsSync(join(root,'data/runtime/prediction-log')),false);
}));
await test('mixed and insufficient directions stay null and NO_TRADE',()=>temporary(async root=>{
  await completed(root,['MIXED','INSUFFICIENT_EVIDENCE']);
  const value=await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root});
  assert.deepEqual(value.candidates.map(c=>c.directionCandidate),[null,null]);
  assert(value.candidates.every(c=>c.decision==='NO_TRADE'&&c.blockingReasons.includes('NO_DIRECTION_CANDIDATE')));
}));
await test('repeat materialization is idempotent and current settings or clock cannot rewrite issued payload',()=>temporary(async root=>{
  await completed(root,['BULLISH','MIXED']);
  const s=await state(root),pe=s.predictionEvidence.data,original=s.decisionEvidence.data;
  const before=readFileSync(join(root,original.path));
  s.guidance.data.current.settings={altered:true};
  s.guidance.data.input.settings={altered:true};
  s.loadedAt='2099-01-01T00:00:00.000Z';s.capitalPolicy.data={changed:true};
  const again=materializeDecisionEvidence(root,pe);
  assert.equal(again.status,'ALREADY_MATERIALIZED');assert.equal(again.identity,original.identity);
  assert.deepEqual(readFileSync(join(root,original.path)),before);
  assert.equal((await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root})).identity,original.identity);
  assert.equal(readdirSync(join(root,'data/runtime/options-decision-evidence')).length,1);
}));
await test('wrong PE identity, scope, path and modified bytes fail closed',()=>temporary(async root=>{
  await completed(root,['BULLISH','BEARISH']);const pe=(await state(root)).predictionEvidence.data;
  for(const mutation of [p=>p.identity='0'.repeat(64),p=>p.path='../escape.json',p=>p.candidates[0].symbol='QQQ',p=>p.provenance.capture.capturedAt=now()]){
    const bad=structuredClone(pe);mutation(bad);assert.throws(()=>materializeDecisionEvidence(root,bad),/DECISION_EVIDENCE_/);
  }
  writeFileSync(join(root,pe.path),'{"tampered":true}\n');
  assert.throws(()=>materializeDecisionEvidence(root,pe),/DECISION_EVIDENCE_/);
}));
await test('forged Prediction authority fails even with recomputed integrity identity',()=>temporary(async root=>{
  await completed(root,['BULLISH','BEARISH']);const pe=(await state(root)).predictionEvidence.data;
  const forged=structuredClone(pe);forged.authority='CANONICAL_PREDICTION_LOG';
  const payload=Object.fromEntries(Object.entries(forged).filter(([k])=>!['identity','path','status'].includes(k)));
  forged.identity=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const stored=Object.fromEntries(Object.entries(forged).filter(([k])=>k!=='status'));
  writeFileSync(join(root,forged.path),JSON.stringify(stored,null,2)+'\n');
  assert.throws(()=>materializeDecisionEvidence(root,forged),/DECISION_EVIDENCE_PREDICTION_AUTHORITY/);
}));
await test('unknown broker costs remain an explicit non-trade blocker',()=>temporary(async root=>{
  await completed(root,['BULLISH','BEARISH']);const s=await state(root),value=s.decisionEvidence.data,pe=s.predictionEvidence.data;
  assert(value.candidates.every(c=>c.decision==='NO_TRADE'&&c.brokerFeesConfirmed===false&&c.blockingReasons.includes('BROKER_FEES_UNCONFIRMED')));
  assert(value.candidates.every(c=>c.referenceContracts.every(r=>r.chosenTrade===false&&(!r.illustrativeCostExample||r.illustrativeCostExample.brokerFeesConfirmed===false&&r.illustrativeCostExample.changesDecision===false))));
  const bad=structuredClone(value);bad.candidates[0].blockingReasons=bad.candidates[0].blockingReasons.filter(b=>b!=='BROKER_FEES_UNCONFIRMED');
  const body=Object.fromEntries(Object.entries(bad).filter(([k])=>!['identity','path','status'].includes(k)));
  bad.identity=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.throws(()=>validateDecisionEvidence(bad,pe),/DECISION_EVIDENCE_CANDIDATE_VALIDATION/);
}));
await test('Decision artifact corruption and unsafe linked path fail closed',()=>temporary(async root=>{
  await completed(root,['MIXED','MIXED']);const s=await state(root),value=s.decisionEvidence.data;
  writeFileSync(join(root,value.path),'{"truncated":');
  assert.equal((await state(root)).decisionEvidence.state,'BLOCKED');
  assert.throws(()=>verifyDecisionEvidenceArtifact(root,s.predictionEvidence.data));
  rmSync(join(root,value.path));
  try{symlinkSync(join(root,s.predictionEvidence.data.path),join(root,value.path));}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code))return;throw error;}
  assert.throws(()=>materializeDecisionEvidence(root,s.predictionEvidence.data),/UNSAFE|ARTIFACT|FILE/);
}));
await test('newer capture does not materialize an old decision under a new current report',()=>temporary(async root=>{
  await completed(root,['BULLISH','BEARISH']);const old=(await state(root)).decisionEvidence.data;
  await new Promise(resolve=>setTimeout(resolve,5));await ingestFastHost(root,line(capture()));
  const current=await runGuidanceCommand(['--decision-evidence'],{workspaceRoot:root});
  assert.equal(current.status,'NOT_MATERIALIZED');
  assert.equal(disk(root,old.path).identity,old.identity);
  assert.equal(readdirSync(join(root,'data/runtime/options-decision-evidence')).length,1);
}));
await test('operational FAIL skips Decision artifact and reports reason',()=>temporary(async root=>{
  const raw=capture();for(const r of raw.receipts.filter(r=>r.tool==='get_option_quotes'))for(const row of r.response.data.results)row.quote.updated_at=new Date(Date.parse(raw.capturedAt)-600000).toISOString();
  const first=await ingestFastHost(root,line(raw));const finish=await finishFastHost(root,first.identity,line(note()));
  assert.equal(finish.status,'FAIL');assert.equal(finish.decisionEvidence.status,'SKIPPED');assert.equal(finish.decisionEvidence.reason,'OPERATIONAL_CHECK_FAILED');
  assert(finish.decisionEvidence.failedChecks.includes('PUBLISH_QUOTE_FRESHNESS'));
  assert.equal(existsSync(join(root,'data/runtime/options-decision-evidence')),false);
}));
console.log(`${passed}/${passed} tests passed`);
