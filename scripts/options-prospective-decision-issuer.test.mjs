import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal,ok,throws} from 'node:assert/strict';
import {registerReadinessContract} from './lib/options-prospective-decision-readiness.mjs';
import {decisionTriggerKey,issueProspectiveDecision,readDecisionAttempt,saveIssuerRehearsal,readIssuerRehearsal} from './lib/options-prospective-decision-issuer.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-issuer-'));
const eventId='scheduled-test-issuer';
const eventTime='2026-10-10T12:30:00.000Z';
const baseInput={
 eventId,contractId:'gld-event-thesis',version:'v1',eventTime,thesisVersion:'gld-thesis-v1',thesisStatement:'Synthetic engineering thesis.',
 requiredEvidence:[
  {id:'expectation',asset:'EVENT',kind:'EXPECTATION',sourceId:'exp',instrument:null,freshnessClock:'RECEIVED',maxAgeMs:86400000,session:'ANY',missingPolicy:'EVENT_NOT_READY',purpose:'expectation'},
  {id:'gld',asset:'GLD',kind:'MARKET',sourceId:'gld-feed',instrument:'GLD',freshnessClock:'QUOTE_OBSERVED',maxAgeMs:15000,session:'REGULAR',missingPolicy:'EVENT_NOT_READY',purpose:'gld'},
  {id:'real-health',asset:'GLD',kind:'SOURCE_HEALTH',sourceId:'real-feed',instrument:null,freshnessClock:'RECEIVED',maxAgeMs:30000,session:'ANY',missingPolicy:'RULE_UNEVALUABLE',purpose:'real yield'}
 ],
 rules:[
  {ruleId:'support-real-low',ruleVersion:'v1',effect:'SUPPORT',metric:'REAL_10Y',sourceId:'real-feed',operator:'LT',threshold:3,requiredObservations:3,observationIntervalMs:1000,windowMs:5000,applicableSession:'ANY',freshnessMs:5000,missingPolicy:'RULE_UNEVALUABLE'},
  {ruleId:'invalidate-real-high',ruleVersion:'v1',effect:'INVALIDATE',metric:'REAL_10Y',sourceId:'real-feed',operator:'GT',threshold:3.2,requiredObservations:3,observationIntervalMs:1000,windowMs:5000,applicableSession:'ANY',freshnessMs:5000,missingPolicy:'RULE_UNEVALUABLE'}
 ],
 latencyPolicy:{version:'latency-v1',maxNormalizationLatencyMs:1000,maxDecisionLatencyMs:2000,timeoutBehavior:'ISSUE_TIMEOUT_RECORD'},
 generator:{type:'RULE_ENGINE',version:'prospective-rule-engine-v1'}
};
const contract=registerReadinessContract(root,baseInput,{now:()=> '2026-10-10T12:00:00.000Z'}).contract;
const e=(x)=>({eventId,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,parsedAt:x.receivedAt,availability:'CURRENT',summary:'test',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null,numericObservation:null,...x});
const evidence=[
 e({evidenceId:'exp1',kind:'EXPECTATION_SNAPSHOT',sourceId:'exp',receivedAt:'2026-10-10T12:10:00.000Z',expectationSnapshot:{stage:'RESEARCH',ownerConfirmed:false,rows:[{id:'r',metric:'M',period:'P',unit:'U',adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'LEVEL',expectationType:'CONSENSUS',value:'1',selected:true,source:'s',sourcePublishedAt:null,sourceReceivedAt:'2026-10-10T12:10:00.000Z',methodology:'m',sampleInfo:null}]}}),
 e({evidenceId:'trigger1',kind:'SOURCE_OBSERVATION',sourceId:'official',receivedAt:'2026-10-10T12:30:00.500Z'}),
 e({evidenceId:'gld1',kind:'MARKET_OBSERVATION',sourceId:'gld-feed',receivedAt:'2026-10-10T12:30:02.000Z',marketObservation:{instrument:'GLD',quoteObservedAt:'2026-10-10T12:30:01.900Z',declaredDelayMs:null,session:'REGULAR',comparability:'COMPARABLE',comparabilityReason:'test'}}),
 e({evidenceId:'health1',kind:'SOURCE_STATUS',sourceId:'real-feed',receivedAt:'2026-10-10T12:30:02.000Z'}),
 ...[0,1,2].map(i=>e({evidenceId:'real'+i,kind:'SOURCE_OBSERVATION',sourceId:'real-feed',receivedAt:'2026-10-10T12:30:0'+(1+i)+'.000Z',numericObservation:{metric:'REAL_10Y',value:2.8,observedAt:'2026-10-10T12:30:0'+(1+i)+'.000Z',sourceId:'real-feed',session:'ANY'}}))
];
const seq=(...times)=>{let i=0;return()=>times[Math.min(i++,times.length-1)];};
try{
 const issued=issueProspectiveDecision(root,{contract,evidence,triggerEvidenceIds:['trigger1'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'},{now:seq('2026-10-10T12:30:03.100Z','2026-10-10T12:30:03.200Z','2026-10-10T12:30:03.500Z','2026-10-10T12:30:03.600Z')});
 equal(issued.status,'ISSUED');equal(issued.decision.thesisState,'MAINTAIN');equal(issued.decision.modelVersion,null);equal(issued.decision.generatorType,'RULE_ENGINE');equal(issued.decision.decisionLatencyMs,500);
 const repeat=issueProspectiveDecision(root,{contract,evidence,triggerEvidenceIds:['trigger1'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'});
 equal(repeat.alreadyCompleted,true);equal(repeat.decision.decisionId,issued.decision.decisionId,'duplicate trigger is idempotent');

 const restartEvidence=evidence.map(x=>structuredClone(x));restartEvidence[1].evidenceId='trigger-restart';
 const restartKey=decisionTriggerKey(contract,['trigger-restart']);
 throws(()=>issueProspectiveDecision(root,{contract,evidence:restartEvidence,triggerEvidenceIds:['trigger-restart'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'},{now:seq('2026-10-10T12:30:03.100Z'),failAfterStart:true}),/INJECTED_AFTER_START/);
 ok(readDecisionAttempt(root,eventId,restartKey).start);equal(readDecisionAttempt(root,eventId,restartKey).terminal,null);
 const resumed=issueProspectiveDecision(root,{contract,evidence:restartEvidence,triggerEvidenceIds:['trigger-restart'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'},{now:seq('2026-10-10T12:30:03.300Z','2026-10-10T12:30:03.600Z','2026-10-10T12:30:03.700Z')});
 equal(resumed.status,'ISSUED');equal(resumed.processingStartedAt,'2026-10-10T12:30:03.100Z','restart resumes original attempt');

 const corrected=[...evidence,e({evidenceId:'correction1',kind:'CORRECTION',sourceId:'official',receivedAt:'2026-10-10T12:30:04.000Z'})];
 const correction=issueProspectiveDecision(root,{contract,evidence:corrected,triggerEvidenceIds:['correction1'],triggerEligibleAt:'2026-10-10T12:30:04.000Z'},{now:seq('2026-10-10T12:30:04.100Z','2026-10-10T12:30:04.200Z','2026-10-10T12:30:04.400Z','2026-10-10T12:30:04.500Z')});
 equal(correction.status,'ISSUED');ok(correction.decision.decisionId!==issued.decision.decisionId,'correction appends a new decision');

 const failedEvidence=evidence.map(x=>structuredClone(x));failedEvidence[1].evidenceId='trigger-fail';
 const failed=issueProspectiveDecision(root,{contract,evidence:failedEvidence,triggerEvidenceIds:['trigger-fail'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'},{now:seq('2026-10-10T12:30:03.100Z','2026-10-10T12:30:03.200Z','2026-10-10T12:30:03.300Z'),evaluator:()=>{throw Error('boom');}});
 equal(failed.status,'FAILED');equal(failed.errorCode,'PROSPECTIVE_ISSUER_EVALUATION_FAILED');

 const timeoutEvidence=evidence.map(x=>structuredClone(x));timeoutEvidence[1].evidenceId='trigger-timeout';
 const timeout=issueProspectiveDecision(root,{contract,evidence:timeoutEvidence,triggerEvidenceIds:['trigger-timeout'],triggerEligibleAt:'2026-10-10T12:30:03.000Z'},{now:seq('2026-10-10T12:30:03.100Z','2026-10-10T12:30:03.200Z','2026-10-10T12:30:06.100Z','2026-10-10T12:30:06.200Z')});
 equal(timeout.status,'TIMED_OUT');equal(timeout.decision.blockers.includes('DECISION_LATENCY_EXCEEDED'),true);

 const rehearsal=saveIssuerRehearsal(root,{generatorVersion:contract.generator.version,latencyPolicyVersion:contract.latencyPolicy.version,scenarios:['duplicate','restart','correction','failure','timeout']},{now:()=> '2026-10-10T12:15:00.000Z'});
 equal(rehearsal.status,'PASS');equal(readIssuerRehearsal(root,contract.generator.version,contract.latencyPolicy.version).status,'PASS');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Prospective decision issuer fault rehearsal tests passed');
