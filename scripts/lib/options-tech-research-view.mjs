import fs from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {readTechEventReviews} from './options-tech-candidate.mjs';
import {assessThreeFacet} from '../../src/engines/options-three-facet/OptionsThreeFacet.ts';

const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const choice=(v,list)=>list.includes(v)?v:'UNKNOWN';
const direction=v=>choice(v,['UP','DOWN','NEUTRAL']);
const publicHosts=new Set(['www.sec.gov','sec.gov','www.nasdaq.com','www.invesco.com','www.federalreserve.gov','www.bls.gov','www.reuters.com','apnews.com','kvia.com','www.investing.com','investor.apple.com','www.apple.com','investor.tsmc.com','www.tsmc.com','www.tradingview.com']);
export function publicResearchUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&publicHosts.has(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&researchSummary(decodeURIComponent(u.pathname))!==null?u.href:null;}catch{return null;}}
// Only named research summaries enter the response. Never copy a document body,
// arbitrary extra fields, filesystem references, account material or raw envelopes.
export function researchSummary(value){
 if(typeof value!=='string'||/[\x00-\x08\x0b\x0c\x0e-\x1f]|[A-Za-z]:[\\/]|\\\\|(?:^|\s)\/(?:home|users|tmp|data)\/|data[\\/]runtime|sourcePath|rawPath|(?:file|https?):\/\/|账号|账户|帐户|密码|口令|\b(?:account|acct|password|token|secret|authorization|bearer|api.?key)\b|sk-[\w-]{12,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value))return null;
 const text=value.replace(/\s+/g,' ').trim();return text?text.slice(0,420)+(text.length>420?'…':''):null;
}
const sources=(items,includeEvidenceLocations=false)=>{const rows=items.map(e=>({url:publicResearchUrl(e.source??e.url),publishedAt:clock(e.publishedAt),receivedAt:clock(e.receivedAt),reviewedAt:clock(e.reviewedAt),filingAcceptedAt:clock(e.filingAcceptedAt),...(includeEvidenceLocations?{sourcePath:typeof e.sourcePath==='string'&&/^[a-zA-Z0-9_./-]+$/.test(e.sourcePath)&&!e.sourcePath.startsWith('/')&&!e.sourcePath.split('/').includes('..')?e.sourcePath:null,sha256:/^[a-f0-9]{64}$/.test(e.sha256??'')?e.sha256:null}:{})})),visible=rows.filter(e=>e.url).filter((e,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(e))===i);return {items:visible.slice(0,16),omitted:rows.filter(e=>!e.url).length+Math.max(0,visible.length-16),limit:16};};
const boundary={currentQuoteAdmission:'NOT_EVALUATED',executionAllowed:false,positionSizingAllowed:false,winProbability:null};

export function projectThreeFacetCase(c,{digest,createdAt,at,fixture=false}){
 const i=c?.input;check(i?.version==='THREE_FACET_INPUT_V1'&&/^[A-Z]{1,6}$/.test(i.symbol)&&i.symbol===c.symbol,'INVALID_RESEARCH_INPUT');
 check(clock(createdAt)&&clock(i.asOf)&&Date.parse(i.asOf)<=Date.parse(createdAt)&&Date.parse(createdAt)<=Date.parse(at),'RESEARCH_CLOCK');
 // Reuse the published engine with the original research clock, never with page load time.
 const review=assessThreeFacet(i);check(review.researchStatus!=='INPUT_INVALID','INVALID_RESEARCH_INPUT');
 const ev=[...(i.fundamental?.evidence??[]),...(i.news?.evidence??[]),...(i.technical?.facet?.evidence??[])];
 check(ev.every(e=>clock(e.receivedAt)&&Date.parse(e.receivedAt)<=Date.parse(i.asOf)),'RESEARCH_CLOCK');
 return {...boundary,id:hash(digest+'|'+i.symbol),sourceRef:digest,symbol:i.symbol,context:fixture?'TEST_FIXTURE':'HISTORICAL_ATTRIBUTED_SAMPLE',
  assessedAt:i.asOf,recordedAt:createdAt,sourceCutoff:null,window:{from:clock(i.holdingFrom),through:clock(i.holdingThrough)},
  fundamental:{direction:direction(i.fundamental?.direction),operatingTrend:direction(i.fundamental?.operatingTrend),summary:researchSummary(i.fundamental?.directionRationale)},
  news:{direction:direction(i.news?.direction),summary:researchSummary(i.news?.trigger)},
  technical:{status:review.technical?.status??'NOT_ASSESSED',summary:researchSummary(c.conditionalInterpretation?.observed),measurementDirection:direction(c.measurementLegDirection),currentStructure:choice(c.currentObservedStructure,['PULLBACK_FROM_HIGH','REBOUND_FROM_LOW']),levels:null},
  hypothesis:researchSummary(i.researchPlan?.hypothesis),trial:researchSummary(i.researchPlan?.triggerCondition),confirmation:null,invalidation:researchSummary(i.researchPlan?.invalidationCondition),exit:researchSummary(i.researchPlan?.exitCondition),
  gaps:review.blockers.filter(v=>/^[A-Z][A-Z0-9_]{1,100}$/.test(v)).slice(0,30),nextEvidence:researchSummary(c.conditionalInterpretation?.overturn),
  researchStatus:review.researchStatus,conditionalPlanStatus:review.conditionalPlanStatus,sources:sources(ev),
  authority:'SAVED_INPUT_REEVALUATED_AT_ORIGINAL_CLOCK_NOT_CURRENT_ADMISSION'};
}

