import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {readFocusedSupplement,verifyFocusedNews} from './options-focused-news-io.mjs';
import {withDriverJournal} from './options-driver-io.mjs';
import {readSourceRecord} from './options-source-comparison.mjs';
import {readWorldModel} from './macro-world-model.mjs';
import {STORY_CHANGES,STORY_LIMITATIONS} from '../../apps/options-workbench/storyline-model.js';

// References only: not another news database or a trading-evidence store.
const BASE='data/runtime/options-storyline-links',MAX=16384,LIMIT=500;
const fail=c=>{throw Error('MACRO_STORYLINE_'+c);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.split(',').sort().join())fail('FIELDS');};
const text=(v,max=1200)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('TEXT');return v;};
const id=v=>{if(typeof v!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(v))fail('ID');return v;};
const hash=v=>{if(typeof v!=='string'||!/^sha256:[a-f0-9]{64}$/.test(v))fail('FINGERPRINT');return v;};
const time=v=>{try{return snapshotNs(v);}catch{fail('CLOCK');}};
const array=(v,max)=>{if(!Array.isArray(v)||v.length>max||new Set(v).size!==v.length)fail('BOUND');return v;};
const pathFor=k=>BASE+'/'+id(k)+'.json';
function files(root){
  let p=root;for(const s of BASE.split('/')){p=resolve(p,s);if(!existsSync(p))return [];const st=lstatSync(p);if(!st.isDirectory()||st.isSymbolicLink())fail('DIRECTORY');}
  const entries=readdirSync(p,{withFileTypes:true});if(entries.length>LIMIT||entries.some(e=>!e.isFile()||e.isSymbolicLink()||!/^[-a-z0-9]+\.json$/.test(e.name)))fail('CATALOG');
  return entries.map(e=>BASE+'/'+e.name);
}
function validateRef(r){exact(r,'kind,path,itemId,sourceId,recordFingerprint');text(r.path,300);text(r.itemId,1024);text(r.sourceId,160);hash(r.recordFingerprint);if(!['FOCUSED_NEWS','SOURCE_PACKAGE','DRIVER_JOURNAL'].includes(r.kind))fail('SOURCE_KIND');}
function projectMaterial(item,ref){
  const packaged=ref.kind==='SOURCE_PACKAGE';
  return {key:fp(ref).slice(7),newsRef:ref,newsId:packaged?item.id:item.itemId,newsFingerprint:fp(item),newsSource:packaged?item.source:item.sourceId,
    publishedAt:item.publishedAt,receivedAt:packaged?item.receivedAt:item.observedAt,coverageType:packaged?item.coverage:'HEADLINE_ONLY',
    title:packaged?item.title:item.headline,text:packaged?item.text:item.headline,url:packaged?item.url:item.link};
}
export function resolveStorylineNews(root,ref,at){
  validateRef(ref);let item;
  if(ref.kind==='FOCUSED_NEWS'){
    const r=verifyFocusedNews(root,ref.path);if(r.fingerprint!==ref.recordFingerprint||time(r.batch.recordedAt)>time(at))fail('NEWS_FINGERPRINT_MISMATCH');
    item=r.batch.sources.flatMap(s=>s.items).find(i=>i.sourceId===ref.sourceId&&i.itemId===ref.itemId);
  }else if(ref.kind==='SOURCE_PACKAGE'){
    const r=readSourceRecord(root,ref.path);if(r.kind!=='package'||r.fingerprint!==ref.recordFingerprint||time(r.savedAt)>time(at))fail('NEWS_FINGERPRINT_MISMATCH');
    item=r.payload.materials.find(i=>i.id===ref.itemId&&i.source===ref.sourceId);
  }else{
    if(ref.path!=='data/runtime/options-driver-monitor/refreshes.ndjson')fail('PATH');
    // Exact append-only observation, not the latest item with the same headline.
    item=withDriverJournal(root,s=>s.observations.find(i=>i.itemId===ref.itemId&&i.sourceId===ref.sourceId&&fp(i)===ref.recordFingerprint));
  }
  if(!item)fail('NEWS_UNAVAILABLE');const n=projectMaterial(item,ref);
  if(time(n.receivedAt)>time(at))fail('NEWS_NOT_YET_AVAILABLE');
  if(n.publishedAt!==null)time(n.publishedAt);
  return n;
}
export function storylineNewsCatalog(root,state,at){
  const rows=[],errors=[];
  try{for(const r of readFocusedSupplement(root,at,true).references)rows.push(projectMaterial(r.item,{kind:'FOCUSED_NEWS',path:r.path,itemId:r.item.itemId,sourceId:r.item.sourceId,recordFingerprint:r.recordFingerprint}));}catch{errors.push('FOCUSED_NEWS_UNAVAILABLE');}
  for(const i of state.headlines?.data?.headlines??[])rows.push(projectMaterial(i,{kind:'DRIVER_JOURNAL',path:'data/runtime/options-driver-monitor/refreshes.ndjson',itemId:i.itemId,sourceId:i.sourceId,recordFingerprint:fp(i)}));
  for(const r of state.sourceComparisons?.data?.records??[])if(r.kind==='package')for(const m of r.payload.materials)rows.push(projectMaterial(m,{kind:'SOURCE_PACKAGE',path:r.path,itemId:m.id,sourceId:m.source,recordFingerprint:r.fingerprint}));
  const sorted=rows.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)||a.key.localeCompare(b.key));
  return {news:sorted.slice(0,500),omittedNews:Math.max(0,sorted.length-500),errors};
}
function requestCheck(r){
  exact(r,'linkId,newsRef,newsFingerprint,themes,knowledgeIds,reviewedBy,humanConfirmed,linkReason,storyChangeType,limitations,supersedes');
  id(r.linkId);validateRef(r.newsRef);hash(r.newsFingerprint);array(r.themes,5).forEach(x=>text(x,10));array(r.knowledgeIds,20).forEach(x=>text(x,180));
  exact(r.reviewedBy,'kind,name');if(!['OWNER','HUMAN_REVIEWER'].includes(r.reviewedBy.kind)||!text(r.reviewedBy.name,100).trim())fail('REVIEWER');
  if(typeof r.humanConfirmed!=='boolean')fail('CONFIRMATION');if(!text(r.linkReason,1200).trim())fail('REASON_REQUIRED');
  if(!STORY_CHANGES.includes(r.storyChangeType))fail('CHANGE_TYPE');array(r.limitations,12).forEach(x=>text(x,400));text(r.supersedes,300);
}
const knowledgeRef=i=>({id:i.id,version:i.version,fingerprint:fp(i),knowledgeType:i.knowledgeType??'EDGE',evidenceStatus:i.evidenceStatus});
export function readStorylineLink(root,path){
  if(typeof path!=='string'||!/^data\/runtime\/options-storyline-links\/[a-z0-9][a-z0-9-]{2,79}\.json$/.test(path))fail('PATH');
  const r=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX))),{fingerprint,...p}=r;
  exact(p,'schemaVersion,linkId,lineageId,version,supersedes,newsId,newsRef,newsFingerprint,newsSource,publishedAt,receivedAt,coverageType,themes,knowledgeRefs,reviewedAt,reviewedBy,linkReason,storyChangeType,limitations,status,outcome,request,previewFingerprint');
  requestCheck(p.request);time(p.reviewedAt);time(p.receivedAt);hash(p.previewFingerprint);
  if(p.schemaVersion!=='MACRO_STORYLINE_LINK_V1'||fp(p)!==fingerprint||pathFor(p.linkId)!==path||p.linkId!==p.request.linkId||!p.request.humanConfirmed||p.status!=='MANUAL_REVIEWED_LINK'||!Number.isSafeInteger(p.version)||p.version<1)fail('INTEGRITY');
  for(const key of ['newsRef','newsFingerprint','themes','reviewedBy','linkReason','storyChangeType','supersedes'])if(fp(p[key])!==fp(p.request[key]))fail('INTEGRITY');
  if(fp(p.knowledgeRefs.map(i=>i.id))!==fp(p.request.knowledgeIds)||p.outcome!==(p.themes.length||p.knowledgeRefs.length?'LINKED_CONTEXT':'NO_RELEVANT_APPROVED_STORYLINE'))fail('INTEGRITY');
  return {path,...r};
}
export function previewStorylineLink(root,request,at){
  time(at);requestCheck(request);const c=readWorldModel(),n=resolveStorylineNews(root,request.newsRef,at);
  if(n.newsFingerprint!==request.newsFingerprint)fail('NEWS_FINGERPRINT_MISMATCH');
  if(request.themes.some(t=>!c.themes.some(x=>x.themeId===t)))fail('THEME');
  const knowledge=request.knowledgeIds.map(id=>{const i=[...c.items,...c.edges].find(x=>x.id===id);if(!i)fail('UNAPPROVED_KNOWLEDGE');return i;});
  let prior=null;if(request.supersedes){prior=readStorylineLink(root,request.supersedes);if(prior.newsId!==n.newsId||prior.newsSource!==n.newsSource||time(prior.reviewedAt)>time(at))fail('REVISION');}
  const knowledgeRefs=knowledge.map(knowledgeRef),outcome=request.themes.length||knowledgeRefs.length?'LINKED_CONTEXT':'NO_RELEVANT_APPROVED_STORYLINE';
  const limitations=[...new Set([...STORY_LIMITATIONS,...request.limitations,...knowledge.flatMap(i=>i.limitations),...(n.coverageType==='HEADLINE_ONLY'?['HEADLINE_ONLY: article body and reported claims have not been verified by linking.']:['Only the saved source coverage is available; no additional original text was read.'])])];
  const summary={news:n,themes:request.themes,knowledge,limitations,outcome,status:'SUGGESTED_NOT_CONFIRMED',reviewAtSaveOnly:true};
  return {request,summary,knowledgeRefs,version:prior?prior.version+1:1,lineageId:prior?.lineageId??request.linkId,
    previewFingerprint:fp({request,news:n.newsFingerprint,knowledgeRefs,approvalRef:c.approvalRef,prior:prior?.fingerprint??null}),executionAllowed:false,tradingInfluence:false};
}
export function saveStorylineLink(root,request,previewFingerprint,at){
  time(at);if(time(at)>time(new Date().toISOString()))fail('FUTURE_SAVE');requestCheck(request);
  if(!request.humanConfirmed)fail('HUMAN_REVIEW_REQUIRED');
  const path=pathFor(request.linkId);
  if(existsSync(resolve(root,path))){const r=readStorylineLink(root,path);if(fp(r.request)!==fp(request)||r.previewFingerprint!==previewFingerprint)fail('RETRY_CHANGED');return {...r,alreadyRecorded:true};}
  const p=previewStorylineLink(root,request,at);if(p.previewFingerprint!==previewFingerprint)fail('PREVIEW_CHANGED');
  const list=files(root);if(list.length>=LIMIT)fail('CATALOG_LIMIT');
  if(request.supersedes&&list.some(f=>readStorylineLink(root,f).supersedes===request.supersedes))fail('REVISION_ADVANCED');
  const n=p.summary.news,r={schemaVersion:'MACRO_STORYLINE_LINK_V1',linkId:request.linkId,lineageId:p.lineageId,version:p.version,supersedes:request.supersedes,
    newsId:n.newsId,newsRef:request.newsRef,newsFingerprint:n.newsFingerprint,newsSource:n.newsSource,publishedAt:n.publishedAt,receivedAt:n.receivedAt,coverageType:n.coverageType,
    themes:request.themes,knowledgeRefs:p.knowledgeRefs,reviewedAt:at,reviewedBy:request.reviewedBy,linkReason:request.linkReason,storyChangeType:request.storyChangeType,
    limitations:p.summary.limitations,status:'MANUAL_REVIEWED_LINK',outcome:p.summary.outcome,request,previewFingerprint};
  const bytes=Buffer.from(JSON.stringify({...r,fingerprint:fp(r)})+'\n');if(bytes.length>MAX)fail('RECORD_LIMIT');
  io.directory(root,BASE);io.writeExclusive(root,path,bytes);return readStorylineLink(root,path);
}
export function storylineView(root,state,at){
  const catalog=storylineNewsCatalog(root,state,at),records=[],errors=[...catalog.errors],c=readWorldModel();
  for(const path of files(root)){try{
    const r=readStorylineLink(root,path);if(time(r.reviewedAt)>time(at))continue;
    let news=null,knowledge=[],recovery='AVAILABLE';
    try{news=resolveStorylineNews(root,r.newsRef,at);if(news.newsFingerprint!==r.newsFingerprint)fail('NEWS_FINGERPRINT_MISMATCH');}catch{news=null;recovery='NEWS_REFERENCE_UNAVAILABLE_OR_CHANGED';}
    for(const ref of r.knowledgeRefs){const i=[...c.items,...c.edges].find(x=>x.id===ref.id);if(!i||fp(knowledgeRef(i))!==fp(ref)){recovery='KNOWLEDGE_REFERENCE_UNAVAILABLE_OR_CHANGED';continue;}knowledge.push(i);}
    records.push({...r,news,knowledge,recovery});
  }catch{errors.push(path+' RECORD_UNAVAILABLE');}}
  return {...catalog,records:records.sort((a,b)=>b.reviewedAt.localeCompare(a.reviewedAt)),errors,limit:LIMIT,executionAllowed:false,tradingInfluence:false};
}
