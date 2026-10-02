import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {strict as a} from 'node:assert';
import {parseEmploymentBody,saveReleaseFacts,readReleaseFactEvidence,evaluateEventEvidence,registerAssessmentPolicy,saveIssuedAssessment,readIssuedAssessments,captureEmploymentRelease,decimalDifference,EVENT_ID,EVENT_TIME,RELEASE_URL,PARSER_VERSION} from './lib/options-event-intelligence-assessment.mjs';
import {PointInTimeReplayEngine} from '../src/engines/event-intelligence-replay/PointInTimeReplayEngine.ts';
import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';
const root=mkdtempSync(join(tmpdir(),'alpha-assessment-'));
const t='2026-10-02T12:31:00.000Z',now=()=>t;
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
// All values below are synthetic program tests, not real market observations.
const body=`Transmission of material is embargoed until 8:30 a.m. (ET) Friday, October 2, 2026
THE EMPLOYMENT SITUATION - SEPTEMBER 2026
Both nonfarm payroll employment (+51,000) and the unemployment rate (4.4 percent) changed little.
Both the unemployment rate, at 4.4 percent, and other measures changed little.
Total nonfarm payroll employment changed little in September (+51,000), following an average gain. (See table B-1.)
In September, average hourly earnings for all employees on private nonfarm payrolls edged up by 7 cents, or 0.2 percent, to $37.00.
Over the past 12 months, average hourly earnings have increased by 3.5 percent.
The change in total nonfarm payroll employment for July was revised down by 15,000, from +10,000 to -5,000, and the change for August was revised down by 10,000, from +120,000 to +110,000.
With these revisions, employment in July and August combined is 25,000 lower than previously reported.`;
const raw=(text=body)=>{const html='<html><pre>'+text+'</pre></html>';return {version:'EMPLOYMENT_RELEASE_RAW_V1',url:RELEASE_URL,status:200,requestedAt:'2026-10-02T12:30:01.000Z',receivedAt:'2026-10-02T12:30:02.000Z',html,sha256:createHash('sha256').update(html).digest('hex'),executionAllowed:false};};
const storeRaw=(r,key='a')=>{const dir='data/runtime/options-event-intelligence/release-inputs';io.directory(root,dir);const path=dir+'/2026-10-02T12-30-02-000Z-'+key.repeat(8)+'.json';io.writeExclusive(root,path,Buffer.from(JSON.stringify(r,null,2)+'\n'));return path;};
const ev=(key,kind,extra={})=>({evidenceId:key,eventId:EVENT_ID,kind,sourceId:'test',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:'2026-10-02T12:20:00.000Z',parsedAt:'2026-10-02T12:20:00.000Z',availability:'CURRENT',summary:'Synthetic test',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null,...extra});
const expect=ev('expectation','EXPECTATION_SNAPSHOT',{expectationSnapshot:{stage:'RESEARCH',ownerConfirmed:false,rows:[{id:'test-consensus',metric:'TOTAL_NONFARM_PAYROLL_CHANGE',period:'2026-09',unit:'THOUSAND_JOBS',adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'MONTHLY_CHANGE',selected:true,expectationType:'CONSENSUS',value:'80',source:'Synthetic survey',sourcePublishedAt:null,sourceReceivedAt:'2026-10-02T12:20:00.000Z',methodology:'Synthetic only',sampleInfo:null}]}});
const pre=ev('pre','PRE_EVENT_STATE');
const market=symbol=>ev(symbol.toLowerCase(),'MARKET_OBSERVATION',{receivedAt:'2026-10-02T12:30:30.000Z',parsedAt:'2026-10-02T12:30:31.000Z',marketObservation:{instrument:symbol,quoteObservedAt:'2026-10-02T12:30:29.000Z',declaredDelayMs:null,session:'PREMARKET',comparability:'COMPARABLE',comparabilityReason:'Synthetic only'}});
let factRecord,all,policy;
const baseRule={ruleId:'support',metric:'TOTAL_NONFARM_PAYROLL_CHANGE',period:'2026-09',unit:'THOUSAND_JOBS',adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'MONTHLY_CHANGE',sourceId:'bls',operator:'LTE',threshold:'60',effect:'SUPPORT'};
try{
await test('body facts and two signed prior-month revisions extracted with locators',()=>{const r=parseEmploymentBody(raw());a.equal(r.facts.length,4);a.equal(r.facts[0].value,'51');a.equal(r.facts[1].value,'4.4');a.equal(r.revisions.length,2);a.equal(r.revisions[0].change,'-15');a.equal(r.revisions[0].previouslyReportedInThisRelease,'10');a.ok(r.facts.every(f=>f.locator.start>=0));a.ok(r.missingMetrics.includes('PRIVATE_PAYROLL_CHANGE'));});
await test('wrong period or release identity rejects instead of reusing the latest page',()=>{a.throws(()=>parseEmploymentBody(raw(body.replace('SEPTEMBER 2026','AUGUST 2026'))),/IDENTITY/);a.throws(()=>parseEmploymentBody({...raw(),url:'https://evil.test/'}),/RAW_RELEASE/);});
await test('same-document conflicting payroll values are rejected',()=>a.throws(()=>parseEmploymentBody(raw(body.replace('September (+51,000)','September (+52,000)'))),/PAYROLL_CONFLICT/));
await test('invalid revision arithmetic and combined revision sum are rejected',()=>{a.throws(()=>parseEmploymentBody(raw(body.replace('from +10,000 to -5,000','from +10,000 to -4,000'))),/REVISION_ARITHMETIC/);a.throws(()=>parseEmploymentBody(raw(body.replace('25,000 lower','24,000 lower'))),/REVISION_TOTAL/);});
await test('missing wage field is null coverage, not an inferred zero',()=>{const r=parseEmploymentBody(raw(body.replace('or 0.2 percent','or an unspecified amount')));a.ok(r.missingMetrics.includes('ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_MOM'));a.equal(r.facts.length,3);});
await test('raw byte hash detects substitution before numerical extraction',()=>a.throws(()=>parseEmploymentBody({...raw(),html:'other'}),/RAW_RELEASE/));
await test('exact decimal arithmetic has no binary residuals',()=>{a.equal(decimalDifference('4.2','4.1'),'0.1');a.equal(decimalDifference('29','90'),'-61');a.equal(decimalDifference('0','0'),'0');});
await test('fixed anonymous archive transport keeps source receipt and durable bytes',async()=>{let called=0;const out=await captureEmploymentRelease(root,{now,fetchImplementation:async(url,opts)=>{called++;a.equal(url,RELEASE_URL);a.equal(opts.redirect,'manual');a.equal(opts.credentials,'omit');return new Response(raw().html,{headers:{'content-type':'text/html'}});}});a.equal(called,1);a.equal(out.status,'RECEIVED');a.equal(out.receivedAt,t);});
await test('transport failure writes an unavailable source, not invented release values',async()=>{const out=await captureEmploymentRelease(root,{now,fetchImplementation:async()=>new Response('no',{status:403})});a.equal(out.status,'FAILED');const r=JSON.parse(readFileSync(join(root,out.path)));a.equal(r.html,null);a.equal(r.sha256,null);});
await test('same raw edition cannot overwrite or refresh the first parse timestamp',()=>{const path=storeRaw(raw());factRecord=saveReleaseFacts(root,path,{now:()=> '2026-10-02T12:30:05.000Z'});const again=saveReleaseFacts(root,path,{now});a.equal(again.alreadyRecorded,true);a.equal(again.payload.evidence.parsedAt,'2026-10-02T12:30:05.000Z');all=[pre,expect,market('GLD'),market('IBIT'),factRecord.payload.evidence];});
await test('future parsed fact and later-issued decision cannot appear in an earlier view',()=>{const engine=new PointInTimeReplayEngine();const c={eventId:EVENT_ID,title:'Synthetic',caseType:'SCHEDULED',createdAt:t,eventTime:EVENT_TIME,evidence:all,historicalDecisions:[],recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:[]};a.equal(engine.replay(c,'2026-10-02T12:30:04.999Z').visibleEvidence.some(e=>e.releaseFacts),false);});
await test('missing original rules is UNEVALUABLE, not MAINTAIN or INVALIDATE',()=>{const r=evaluateEventEvidence(all,null,t);a.equal(r.thesisState,'UNEVALUABLE');a.ok(r.blockers.includes('PREDECLARED_RULES_UNAVAILABLE'));a.equal(r.surprises[0].difference,'-29');});
await test('model forecast cannot masquerade as survey consensus',()=>{const es=structuredClone(all);es[1].expectationSnapshot.rows[0].expectationType='MODEL_ESTIMATE';a.equal(evaluateEventEvidence(es,null,t).surprises[0].expected,null);});
await test('unknown wages expectations preserve actuals without invented gaps',()=>{const r=evaluateEventEvidence(all,null,t);a.equal(r.surprises.find(x=>x.metric.includes('EARNINGS_MOM')).difference,null);});
await test('policy registration owns its actual timestamp and refuses caller backdating',()=>{a.throws(()=>registerAssessmentPolicy(root,{policyId:'bad-clock',thesisVersion:'test-thesis',version:'test-rules-v1',eventId:EVENT_ID,rules:[baseRule],registeredAt:'2026-10-02T12:00:00.000Z'},{now}),/CALLER_POLICY_CLOCK/);policy=registerAssessmentPolicy(root,{policyId:'test-pre-policy',thesisVersion:'test-thesis',version:'test-rules-v1',eventId:EVENT_ID,rules:[baseRule]},{now:()=> '2026-10-02T12:00:00.000Z'}).payload;});
await test('known support plus complete evidence can maintain a predeclared test thesis',()=>{const r=evaluateEventEvidence(all,policy,t);a.equal(r.thesisState,'MAINTAIN');a.equal(r.evidenceCompleteness,'COMPLETE');a.equal(r.ruleChecks[0].status,'TRIGGERED');});
await test('missing/old ETF price cannot silently maintain the test thesis',()=>{const r=evaluateEventEvidence(all.filter(e=>e.evidenceId!=='gld'),policy,t);a.equal(r.thesisState,'UNEVALUABLE');a.ok(r.blockers.includes('GLD_PRICE_UNAVAILABLE'));const es=structuredClone(all);es.find(e=>e.evidenceId==='ibit').marketObservation.quoteObservedAt='2026-10-01T12:30:29.000Z';a.equal(evaluateEventEvidence(es,policy,t).thesisState,'UNEVALUABLE');});
await test('observed predeclared invalidation and degradation have exact evidence links',()=>{for(const effect of ['INVALIDATE','DEGRADE']){const r=evaluateEventEvidence(all,{...policy,rules:[{...baseRule,effect}]},t);a.equal(r.thesisState,effect);a.deepEqual(r.ruleChecks[0].evidenceIds,[factRecord.payload.evidence.evidenceId]);}});
await test('late rule does not retrospectively invalidate this release',()=>{a.equal(evaluateEventEvidence(all,{...policy,registeredAt:t,rules:[{...baseRule,effect:'INVALIDATE'}]},t).thesisState,'UNEVALUABLE');});
await test('unsupported actual metric returns insufficient data, never false invalidation',()=>{a.equal(evaluateEventEvidence(all,{...policy,rules:[{...baseRule,metric:'MISSING',effect:'INVALIDATE'}]},t).thesisState,'UNEVALUABLE');});
await test('issued decisions survive fresh reads without recomputation or source files',()=>{let tick=0;const saved=saveIssuedAssessment(root,all,{now:()=>tick++?'2026-10-02T12:31:00.001Z':t});a.equal(saved.payload.decision.thesisState,'MAINTAIN');a.equal(readIssuedAssessments(root,t).length,0);a.equal(readIssuedAssessments(root,'2026-10-02T12:31:00.002Z')[0].decisionId,saved.payload.decision.decisionId);a.deepEqual(saved.payload.inputEvidence,all);});
await test('changed source version appends a correction and keeps earlier source bytes',()=>{const before=readFileSync(join(root,factRecord.path));const changed=raw(body.replaceAll('51,000','50,000'));const r=saveReleaseFacts(root,storeRaw(changed,'b'),{now:()=> '2026-10-02T12:32:00.000Z'});a.equal(r.payload.evidence.kind,'CORRECTION');a.equal(r.payload.evidence.supersedesEvidenceId,factRecord.payload.evidence.evidenceId);a.ok(readFileSync(join(root,factRecord.path)).equals(before));a.equal(readReleaseFactEvidence(root,t).length,1);});
await test('conflicting unlinked structured editions cannot select a favorable actual',()=>{const twin=structuredClone(factRecord.payload.evidence);twin.evidenceId='conflicting';twin.releaseFacts.facts[0].value='10';const r=evaluateEventEvidence([...all,twin],policy,t);a.equal(r.thesisState,'UNEVALUABLE');a.equal(r.surprises.length,0);});
await test('spoofed source cannot qualify a formal release observation',()=>{const es=structuredClone(all);es.at(-1).sourceId='unverified';a.equal(evaluateEventEvidence(es,policy,t).thesisState,'UNEVALUABLE');});
await test('workflow writes an issued assessment and materializes it for the real Replay API',async()=>{
 const {recordEmploymentAssessment}=await import('./options-event-intelligence-assess.mjs');
 const r=await recordEmploymentAssessment({workspaceRoot:root,rawPath:'data/runtime/options-event-intelligence/release-inputs/2026-10-02T12-30-02-000Z-aaaaaaaa.json',now:()=> '2026-10-02T12:34:00.000Z'});
 a.equal(r.sourceError,null);a.equal(r.executionAllowed,false);
 const c=JSON.parse(readFileSync(join(root,r.materialized.path),'utf8'));
 a.ok(c.historicalDecisions.some(d=>d.decisionId===r.decision.decisionId));
 const replay=new PointInTimeReplayEngine().replay(c,'2026-10-02T12:29:59.999Z');a.equal(replay.visibleHistoricalDecisions.length,0);
});
console.log('Event assessment regression: '+count+'/'+count+' passed. Synthetic only.');
}finally{rmSync(root,{recursive:true,force:true});}
