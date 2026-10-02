import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {assessRequiredEvidence,validateReadinessContract} from './options-prospective-decision-readiness.mjs';

const VERSION='PROSPECTIVE_DECISION_ISSUER_V1';
const BASE='data/runtime/options-event-intelligence/decision-attempts';
const REHEARSAL='data/runtime/options-event-intelligence/decision-issuer-rehearsals';
const fail=c=>{throw Error('PROSPECTIVE_ISSUER_'+c);};
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const utc=()=>new Date().toISOString();
const clock=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('CLOCK');return Date.parse(v);};
const safeId=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{1,119}$/.test(v);
const exact=(o,k,c)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!==[...k].sort().join(','))fail(c);};
const cmp=(op,a,b)=>op==='GT'?a>b:op==='GTE'?a>=b:op==='LT'?a<b:a<=b;

function attemptPaths(root,eventId,key){
  if(!safeId(eventId)||!/^[a-f0-9]{64}$/.test(key))fail('ATTEMPT_ID');
  const rootReal=realpathSync(root),dir=resolve(rootReal,BASE,eventId,key);mkdirSync(dir,{recursive:true});
  if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory())fail('DIRECTORY');
  return {start:BASE+'/'+eventId+'/'+key+'/start.json',terminal:BASE+'/'+eventId+'/'+key+'/terminal.json'};
}
function read(root,path,max=2*1024*1024){const b=io.readBytes(root,path,max);let v;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}catch{fail('JSON');}return v;}
function write(root,path,kind,payload){const envelope={version:VERSION,kind,payload,fingerprint:sha(payload)};io.writeExclusive(root,path,Buffer.from(JSON.stringify(envelope,null,2)+'\n'));return envelope;}
function verifyEnvelope(v,kind){exact(v,['version','kind','payload','fingerprint'],'ENVELOPE');if(v.version!==VERSION||v.kind!==kind||v.fingerprint!==sha(v.payload))fail('INTEGRITY');return v.payload;}
function visibleEvidence(evidence,cutoff){
  const t=clock(cutoff);
  return evidence.filter(e=>clock(e.receivedAt)<=t&&(e.parsedAt===null||clock(e.parsedAt)<=t)).map(e=>structuredClone(e));
}
function ruleStatus(rule,evidence,cutoff){
  const at=clock(cutoff);
  const rows=evidence.filter(e=>e.numericObservation&&e.numericObservation.metric===rule.metric&&e.numericObservation.sourceId===rule.sourceId&&clock(e.receivedAt)<=at&&(e.parsedAt===null||clock(e.parsedAt)<=at))
    .filter(e=>rule.applicableSession==='ANY'||e.numericObservation.session===rule.applicableSession)
    .filter(e=>{const observed=clock(e.numericObservation.observedAt);return observed<=at&&at-observed<=rule.windowMs&&at-observed<=rule.freshnessMs;})
    .sort((a,b)=>clock(a.numericObservation.observedAt)-clock(b.numericObservation.observedAt)||a.evidenceId.localeCompare(b.evidenceId));
  if(rows.length<rule.requiredObservations)return {ruleId:rule.ruleId,status:'INSUFFICIENT_DATA',effect:rule.effect,evidenceIds:rows.map(x=>x.evidenceId)};
  const sample=rows.slice(-rule.requiredObservations);
  for(let i=1;i<sample.length;i++)if(clock(sample[i].numericObservation.observedAt)-clock(sample[i-1].numericObservation.observedAt)!==rule.observationIntervalMs)return {ruleId:rule.ruleId,status:'INSUFFICIENT_DATA',effect:rule.effect,evidenceIds:sample.map(x=>x.evidenceId)};
  const triggered=sample.every(e=>cmp(rule.operator,e.numericObservation.value,rule.threshold));
  return {ruleId:rule.ruleId,status:triggered?'TRIGGERED':'NOT_TRIGGERED',effect:rule.effect,evidenceIds:sample.map(x=>x.evidenceId)};
}
function evaluate(contract,evidence,cutoff){
  const required=assessRequiredEvidence(contract,evidence,cutoff);
  const checks=contract.rules.map(r=>ruleStatus(r,evidence,cutoff));
  const ruleMissing=checks.some(x=>x.status==='INSUFFICIENT_DATA');
  let thesisState='UNEVALUABLE';
  if(checks.some(x=>x.effect==='INVALIDATE'&&x.status==='TRIGGERED'))thesisState='INVALIDATE';
  else if(checks.some(x=>x.effect==='DEGRADE'&&x.status==='TRIGGERED'))thesisState='DEGRADE';
  else if(!required.blockers.length&&!required.ruleUnavailable.length&&!ruleMissing&&checks.some(x=>x.effect==='SUPPORT'&&x.status==='TRIGGERED'))thesisState='MAINTAIN';
  const blockers=[...required.blockers,...required.ruleUnavailable.map(x=>'RULE_EVIDENCE_'+x+'_UNAVAILABLE'),...(ruleMissing?['RULE_OBSERVATIONS_INSUFFICIENT']:[])];
  const completeness=blockers.length?required.checks.some(x=>x.ready)?'PARTIAL':'INSUFFICIENT':'COMPLETE';
  return {thesisState,evidenceCompleteness:completeness,blockers,requiredEvidenceChecks:required.checks,ruleChecks:checks};
}
export function decisionTriggerKey(contract,triggerEvidenceIds){
  validateReadinessContract(contract);
  if(!Array.isArray(triggerEvidenceIds)||!triggerEvidenceIds.length||new Set(triggerEvidenceIds).size!==triggerEvidenceIds.length||triggerEvidenceIds.some(x=>!safeId(x)))fail('TRIGGER_IDS');
  return sha([contract.eventId,contract.contractId,contract.version,[...triggerEvidenceIds].sort()]);
}
export function issueProspectiveDecision(root,{contract,evidence,triggerEvidenceIds,triggerEligibleAt},{now=utc,evaluator=evaluate,failAfterStart=false}={}){
  validateReadinessContract(contract);clock(triggerEligibleAt);
  if(clock(triggerEligibleAt)<clock(contract.eventTime))fail('TRIGGER_BEFORE_EVENT');
  const key=decisionTriggerKey(contract,triggerEvidenceIds),paths=attemptPaths(root,contract.eventId,key),rootReal=realpathSync(root);
  if(existsSync(resolve(rootReal,paths.terminal))){
    const terminal=verifyEnvelope(read(root,paths.terminal),'TERMINAL');
    return {...terminal,alreadyCompleted:true};
  }
  let start;
  if(existsSync(resolve(rootReal,paths.start)))start=verifyEnvelope(read(root,paths.start),'START');
  else{
    const processingStartedAt=now();clock(processingStartedAt);if(clock(processingStartedAt)<clock(triggerEligibleAt))fail('START_BEFORE_TRIGGER');
    start={attemptId:key,eventId:contract.eventId,contractId:contract.contractId,contractVersion:contract.version,triggerEvidenceIds:[...triggerEvidenceIds].sort(),triggerEligibleAt,processingStartedAt,generatorType:'RULE_ENGINE',generatorVersion:contract.generator.version,latencyPolicyVersion:contract.latencyPolicy.version,executionAllowed:false};
    write(root,paths.start,'START',start);
  }
  if(failAfterStart)throw Error('PROSPECTIVE_ISSUER_INJECTED_AFTER_START');
  try{
    const evidenceCutoffAt=now();clock(evidenceCutoffAt);if(clock(evidenceCutoffAt)<clock(start.processingStartedAt))fail('CUTOFF_CLOCK');
    const visible=visibleEvidence(evidence,evidenceCutoffAt);
    const result=evaluator(contract,visible,evidenceCutoffAt);
    const generatedAt=now();clock(generatedAt);if(clock(generatedAt)<clock(evidenceCutoffAt))fail('GENERATED_CLOCK');
    const decisionLatencyMs=clock(generatedAt)-clock(triggerEligibleAt),timedOut=decisionLatencyMs>contract.latencyPolicy.maxDecisionLatencyMs;
    const processingCompletedAt=now();clock(processingCompletedAt);if(clock(processingCompletedAt)<clock(generatedAt))fail('COMPLETE_CLOCK');
    const decision={decisionId:'prospective-'+key.slice(0,24),eventId:contract.eventId,generatedAt,evidenceCutoffAt,inputEvidenceIds:visible.map(e=>e.evidenceId),decisionVersion:'prospective-decision-v1',ruleVersion:contract.version,generatorType:'RULE_ENGINE',modelVersion:null,triggerEvidenceIds:[...triggerEvidenceIds].sort(),triggerEligibleAt,processingStartedAt:start.processingStartedAt,processingCompletedAt,decisionLatencyMs,latencyPolicyVersion:contract.latencyPolicy.version,thesisVersion:contract.thesisVersion,thesisState:result.thesisState,evidenceCompleteness:result.evidenceCompleteness,reason:timedOut?'Decision completed after the frozen latency limit; content is preserved but the prospective timing gate failed.':result.thesisState==='UNEVALUABLE'?'Required evidence or rule observations were insufficient; no directional state was invented.':'Frozen rules were evaluated against point-in-time evidence.',blockers:[...result.blockers,...(timedOut?['DECISION_LATENCY_EXCEEDED']:[])],prospectiveDetails:{requiredEvidenceChecks:result.requiredEvidenceChecks,ruleChecks:result.ruleChecks,timedOut,maxDecisionLatencyMs:contract.latencyPolicy.maxDecisionLatencyMs}};
    const terminal={status:timedOut?'TIMED_OUT':'ISSUED',attemptId:key,decision,inputEvidence:visible,contractFingerprint:sha(contract),generatorType:'RULE_ENGINE',modelVersion:null,processingStartedAt:start.processingStartedAt,processingCompletedAt,executionAllowed:false};
    write(root,paths.terminal,'TERMINAL',terminal);return {...terminal,alreadyCompleted:false};
  }catch(error){
    const processingCompletedAt=now();clock(processingCompletedAt);
    const code=/^PROSPECTIVE_(?:ISSUER|READINESS)_[A-Z_]+$/.test(error?.message)?error.message:'PROSPECTIVE_ISSUER_EVALUATION_FAILED';
    const terminal={status:'FAILED',attemptId:key,decision:null,inputEvidence:[],contractFingerprint:sha(contract),generatorType:'RULE_ENGINE',modelVersion:null,processingStartedAt:start.processingStartedAt,processingCompletedAt,errorCode:code,executionAllowed:false};
    write(root,paths.terminal,'TERMINAL',terminal);return {...terminal,alreadyCompleted:false};
  }
}
export function readDecisionAttempt(root,eventId,key){
  const paths=attemptPaths(root,eventId,key),rootReal=realpathSync(root);
  const startPath=resolve(rootReal,paths.start),terminalPath=resolve(rootReal,paths.terminal);
  return {start:existsSync(startPath)?verifyEnvelope(read(root,paths.start),'START'):null,terminal:existsSync(terminalPath)?verifyEnvelope(read(root,paths.terminal),'TERMINAL'):null};
}
export function saveIssuerRehearsal(root,input,{now=utc}={}){
  exact(input,['generatorVersion','latencyPolicyVersion','scenarios'],'REHEARSAL_FIELDS');
  if(!safeId(input.generatorVersion)||!safeId(input.latencyPolicyVersion)||!Array.isArray(input.scenarios)||!['duplicate','restart','correction','failure','timeout'].every(x=>input.scenarios.includes(x)))fail('REHEARSAL');
  const completedAt=now();clock(completedAt);const payload={...structuredClone(input),completedAt,status:'PASS',executionAllowed:false};
  io.directory(root,REHEARSAL);const rel=REHEARSAL+'/'+input.generatorVersion+'--'+input.latencyPolicyVersion+'.json';write(root,rel,'REHEARSAL',payload);return {...payload,path:rel};
}
export function readIssuerRehearsal(root,generatorVersion,latencyPolicyVersion){
  const rel=REHEARSAL+'/'+generatorVersion+'--'+latencyPolicyVersion+'.json',full=resolve(realpathSync(root),rel);if(!existsSync(full))return null;
  const p=verifyEnvelope(read(root,rel),'REHEARSAL');return p.status==='PASS'?p:null;
}
