import fs from 'node:fs';
import {resolve,relative,isAbsolute,sep,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {classifyAndRank} from './options-tech-review-ranking.mjs';
import {assessTechPaperFeasibility} from './options-tech-paper-feasibility.mjs';
import {normalizeTechOptionCapture,validateTechQuoteSelection} from './options-tech-quote-adapter.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {buildTechResearchInputs,extractTechOriginal,techResearchContext} from './options-tech-research-inputs.mjs';

export const TECH36_POOL=Object.freeze('AAPL MSFT GOOGL AMZN META NVDA TSLA AVGO AMD TSM ASML AMAT LRCX KLAC MU ARM QCOM ORCL CRM NOW PANW CRWD ADBE PLTR SNOW SNPS CDNS ANET CSCO VRT DELL HPE STX WDC APH ETN'.split(' '));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=c=>{throw Error('TECH_CANDIDATE_'+c);};
const check=(v,c)=>{if(!v)fail(c);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const json=b=>parseChainSurveyJson(new TextDecoder('utf8',{fatal:true}).decode(b).replace(/^\uFEFF/,''));
const time=s=>{const t=Date.parse(s);check(Number.isFinite(t),'CLOCK');return t;};
function safePath(root,p){check(typeof p==='string'&&!isAbsolute(p),'PATH');const f=resolve(root,p),r=relative(root,f);check(r&&!r.startsWith('..')&&!isAbsolute(r),'PATH');return f;}
function reader(root){
 const base=fs.realpathSync(root),files=new Map();
 const read=p=>{const full=safePath(base,p),s=fs.lstatSync(full);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=12*1024*1024,'FILE');check(fs.realpathSync(full)===full,'PATH');const bytes=fs.readFileSync(full);files.set(p.replaceAll('\\','/'),bytes);check(files.size<=200,'FILE_COUNT');return bytes;};
 return {base,files,read,load:p=>json(read(p))};
}

/** Read-only replay of the existing fixed-pool discovery and retrospective ranking. */
export function loadTechCandidate(sourceRoot,{researchOnly=false}={}){
 const r=reader(sourceRoot),summary=r.load('derived-review-v1.2/summary.json');
 check(/^alpha-tech36-[a-zA-Z0-9-]+$/.test(summary.parentRunId),'RUN_ID');
 const scan='runs/'+summary.parentRunId+'/',policyBytes=r.read(scan+'policy.json'),policy=json(policyBytes);
 check(sha(policyBytes)===r.read(scan+'policy.sha256').toString().trim()&&sha(policyBytes)===summary.parentPolicySha256,'POLICY_HASH');
 check(policy.version==='ALPHA_TECH36_DISCOVERY_V1.1'&&policy.scanId===summary.parentRunId&&same(policy.pool,TECH36_POOL),'FIXED_POOL');
 const rulesBytes=r.read('review-rules-v1.2.json'),rules=json(rulesBytes),inputBytes=r.read('review-input-v1.2.json'),input=json(inputBytes);
 check(rules.version==='TECH36_REVIEW_RULES_V1.2'&&rules.parentRunId===policy.scanId&&rules.originalCutoff===policy.cutoffAt&&rules.maxFocus===5,'RULE_LINEAGE');
 check(sha(rulesBytes)===summary.ruleSha256&&input.ruleSha256===summary.ruleSha256&&sha(inputBytes)===summary.inputSha256&&input.parentRunId===policy.scanId,'REVIEW_HASH');
 check(time(input.createdAt)>=time(rules.frozenAt)&&time(summary.processedAt)>=time(input.createdAt),'REVIEW_CLOCK');
 const eventBytes=r.read(scan+'events.json'),events=json(eventBytes),coverage=r.load(scan+'coverage.json');
 check(sha(eventBytes)===summary.parentEventsSha256&&events.length===summary.originalDiscoveryRecords,'EVENT_HASH');
 check(coverage.length===72&&new Set(coverage.map(c=>c.symbol+'|'+c.sourceId)).size===72&&TECH36_POOL.every(s=>['SEC_SUBMISSIONS','GOOGLE_NEWS_RSS'].every(id=>coverage.some(c=>c.symbol===s&&c.sourceId===id))),'DISCOVERY_COVERAGE');
 const originals=r.load(scan+'originals.json'),receipts=r.load(scan+'http-receipts.json'),supplements=r.load(scan+'verification/receipts.json');
 for(const receipt of [...receipts,...supplements]){
  check(time(receipt.startedAt)>=time(policy.frozenAt)&&time(receipt.receivedAt)>=time(receipt.startedAt),'SOURCE_CLOCK');
  if(receipt.rawPath)check(sha(r.read(scan+receipt.rawPath))===receipt.sha256,'RAW_HASH');
 }
 for(const c of coverage){check(c.attempted===true&&receipts.some(x=>x.rawPath===c.rawPath&&x.sha256===c.sha256&&x.url===c.url),'COVERAGE_RECEIPT');}
 for(const row of input.reviews){check(events.some(e=>e.eventId===row.eventId&&e.symbols.includes(row.symbol)),'EVENT_COMPANY');if(row.originalVerified)check(originals.some(o=>o.eventId===row.eventId&&o.status==='SUCCESS'&&receipts.some(x=>x.rawPath===o.rawPath&&x.sha256===o.sha256)),'ORIGINAL_LINK');}
 const ranked=classifyAndRank(policy.pool,input.reviews,rules.maxFocus),saved=r.load('derived-review-v1.2/candidates.json');
 check(saved.length===36&&same(ranked.map(x=>[x.symbol,x.category,x.eventId??null,x.coreScore,x.dimensions]),saved.map(x=>[x.symbol,x.category,x.eventId??null,x.coreScore,x.dimensions])),'RANK_REPLAY');
 const selected=ranked.find(x=>x.category==='SELECTED');if(!researchOnly)check(selected,'NO_CANDIDATE');
 const batchRoot='verification-batch2-errata-v1/';let batch=null,latest=[],followup=null;
 if(!researchOnly||fs.existsSync(resolve(sourceRoot,batchRoot+'summary.json'))||fs.existsSync(resolve(sourceRoot,batchRoot+'company-coverage-and-candidates.json'))){
 batch=r.load(batchRoot+'summary.json');latest=r.load(batchRoot+'company-coverage-and-candidates.json');
 check(batch.parentRunId===policy.scanId&&batch.errataVersion===1&&latest.length===36&&new Set(latest.map(x=>x.symbol)).size===36&&latest.every(x=>TECH36_POOL.includes(x.symbol)),'FOLLOWUP_LINEAGE');
 followup=latest.find(x=>x.symbol===selected?.symbol)??null;if(!researchOnly)check(followup?.classification==='PRIORITY_RESEARCH'&&batch.priorityResearch.includes(selected.symbol),'FOLLOWUP_CONFLICT');
 for(const receipt of followup?.sourceReceipts??[]){if(receipt.rawPath)check(sha(r.read(batchRoot+receipt.rawPath))===receipt.sha256,'FOLLOWUP_RAW_HASH');}
 }
 const selectedOriginals=[...originals,...supplements].filter(x=>x.eventId===selected?.eventId);
 if(!researchOnly)check(selectedOriginals.some(x=>x.rawPath.startsWith('verification/')&&x.status==='SUCCESS'),'EXHIBIT_REQUIRED');
 const candidate=selected?{...selected,candidateId:policy.scanId+'-'+selected.symbol,rank:1}:null;
 return {files:r.files,lineage:{version:'TECH36_CANDIDATE_LINEAGE_V1',scanId:policy.scanId,scanPolicySha256:sha(policyBytes),rulesSha256:sha(rulesBytes),rulesMode:rules.mode,originalCutoff:policy.cutoffAt,lookbackStart:policy.lookbackStart,pool:policy.pool,coverage,candidate,ranking:ranked.map(x=>({symbol:x.symbol,category:x.category,coreScore:x.coreScore,valuation:x.dimensions.valuation,eventId:x.eventId??null})),originals:selectedOriginals,followup,followupBatch:batch,sourceReceiptCount:receipts.length+supplements.length,completePoolOpportunityScreen:false,excludedEventDoesNotExcludeCompany:true,executionAllowed:false}};
}

/** Original scanner files are sufficient; review/ranking/followup artifacts are optional. */
export function loadTechResearchSource(sourceRoot){
 if(fs.existsSync(resolve(sourceRoot,'derived-review-v1.2/summary.json')))return loadTechCandidate(sourceRoot,{researchOnly:true});
 const r=reader(sourceRoot);let prefix='';
 if(!fs.existsSync(resolve(sourceRoot,'policy.json'))){
  const runs=fs.readdirSync(resolve(sourceRoot,'runs'),{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink());check(runs.length===1,'SCAN_SELECTION');prefix='runs/'+runs[0].name+'/';
 }
 const policyBytes=r.read(prefix+'policy.json'),policy=json(policyBytes),scan='runs/'+policy.scanId+'/';
 check(/^alpha-tech36-[a-zA-Z0-9-]+$/.test(policy.scanId),'RUN_ID');
 check(sha(policyBytes)===r.read(prefix+'policy.sha256').toString().trim(),'POLICY_HASH');
 check(policy.version==='ALPHA_TECH36_DISCOVERY_V1.1'&&same(policy.pool,TECH36_POOL),'FIXED_POOL');
 check(time(policy.lookbackStart)<=time(policy.cutoffAt)&&time(policy.frozenAt)<=time(policy.cutoffAt),'SOURCE_CLOCK');
 const missing=[];const optional=p=>{if(!fs.existsSync(resolve(sourceRoot,prefix+p))){missing.push(p);return [];}const a=r.load(prefix+p);check(Array.isArray(a),'SCAN_SHAPE');return a;};
 const events=optional('events.json'),coverage=optional('coverage.json'),receipts=optional('http-receipts.json'),originals=optional('originals.json'),supplements=optional('verification/receipts.json');
 check(events.length<=10000&&new Set(events.map(e=>e.eventId)).size===events.length,'EVENT_IDENTITY');
 for(const e of events){check(typeof e.eventId==='string'&&e.eventId.length<=160&&Array.isArray(e.symbols)&&e.symbols.length&&new Set(e.symbols).size===e.symbols.length&&e.symbols.every(s=>TECH36_POOL.includes(s)),'EVENT_COMPANY');if(e.publishedAt)check(time(e.publishedAt)<=time(policy.cutoffAt),'EVENT_CLOCK');if(e.receivedAt)time(e.receivedAt);}
 check(coverage.length<=72&&new Set(coverage.map(c=>c.symbol+'|'+c.sourceId)).size===coverage.length,'DISCOVERY_COVERAGE');
 for(const receipt of [...receipts,...supplements]){
  check(time(receipt.startedAt)>=time(policy.frozenAt),'SOURCE_CLOCK');if(receipt.receivedAt)check(time(receipt.receivedAt)>=time(receipt.startedAt),'SOURCE_CLOCK');else check(receipt.attempted===false&&!receipt.rawPath,'SOURCE_CLOCK');
  if(receipt.rawPath)check(sha(r.read(prefix+receipt.rawPath))===receipt.sha256,'RAW_HASH');
 }
 for(const c of coverage){check(TECH36_POOL.includes(c.symbol)&&['SEC_SUBMISSIONS','GOOGLE_NEWS_RSS'].includes(c.sourceId),'DISCOVERY_COVERAGE');if(c.attempted===true)check(receipts.some(x=>x.url===c.url&&x.rawPath===c.rawPath&&x.sha256===c.sha256),'COVERAGE_RECEIPT');else check(c.attempted===false&&c.status!=='SUCCESS','COVERAGE_RECEIPT');}
 for(const o of [...originals,...supplements]){check(events.some(e=>e.eventId===o.eventId&&(!o.symbol||e.symbols.includes(o.symbol))),'ORIGINAL_LINK');if(o.rawPath)check([...receipts,...supplements].some(r=>r.rawPath===o.rawPath&&r.sha256===o.sha256&&r.status===o.status),'ORIGINAL_LINK');}
 const files=new Map([...r.files].map(([p,b])=>[scan+p.slice(prefix.length),b]));
 const ranking=classifyAndRank(TECH36_POOL,[],5).map(x=>({symbol:x.symbol,category:x.category,coreScore:x.coreScore,valuation:x.dimensions.valuation,eventId:null}));
 return {files,lineage:{version:'TECH36_SCAN_RESEARCH_LINEAGE_V1',scanId:policy.scanId,scanPolicySha256:sha(policyBytes),originalCutoff:policy.cutoffAt,lookbackStart:policy.lookbackStart,
  pool:policy.pool,coverage,ranking,candidate:null,followupBatch:null,sourceReceiptCount:receipts.length+supplements.length,missingSavedFiles:missing,
  completePoolOpportunityScreen:false,excludedEventDoesNotExcludeCompany:true,executionAllowed:false}};
}

function runDirectory(root,id,create=false){
 check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(id),'OUTPUT_ID');
 const base=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development');check(fs.realpathSync(base)===base,'OUTPUT_SCOPE');
 const out=resolve(base,id);if(create)fs.mkdirSync(out);check(fs.realpathSync(out)===out&&!fs.lstatSync(out).isSymbolicLink(),'OUTPUT_SCOPE');return out;
}
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
/** Explicit offline derivation: all 36 rows, inherited ranking, cited original text; no plan freeze. */
export function prepareTechResearchInputs({root,sourceRoot,runId,now=()=>new Date().toISOString()}){
 const {files,lineage}=loadTechResearchSource(sourceRoot),at=now(),inputs=buildTechResearchInputs({files,lineage,at});
 const out=runDirectory(root,runId,true),manifest=[];
 for(const [p,b] of files){const target=resolve(out,'source',p);fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx',mode:0o600});manifest.push({path:'source/'+p,sha256:sha(b)});}
 write(out+'/research-inputs.json',inputs);manifest.push({path:'research-inputs.json',sha256:sha(fs.readFileSync(out+'/research-inputs.json'))});
 const receipt={version:'TECH36_RESEARCH_INPUTS_RECEIPT_V1',runId,recordedAt:at,scanId:lineage.scanId,
  implementation:Object.fromEntries(['options-tech-candidate.mjs','options-tech-research-inputs.mjs','options-tech-review-ranking.mjs'].map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))])),
  manifest,screeningTrace:inputs.screeningTrace,sourceReads:0,marketCalls:0,executionAllowed:false,paperAdmissionAllowed:false};
 write(out+'/receipt.json',receipt);return {runPath:out,receiptPath:out+'/receipt.json',...receipt};
}

