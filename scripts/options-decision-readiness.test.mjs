import assert from 'node:assert/strict';
import {decisionReadinessProjection} from './lib/options-decision-readiness.mjs';

let passed=0;
async function test(name,fn){
  try{await fn();passed++;console.log('PASS',name);}
  catch(error){console.error('FAIL',name,error);process.exitCode=1;}
}
const contract=(id,symbol,askCents)=>({id,symbol,expiry:'2026-10-30',type:'call',strike:'50.0000',multiplier:100,
  bidCents:askCents-2,askCents,tickCents:1,bidSize:10,askSize:12,delta:0.5,
  updatedAt:'2026-09-29T19:55:38.000Z',receivedAt:'2026-09-29T19:55:39.000Z'});
const cost=(premiumCents,feeReserveCents,blockers=[])=>({basis:'REVIEWED_SCHEDULE_ASSUMPTION',
  profile:{id:'reviewed'},exitAllowanceCents:100,feeReserveCents,premiumCents,targetPerShareCents:300,
  plannedRiskCents:4000,netTargetCents:8000,blockers,brokerFeesConfirmed:false,changesDecision:false});
function fixture(){
  return {guidance:{data:{current:{assessedAt:'2026-09-29T19:56:30.000Z',marketCapturedAt:'2026-09-29T19:55:39.000Z',
    settings:{tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}}}}},
    decisionCards:{data:{assessedAt:'2026-09-29T19:56:30.000Z',marketCapturedAt:'2026-09-29T19:55:39.000Z',
      analysisAt:'2026-09-29T19:56:00.000Z',reviewCurrent:true,cards:[        {symbol:'GLD',action:'WATCH',trend:{direction:'DOWN'},bias:'BEARISH',blockers:['ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'],
          references:[
            {contract:contract('g1','GLD',200),disposition:'NO_TRADE',blockers:['COSTS_UNKNOWN','ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'],costExample:cost(20000,20)},
            {contract:contract('g2','GLD',520),disposition:'NO_TRADE',blockers:['COSTS_UNKNOWN'],costExample:cost(52000,20)}
          ]},
        {symbol:'IBIT',action:'WATCH',trend:{direction:'UP'},bias:'BULLISH',blockers:[],
          references:[{contract:contract('i1','IBIT',150),disposition:'NO_TRADE',blockers:['COSTS_UNKNOWN'],costExample:cost(15000,15)}]}
      ]}}};
}await test('modeled costs replace only COSTS_UNKNOWN and preserve evidence blockers',()=>{
  const input=fixture(),before=JSON.stringify(input),out=decisionReadinessProjection(input),g=out.assets[0].candidates[0];
  assert.equal(g.withinOwnerCapitalRange,true);
  assert.equal(g.modeledEconomics.allInCapitalCents,20020);
  assert.deepEqual(g.originalBlockers,['COSTS_UNKNOWN','ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD']);
  assert.deepEqual(g.modeledBlockers,['ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD']);
  assert.equal(g.state,'MODELED_COST_FEASIBLE_EVIDENCE_BLOCKED');
  assert.equal(JSON.stringify(input),before);
});await test('capital conflict is explicit after modeled fees',()=>{
  const out=decisionReadinessProjection(fixture()),g=out.assets[0].candidates[1];
  assert.equal(g.withinOwnerCapitalRange,false);
  assert.ok(g.modeledBlockers.includes('MODELED_ALL_IN_CAPITAL_OUTSIDE_OWNER_RANGE'));
  assert.equal(g.state,'MODELED_CAPITAL_CONFLICT');
});
await test('cost-feasible and evidence-clear still never authorizes a trade',()=>{
  const out=decisionReadinessProjection(fixture()),i=out.assets[1].candidates[0];
  assert.equal(i.state,'MODELED_COST_AND_EVIDENCE_CLEAR_NOT_AUTHORIZED');
  assert.equal(i.executionAllowed,false);
  assert.equal(out.canonicalDecisionEligible,false);
  assert.equal(out.ownerAuthorityRequired,true);
  assert.equal(out.summary.modeledEvidenceClear,1);
});await test('missing modeled cost cannot clear COSTS_UNKNOWN',()=>{
  const input=fixture();input.decisionCards.data.cards[1].references[0].costExample=null;
  const i=decisionReadinessProjection(input).assets[1].candidates[0];
  assert.ok(i.modeledBlockers.includes('COSTS_UNKNOWN'));
  assert.ok(i.modeledBlockers.includes('MODELED_COST_SCENARIO_UNAVAILABLE'));
  assert.equal(i.withinOwnerCapitalRange,null);
});
await test('invalid or missing owner allocation policy fails closed',()=>{
  const input=fixture();input.guidance.data.current.settings.tradeBudget.version='OTHER';
  assert.throws(()=>decisionReadinessProjection(input),/DECISION_READINESS_INPUT/);
});
if(process.exitCode)throw Error('decision readiness tests failed');
console.log('decision readiness: '+passed+'/5 passed');
