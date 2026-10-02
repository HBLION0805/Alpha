import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal} from 'node:assert/strict';
import {runProspectiveDecision} from './options-prospective-decision.mjs';
import {saveIssuerRehearsal} from './lib/options-prospective-decision-issuer.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-prospective-cli-'));
const contractPath=join(root,'contract.json'),evidencePath=join(root,'evidence.json');
const eventId='cli-test-event',eventTime='2026-10-20T12:30:00.000Z';
const contract={eventId,contractId:'cli-contract',version:'v1',eventTime,thesisVersion:'cli-thesis-v1',thesisStatement:'CLI test.',
 requiredEvidence:[{id:'gld',asset:'GLD',kind:'MARKET',sourceId:'qualified-gld',instrument:'GLD',freshnessClock:'QUOTE_OBSERVED',maxAgeMs:15000,session:'REGULAR',missingPolicy:'EVENT_NOT_READY',purpose:'GLD required.'}],
 rules:[{ruleId:'support',ruleVersion:'v1',effect:'SUPPORT',metric:'TEST',sourceId:'metric',operator:'LT',threshold:1,requiredObservations:1,observationIntervalMs:1000,windowMs:5000,applicableSession:'ANY',freshnessMs:5000,missingPolicy:'RULE_UNEVALUABLE'}],
 latencyPolicy:{version:'latency-v1',maxNormalizationLatencyMs:1000,maxDecisionLatencyMs:2000,timeoutBehavior:'ISSUE_TIMEOUT_RECORD'},generator:{type:'RULE_ENGINE',version:'prospective-rule-engine-v1'}};
const evidence=[{evidenceId:'gld1',eventId,kind:'MARKET_OBSERVATION',sourceId:'qualified-gld',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:'2026-10-20T12:19:59.000Z',parsedAt:'2026-10-20T12:19:59.000Z',availability:'CURRENT',summary:'test',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:{instrument:'GLD',quoteObservedAt:'2026-10-20T12:19:58.000Z',declaredDelayMs:null,session:'REGULAR',comparability:'COMPARABLE',comparabilityReason:'test'},numericObservation:null}];
try{
 writeFileSync(contractPath,JSON.stringify(contract));writeFileSync(evidencePath,JSON.stringify(evidence));
 const registered=runProspectiveDecision(['--register',contractPath,'--workspace',root],{now:()=> '2026-10-20T12:00:00.000Z'});equal(registered.status,'REGISTERED');
 equal(runProspectiveDecision(['--report',eventId,'--workspace',root],{now:()=> '2026-10-20T12:20:00.000Z'}).contracts.length,1);
 let gate=runProspectiveDecision(['--gate',eventId,'--evidence',evidencePath,'--workspace',root],{now:()=> '2026-10-20T12:20:00.000Z'});equal(gate.gate.status,'EVENT_NOT_READY');equal(gate.gate.blockers.includes('DECISION_ISSUER_REHEARSAL_MISSING'),true);
 saveIssuerRehearsal(root,{generatorVersion:'prospective-rule-engine-v1',latencyPolicyVersion:'latency-v1',scenarios:['duplicate','restart','correction','failure','timeout']},{now:()=> '2026-10-20T12:10:00.000Z'});
 gate=runProspectiveDecision(['--gate',eventId,'--evidence',evidencePath,'--workspace',root],{now:()=> '2026-10-20T12:20:00.000Z'});equal(gate.gate.status,'PRE_EVENT_READY');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Prospective decision CLI tests passed');