export function projectTechResearchView(view,{digest,at,includeEvidenceLocations=false}){
 check(view?.version==='TECH36_EVENT_REVIEW_VIEW_V1'&&['SYNTHETIC_FIXTURE','SAVED_SOURCE_REVIEW'].includes(view.mode)&&clock(view.recordedAt)&&Date.parse(view.recordedAt)<=Date.parse(at)&&Array.isArray(view.inputs?.eventInputs)&&view.inputs.eventInputs.length<=80,'INVALID_RESEARCH_INPUT');
 return view.inputs.eventInputs.slice(0,80).map((e,index)=>{
  check(/^[A-Z]{1,6}$/.test(e.symbol),'INVALID_RESEARCH_INPUT');const i=e.researchInput??{},r=e.savedReview??{},docs=view.inputs.documents.filter(d=>e.documentIds.includes(d.id));
  return {...boundary,id:hash(digest+'|'+index),sourceRef:digest,symbol:e.symbol,context:view.mode==='SYNTHETIC_FIXTURE'?'TEST_FIXTURE':'SAVED_RESEARCH',
   assessedAt:clock(r.reviewedAt),recordedAt:view.recordedAt,sourceCutoff:clock(view.inputs.sourceCutoff),window:null,
   fundamental:{direction:direction(i.fundamental?.direction),operatingTrend:'UNKNOWN',summary:researchSummary(r.interpretation)},
   news:{direction:direction(i.news?.direction),summary:researchSummary(r.eventWindow)},
   technical:{status:'NOT_ASSESSED',summary:null,measurementDirection:'UNKNOWN',currentStructure:'UNKNOWN',levels:null},
   hypothesis:null,trial:researchSummary(i.trialCondition),confirmation:researchSummary(i.confirmationCondition),invalidation:researchSummary(i.invalidationCondition),exit:null,
   gaps:['HOLDING_WINDOW_UNKNOWN','TECHNICAL_EVIDENCE_UNKNOWN','DIRECTIONAL_PLAN_NOT_REGISTERED',...(e.coverageStatus==='UNRESOLVED'?['SOURCE_REVIEW_UNRESOLVED']:[])],nextEvidence:researchSummary(r.nextEvidence),
   researchStatus:choice(i.status,['CITED_MATERIAL_READY_FOR_REVIEW','PARTIAL_INPUT_ORIGINAL_BODY_UNKNOWN']),conditionalPlanStatus:'NOT_REGISTERED',sources:sources(docs,includeEvidenceLocations),
   authority:'SAVED_ATTRIBUTED_RESEARCH_NOT_NEW_FORECAST'};
 });
}

