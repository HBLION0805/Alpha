import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';

const VERSION='PROSPECTIVE_EVENT_READINESS_V1';
const BASE='data/runtime/options-event-intelligence/readiness/contracts';
const fail=c=>{throw Error('PROSPECTIVE_READINESS_'+c);};
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const utc=()=>new Date().toISOString();
const text=(v,n=180)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f]/.test(v);
const safeId=v=>text(v,120)&&/^[a-z0-9][a-z0-9-]{1,119}$/.test(v);
const clock=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('CLOCK');return Date.parse(v);};
const exact=(o,keys,code)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!==[...keys].sort().join(','))fail(code);};

function validateRequiredEvidence(x){
  exact(x,['id','asset','kind','sourceId','instrument','freshnessClock','maxAgeMs','session','missingPolicy','purpose'],'EVIDENCE_FIELDS');
  if(!safeId(x.id)||!['EVENT','GLD','IBIT'].includes(x.asset)||!['EXPECTATION','PRE_EVENT_STATE','SOURCE_HEALTH','MARKET'].includes(x.kind)||!text(x.sourceId)||!['RECEIVED','QUOTE_OBSERVED'].includes(x.freshnessClock)||!['ANY','REGULAR','PREMARKET','AFTER_HOURS','TWENTY_FOUR_SEVEN'].includes(x.session)||!['EVENT_NOT_READY','RULE_UNEVALUABLE'].includes(x.missingPolicy)||!text(x.purpose,400))fail('EVIDENCE');
  if(x.instrument!==null&&!text(x.instrument,80))fail('EVIDENCE_INSTRUMENT');
  if(x.maxAgeMs!==null&&(!Number.isSafeInteger(x.maxAgeMs)||x.maxAgeMs<0||x.maxAgeMs>86400000))fail('EVIDENCE_AGE');
  if(x.kind==='MARKET'&&x.instrument===null)fail('MARKET_INSTRUMENT');
  return x;
}
function validateRule(r){
  exact(r,['ruleId','ruleVersion','effect','metric','sourceId','operator','threshold','requiredObservations','observationIntervalMs','windowMs','applicableSession','freshnessMs','missingPolicy'],'RULE_FIELDS');
  if(!safeId(r.ruleId)||!safeId(r.ruleVersion)||!['SUPPORT','DEGRADE','INVALIDATE'].includes(r.effect)||!text(r.metric,100)||!text(r.sourceId,100)||!['GT','GTE','LT','LTE'].includes(r.operator)||typeof r.threshold!=='number'||!Number.isFinite(r.threshold)||!['ANY','REGULAR','PREMARKET','AFTER_HOURS','TWENTY_FOUR_SEVEN'].includes(r.applicableSession)||!['RULE_UNEVALUABLE','EVENT_NOT_READY'].includes(r.missingPolicy))fail('RULE');
  for(const n of ['requiredObservations','observationIntervalMs','windowMs','freshnessMs'])if(!Number.isSafeInteger(r[n])||r[n]<=0)fail('RULE_NUMBER');
  if(r.requiredObservations>60||r.windowMs<r.observationIntervalMs*Math.max(0,r.requiredObservations-1))fail('RULE_WINDOW');
  return r;
}
export function validateReadinessContract(c){
  exact(c,['schemaVersion','eventId','contractId','version','eventTime','registeredAt','thesisVersion','thesisStatement','requiredEvidence','rules','latencyPolicy','generator','executionAllowed'],'CONTRACT_FIELDS');
  if(c.schemaVersion!==VERSION||c.executionAllowed!==false||!safeId(c.eventId)||!safeId(c.contractId)||!safeId(c.version)||!safeId(c.thesisVersion)||!text(c.thesisStatement,1000))fail('CONTRACT');
  clock(c.eventTime);clock(c.registeredAt);if(clock(c.registeredAt)>=clock(c.eventTime))fail('LATE_REGISTRATION');
  if(!Array.isArray(c.requiredEvidence)||!c.requiredEvidence.length||c.requiredEvidence.length>40||new Set(c.requiredEvidence.map(x=>x.id)).size!==c.requiredEvidence.length)fail('EVIDENCE_LIST');
  c.requiredEvidence.forEach(validateRequiredEvidence);
  if(!Array.isArray(c.rules)||!c.rules.length||c.rules.length>40||new Set(c.rules.map(x=>x.ruleId)).size!==c.rules.length)fail('RULE_LIST');
  c.rules.forEach(validateRule);
  exact(c.latencyPolicy,['version','maxNormalizationLatencyMs','maxDecisionLatencyMs','timeoutBehavior'],'LATENCY_FIELDS');
  if(!safeId(c.latencyPolicy.version)||!Number.isSafeInteger(c.latencyPolicy.maxNormalizationLatencyMs)||c.latencyPolicy.maxNormalizationLatencyMs<=0||!Number.isSafeInteger(c.latencyPolicy.maxDecisionLatencyMs)||c.latencyPolicy.maxDecisionLatencyMs<=0||c.latencyPolicy.timeoutBehavior!=='ISSUE_TIMEOUT_RECORD')fail('LATENCY');
  exact(c.generator,['type','version'],'GENERATOR_FIELDS');
  if(c.generator.type!=='RULE_ENGINE'||!safeId(c.generator.version))fail('GENERATOR');
  return c;
}
function pathFor(root,eventId,contractId,version){
  if(!safeId(eventId)||!safeId(contractId)||!safeId(version))fail('PATH_ID');
  const rootReal=realpathSync(root),dir=resolve(rootReal,BASE,eventId);mkdirSync(dir,{recursive:true});
  if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory())fail('DIRECTORY');
  return {rootReal,rel:BASE+'/'+eventId+'/'+contractId+'--'+version+'.json'};
}
export function registerReadinessContract(root,input,{now=utc}={}){
  if(Object.hasOwn(input,'registeredAt'))fail('CALLER_CLOCK');
  const registeredAt=now();clock(registeredAt);
  const contract=validateReadinessContract({...structuredClone(input),schemaVersion:VERSION,registeredAt,executionAllowed:false});
  const {rel}=pathFor(root,contract.eventId,contract.contractId,contract.version);
  const envelope={version:VERSION,contract,fingerprint:sha(contract)};
  io.writeExclusive(root,rel,Buffer.from(JSON.stringify(envelope,null,2)+'\n'));
  return {...envelope,path:rel};
}
function readContractFile(root,rel){
  const raw=io.readBytes(root,rel,1024*1024);let v;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail('JSON');}
  exact(v,['version','contract','fingerprint'],'ENVELOPE');
  if(v.version!==VERSION||sha(v.contract)!==v.fingerprint)fail('INTEGRITY');
  validateReadinessContract(v.contract);return {...v,path:rel};
}
export function listReadinessContracts(root,eventId,asOf){
  const cutoff=clock(asOf);if(!safeId(eventId))fail('EVENT_ID');
  const rootReal=realpathSync(root),dir=resolve(rootReal,BASE,eventId);if(!existsSync(dir))return [];
  if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory())fail('DIRECTORY');
  const entries=readdirSync(dir,{withFileTypes:true});if(entries.length>200)fail('LIMIT');
  return entries.filter(e=>e.isFile()&&!e.isSymbolicLink()&&e.name.endsWith('.json')).map(e=>readContractFile(root,BASE+'/'+eventId+'/'+e.name))
    .filter(x=>clock(x.contract.registeredAt)<=cutoff).sort((a,b)=>a.contract.registeredAt.localeCompare(b.contract.registeredAt));
}
function matchEvidence(req,e,asOf){
  if(Date.parse(e.receivedAt)>asOf||e.parsedAt&&Date.parse(e.parsedAt)>asOf)return false;
  if(req.kind==='EXPECTATION'&&e.kind!=='EXPECTATION_SNAPSHOT')return false;
  if(req.kind==='PRE_EVENT_STATE'&&e.kind!=='PRE_EVENT_STATE')return false;
  if(req.kind==='SOURCE_HEALTH'&&e.kind!=='SOURCE_STATUS')return false;
  if(req.kind==='MARKET'&&(e.kind!=='MARKET_OBSERVATION'||e.marketObservation?.instrument!==req.instrument))return false;
  if(e.sourceId!==req.sourceId)return false;
  if(req.session!=='ANY'&&req.kind==='MARKET'&&e.marketObservation?.session!==req.session)return false;
  const t=req.freshnessClock==='QUOTE_OBSERVED'?Date.parse(e.marketObservation?.quoteObservedAt??''):Date.parse(e.receivedAt);
  return Number.isFinite(t)&&asOf-t>=0&&(req.maxAgeMs===null||asOf-t<=req.maxAgeMs)&&e.availability==='CURRENT';
}
export function assessRequiredEvidence(contract,evidence,asOf){
  validateReadinessContract(contract);const at=clock(asOf),checks=[];
  for(const req of contract.requiredEvidence){const matches=evidence.filter(e=>matchEvidence(req,e,at));checks.push({id:req.id,asset:req.asset,ready:matches.length>0,evidenceIds:matches.map(e=>e.evidenceId),missingPolicy:req.missingPolicy,purpose:req.purpose});}
  return {checks,blockers:checks.filter(x=>!x.ready&&x.missingPolicy==='EVENT_NOT_READY').map(x=>'EVIDENCE_'+x.id+'_NOT_READY'),ruleUnavailable:checks.filter(x=>!x.ready&&x.missingPolicy==='RULE_UNEVALUABLE').map(x=>x.id)};
}
export function assessEventReadiness(contract,evidence,asOf,{faultRehearsalPassed=false}={}){
  validateReadinessContract(contract);const at=clock(asOf),required=assessRequiredEvidence(contract,evidence,asOf);
  const preEvent=at<clock(contract.eventTime),registered=clock(contract.registeredAt)<clock(contract.eventTime)&&clock(contract.registeredAt)<=at;
  const blockers=[...(!preEvent?['EVENT_ALREADY_STARTED']:[]),...(!registered?['CONTRACT_NOT_ACTIVE']:[]),...(!faultRehearsalPassed?['DECISION_ISSUER_REHEARSAL_MISSING']:[]),...required.blockers];
  return {version:'PROSPECTIVE_EVENT_GATE1_V1',eventId:contract.eventId,contractId:contract.contractId,contractVersion:contract.version,assessedAt:asOf,status:blockers.length?'EVENT_NOT_READY':'PRE_EVENT_READY',checks:required.checks,rulesExecutable:true,faultRehearsalPassed,latencyPolicy:structuredClone(contract.latencyPolicy),blockers,executionAllowed:false};
}