const rankShape=rows=>rows.map(x=>({symbol:x.symbol,category:x.category,coreScore:x.coreScore,valuation:x.dimensions.valuation,eventId:x.eventId??null}));
function rankEventReviews(pool,reviews){
 const selected=[];
 for(const symbol of pool){
  const options=reviews.filter(r=>r.symbol===symbol).map(r=>({review:r,rank:classifyAndRank([symbol],[r],1)[0]}));
  options.sort((a,b)=>(b.rank.coreScore??-1)-(a.rank.coreScore??-1)||(b.rank.dimensions.evidence??-1)-(a.rank.dimensions.evidence??-1)||(b.rank.dimensions.impact??-1)-(a.rank.dimensions.impact??-1)||a.review.eventId.localeCompare(b.review.eventId));
  if(options.length)selected.push(options[0].review);
 }
 return rankShape(classifyAndRank(pool,selected,5));
}
const exactKeys=(v,keys)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join(),'REVIEW_FIELDS');
const boundedText=(s,max=4000)=>check(typeof s==='string'&&s.length>0&&s.length<=max&&!/[\u0000-\u0008]/.test(s),'REVIEW_TEXT');
function applyEventReview(state,request,evidence,recordedAt){
 exactKeys(request,'version,requestId,parent,symbol,eventId,mode,evidence,review,links');
 check(request.version==='TECH36_EVENT_REVIEW_REQUEST_V1'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(request.requestId),'REVIEW_REQUEST');
 exactKeys(request.parent,'scanId,baseReceiptSha256,revisionSha256');
 check(request.parent.scanId===state.lineage.scanId&&request.parent.baseReceiptSha256===state.baseSha,'REVIEW_PARENT');
 check(request.parent.revisionSha256===state.head,'REVIEW_STALE_PARENT');
 check(time(recordedAt)>=time(state.recordedAt),'REVIEW_CLOCK');
 check(['SAVED_SOURCE_REVIEW','SYNTHETIC_FIXTURE'].includes(request.mode),'REVIEW_MODE');
 check(state.mode!=='SYNTHETIC_FIXTURE'||request.mode==='SYNTHETIC_FIXTURE','REVIEW_MODE');
 const event=state.context.events.find(e=>e.eventId===request.eventId&&e.symbols.includes(request.symbol));check(event,'EVENT_COMPANY');
 check(Array.isArray(request.evidence)&&request.evidence.length<=6&&same(request.evidence,evidence.map(e=>e.metadata)),'REVIEW_EVIDENCE');
 const context=structuredClone(state.context),files=new Map(state.files),priorEvidence=[...context.originals,...context.supplements].filter(e=>e.eventId===event.eventId),changes=[];
 for(let i=0;i<evidence.length;i++){
  const {metadata:m,base64}=evidence[i];exactKeys(m,'rawPath,sha256,url,startedAt,receivedAt,publishedAt,provenance');
  check(['SAVED_PUBLIC_ORIGINAL','NEW_PUBLIC_ORIGINAL','SYNTHETIC_FIXTURE'].includes(m.provenance),'REVIEW_EVIDENCE');
  check(m.provenance!=='SYNTHETIC_FIXTURE'||request.mode==='SYNTHETIC_FIXTURE','REVIEW_MODE');
  check(typeof m.url==='string'&&/^https?:\/\//.test(m.url),'REVIEW_EVIDENCE');
  check(time(m.startedAt)<=time(m.receivedAt)&&time(m.receivedAt)<=time(recordedAt),'REVIEW_SOURCE_CLOCK');
  if(m.publishedAt!==null)check(time(m.publishedAt)<=time(m.receivedAt),'REVIEW_SOURCE_CLOCK');
  const bytes=Buffer.from(base64,'base64');check(bytes.toString('base64')===base64&&bytes.length<=2*1024*1024&&sha(bytes)===m.sha256,'REVIEW_RAW_HASH');
  const rawPath='appended/'+request.requestId+'/'+i+'.html';files.set(context.scan+rawPath,bytes);
  const original={eventId:event.eventId,symbol:request.symbol,status:'SUCCESS',rawPath,sha256:m.sha256,url:m.url,startedAt:m.startedAt,receivedAt:m.receivedAt,publishedAt:m.publishedAt,provenance:m.provenance};
  changes.push({sha256:m.sha256,url:m.url,kind:priorEvidence.some(e=>e.sha256===m.sha256)?'IDENTICAL_BYTES_RETRANSMITTED':priorEvidence.some(e=>e.url===m.url)?'SAME_URL_DIFFERENT_BYTES_REQUIRES_REVIEW':'ADDITIONAL_ORIGINAL'});
  context.supplements.push(original);priorEvidence.push(original);
 }
 exactKeys(request.review,'originalVerified,companyEventVerified,materialityReviewed,materialConflict,dimensions,fact,analysis,nextEvidence,eventWindow,citations');
 for(const k of ['originalVerified','companyEventVerified','materialityReviewed','materialConflict'])check(typeof request.review[k]==='boolean','REVIEW_FIELDS');
 exactKeys(request.review.dimensions,'impact,valuation,catalyst,evidence');
 for(const [key,max] of Object.entries({impact:3,valuation:2,catalyst:2,evidence:3}))check(request.review.dimensions[key]===null&&key==='valuation'||Number.isInteger(request.review.dimensions[key])&&request.review.dimensions[key]>=0&&request.review.dimensions[key]<=max,'REVIEW_SCORE');
 for(const k of ['fact','analysis','nextEvidence'])boundedText(request.review[k]);if(request.review.eventWindow!==null)boundedText(request.review.eventWindow);
 check(Array.isArray(request.review.citations)&&request.review.citations.length<=20,'REVIEW_CITATIONS');
 for(const citation of request.review.citations){
  exactKeys(citation,'sha256,blockIndex');const original=[...context.originals,...context.supplements].find(e=>e.eventId===event.eventId&&e.status==='SUCCESS'&&e.sha256===citation.sha256),bytes=original&&files.get(context.scan+original.rawPath);check(bytes&&sha(bytes)===citation.sha256,'REVIEW_CITATIONS');
  let body;try{body=extractTechOriginal(bytes);}catch{fail('REVIEW_CITATIONS');}check(Number.isInteger(citation.blockIndex)&&body.blocks.some(b=>b.index===citation.blockIndex),'REVIEW_CITATIONS');
 }
 if(request.review.originalVerified||request.review.companyEventVerified||request.review.materialityReviewed)check(request.review.citations.length>0,'REVIEW_ORIGINAL_REQUIRED');
 const review={...request.review,symbol:request.symbol,eventId:event.eventId,reviewedAt:recordedAt,reviewAuthority:'ATTRIBUTED_EVENT_REVIEW_NOT_MACHINE_AUTHENTICATION'};
 check(Array.isArray(request.links)&&request.links.length<=20&&new Set(request.links.map(l=>l.eventId)).size===request.links.length,'REVIEW_LINKS');
 for(const link of request.links){exactKeys(link,'eventId,relationship,verifiedScope');check(link.eventId!==event.eventId&&context.events.some(e=>e.eventId===link.eventId&&e.symbols.includes(request.symbol)),'REVIEW_LINKS');boundedText(link.relationship,200);boundedText(link.verifiedScope);check(request.review.citations.length>0,'REVIEW_ORIGINAL_REQUIRED');}
 context.input.reviews=context.input.reviews.filter(r=>r.eventId!==event.eventId||r.symbol!==request.symbol).concat(review);
 context.input.clusters=(context.input.clusters??[]).filter(c=>c.canonicalEventId!==event.eventId||c.symbol!==request.symbol).concat({canonicalEventId:event.eventId,symbol:request.symbol,linkedDiscoveryRecords:request.links.map(l=>({id:l.eventId,relationship:l.relationship,verifiedScope:l.verifiedScope,notIndependentOpportunity:true}))});
 const ranking=rankEventReviews(state.lineage.pool,context.input.reviews),rankingChanges=[];
 for(const after of ranking){const before=state.lineage.ranking.find(r=>r.symbol===after.symbol),oldRank=state.lineage.ranking.findIndex(r=>r.symbol===after.symbol)+1,newRank=ranking.indexOf(after)+1;
  if(!same(before,after)||oldRank!==newRank)rankingChanges.push({symbol:after.symbol,before,after,oldRank,newRank,reason:after.symbol===request.symbol?'APPENDED_EVENT_REVIEW_USING_EXISTING_CLASSIFY_AND_RANK':'RELATIVE_ORDER_OR_FOCUS_CHANGED_BY_APPENDED_REVIEW'});
 }
 return {context,files,lineage:{...state.lineage,ranking},recordedAt,mode:request.mode==='SYNTHETIC_FIXTURE'?'SYNTHETIC_FIXTURE':state.mode,ranking,rankingChanges,evidenceChanges:changes};
}

/** Ordered, hash-linked local event reviews; base source and prior records never change. */
function readEventReviewState(root,runId){
 const out=runDirectory(root,runId),r=reader(out),baseBytes=r.read('receipt.json'),base=json(baseBytes),baseSha=sha(baseBytes);
 check(base.version==='TECH36_RESEARCH_INPUTS_RECEIPT_V1'&&base.runId===runId,'REVIEW_BASE');
 for(const m of base.manifest)check(sha(r.read(m.path))===m.sha256,'PREPARED_HASH');
 const loaded=loadTechResearchSource(out+'/source');check(loaded.lineage.scanId===base.scanId,'REVIEW_PARENT');
 const sourceManifest=new Map(base.manifest.filter(m=>m.path.startsWith('source/')).map(m=>[m.path.slice(7),m.sha256]));
 check(sourceManifest.size===loaded.files.size&&[...loaded.files].every(([p,b])=>sourceManifest.get(p)===sha(b)),'REVIEW_BASE_SOURCE_SET');
 let state={...loaded,out,base,baseSha,head:baseSha,context:techResearchContext(loaded),recordedAt:base.recordedAt,mode:'SAVED_SOURCE_REVIEW',records:[],baseRanking:loaded.lineage.ranking};
 const dir=resolve(out,'event-reviews');
 if(fs.existsSync(dir)){
  check(!fs.lstatSync(dir).isSymbolicLink()&&fs.realpathSync(dir)===dir,'PATH');
  const names=fs.readdirSync(dir).filter(n=>!n.startsWith('.pending-')).sort();check(names.length<=64&&names.every((n,i)=>n===String(i+1).padStart(6,'0')),'REVIEW_SEQUENCE');
  for(const name of names){
   const record=r.load('event-reviews/'+name+'/record.json'),{fingerprint,...payload}=record;check(record.version==='TECH36_EVENT_REVIEW_RECORD_V1'&&sha(JSON.stringify(payload))===fingerprint,'REVIEW_RECORD_HASH');
   check(record.sequence===state.records.length+1&&record.baseReceiptSha256===baseSha&&record.requestSha256===sha(record.requestUtf8),'REVIEW_RECORD_HASH');
   const request=json(Buffer.from(record.requestUtf8));check(!state.records.some(r=>r.requestId===request.requestId)&&record.requestId===request.requestId,'REVIEW_REQUEST');
   const next=applyEventReview(state,request,record.evidence,record.recordedAt);check(same(next.ranking,record.ranking)&&same(next.rankingChanges,record.rankingChanges)&&same(next.evidenceChanges,record.evidenceChanges),'RANK_REPLAY');
   state={...state,...next,head:fingerprint,records:state.records.concat(record)};
  }
 }
 return state;
}
export function readTechEventReviews({root,runId,now=()=>new Date().toISOString()}){
 const state=readEventReviewState(root,runId),at=now();check(time(at)>=time(state.recordedAt),'REVIEW_CLOCK');
 const inputs=buildTechResearchInputs({...state,at});inputs.version='TECH36_RESEARCH_INPUTS_V2';inputs.mode=state.mode==='SYNTHETIC_FIXTURE'?'SYNTHETIC_APPEND_DEMO_ON_SAVED_BATCH':'SAVED_ORIGINAL_AND_APPEND_REPLAY';
 inputs.screeningTrace.rankingChanged=!same(state.baseRanking,state.lineage.ranking);
 return {version:'TECH36_EVENT_REVIEW_VIEW_V1',runId,scanId:state.lineage.scanId,baseReceiptSha256:state.baseSha,headSha256:state.head,recordedAt:state.recordedAt,
  revisionCount:state.records.length,mode:state.mode,baseRanking:state.baseRanking,rankingChanges:state.records.map(r=>({revisionSha256:r.fingerprint,recordedAt:r.recordedAt,requestId:r.requestId,changes:r.rankingChanges})),inputs};
}
export function appendTechEventReview({root,runId,requestPath,now=()=>new Date().toISOString()}){
 const source=reader(dirname(resolve(requestPath))),requestBytes=source.read(relative(source.base,resolve(requestPath))),request=json(requestBytes),requestSha256=sha(requestBytes),state=readEventReviewState(root,runId);
 const recordedAt=now();check(time(recordedAt)>=time(state.recordedAt),'REVIEW_CLOCK');
 const existing=state.records.find(r=>r.requestId===request.requestId);
 if(existing){check(existing.requestSha256===requestSha256,'REVIEW_IDEMPOTENCY_CONFLICT');for(const e of existing.evidence)check(sha(source.read(e.metadata.rawPath))===e.metadata.sha256,'REVIEW_RAW_HASH');return {alreadyRecorded:true,revision:existing};}
 check(state.records.length<64,'REVIEW_LIMIT');check(Array.isArray(request.evidence)&&request.evidence.length<=6,'REVIEW_EVIDENCE');
 const evidence=request.evidence.map(metadata=>({metadata,base64:source.read(metadata.rawPath).toString('base64')})),next=applyEventReview(state,request,evidence,recordedAt);
 const payload={version:'TECH36_EVENT_REVIEW_RECORD_V1',sequence:state.records.length+1,baseReceiptSha256:state.baseSha,requestId:request.requestId,requestSha256,requestUtf8:requestBytes.toString('utf8'),recordedAt,evidence,
  implementation:Object.fromEntries(['options-tech-candidate.mjs','options-tech-research-inputs.mjs','options-tech-review-ranking.mjs'].map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))])),
  ranking:next.ranking,rankingChanges:next.rankingChanges,evidenceChanges:next.evidenceChanges};
 const record={...payload,fingerprint:sha(JSON.stringify(payload))},bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');check(bytes.length<=12*1024*1024,'REVIEW_LIMIT');
 const dir=resolve(state.out,'event-reviews');fs.mkdirSync(dir,{recursive:true});check(!fs.lstatSync(dir).isSymbolicLink()&&fs.realpathSync(dir)===dir,'PATH');
 const temp=resolve(dir,'.pending-'+randomUUID()),target=resolve(dir,String(record.sequence).padStart(6,'0'));fs.mkdirSync(temp);
 try{
  const fd=fs.openSync(resolve(temp,'record.json'),'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{fs.renameSync(temp,target);}catch(e){if(!fs.existsSync(target))throw e;const winner=readEventReviewState(root,runId).records.find(r=>r.sequence===record.sequence);check(winner?.requestSha256===requestSha256,'REVIEW_STALE_PARENT');return {alreadyRecorded:true,revision:winner};}
 }finally{if(fs.existsSync(temp)){const file=resolve(temp,'record.json');if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(temp);}}
 return {alreadyRecorded:false,revision:record};
}
export function prepareTechCandidate({root,sourceRoot,researchPath,runId,now=()=>new Date().toISOString()}){
 const {files,lineage}=loadTechCandidate(sourceRoot),r=reader(dirname(resolve(researchPath))),bytes=r.read(relative(r.base,resolve(researchPath))),research=json(bytes),at=now();
 check(research.parentRunId===lineage.scanId&&research.candidateId===lineage.candidate.candidateId&&research.eventId===lineage.candidate.eventId&&research.threeFacet?.symbol===lineage.candidate.symbol,'RESEARCH_LINK');
 check(time(research.threeFacet.asOf)<=time(at)&&time(research.threeFacet.researchPlan?.registeredAt)<=time(at),'RESEARCH_CLOCK');
 check(research.threeFacet.researchPlan.sourceIds.includes(lineage.candidate.eventId),'RESEARCH_EVENT');
 check(assessTechPaperFeasibility({research:research.threeFacet,at}).research.status==='RETAINED_UNVALIDATED','RESEARCH_SCHEMA');
 validateTechQuoteSelection(research.quoteSelection);check(research.quoteSelection.symbol===lineage.candidate.symbol,'SELECTION_SYMBOL');
 check(research.windows?.optionExpiry===research.quoteSelection.expiry&&time(research.windows.sixMonthOutlookEnd)>time(research.windows.sixMonthOutlookStart),'WINDOWS');
 const out=runDirectory(root,runId,true),manifest=[];
 for(const [p,b] of files){const target=resolve(out,'source',p);fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx',mode:0o600});manifest.push({path:'source/'+p,sha256:sha(b)});}
 fs.writeFileSync(out+'/research.json',bytes,{flag:'wx',mode:0o600});manifest.push({path:'research.json',sha256:sha(bytes)});
 write(out+'/lineage.json',lineage);manifest.push({path:'lineage.json',sha256:sha(fs.readFileSync(out+'/lineage.json'))});
 const prepared={version:'TECH36_CANDIDATE_PREPARED_V1',runId,preparedAt:at,candidateId:lineage.candidate.candidateId,symbol:lineage.candidate.symbol,manifest,sourceAuthority:'COPIED_ORIGINALS_AND_ATTRIBUTED_REVIEW_NOT_MACHINE_AUTHENTICATION',executionAllowed:false};
 write(out+'/prepared.json',prepared);return {prepared,runPath:out};
}

/** Missing account evidence is a local admission blocker, never a company-direction verdict. */
export function assessCandidateInputs({prepared,lineage,research,quoteReceipt=null,evidence=null,at}){
 check(prepared.symbol===research.threeFacet?.symbol&&prepared.candidateId===research.candidateId&&lineage.candidate.candidateId===prepared.candidateId,'ASSESSMENT_IDENTITY');
 if(evidence){check(evidence.symbol===prepared.symbol&&time(evidence.decisionAt)>=time(prepared.preparedAt),'ACCOUNT_EVIDENCE_BINDING');}
 const base=assessTechPaperFeasibility({research:research.threeFacet,evidence,at});
 let quotes=null;const quoteBlockers=[];
 if(quoteReceipt){
  const c=quoteReceipt.capture;
  check(quoteReceipt.version==='TECH_QUOTES_RECEIPT_V1'&&c?.origin==='HOST_MARKET_TOOL_RESPONSES'&&sha(JSON.stringify(c))===quoteReceipt.captureSha256,'QUOTE_INTEGRITY');
  check(same(c.selection,research.quoteSelection)&&same(quoteReceipt.intent?.selection,research.quoteSelection)&&time(c.startedAt)>=time(quoteReceipt.intent.requestedAt),'QUOTE_BINDING');
  if(time(c.startedAt)<time(prepared.preparedAt)||time(quoteReceipt.intent.requestedAt)<time(prepared.preparedAt))quoteBlockers.push('CAPTURE_BEFORE_RESEARCH_PREPARATION_REPLAY_ONLY');
  quotes=normalizeTechOptionCapture(c,at);
  if(evidence){const supplied=evidence.records?.find(x=>x.kind==='QUOTE');check(supplied&&quotes.quotes.some(x=>x.snapshot&&same(json(Buffer.from(supplied.rawJson)),x.snapshot)),'ACCOUNT_QUOTE_BINDING');}
  if(!quotes.quotes?.length)quoteBlockers.push('EXACT_OPTION_QUOTE_MISSING');
  for(const q of quotes.quotes??[]){quoteBlockers.push(...q.blockers);if(!q.snapshot?.updatedAt||snapshotNs(q.snapshot.updatedAt)<=snapshotNs(research.threeFacet.researchPlan.registeredAt))quoteBlockers.push('QUOTE_NOT_AFTER_RESEARCH');}
 }else quoteBlockers.push('QUOTE_NOT_SUPPLIED');
 const session=paperSession(at,quotes?.quotes?.[0]?.snapshot?.chainSession);
 if(!session.isOpen)quoteBlockers.push('ASSESSMENT_OUTSIDE_SESSION');
 const accountChecks=Object.fromEntries(['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(kind=>{
  const record=evidence?.records?.find(x=>x.kind===kind);
  return [kind,{status:record?(base.feasibilityPassed?'ATTRIBUTED_REVIEW_PASSED':'UNQUALIFIED_EVIDENCE'):'UNKNOWN',blocker:record?null:kind+'_UNKNOWN',affects:'PAPER_ADMISSION_ONLY',directionInferenceAllowed:false}];
 }));
 return {version:'TECH36_CANDIDATE_ASSESSMENT_V1',assessedAt:at,scanId:lineage.scanId,candidateId:prepared.candidateId,eventId:lineage.candidate.eventId,symbol:prepared.symbol,
  validationMode:session.isOpen?'SAVED_SOURCE_ASSESSMENT_NO_LIFECYCLE':'CLOSED_SESSION_SAVED_SOURCE_REPLAY',
  research:{status:'CONTINUE_EVENT_RESEARCH',direction:base.research.direction,ranking:lineage.candidate.rank,coreScore:lineage.candidate.coreScore,conditions:research.threeFacet.researchPlan,windows:research.windows,engine:base.research,accountUnknownDoesNotRejectDirection:true},
  quote:{status:quoteBlockers.length?'NOT_ADMISSIBLE':'SNAPSHOT_ONLY',blockers:[...new Set(quoteBlockers)],normalized:quotes,session,spreadPolicy:'INHERITED_GLD_IBIT_ENGINEERING_REFERENCE_TECH_APPLICABILITY_UNAPPROVED'},
  accountChecks,productChecks:{contractIdentity:quotes?.quotes?.length?'SOURCE_MAPPED_ONLY':'UNKNOWN',deliverable:'UNKNOWN_UNLESS_EXISTING_FEASIBILITY_PASSES',fees:evidence?'SEE_EXISTING_FEASIBILITY':'UNKNOWN',hedgeComparison:'UNKNOWN_NO_OPTION_RECOMMENDATION'},existingFeasibility:base,
  admission:{status:'NOT_ADMITTED',paperAdmissionAllowed:false,executionAllowed:false,fills:0,pnl:null,blockers:[...new Set(['TECH_SYMBOL_LIFECYCLE_NOT_INTEGRATED',...quoteBlockers,...Object.values(accountChecks).flatMap(x=>x.blocker?[x.blocker]:[]),...base.blockers,...base.research.blockers])]},
  limitations:['Historical scan and retrospective ranking are preserved; this is not a new full-pool scan.','Only the selected event is qualified for research; other company events remain unresolved.','No market-timing, account authentication, hedge cost or completed Paper lifecycle is established.']};
}
export function assessTechCandidate({root,runId,quotePath=null,evidencePath=null,now=()=>new Date().toISOString()}){
 const out=runDirectory(root,runId),r=reader(out),prepared=r.load('prepared.json');
 check(prepared.version==='TECH36_CANDIDATE_PREPARED_V1'&&prepared.runId===runId&&prepared.manifest.length<=200,'PREPARED');
 for(const f of prepared.manifest)check(sha(r.read(f.path))===f.sha256,'PREPARED_HASH');
 const research=r.load('research.json'),lineage=r.load('lineage.json');
 const replay=loadTechCandidate(out+'/source');check(same(replay.lineage,lineage),'LINEAGE_REPLAY');
 const external=p=>{if(!p)return null;const a=reader(dirname(resolve(p))),b=a.read(relative(a.base,resolve(p)));return {sha256:sha(b),utf8:b.toString('utf8'),data:json(b)};};
 const quote=external(quotePath),evidence=external(evidencePath),at=now();check(time(at)>=time(prepared.preparedAt),'ASSESSMENT_CLOCK');
 const assessment=assessCandidateInputs({prepared,lineage,research,quoteReceipt:quote?.data,evidence:evidence?.data,at});
 const implementation=Object.fromEntries(['options-tech-candidate.mjs','options-tech-review-ranking.mjs','options-tech-paper-feasibility.mjs','options-tech-quote-adapter.mjs'].map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))]));
 const receipt={version:'TECH36_CANDIDATE_RECEIPT_V1',preparedSha256:sha(r.read('prepared.json')),recordedAt:at,implementation,inputs:{quote,evidence},assessment};
 const receiptPath=out+'/assessment-'+at.replace(/[:.]/g,'-')+'.json';write(receiptPath,receipt);
 return {receiptPath,assessment};
}
