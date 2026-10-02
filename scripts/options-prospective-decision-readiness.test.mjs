import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal,throws} from 'node:assert/strict';
import {registerReadinessContract,listReadinessContracts,assessEventReadiness} from './lib/options-prospective-decision-readiness.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-readiness-'));
const eventTime='2026-10-10T12:30:00.000Z';
const registeredAt='2026-10-10T12:00:00.000Z';
const contractInput={
  eventId:'scheduled-test-20261010',contractId:'gld-jobs-thesis',version:'v1',eventTime,
  thesisVersion:'gold-jobs-v1',thesisStatement:'Test thesis only.',
  requiredEvidence:[
    {id:'expectation',asset:'EVENT',kind:'EXPECTATION',sourceId:'expectation-source',instrument:null,freshnessClock:'RECEIVED',maxAgeMs:86400000,session:'ANY',missingPolicy:'EVENT_NOT_READY',purpose:'Freeze pre-event expectation.'},
    {id:'gld',asset:'GLD',kind:'MARKET',sourceId:'qualified-gld',instrument:'GLD',freshnessClock:'QUOTE_OBSERVED',maxAgeMs:15000,session:'REGULAR',missingPolicy:'EVENT_NOT_READY',purpose:'GLD quote required for GLD thesis.'},
    {id:'real-yield-health',asset:'GLD',kind:'SOURCE_HEALTH',sourceId:'qualified-real-yield',instrument:null,freshnessClock:'RECEIVED',maxAgeMs:30000,session:'ANY',missingPolicy:'EVENT_NOT_READY',purpose:'Real yield source required; nominal yield is not a substitute.'}
  ],
  rules:[
    {ruleId:'real-yield-rise',ruleVersion:'v1',effect:'INVALIDATE',metric:'REAL_10Y_YIELD',sourceId:'qualified-real-yield',operator:'GT',threshold:3,requiredObservations:3,observationIntervalMs:60000,windowMs:180000,applicableSession:'ANY',freshnessMs:15000,missingPolicy:'RULE_UNEVALUABLE'}
  ],
  latencyPolicy:{version:'latency-v1',maxNormalizationLatencyMs:1500,maxDecisionLatencyMs:2000,timeoutBehavior:'ISSUE_TIMEOUT_RECORD'},
  generator:{type:'RULE_ENGINE',version:'prospective-rule-engine-v1'}
};
const e=(extra)=>({eventId:'scheduled-test-20261010',occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,parsedAt:'2026-10-10T12:19:59.500Z',availability:'CURRENT',summary:'test',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null,...extra});
try{
  const saved=registerReadinessContract(root,contractInput,{now:()=>registeredAt});
  equal(saved.contract.registeredAt,registeredAt);
  equal(listReadinessContracts(root,contractInput.eventId,'2026-10-10T12:20:00.000Z').length,1);
  throws(()=>registerReadinessContract(root,contractInput,{now:()=>registeredAt}),/EEXIST|exists/i,'immutable version cannot overwrite');
  const evidence=[
    e({evidenceId:'exp',kind:'EXPECTATION_SNAPSHOT',sourceId:'expectation-source',receivedAt:'2026-10-10T12:10:00.000Z',expectationSnapshot:{stage:'RESEARCH',ownerConfirmed:false,rows:[{id:'r',metric:'M',period:'P',unit:'U',adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'LEVEL',expectationType:'CONSENSUS',value:'1',selected:true,source:'s',sourcePublishedAt:null,sourceReceivedAt:'2026-10-10T12:10:00.000Z',methodology:'m',sampleInfo:null}]}}),
    e({evidenceId:'gld',kind:'MARKET_OBSERVATION',sourceId:'qualified-gld',receivedAt:'2026-10-10T12:20:00.000Z',marketObservation:{instrument:'GLD',quoteObservedAt:'2026-10-10T12:19:55.000Z',declaredDelayMs:null,session:'REGULAR',comparability:'COMPARABLE',comparabilityReason:'test'}}),
    e({evidenceId:'real',kind:'SOURCE_STATUS',sourceId:'qualified-real-yield',receivedAt:'2026-10-10T12:19:58.000Z'})
  ];
  let gate=assessEventReadiness(saved.contract,evidence,'2026-10-10T12:20:01.000Z',{faultRehearsalPassed:true});
  equal(gate.status,'PRE_EVENT_READY','only event-required evidence gates this GLD case');
  equal(gate.checks.some(x=>x.id==='gld'&&x.ready),true);
  gate=assessEventReadiness(saved.contract,evidence.filter(x=>x.sourceId!=='qualified-real-yield'),'2026-10-10T12:20:01.000Z',{faultRehearsalPassed:true});
  equal(gate.status,'EVENT_NOT_READY','missing real-yield source blocks declared real-yield rule');
  equal(gate.blockers.includes('EVIDENCE_real-yield-health_NOT_READY'),true);
  gate=assessEventReadiness(saved.contract,evidence,'2026-10-10T12:20:01.000Z',{faultRehearsalPassed:false});
  equal(gate.blockers.includes('DECISION_ISSUER_REHEARSAL_MISSING'),true);
  gate=assessEventReadiness(saved.contract,evidence,'2026-10-10T12:30:00.000Z',{faultRehearsalPassed:true});
  equal(gate.status,'EVENT_NOT_READY','event start cannot be retroactively declared ready');
  const v2={...contractInput,version:'v2',rules:[{...contractInput.rules[0],ruleVersion:'v2',threshold:3.1}]};
  registerReadinessContract(root,v2,{now:()=> '2026-10-10T12:05:00.000Z'});
  equal(listReadinessContracts(root,contractInput.eventId,'2026-10-10T12:20:00.000Z').length,2,'rule changes create append-only version');
  throws(()=>registerReadinessContract(root,{...contractInput,eventTime:'2026-10-10T11:59:00.000Z'},{now:()=>registeredAt}),/LATE_REGISTRATION/);
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Prospective readiness registry tests passed');