/** Finite local inventory, read-only. No caller-supplied path, recursive search or fetch. */
export function readTechResearchView({root,at,includeEvidenceLocations=false}){
 const out={version:'TECH_RESEARCH_VIEW_V1',records:[],issues:[],sourceCalls:0,fileSystemWrites:0};let budget=0,runs=0;
 const stat=p=>{const s=fs.lstatSync(p);check(!s.isSymbolicLink()&&s.nlink===1&&s.isFile()&&s.size<=12*1024*1024,'UNSAFE_RESEARCH_FILE');return [s.size,s.mtimeMs,s.ctimeMs].join('|');};
 const read=p=>{const before=stat(p),b=fs.readFileSync(p);budget+=b.length;check(budget<=128*1024*1024,'RESEARCH_READ_BOUND');check(stat(p)===before,'RESEARCH_CHANGED');return {data:JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b)),digest:hash(b)};};
 const problem=(path,code)=>out.issues.push({locationRef:hash(path),code:['RESEARCH_CLOCK','RESEARCH_READ_BOUND','RESEARCH_CHANGED','UNSAFE_RESEARCH_FILE','RESEARCH_RUN_BOUND'].includes(code)?code:'INVALID_RESEARCH_INPUT'});
 try{
  check(clock(at),'RESEARCH_CLOCK');let base=fs.realpathSync(root);
  for(const part of ['data','runtime','options-workbench-development']){base=resolve(base,part);if(!fs.existsSync(base))return out;check(fs.lstatSync(base).isDirectory()&&!fs.lstatSync(base).isSymbolicLink()&&fs.realpathSync(base)===base,'UNSAFE_RESEARCH_FILE');}
  const dirs=fs.readdirSync(base,{withFileTypes:true});check(dirs.length<=100,'RESEARCH_RUN_BOUND');
  for(const dir of dirs){if(!dir.isDirectory()&&!dir.isSymbolicLink())continue;const p=resolve(base,dir.name);try{
   check(!dir.isSymbolicLink()&&fs.realpathSync(p)===p,'UNSAFE_RESEARCH_FILE');
   const receipt=resolve(p,'receipt.json');if(fs.existsSync(receipt)){
    const saved=read(receipt);if(saved.data.version==='TECH36_RESEARCH_INPUTS_RECEIPT_V1'){
     check(++runs<=8&&saved.data.runId===dir.name,'RESEARCH_RUN_BOUND');
     // Preflight the exact tree the existing verified reader will consume. Snapshot
     // metadata is checked again after replay, without writing or repairing files.
     const stamps=new Map();let count=0;
     const walk=(q,depth=0)=>{check(depth<=8,'RESEARCH_READ_BOUND');for(const e of fs.readdirSync(q,{withFileTypes:true})){const path=resolve(q,e.name);check(!e.isSymbolicLink()&&fs.realpathSync(path)===path,'UNSAFE_RESEARCH_FILE');if(e.isDirectory())walk(path,depth+1);else{check(++count<=800,'RESEARCH_READ_BOUND');stamps.set(path,stat(path));budget+=fs.statSync(path).size;check(budget<=128*1024*1024,'RESEARCH_READ_BOUND');}}};walk(p);
     const v=readTechEventReviews({root,runId:dir.name,now:()=>at});for(const[path,s]of stamps)check(stat(path)===s,'RESEARCH_CHANGED');
     const projected=projectTechResearchView(v,{digest:v.headSha256,at,includeEvidenceLocations});out.records.push(...projected.map(r=>includeEvidenceLocations?{...r,path:relative(root,p).replaceAll('\\','/')+(v.revisionCount?'/event-reviews/'+String(v.revisionCount).padStart(6,'0')+'/record.json':'/receipt.json')}:r));
    }
   }
   if(/^three-facet-[0-9]{8}$/.test(dir.name))for(const child of fs.readdirSync(p,{withFileTypes:true}).filter(e=>/^five-real-/.test(e.name))){
    const sub=resolve(p,child.name);check(child.isDirectory()&&!child.isSymbolicLink()&&fs.realpathSync(sub)===sub,'UNSAFE_RESEARCH_FILE');const file=resolve(sub,'five-real-results.json');if(!fs.existsSync(file))continue;
    const saved=read(file);check(saved.data.version==='FIVE_REAL_RETROSPECTIVE_RETRACEMENT_SAMPLES_V1'&&Array.isArray(saved.data.cases)&&saved.data.cases.length<=10,'INVALID_RESEARCH_INPUT');
    const rows=saved.data.cases.map(c=>projectThreeFacetCase(c,{digest:saved.digest,createdAt:saved.data.createdAt,at,fixture:saved.data.evidenceContext==='TEST_FIXTURE'}));out.records.push(...rows.map(r=>includeEvidenceLocations?{...r,path:relative(root,file).replaceAll('\\','/')}:r));
   }
  }catch(e){problem(relative(base,p),e.message);}}
 }catch(e){problem('inventory',e.message);}
 out.records.sort((a,b)=>(b.recordedAt??'').localeCompare(a.recordedAt??'')||a.id.localeCompare(b.id));return out;
}
