import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {readWorldModel} from './lib/macro-world-model.mjs';
import {readStorylineLink,resolveStorylineNews,storylineNewsCatalog,storylineView,previewStorylineLink,saveStorylineLink} from './lib/options-storyline.mjs';
import {refreshFocusedNews} from './lib/options-focused-news-io.mjs';
import {saveSourceRecord} from './lib/options-source-comparison.mjs';
import {paperFingerprint as fp} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {lookupWorldModel} from '../apps/options-workbench/world-model-lookup.js';
import {newStorylineDraft,storylinePanel,storylineSummary,storylineNewsChoices} from '../apps/options-workbench/storyline.js';
import {storylinePreviewMatches} from '../apps/options-workbench/storyline-model.js';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';

const at='2026-09-19T16:00:00.000Z',later='2026-09-19T16:01:00.000Z',c=readWorldModel();
const by=l=>[...c.items,...c.edges].find(i=>i.reviewLabel===l).id;
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){
 const root=mkdtempSync(resolve(tmpdir(),'alpha-storyline-test-'));
 try{
  let injectedCalls=0;
  await refreshFocusedNews({workspaceRoot:root,now:()=>at,fetchFeed:async()=>{injectedCalls++;return '<rss><channel><item><guid>fixture-news</guid><link>https://example.com/story</link><title>Bitcoin Core software and fee changes</title><pubDate>Fri, 18 Sep 2026 12:00:00 GMT</pubDate></item></channel></rss>';}});
  assert.equal(injectedCalls,3);const data=storylineNewsCatalog(root,{},at),n=data.news.find(n=>n.newsSource==='coindesk');
  const request={...newStorylineDraft(n,'link-first'),linkReason:'No relevant approved macro context for this software report.',reviewedBy:{kind:'HUMAN_REVIEWER',name:'Isolated test reviewer'},humanConfirmed:true};
  await fn({root,n,request});
 }finally{const rel=relative(resolve(tmpdir()),resolve(root));assert(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-storyline-test-'));rmSync(root,{recursive:true,force:true});}
}
const save=(f,r=f.request)=>{const p=previewStorylineLink(f.root,r,at);return saveStorylineLink(f.root,r,p.previewFingerprint,at);};
await test('suggestions and previews never save or confirm, including zero-match software',()=>temp(f=>{
 const r=lookupWorldModel(c,{keyword:'Bitcoin Core'});assert.equal(r.items.length,0);
 const p=previewStorylineLink(f.root,{...f.request,humanConfirmed:false},at);assert.equal(p.summary.status,'SUGGESTED_NOT_CONFIRMED');assert.equal(p.summary.outcome,'NO_RELEVANT_APPROVED_STORYLINE');
 assert.equal(storylineView(f.root,{},at).records.length,0);assert.throws(()=>saveStorylineLink(f.root,p.request,p.previewFingerprint,at),/HUMAN_REVIEW_REQUIRED/);
}));
await test('explicit reviewed zero-link outcome and headline coverage survive save/recovery',()=>temp(f=>{
 const s=save(f),r=readStorylineLink(f.root,s.path);assert.deepEqual(r.themes,[]);assert.deepEqual(r.knowledgeRefs,[]);assert.equal(r.outcome,'NO_RELEVANT_APPROVED_STORYLINE');assert.equal(r.coverageType,'HEADLINE_ONLY');assert.equal(r.reviewedAt,at);assert.equal(r.newsFingerprint,f.n.newsFingerprint);
 assert(!Object.hasOwn(r,'headline'));assert(!JSON.stringify(r).includes('Bitcoin Core software'));assert.equal(storylineView(f.root,{},later).records[0].news.title,f.n.title);
}));
await test('multiple themes are explicit; edge never adds its second theme',()=>temp(f=>{
 let s=save(f,{...f.request,themes:['M05'],knowledgeIds:[by('L1')]});assert.deepEqual(s.themes,['M05']);
 s=save(f,{...f.request,linkId:'multi-theme',themes:['M05','M01'],knowledgeIds:[by('L1'),by('ME01')]});assert.deepEqual(s.themes,['M05','M01']);assert.equal(s.knowledgeRefs[0].knowledgeType,'EDGE');
}));
await test('hypothesis, unknown, conditional mechanism and unresolved conflict retain grades and both claims',()=>temp(f=>{
 const s=save(f,{...f.request,knowledgeIds:['T02','Q04','ME01','MALACCA_CONFLICT'].map(by)}),v=storylineView(f.root,{},later).records[0];
 assert.deepEqual(s.knowledgeRefs.map(i=>i.evidenceStatus),['ALPHA_INFERENCE','UNKNOWN','CONDITIONAL_HYPOTHESIS','CONFLICTED']);
 const conflict=v.knowledge.find(i=>i.reviewLabel==='MALACCA_CONFLICT');assert.equal(conflict.details.canonicalValue,null);assert(conflict.details.claimA&&conflict.details.claimB);
 const html=storylineSummary(v,c);for(const s of ['HYPOTHESIS_ONLY_CONTEXT','ALPHA_INFERENCE','UNKNOWN','UNRESOLVED CONFLICT','No trade implication','Provenance and approval'])assert(html.includes(s));
}));
await test('revision appends original reason, selection, clocks and fingerprint; stale branch fails',()=>temp(f=>{
 const first=save(f),bytes=readFileSync(resolve(f.root,first.path));
 const r={...f.request,linkId:'revision-two',supersedes:first.path,themes:['M01'],linkReason:'Revised context with explicit source limits.'},p=previewStorylineLink(f.root,r,later),second=saveStorylineLink(f.root,r,p.previewFingerprint,later);
 assert.equal(second.version,2);assert.equal(second.lineageId,first.linkId);assert.equal(second.reviewedAt,later);assert(bytes.equals(readFileSync(resolve(f.root,first.path))));
 assert.throws(()=>save(f,{...r,linkId:'stale-branch'}),/REVISION_ADVANCED/);
 assert.equal(storylineView(f.root,{},later).records.length,2);
}));
await test('repeated save is idempotent; changed retry and stale preview are rejected',()=>temp(f=>{
 const p=previewStorylineLink(f.root,f.request,at),a=saveStorylineLink(f.root,f.request,p.previewFingerprint,at),b=saveStorylineLink(f.root,f.request,p.previewFingerprint,later);assert.equal(a.fingerprint,b.fingerprint);assert(b.alreadyRecorded);
 assert.throws(()=>saveStorylineLink(f.root,{...f.request,linkReason:'Changed'},p.previewFingerprint,later),/RETRY_CHANGED/);
 const changed={...f.request,linkId:'changed-new'};assert.throws(()=>saveStorylineLink(f.root,changed,p.previewFingerprint,at),/PREVIEW_CHANGED/);assert(!storylinePreviewMatches(p,changed));
}));
await test('wrong news and raw-record fingerprints block, never substitute latest title',()=>temp(f=>{
 assert.throws(()=>previewStorylineLink(f.root,{...f.request,newsFingerprint:fp('wrong')},at),/NEWS_FINGERPRINT_MISMATCH/);
 assert.throws(()=>previewStorylineLink(f.root,{...f.request,newsRef:{...f.request.newsRef,recordFingerprint:fp('wrong')}},at),/NEWS_FINGERPRINT_MISMATCH/);
 const s=save(f);const path=resolve(f.root,f.n.newsRef.path),r=JSON.parse(readFileSync(path));r.batch.sources.find(s=>s.id==='coindesk').items[0].headline='Later changed material';r.fingerprint=fp(r.batch);writeFileSync(path,JSON.stringify(r));
 const v=storylineView(f.root,{},later).records[0];assert.equal(v.recovery,'NEWS_REFERENCE_UNAVAILABLE_OR_CHANGED');assert.equal(v.news,null);assert.equal(v.newsFingerprint,s.newsFingerprint);
}));
await test('rejected guardrails, deferred current state, arbitrary status and canonical override are not accepted',()=>temp(f=>{
 for(const id of [c.guardrails[0].id,'C01','VERIFIED_CAUSAL_LINK'])assert.throws(()=>previewStorylineLink(f.root,{...f.request,knowledgeIds:[id]},at),/UNAPPROVED_KNOWLEDGE/);
 for(const field of ['canonicalValue','evidenceStatus','reviewedAt','status'])assert.throws(()=>previewStorylineLink(f.root,{...f.request,[field]:'override'},at),/FIELDS/);
 assert.throws(()=>previewStorylineLink(f.root,{...f.request,reviewedBy:{kind:'HOST_AI',name:'Codex'}},at),/REVIEWER/);
}));
await test('strict limits, source paths, future receipt and invalid user choices fail closed',()=>temp(f=>{
 for(const r of [{...f.request,linkId:'../escape'},{...f.request,themes:['M06']},{...f.request,knowledgeIds:[by('ME01'),by('ME01')]},{...f.request,linkReason:''},{...f.request,storyChangeType:'BULLISH'}])assert.throws(()=>previewStorylineLink(f.root,r,at));
 assert.throws(()=>resolveStorylineNews(f.root,{...f.n.newsRef,path:'../../private'},at));
 assert.throws(()=>resolveStorylineNews(f.root,f.n.newsRef,'2026-09-18T00:00:00.000Z'));
}));
await test('saved source-package excerpt remains excerpt with exact material reference',()=>temp(f=>{
 const m={id:'saved-excerpt',source:'PRIMARY',title:'Saved excerpt',text:'Only retained excerpt.',publishedAt:null,receivedAt:at,coverage:'EXCERPT',url:'https://example.com/source'};
 const p=saveSourceRecord(f.root,'package','source-fixture',{materials:[m]},at),ref={kind:'SOURCE_PACKAGE',path:p.path,recordFingerprint:p.fingerprint,itemId:m.id,sourceId:m.source};
 const n=resolveStorylineNews(f.root,ref,at),s=save(f,{...f.request,linkId:'excerpt-link',newsRef:ref,newsFingerprint:n.newsFingerprint});assert.equal(s.coverageType,'EXCERPT');assert(!JSON.stringify(s).includes(m.text));
}));
await test('old records need no migration and saved links remain available outside current selector',()=>temp(f=>{
 const before=readFileSync(resolve(f.root,f.n.newsRef.path)),s=save(f);
 const v=storylineView(f.root,{},'2026-10-03T16:00:00.000Z');assert.equal(storylineNewsChoices({...v,news:[]})[0].key,f.n.key);assert.equal(v.records[0].linkId,s.linkId);assert.equal(v.records[0].recovery,'AVAILABLE');assert(before.equals(readFileSync(resolve(f.root,f.n.newsRef.path))));
}));
await test('UI separates suggestions/confirmation, preserves escaping, provenance and zero result',()=>temp(f=>{
 const state={storylines:{data:storylineView(f.root,{},at)},macroWorldModel:{data:c}},d={...f.request,linkReason:'<script>not executable</script>',humanConfirmed:false};
 const html=storylinePanel(state,{storyNewsKey:f.n.key,storyDraft:d,storyFilters:{keyword:'Bitcoin Core'}});
 for(const s of ['SUGGESTED_NOT_CONFIRMED','Manual theme selection (zero is allowed)','No suggestion / limited coverage','humanConfirmed','Save reviewed link','NOT_CLASSIFIED','HEADLINE_ONLY'])assert(html.includes(s));assert(html.includes('id="story-save" class="button primary" value="SAVE" disabled'));assert(!html.includes('<script>'));
 const edgeHtml=storylinePanel(state,{storyNewsKey:f.n.key,storyDraft:d,storyFilters:{keyword:'shipping'}});assert(!edgeHtml.includes('undefined'));assert(edgeHtml.includes('L1 · M05 → M01'));
}));
await test('changed saved metadata cannot upgrade a selected knowledge grade during recovery',()=>temp(f=>{
 const s=save(f,{...f.request,knowledgeIds:[by('Q04')]}),path=resolve(f.root,s.path),r=JSON.parse(readFileSync(path));
 r.knowledgeRefs[0].evidenceStatus='VERIFIED';const {fingerprint,...payload}=r;r.fingerprint=fp(payload);writeFileSync(path,JSON.stringify(r));
 const v=storylineView(f.root,{},later).records[0];assert.equal(v.recovery,'KNOWLEDGE_REFERENCE_UNAVAILABLE_OR_CHANGED');assert.equal(v.knowledge.length,0);
}));
await test('protected API save/reload/restart leaves trading outputs and original source bytes unchanged',()=>temp(async f=>{
 const before=new Map(readdirSync(resolve(f.root,'data/runtime/options-focused-news/2026-09-19')).map(n=>[n,createHash('sha256').update(readFileSync(resolve(f.root,'data/runtime/options-focused-news/2026-09-19',n))).digest('hex')]));
 const service=createWorkbenchData({workspaceRoot:f.root,now:()=>at});const baseline=await service.state();
 let app=await startOptionsWorkbench({workspaceRoot:f.root,now:()=>at,port:0});
 try{
  const state=await(await fetch(app.url+'/api/state')).json(),headers={Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':state.session};
  const post=body=>fetch(app.url+'/api/storyline',{method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await fetch(app.url+'/api/storyline',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const p=await(await post({action:'PREVIEW',request:f.request,previewFingerprint:null})).json();assert(p.previewFingerprint);
  const r=await(await post({action:'SAVE',request:f.request,previewFingerprint:p.previewFingerprint})).json();assert(r.fingerprint);
  const after=await service.state();for(const k of ['guidance','candidateChecks','manual','positionWatch','marketExpectations','eventEntryPlans','capitalPolicy'])assert.deepEqual(after[k],baseline[k],k);
  assert.equal(after.storylines.data.records.length,1);assert.equal((await service.state()).storylines.data.records.length,1);
  await app.close();app=await startOptionsWorkbench({workspaceRoot:f.root,now:()=>later,port:0});const restored=await(await fetch(app.url+'/api/state')).json();assert.equal(restored.storylines.data.records[0].fingerprint,r.fingerprint);
  for(const [name,h] of before)assert.equal(createHash('sha256').update(readFileSync(resolve(f.root,'data/runtime/options-focused-news/2026-09-19',name))).digest('hex'),h);
  const client=readFileSync(new URL('../apps/options-workbench/api.js',import.meta.url),'utf8');assert(client.includes("ROUTES.add('/api/storyline')"));
 }finally{await app.close();}
}));
console.log(`Reviewed storyline links: ${passed}/${passed} tests passed.`);
