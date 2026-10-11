import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSourceRecord,saveSourceRecord,sourceRecordFiles} from './options-source-comparison.mjs';
import {scenarioPlanContexts} from './options-scenario-research.mjs';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {assessCourseFramework,courseInputFromPlan,COURSE_FRAMEWORK_VERSION,COURSE_CATALOG_VERSION} from '../../apps/options-workbench/course-framework.mjs';
const BASE='data/runtime/options-macro-comparisons/',VERSION='OPTIONS_COURSE_RESEARCH_ARCHIVE_V1';
const fields=new Set(['direction','structure','magnitude','ivHistoryRef','realizedVolRef','ivComparisonReview','ivHypothesis','rationale','alternative','counterexample','entry','priceExit','ownerPolicyRef','planAssumptionsRef','positionsRef','greeksRef']);
const check=(v,c)=>{if(!v)throw Error('WORKBENCH_COURSE_'+c);};
const exact=(v,keys)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join(),'FIELDS');
const pathFor=id=>BASE+'source-course-'+id+'.json';
function request(r){
 exact(r,'id,planKey,planVersion,declarations');check(/^[a-z0-9][a-z0-9-]{2,79}$/.test(r.id),'ID');
 for(const k of ['planKey','planVersion'])check(typeof r[k]==='string'&&r[k].length>0&&r[k].length<=160,'PLAN_REFERENCE');
 check(r.declarations&&typeof r.declarations==='object'&&!Array.isArray(r.declarations),'DECLARATIONS');
 check(Object.entries(r.declarations).every(([k,v])=>fields.has(k)&&typeof v==='string'&&v.length<=1000&&!/[\u0000-\u001f]/.test(v))&&Buffer.byteLength(JSON.stringify(r.declarations))<=3000,'DECLARATIONS');
}
function payload(root,ledgerId,r,at,report=null){
 request(r);ns(at);const p=scenarioPlanContexts(report??readManualLedger(root,ledgerId,()=>at).report).find(p=>p.key===r.planKey&&p.version===r.planVersion);
 check(p&&ns(p.registeredAt)<=ns(at),'PLAN_VERSION_UNAVAILABLE');
 const f=p.kind==='DRAFT'?p.fields:{thesis:p.plan.thesis,timeExitAt:p.plan.timeExitAt,expiry:p.contract?.expiry,symbol:p.contract?.symbol};
 const input=JSON.parse(JSON.stringify(courseInputFromPlan(f,p.plan.invalidation,r.declarations))),assessment=assessCourseFramework(input);
 return {version:VERSION,frameworkVersion:COURSE_FRAMEWORK_VERSION,catalogVersion:COURSE_CATALOG_VERSION,ledgerId,request:structuredClone(r),planId:p.tradeId,
  planReference:{key:p.key,version:p.version,kind:p.kind,registeredAt:p.registeredAt},input,assessment,
  timing:'SAVED_SUPPLEMENT_NOT_PROOF_OF_PRE_ENTRY_DECLARATION',authority:'OWNER_DECLARATIONS_NOT_AUTHENTICATED',executionAllowed:false,fillsCreated:0,pnl:null};
}
export function previewCourseResearch(root,ledgerId,r,at){const p=payload(root,ledgerId,r,at);return {payload:p,assessment:p.assessment,previewFingerprint:fp(p),executionAllowed:false};}
export function verifyCourseResearch(root,path,ledgerId,at,report=null){
 const r=readSourceRecord(root,path);check(r.kind==='course'&&r.payload.version===VERSION&&r.payload.ledgerId===ledgerId&&r.id===r.payload.request.id&&ns(r.savedAt)<=ns(at),'INTEGRITY');
 check(fp(r.payload)===fp(payload(root,ledgerId,r.payload.request,r.savedAt,report??readManualLedger(root,ledgerId,()=>at).report)),'REFERENCE_OR_ASSESSMENT_CHANGED');return r;
}
export function saveCourseResearch(root,ledgerId,r,previewFingerprint,ownerConfirmed,at){
 request(r);check(ownerConfirmed===true,'CONFIRMATION_REQUIRED');
 if(existsSync(resolve(root,pathFor(r.id)))){const old=verifyCourseResearch(root,pathFor(r.id),ledgerId,at);check(fp(old.payload.request)===fp(r)&&fp(old.payload)===previewFingerprint,'RETRY_CHANGED');return {...old,alreadyRecorded:true};}
 const p=previewCourseResearch(root,ledgerId,r,at);check(p.previewFingerprint===previewFingerprint,'PREVIEW_CHANGED');
 saveSourceRecord(root,'course',r.id,p.payload,at);return verifyCourseResearch(root,pathFor(r.id),ledgerId,at);
}
export function courseResearchView(root,ledgerId,report,at){
 const records=[],errors=[];
 for(const name of sourceRecordFiles(root).filter(n=>n.startsWith('source-course-'))){const path=BASE+name;try{const r=readSourceRecord(root,path);if(r.payload.ledgerId===ledgerId&&ns(r.savedAt)<=ns(at))records.push(verifyCourseResearch(root,path,ledgerId,at,report));}catch{errors.push({path,status:'UNAVAILABLE_REFERENCE_OR_RECORD'});}}
 return {version:VERSION,records,errors,plans:scenarioPlanContexts(report).map(p=>({key:p.key,version:p.version,tradeId:p.tradeId,kind:p.kind,registeredAt:p.registeredAt})),sourceCalls:0,executionAllowed:false};
}
