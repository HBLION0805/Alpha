import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {registerReadinessContract} from './lib/options-prospective-decision-readiness.mjs';
import {issueProspectiveDecision,saveIssuerRehearsal} from './lib/options-prospective-decision-issuer.mjs';

const eventId='rehearsal-prospective-issuer';
const eventTime='2027-01-01T12:30:00.000Z';
const contractInput={
 eventId,contractId:'rehearsal-contract',version:'v1',eventTime,thesisVersion:'rehearsal-thesis-v1',thesisStatement:'Engineering-only decision issuer rehearsal.',
 requiredEvidence:[
  {id:'market',asset:'GLD',kind:'MARKET',sourceId:'rehearsal-market',instrument:'GLD',freshnessClock:'QUOTE_OBSERVED',maxAgeMs:5000,session:'REGULAR',missingPolicy:'EVENT_NOT_READY',purpose:'Synthetic engineering quote.'}
 ],
 rules:[
  {ruleId:'support',ruleVersion:'v1',effect:'SUPPORT',metric:'TEST',sourceId:'rehearsal-metric',operator:'LT',threshold:1,requiredObservations:1,observationIntervalMs:1000,windowMs:5000,applicableSession:'ANY',freshnessMs:5000,missingPolicy:'RULE_UNEVALUABLE'}
 ],
 latencyPolicy:{version:'latency-v1',maxNormalizationLatencyMs:1000,maxDecisionLatencyMs:2000,timeoutBehavior:'ISSUE_TIMEOUT_RECORD'},
 generator:{type:'RULE_ENGINE',version:'prospective-rule-engine-v1'}
};
const ev=(id,receivedAt,extra={})=>({evidenceId:id,eventId,kind:'MARKET_OBSERVATION',sourceId:'rehearsal-market',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt,parsedAt:receivedAt,availability:'CURRENT',summary:'synthetic rehearsal',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:{instrument:'GLD',quoteObservedAt:receivedAt,declaredDelayMs:null,session:'REGULAR',comparability:'COMPARABLE',comparabilityReason:'synthetic rehearsal'},numericObservation:null,...extra});
const metric=(id,t,v)=>({evidenceId:id,eventId,kind:'SOURCE_OBSERVATION',sourceId:'rehearsal-metric',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:t,parsedAt:t,availability:'CURRENT',summary:'synthetic numeric',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null,numericObservation:{metric:'TEST',value:v,observedAt:t,sourceId:'rehearsal-metric',session:'ANY'}});
const seq=(...v)=>{let i=0;return()=>v[Math.min(i++,v.length-1)];};
export function runIssuerRehearsal(workspaceRoot,{now=()=>new Date().toISOString()}={}){
 const temp=mkdtempSync(join(tmpdir(),'alpha-issuer-rehearsal-'));
 try{
  const contract=registerReadinessContract(temp,contractInput,{now:()=> '2027-01-01T12:00:00.000Z'}).contract;
  const evidence=[ev('trigger-a','2027-01-01T12:30:01.000Z'),metric('metric-a','2027-01-01T12:30:01.000Z',0.5)];
  const a=issueProspectiveDecision(temp,{contract,evidence,triggerEvidenceIds:['trigger-a'],triggerEligibleAt:'2027-01-01T12:30:01.000Z'},{now:seq('2027-01-01T12:30:01.100Z','2027-01-01T12:30:01.200Z','2027-01-01T12:30:01.400Z','2027-01-01T12:30:01.500Z')});
  const duplicate=issueProspectiveDecision(temp,{contract,evidence,triggerEvidenceIds:['trigger-a'],triggerEligibleAt:'2027-01-01T12:30:01.000Z'});
  let restartStarted=false;try{issueProspectiveDecision(temp,{contract,evidence:[...evidence,ev('trigger-b','2027-01-01T12:30:02.000Z')],triggerEvidenceIds:['trigger-b'],triggerEligibleAt:'2027-01-01T12:30:02.000Z'},{now:seq('2027-01-01T12:30:02.100Z'),failAfterStart:true});}catch{restartStarted=true;}
  const resumed=issueProspectiveDecision(temp,{contract,evidence:[...evidence,ev('trigger-b','2027-01-01T12:30:02.000Z')],triggerEvidenceIds:['trigger-b'],triggerEligibleAt:'2027-01-01T12:30:02.000Z'},{now:seq('2027-01-01T12:30:02.200Z','2027-01-01T12:30:02.400Z','2027-01-01T12:30:02.500Z')});
  const correction=issueProspectiveDecision(temp,{contract,evidence:[...evidence,ev('correction-a','2027-01-01T12:30:03.000Z')],triggerEvidenceIds:['correction-a'],triggerEligibleAt:'2027-01-01T12:30:03.000Z'},{now:seq('2027-01-01T12:30:03.100Z','2027-01-01T12:30:03.200Z','2027-01-01T12:30:03.400Z','2027-01-01T12:30:03.500Z')});
  const failed=issueProspectiveDecision(temp,{contract,evidence:[...evidence,ev('trigger-fail','2027-01-01T12:30:04.000Z')],triggerEvidenceIds:['trigger-fail'],triggerEligibleAt:'2027-01-01T12:30:04.000Z'},{now:seq('2027-01-01T12:30:04.100Z','2027-01-01T12:30:04.200Z','2027-01-01T12:30:04.300Z'),evaluator:()=>{throw Error('rehearsal');}});
  const timeout=issueProspectiveDecision(temp,{contract,evidence:[...evidence,ev('trigger-timeout','2027-01-01T12:30:05.000Z')],triggerEvidenceIds:['trigger-timeout'],triggerEligibleAt:'2027-01-01T12:30:05.000Z'},{now:seq('2027-01-01T12:30:05.100Z','2027-01-01T12:30:05.200Z','2027-01-01T12:30:08.100Z','2027-01-01T12:30:08.200Z')});
  const pass=a.status==='ISSUED'&&duplicate.alreadyCompleted===true&&restartStarted&&resumed.status==='ISSUED'&&correction.status==='ISSUED'&&failed.status==='FAILED'&&timeout.status==='TIMED_OUT';
  if(!pass)throw Error('PROSPECTIVE_REHEARSAL_FAILED');
  const saved=saveIssuerRehearsal(workspaceRoot,{generatorVersion:contract.generator.version,latencyPolicyVersion:contract.latencyPolicy.version,scenarios:['duplicate','restart','correction','failure','timeout']},{now});
  return {version:'PROSPECTIVE_DECISION_REHEARSAL_V1',status:'PASS',saved,details:{duplicateIdempotent:true,restartRecovered:true,correctionAppended:true,failureRecorded:true,timeoutRecorded:true},executionAllowed:false};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const i=process.argv.indexOf('--workspace');if(i<0||!process.argv[i+1]){console.error('PROSPECTIVE_REHEARSAL_ARGUMENTS');process.exitCode=2;}else console.log(JSON.stringify(runIssuerRehearsal(process.argv[i+1]),null,2));
}
