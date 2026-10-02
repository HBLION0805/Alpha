/** Point-in-time release extraction and evidence-gated assessments. No orders or model calls. */
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
export const EVENT_ID='employment-situation-20261002';
export const EVENT_TIME='2026-10-02T12:30:00.000Z';
export const RELEASE_URL='https://www.bls.gov/news.release/archives/empsit_10022026.htm';
export const PARSER_VERSION='BLS_EMPLOYMENT_BODY_V1';
export const EVALUATOR_VERSION='EVENT_EVIDENCE_GATES_V1';
const BASE='data/runtime/options-event-intelligence/assessments';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=c=>{throw Error('EVENT_ASSESSMENT_'+c);};
const clock=x=>{if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString()!==x)fail('CLOCK');return Date.parse(x);};
const id=x=>{if(typeof x!=='string'||!/^[a-z0-9][a-z0-9-]{2,119}$/.test(x))fail('ID');return x;};
const dec=x=>{if(typeof x!=='string'||!/^[-+]?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(x))fail('DECIMAL');const neg=x[0]==='-',p=x.replace(/^[-+]/,'').split('.');return (neg?-1n:1n)*(BigInt(p[0])*1000000n+BigInt((p[1]??'').padEnd(6,'0')));};
const fmt=n=>{const neg=n<0n,v=neg?-n:n;return (neg?'-':'')+String(v/1000000n)+(v%1000000n?'.'+String(v%1000000n).padStart(6,'0').replace(/0+$/,''):'');};
export const decimalDifference=(a,b)=>fmt(dec(a)-dec(b));
const jobs=x=>fmt(dec(x.replaceAll(',',''))/1000n);
const sameSubject=(a,b)=>['metric','period','unit','adjustment','releaseVersion','valueMeaning'].every(k=>a[k]===b[k]);
const utc=()=>new Date().toISOString();
function readJson(root,path,max=2097152){const bytes=io.readBytes(root,path,max);let v;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('JSON');}return v;}
function safeDirectory(root,relative){let dir=root;for(const part of relative.split('/')){dir=resolve(dir,part);if(!existsSync(dir))return null;const s=lstatSync(dir);if(!s.isDirectory()||s.isSymbolicLink())fail('DIRECTORY');}return dir;}
function put(root,kind,key,payload){id(key);const dir=BASE+'/'+kind;io.directory(root,dir);const path=dir+'/'+key+'.json';const value={version:'EVENT_ASSESSMENT_RECORD_V1',kind,payload,fingerprint:sha(payload)};io.writeExclusive(root,path,Buffer.from(JSON.stringify(value,null,2)+'\n'));return {...value,path};}
function records(root,kind){const base=safeDirectory(root,BASE+'/'+kind);if(!base)return [];const entries=readdirSync(base,{withFileTypes:true});if(entries.length>2000)fail('RECORD_LIMIT');return entries.map(e=>{if(!e.isFile()||e.isSymbolicLink()||!e.name.endsWith('.json'))fail('RECORD_ENTRY');const path=BASE+'/'+kind+'/'+e.name;const v=readJson(root,path);if(Object.keys(v).sort().join(',')!=='fingerprint,kind,payload,version'||v.kind!==kind||v.version!=='EVENT_ASSESSMENT_RECORD_V1'||sha(v.payload)!==v.fingerprint)fail('INTEGRITY');return {...v,path};});}
/** Fixed dated archive transport. Each read preserves actual source receipt, including failures. */
export async function captureEmploymentRelease(root,{fetchImplementation=globalThis.fetch,now=utc}={}){
  const requestedAt=now();clock(requestedAt);let html=null,error=null,status=null,contentType=null;
  try{const r=await fetchImplementation(RELEASE_URL,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html','User-Agent':'Alpha-Event-Research/1.0'}});status=r.status;contentType=r.headers.get('content-type');if(r.status!==200||r.redirected||!/^text\/html(?:;|$)/i.test(contentType??''))throw Error('HTTP_OR_CONTENT_TYPE');let n=0;const parts=[];for await(const p of r.body){n+=p.byteLength;if(n>2097152)throw Error('BODY_LIMIT');parts.push(p);}html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));if(!html)throw Error('EMPTY_BODY');}
  catch(e){error=['BODY_LIMIT','HTTP_OR_CONTENT_TYPE','EMPTY_BODY'].includes(e?.message)?e.message:'TRANSPORT_FAILURE';html=null;}
  const receivedAt=now();if(clock(receivedAt)<clock(requestedAt))fail('CLOCK_ROLLBACK');
  const dir='data/runtime/options-event-intelligence/release-inputs';io.directory(root,dir);const path=dir+'/'+receivedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  io.writeExclusive(root,path,Buffer.from(JSON.stringify({version:'EMPLOYMENT_RELEASE_RAW_V1',url:RELEASE_URL,requestedAt,receivedAt,status,contentType,sha256:html===null?null:sha(html),html,error,executionAllowed:false},null,2)+'\n'));
  return {path,receivedAt,status:error?'FAILED':'RECEIVED',error,executionAllowed:false};
}
/** Narrow supported BLS body format; unsupported/missing fields never become zero. */
export function parseEmploymentBody(raw){
  if(raw?.version!=='EMPLOYMENT_RELEASE_RAW_V1'||raw.url!==RELEASE_URL||raw.status!==200||typeof raw.html!=='string'||raw.html.length>2097152||sha(raw.html)!==raw.sha256||raw.executionAllowed!==false)fail('RAW_RELEASE');
  if(clock(raw.receivedAt)<clock(raw.requestedAt))fail('RAW_CLOCK');
  const safe=raw.html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const pres=[...safe.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#8211;|&ndash;|[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim());
  const bodies=pres.filter(s=>s.includes('THE EMPLOYMENT SITUATION - SEPTEMBER 2026'));
  if(bodies.length!==1||!bodies[0].includes('8:30 a.m. (ET) Friday, October 2, 2026'))fail('RELEASE_IDENTITY');
  const text=bodies[0],facts=[],revisions=[],missing=[];
  const add=(metric,value,unit,valueMeaning,quote)=>facts.push({metric,period:'2026-09',unit,adjustment:'SA',releaseVersion:'INITIAL',valueMeaning,value,locator:{section:'BLS release narrative',start:text.indexOf(quote),end:text.indexOf(quote)+quote.length,quote}});
  const pp=text.match(/Total nonfarm payroll employment [^.]{0,600}\./i);
  let payroll=null;if(pp){let m=pp[0].match(/\(([+-]?[\d,]+)\)/);if(m)payroll=jobs(m[1]);else{m=pp[0].match(/(increased|decreased|declined|rose|fell) by ([\d,]+)/i);if(m)payroll=jobs((/decreased|declined|fell/i.test(m[1])?'-':'')+m[2]);}}
  if(payroll!==null){const lead=text.match(/nonfarm payroll employment \(([+-]?[\d,]+)\)/i);if(lead&&jobs(lead[1])!==payroll)fail('PAYROLL_CONFLICT');add('TOTAL_NONFARM_PAYROLL_CHANGE',payroll,'THOUSAND_JOBS','MONTHLY_CHANGE',pp[0]);}else missing.push('TOTAL_NONFARM_PAYROLL_CHANGE');
  const ur=text.match(/(?:Both )?the unemployment rate, at (\d+(?:\.\d+)?) percent/i);
  if(ur){const lead=text.match(/unemployment rate \((\d+(?:\.\d+)?) percent\)/i);if(lead&&dec(lead[1])!==dec(ur[1]))fail('UNEMPLOYMENT_CONFLICT');add('U3_UNEMPLOYMENT_RATE',fmt(dec(ur[1])),'PERCENT','RATE',ur[0]);}else missing.push('U3_UNEMPLOYMENT_RATE');
  const wage=text.match(/average hourly earnings for all employees on private nonfarm payrolls [\s\S]{0,180}?or (\d+(?:\.\d+)?) percent/i);
  if(wage)add('ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_MOM',fmt(dec((/down|declined|decreased|fell/i.test(wage[0])?'-':'')+wage[1])),'PERCENT','MONTH_ON_MONTH_PERCENT_CHANGE',wage[0]);else missing.push('ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_MOM');
  const yoy=text.match(/Over the past 12 months, average hourly earnings have (increased|decreased) by (\d+(?:\.\d+)?) percent/i);
  if(yoy)add('ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_YOY',fmt(dec((yoy[1].toLowerCase()==='decreased'?'-':'')+yoy[2])),'PERCENT','YEAR_ON_YEAR_PERCENT_CHANGE',yoy[0]);else missing.push('ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_YOY');
  const rr=/change (?:in total nonfarm payroll employment )?for (July|August) was revised (down|up) by ([\d,]+), from ([+-]?[\d,]+) to ([+-]?[\d,]+)/gi;
  for(const m of text.matchAll(rr)){const previous=jobs(m[4]),revised=jobs(m[5]),delta=jobs((m[2].toLowerCase()==='down'?'-':'')+m[3]);if(decimalDifference(revised,previous)!==delta)fail('REVISION_ARITHMETIC');const period=m[1].toLowerCase()==='july'?'2026-07':'2026-08';if(revisions.some(r=>r.period===period))fail('REVISION_DUPLICATE');revisions.push({metric:'TOTAL_NONFARM_PAYROLL_CHANGE',period,unit:'THOUSAND_JOBS',adjustment:'SA',previouslyReportedInThisRelease:previous,revisedValue:revised,change:delta,locator:{section:'BLS revision paragraph',start:m.index,end:m.index+m[0].length,quote:m[0]}});}
  if(revisions.length!==2)missing.push('PRIOR_MONTH_PAYROLL_REVISIONS');
  const total=text.match(/employment in July and August combined is ([\d,]+) (lower|higher) than previously reported/i);
  if(total&&revisions.length===2&&revisions.reduce((a,r)=>a+dec(r.change),0n)!==dec(jobs((total[2].toLowerCase()==='lower'?'-':'')+total[1])))fail('REVISION_TOTAL');
  missing.push('PRIVATE_PAYROLL_CHANGE'); // Not inferred from totals or headline text; table parser not included in this body version.
  return {parserVersion:PARSER_VERSION,eventId:EVENT_ID,scheduledAt:EVENT_TIME,period:'2026-09',sourceUrl:raw.url,rawSha256:raw.sha256,sourceReceivedAt:raw.receivedAt,normalizedBodySha256:sha(text),facts,revisions,missingMetrics:missing,verification:'PRIMARY_BODY_PARSED_NOT_INDEPENDENT_AUDIT'};
}
export function saveReleaseFacts(root,rawPath,{now=utc}={}){
  if(!/^data\/runtime\/options-event-intelligence\/release-inputs\/[0-9TZ.-]+-[a-f0-9-]+\.json$/.test(rawPath))fail('RAW_PATH');
  const raw=readJson(root,rawPath,4194304),parsed=parseEmploymentBody(raw),all=records(root,'facts');
  const prior=all.find(r=>r.payload.evidence.releaseFacts.rawSha256===parsed.rawSha256&&r.payload.evidence.releaseFacts.parserVersion===PARSER_VERSION);if(prior)return {...prior,alreadyRecorded:true};
  const parsedAt=now();if(clock(parsedAt)<clock(raw.receivedAt))fail('PARSE_CLOCK');
  const previous=all.sort((a,b)=>a.payload.evidence.parsedAt.localeCompare(b.payload.evidence.parsedAt)).at(-1);
  const evidence={evidenceId:'employment-facts-'+sha([parsed.rawSha256,PARSER_VERSION]).slice(0,28),eventId:EVENT_ID,kind:previous?'CORRECTION':'SOURCE_OBSERVATION',sourceId:'bls',sourceUrl:RELEASE_URL,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:raw.receivedAt,parsedAt,availability:'CURRENT',summary:'BLS正文结构化记录；前月修订单独保存，不改变事前预期。此记录的可见时间以实际接收及解析完成时间为准。',supersedesEvidenceId:previous?.payload.evidence.evidenceId??null,expectationSnapshot:null,marketObservation:null,releaseFacts:{...parsed,rawPath}};
  return put(root,'facts',evidence.evidenceId,{evidence,recordedAt:now(),executionAllowed:false});
}
export function readReleaseFactEvidence(root,asOf){clock(asOf);return records(root,'facts').map(r=>r.payload.evidence).filter(e=>clock(e.receivedAt)<=clock(asOf)&&clock(e.parsedAt)<=clock(asOf)).sort((a,b)=>a.parsedAt.localeCompare(b.parsedAt));}
const RULE_KEYS=['ruleId','metric','period','unit','adjustment','releaseVersion','valueMeaning','sourceId','operator','threshold','effect'];
function validatePolicy(p){
  if(p?.eventId!==EVENT_ID||!id(p.policyId)||!id(p.thesisVersion)||!id(p.version)||clock(p.registeredAt)<0||!Array.isArray(p.rules)||!p.rules.length||p.rules.length>12)fail('POLICY');
  const seen=new Set();for(const r of p.rules){if(Object.keys(r).sort().join(',')!==[...RULE_KEYS].sort().join(',')||seen.has(r.ruleId)||r.sourceId!=='bls'||!['GT','GTE','LT','LTE'].includes(r.operator)||!['SUPPORT','DEGRADE','INVALIDATE'].includes(r.effect))fail('RULE');id(r.ruleId);seen.add(r.ruleId);dec(r.threshold);for(const k of RULE_KEYS)if(typeof r[k]!=='string'||!r[k].trim())fail('RULE_TEXT');}
  return p;
}
export function registerAssessmentPolicy(root,input,{now=utc}={}){if(Object.hasOwn(input,'registeredAt'))fail('CALLER_POLICY_CLOCK');const p=validatePolicy({...structuredClone(input),registeredAt:now()});return put(root,'policies',p.policyId,p);}
export function readAssessmentPolicy(root,asOf){return records(root,'policies').map(r=>validatePolicy(r.payload)).filter(p=>clock(p.registeredAt)<=clock(asOf)).sort((a,b)=>a.registeredAt.localeCompare(b.registeredAt)).at(-1)??null;}
const comparison=(op,a,b)=>op==='GT'?a>b:op==='GTE'?a>=b:op==='LT'?a<b:a<=b;
/** Facts and expectation gaps are descriptive; no hard-coded CPI/jobs-to-gold direction. */
export function evaluateEventEvidence(evidence,policy,asOf){
  const cutoff=clock(asOf),visible=evidence.filter(e=>clock(e.receivedAt)<=cutoff&&e.parsedAt!==null&&clock(e.parsedAt)<=cutoff);
  const factRecords=visible.filter(e=>e.releaseFacts&&e.sourceId==='bls'&&e.releaseFacts.parserVersion===PARSER_VERSION&&e.releaseFacts.verification==='PRIMARY_BODY_PARSED_NOT_INDEPENDENT_AUDIT'),replaced=new Set(factRecords.map(e=>e.supersedesEvidenceId).filter(Boolean));
  const active=factRecords.filter(e=>!replaced.has(e.evidenceId));const release=active.length===1?active[0]:null;
  const expectations=visible.filter(e=>e.kind==='EXPECTATION_SNAPSHOT'&&clock(e.receivedAt)<clock(EVENT_TIME)&&clock(e.parsedAt)<clock(EVENT_TIME)).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
  const expectation=expectations.at(-1)??null;
  const pre=visible.filter(e=>e.kind==='PRE_EVENT_STATE'&&clock(e.receivedAt)<clock(EVENT_TIME)).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)).at(-1)??null;
  const requirements=[{id:'PRE_EVENT_STATE',available:pre?.availability==='CURRENT',evidenceIds:pre?[pre.evidenceId]:[],reason:'事前快照必须真实且没有已知过旧/缺失标记。'},
    {id:'PRE_EVENT_EXPECTATION',available:Boolean(expectation),evidenceIds:expectation?[expectation.evidenceId]:[],reason:'只使用事件前已经接收并解析的预期。'},
    {id:'OFFICIAL_RELEASE_FACTS',available:Boolean(release?.releaseFacts.facts.length),evidenceIds:release?[release.evidenceId]:[],reason:active.length>1?'原文版本冲突，不能选择有利的一份。':'需要实际收到、解析成功且版本无冲突的BLS正文。'}];
  for(const symbol of ['GLD','IBIT']){const m=visible.filter(e=>e.kind==='MARKET_OBSERVATION'&&e.marketObservation?.instrument===symbol).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)).at(-1);const q=m?.marketObservation;const age=q?cutoff-Date.parse(q.quoteObservedAt):Infinity;requirements.push({id:symbol+'_PRICE',available:Boolean(m?.availability==='CURRENT'&&q?.comparability==='COMPARABLE'&&age>=0&&age<=120000),evidenceIds:m?[m.evidenceId]:[],reason:'需要同一标的、可比且不超过120秒的报价；这只是证据新鲜度门槛，不是交易规则。'});}
  if(policy)validatePolicy(policy);
  const prospective=Boolean(policy&&clock(policy.registeredAt)<clock(EVENT_TIME));
  requirements.push({id:'PREDECLARED_RULES',available:prospective,evidenceIds:[],reason:'失效条件必须在事件前登记，不能事后选择阈值。'});
  const gaps=[],ruleChecks=[];
  for(const f of release?.releaseFacts.facts??[]){const candidates=(expectation?.expectationSnapshot?.rows??[]).filter(r=>r.selected&&r.expectationType==='CONSENSUS'&&r.value!==null&&sameSubject(r,f));const r=candidates.length===1?candidates[0]:null;gaps.push({metric:f.metric,period:f.period,unit:f.unit,actual:f.value,expected:r?.value??null,difference:r?decimalDifference(f.value,r.value):null,expectationEvidenceId:expectation?.evidenceId??null,factEvidenceId:release.evidenceId,source:r?.source??null,meaning:r?'相对事前保存的调查预期；不代表交易方向。':'没有口径匹配的事前调查预期，不计算差值。'});}
  for(const r of policy?.rules??[]){const f=release?.releaseFacts.facts.find(f=>sameSubject(f,r));ruleChecks.push({ruleId:r.ruleId,ruleVersion:policy.version,definedAt:policy.registeredAt,effect:r.effect,condition:r.metric+' '+r.operator+' '+r.threshold+' '+r.unit,evidenceIds:f?[release.evidenceId]:[],status:!prospective?'LATE_RULE':!f?'INSUFFICIENT_DATA':comparison(r.operator,dec(f.value),dec(r.threshold))?'TRIGGERED':'NOT_TRIGGERED'});}
  const available=requirements.filter(r=>r.available).length,completeness=available===requirements.length?'COMPLETE':available===0?'INSUFFICIENT':'PARTIAL';
  let thesisState='UNEVALUABLE';
  if(prospective&&ruleChecks.some(r=>r.effect==='INVALIDATE'&&r.status==='TRIGGERED'))thesisState='INVALIDATE';
  else if(prospective&&ruleChecks.some(r=>r.effect==='DEGRADE'&&r.status==='TRIGGERED'))thesisState='DEGRADE';
  else if(completeness==='COMPLETE'&&ruleChecks.every(r=>!['INSUFFICIENT_DATA','LATE_RULE'].includes(r.status))&&ruleChecks.some(r=>r.effect==='SUPPORT'&&r.status==='TRIGGERED'))thesisState='MAINTAIN';
  const blockers=requirements.filter(r=>!r.available).map(r=>r.id+'_UNAVAILABLE');
  const reasons={UNEVALUABLE:'证据不足，暂时无法评估原判断。未登记事前条件或缺少行情，不能解释成维持，也不能解释成失效。',INVALIDATE:'事前登记的失效条件已被当时可用的正式数据触发；见对应规则与证据。',DEGRADE:'事前登记的降级条件已被正式数据触发；其他缺失证据仍单独保留。',MAINTAIN:'事前支持条件得到确认，必需证据完整；尚未触发已登记的降级/失效条件。'};
  return {thesisState,evidenceCompleteness:completeness,requirements,surprises:gaps,ruleChecks,blockers,reason:reasons[thesisState],prospectivePolicy:prospective,evaluatorVersion:EVALUATOR_VERSION};
}
/** Store the issued result plus exact input copies; reading never reruns the evaluator. */
export function saveIssuedAssessment(root,evidence,{now=utc}={}){
  const evidenceCutoffAt=now();clock(evidenceCutoffAt);const selected=evidence.filter(e=>e.evidenceId!=='employment-release-observation-pending'&&clock(e.receivedAt)<=clock(evidenceCutoffAt)&&e.parsedAt!==null&&clock(e.parsedAt)<=clock(evidenceCutoffAt)).map(e=>structuredClone(e));
  const chosen=readAssessmentPolicy(root,evidenceCutoffAt);
  const result=evaluateEventEvidence(selected,chosen,evidenceCutoffAt),generatedAt=now();if(clock(generatedAt)<clock(evidenceCutoffAt))fail('DECISION_CLOCK');
  const decisionId='employment-decision-'+randomUUID();const decision={decisionId,eventId:EVENT_ID,generatedAt,evidenceCutoffAt,inputEvidenceIds:selected.map(e=>e.evidenceId),decisionVersion:'event-decision-v1',ruleVersion:chosen?.version??EVALUATOR_VERSION,generatorType:'RULE_ENGINE',modelVersion:null,triggerEvidenceIds:selected.map(e=>e.evidenceId),triggerEligibleAt:evidenceCutoffAt,processingStartedAt:evidenceCutoffAt,processingCompletedAt:generatedAt,decisionLatencyMs:clock(generatedAt)-clock(evidenceCutoffAt),latencyPolicyVersion:'LEGACY_UNFROZEN',thesisVersion:chosen?.thesisVersion??'NOT_REGISTERED',thesisState:result.thesisState,evidenceCompleteness:result.evidenceCompleteness,reason:result.reason,blockers:result.blockers,
    assessmentDetails:{...result,assessmentTiming:chosen&&clock(chosen.registeredAt)<clock(EVENT_TIME)?'RULES_REGISTERED_PRE_EVENT':'POST_EVENT_ASSESSMENT_NO_PREDECLARED_THESIS',policyRegisteredAt:chosen?.registeredAt??null,eventTime:EVENT_TIME}};
  return put(root,'decisions',decisionId,{decision,policy:chosen?structuredClone(chosen):null,inputEvidence:selected,createdBy:'DETERMINISTIC_EVALUATOR',executionAllowed:false});
}
export function readIssuedAssessments(root,asOf){clock(asOf);return records(root,'decisions').map(r=>{const p=r.payload,d=p.decision;if(p.executionAllowed!==false||d.eventId!==EVENT_ID||clock(d.evidenceCutoffAt)>clock(d.generatedAt)||!Array.isArray(p.inputEvidence)||d.inputEvidenceIds.join('|')!==p.inputEvidence.map(e=>e.evidenceId).join('|'))fail('DECISION_RECORD');for(const e of p.inputEvidence){if(clock(e.receivedAt)>clock(d.evidenceCutoffAt)||e.parsedAt===null||clock(e.parsedAt)>clock(d.evidenceCutoffAt))fail('DECISION_FUTURE_INPUT');}return d;}).filter(d=>clock(d.generatedAt)<=clock(asOf)).sort((a,b)=>a.generatedAt.localeCompare(b.generatedAt)||a.decisionId.localeCompare(b.decisionId));}

/** Restore exactly the evidence copied into issued records, not today's reconstructed replacements. */
export function readIssuedAssessmentInputs(root,asOf){
  const eligible=new Set(readIssuedAssessments(root,asOf).map(d=>d.decisionId)),byId=new Map();
  for(const r of records(root,'decisions'))if(eligible.has(r.payload.decision.decisionId))for(const e of r.payload.inputEvidence){
    const prior=byId.get(e.evidenceId);if(prior&&sha(prior)!==sha(e))fail('FROZEN_INPUT_CONFLICT');byId.set(e.evidenceId,structuredClone(e));
  }
  return [...byId.values()];
}
