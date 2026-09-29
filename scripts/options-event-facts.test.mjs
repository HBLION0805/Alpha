import assert from 'node:assert/strict';
import {projectEventFacts} from './lib/options-event-facts.mjs';

const at='2026-09-29T20:00:00.000Z';
const subject={eventKey:'employment',metric:'PAYROLLS',period:'2026-09',unit:'THOUSAND_JOBS',releaseVersion:'INITIAL'};
const event={key:'employment',title:'Employment',source:'BLS',scheduledAt:at};
function expectation(value='100',forecasts=null){
  const items=forecasts??[{...subject,id:'survey',type:'CONSENSUS',consensusBasis:'SOURCE_SURVEY',value,source:'Survey publisher',reference:'survey table',receivedAt:at}];
  return {kind:'expectation',path:'expectation.json',savedAt:at,payload:{frozenAt:at,request:{eventKey:'employment',rows:[{subject,selectedConsensusId:'survey',forecasts:items}]}}};
}
function comparison(value='100',factChanges={},eligible=true){
  const fact={...subject,claimId:'release',value,source:'https://www.bls.gov/release',sourceAt:at,receivedAt:at,...factChanges};
  return {kind:'saved',path:'comparison.json',savedAt:at,event,payload:{eventKey:'employment',assessment:{statements:[{id:'release',eligible,semanticStatus:eligible?'OWNER_REVIEWED_NOT_MACHINE_VERIFIED':'SEMANTIC_SUPPORT_UNVERIFIED'}],
    bindings:[{factClaimId:'release',status:eligible?'EVIDENCE_ELIGIBLE_FOR_ORIGINAL_CHECKER':'MANUAL_REVIEW_REQUIRED',evidence:eligible?fact:null}]}},draft:{payload:{facts:[fact]}}};
}
const project=(e=[expectation()],c=[comparison()],events=[event])=>projectEventFacts({events,expectations:e,comparisons:c,at});
const row=(e,c)=>project(e,c).events[0].metrics[0];
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('exact selected consensus and eligible actual are in line',()=>{
  const v=row([expectation()],[comparison()]);assert.equal(v.numericDifference,'0');assert.equal(v.qualitativeSurprise,'IN_LINE');assert.deepEqual(v.issues,[]);
  assert.equal(v.actual.sourceAt,at);assert.equal(v.consensus.reference,'survey table');
});
test('exact decimals produce higher and lower with no asset direction',()=>{
  for(const [value,difference,surprise] of [['100.25','0.25','HIGHER_THAN_CONSENSUS'],['99.75','-0.25','LOWER_THAN_CONSENSUS']]){
    const v=row([expectation()],[comparison(value)]);assert.equal(v.numericDifference,difference);assert.equal(v.qualitativeSurprise,surprise);
    assert(!JSON.stringify(v).match(/BULLISH|BEARISH|tradeDisposition|candidateDisposition/));
  }
});
test('missing expectation and missing actual stay unknown',()=>{
  const missingExpectation=row([],[]),missingActual=row([expectation()],[]);
  assert.equal(missingExpectation.qualitativeSurprise,'UNKNOWN');assert(missingExpectation.issues.includes('MISSING_EXPECTATION'));
  assert.equal(missingActual.actual,null);assert(missingActual.issues.includes('MISSING_ACTUAL'));
  const factOnly=row([],[comparison('101')]);assert.equal(factOnly.actual.value,'101');assert.equal(factOnly.numericDifference,null);assert(factOnly.issues.includes('MISSING_EXPECTATION'));
  const ineligibleOnly=row([],[comparison('101',{},false)]);assert.equal(ineligibleOnly.actual,null);assert(ineligibleOnly.issues.includes('UNVERIFIED_OR_INELIGIBLE_SOURCE'));
});
test('period, unit, and release vintage mismatch block comparison',()=>{
  for(const [field,value,issue] of [['period','2026-08','PERIOD_MISMATCH'],['unit','PERCENT','UNIT_MISMATCH'],['releaseVersion','REVISED','RELEASE_VERSION_MISMATCH']]){
    const v=row([expectation()],[comparison('101',{[field]:value})]);assert.equal(v.numericDifference,null);assert(v.issues.includes(issue));
  }
});
test('unreviewed, conflicting, and headline-only ineligible facts never become actual',()=>{
  const unreviewed=row([expectation()],[comparison('101',{},false)]);assert.equal(unreviewed.actual,null);assert(unreviewed.issues.includes('UNVERIFIED_OR_INELIGIBLE_SOURCE'));
  const headline=comparison('101',{},false);headline.payload.assessment.statements[0].issues=['HEADLINE_ONLY_NOT_BODY_FACT'];
  assert.equal(row([expectation()],[headline]).actual,null);
  const disputed=comparison('101',{},false);disputed.draft.payload.relations=[{kind:'FACTUAL_CONFLICT',statementIds:['release']}];
  assert(row([expectation()],[disputed]).issues.includes('CONFLICTING_FACTS'));
  const conflict=comparison('102');conflict.path='second.json';assert.equal(row([expectation()],[comparison('101'),conflict]).actual,null);
  assert(row([expectation()],[comparison('101'),conflict]).issues.includes('CONFLICTING_FACTS'));
});
test('only selected survey consensus is used; no averaging',()=>{
  const selected=expectation('100');selected.payload.request.rows[0].forecasts.push({...selected.payload.request.rows[0].forecasts[0],id:'other',value:'200'});
  assert.equal(row([selected],[comparison('101')]).numericDifference,'1');
});
test('unsupported numeric representation remains unknown',()=>{
  const v=row([expectation()],[comparison('1e2')]);assert.equal(v.actual.value,'1e2');assert.equal(v.numericDifference,null);assert(v.issues.includes('UNSUPPORTED_NUMERIC_REPRESENTATION'));
});
test('selected consensus identity drift and a future fact receipt block arithmetic',()=>{
  const drift=expectation();drift.payload.request.rows[0].forecasts[0].unit='PERCENT';
  assert(row([drift],[comparison()]).issues.includes('CONSENSUS_IDENTITY_MISMATCH'));
  assert.equal(row([drift],[comparison()]).numericDifference,null);
  const future=row([expectation()],[comparison('101',{receivedAt:'2026-09-30T20:00:00.000Z'})]);
  assert(future.issues.includes('STALE_OR_FUTURE_SOURCE'));assert.equal(future.numericDifference,null);
  const stale=row([expectation()],[comparison('101',{sourceAt:'2026-09-28T20:00:00.000Z'})]);
  assert(stale.issues.includes('STALE_SOURCE_BEFORE_EVENT'));assert.equal(stale.numericDifference,null);
});
test('event and metric output bounds and authority flags',()=>{
  const events=Array.from({length:20},(_,n)=>({...event,key:'event-'+n}));const result=project([],[],events);
  assert.equal(result.events.length,12);assert.equal(result.executionAllowed,false);assert.equal(result.guidanceChanged,false);assert.equal(result.sourceReads,0);assert.equal(result.marketCalls,0);
  const e=expectation();e.payload.request.rows=Array.from({length:10},(_,n)=>({...e.payload.request.rows[0],subject:{...subject,metric:'METRIC_'+n}}));
  assert.equal(project([e],[],[event]).events[0].metrics.length,6);
});
console.log(`${passed}/${passed} tests passed`);
