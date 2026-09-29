import assert from 'node:assert/strict';
import {predictionEvidenceCandidate} from './lib/options-prediction-evidence.mjs';
import {projectEventFacts} from './lib/options-event-facts.mjs';

const asset=(symbol,bias)=>({symbol,bias,summary:'Attributed summary',supporting:['support'],opposing:['opposition'],invalidation:'invalidation',eventPlan:'event plan',sources:[{url:'https://example.com/a',title:'A',publishedAt:null,retrievedAt:'2026-09-29T19:50:00.000Z'}]});
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
test('exact GLD/IBIT candidates preserve attributed analysis',()=>{
  const candidates=[predictionEvidenceCandidate(asset('GLD','BULLISH')),predictionEvidenceCandidate(asset('IBIT','BEARISH'))];
  assert.deepEqual(candidates.map(c=>c.symbol),['GLD','IBIT']);
  assert.deepEqual(candidates.map(c=>c.directionCandidate),['UP','DOWN']);
  for(const [i,c] of candidates.entries()){
    assert.equal(c.hostBias,['BULLISH','BEARISH'][i]);assert.equal(c.summary,'Attributed summary');
    assert.deepEqual(c.supporting,['support']);assert.deepEqual(c.opposing,['opposition']);
    assert.equal(c.invalidation,'invalidation');assert.equal(c.eventPlan,'event plan');assert.deepEqual(c.sources,asset(c.symbol,c.hostBias).sources);
    assert.equal(c.confidence,null);assert.equal(c.forecastHorizon,null);assert.equal(c.canonicalPredictionEligible,false);assert.equal(c.executionAllowed,false);
    assert.deepEqual(c.blockingReasons,['NO_FORECAST_HORIZON','NO_FROZEN_PLAN','OWNER_AUTHORITY_REQUIRED']);
  }
});
test('mixed and insufficient evidence have no direction and explicit blocker',()=>{
  for(const bias of ['MIXED','INSUFFICIENT_EVIDENCE']){
    const c=predictionEvidenceCandidate(asset('GLD',bias));assert.equal(c.directionCandidate,null);assert(c.blockingReasons.includes('NO_DIRECTION_CANDIDATE'));
  }
});
test('eventFacts surprise and unresolved issues never set an asset direction',()=>{
  const facts=projectEventFacts({events:[{key:'release',title:'Release'}],at:'2026-09-29T20:00:00.000Z'});
  assert(facts.events[0].issues.includes('MISSING_ACTUAL'));
  for(const surprise of ['HIGHER_THAN_CONSENSUS','LOWER_THAN_CONSENSUS','IN_LINE']){
    facts.events[0].metrics[0].qualitativeSurprise=surprise;
    assert.equal(predictionEvidenceCandidate(asset('IBIT','MIXED')).directionCandidate,null);
  }
  assert.equal(facts.events[0].metrics[0].actual,null);
});
console.log(`${passed}/${passed} tests passed`);
