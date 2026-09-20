import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,realpathSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {watchClock as at,watchId} from './lib/options-position-watch-fixtures.mjs';
import {seedSourceComparison,sourceDraftFixture,comparisonLedger as ledgerId} from './lib/options-source-comparison-fixtures.mjs';
import {prepareSourcePackage,receiveSourceDraft,previewSourceComparison,saveSourceComparison,sourceCatalog,sourcePlanOptions,sourceComparisonRecords,sourceComparisonView,readSourceRecord,verifySourceHandoff,assessSourceComparison} from './lib/options-source-comparison.mjs';
import {readManualLedger} from './options-manual-ledger.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {sourceCard,sourceComparisonPanel,sourcePreviewMatches,sourceBackrefs} from '../apps/options-workbench/source-comparison.js';
import {registerDefaults} from '../apps/options-workbench/forms.js';
import {thesisDefaults} from '../apps/options-workbench/trade-thesis.js';
import {preparePositionQuotes,beginPositionQuotes,authorizePositionQuoteCall,recordPositionQuotes} from './lib/options-position-quotes.mjs';
import {collectPositionQuotes} from './lib/options-guidance-host.mjs';
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-position-watch-source-'));try{const f=await seedSourceComparison(root);f.setClock(at(2));const state=await f.service.state(),catalog=sourceCatalog(state),p=prepareSourcePackage(root,ledgerId,{id:'package-one',eventKey:'test-cpi',materialIds:[catalog.materials[0].id],asOf:at(2)},catalog,at(2));await fn({root,...f,state,catalog,p});}finally{const r=realpathSync(root),rel=relative(realpathSync(tmpdir()),r);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-position-watch-source-'))throw Error('UNSAFE_CLEANUP');rmSync(r,{recursive:true,force:true});}}
function requestFor(f,d){const plan=sourcePlanOptions(f.state.manual.data)[0];return {id:'comparison-one',draftPath:d.path,reviewedClaims:['claim-one'],bindings:[{planKey:plan.key,planVersion:plan.version,conditionId:'event',factClaimId:'claim-one'}],supersedes:'',note:'Isolated Owner semantic review'};}
function saveDraft(f,change=()=>{}){const input=sourceDraftFixture(f.p);change(input);const d=receiveSourceDraft(f.root,input,at(4));return {d,request:requestFor(f,d)};}
function confirm(f,r){const p=previewSourceComparison(f.root,ledgerId,r,at(5));return saveSourceComparison(f.root,ledgerId,r,p.previewFingerprint,at(5));}

await test('one source allowed; immutable package and draft receipt remain distinct',()=>temp(f=>{
  const {d,request}=saveDraft(f);assert.equal(f.p.payload.materials.length,1);assert.equal(d.savedAt,at(4));const s=confirm(f,request);assert.equal(s.savedAt,at(5));assert.equal(s.payload.assessment.bindings[0].status,'EVIDENCE_ELIGIBLE_FOR_ORIGINAL_CHECKER');assert.equal(s.payload.assessment.independentConfirmations,null);
  assert.equal(sourceComparisonRecords(f.root,ledgerId,at(4)).records.filter(r=>r.kind==='saved').length,0);
}));
await test('shared upstream translations form one group, without a confirmation count',()=>temp(f=>{
  const p=structuredClone(f.p),m={...p.payload.materials[0],id:'translated',language:'zh'};p.payload.materials.push(m);const d=sourceDraftFixture(p);d.lineage=[p.payload.materials[0],m].map(m=>({materialId:m.id,relationship:'TRANSLATION',upstreamRef:'one-wire',note:'Attributed lineage'}));const r=assessSourceComparison(p,d,{reviewedClaims:[],bindings:[]},f.state.manual.data,at(5));assert.equal(r.lineageGroups.length,1);assert.equal(r.independentConfirmations,null);assert.deepEqual(d.relations,[]);
}));
await test('headline, summary, absent locator, missing reference and unreviewed meaning cannot qualify facts',()=>temp(f=>{
  for(const patch of ['HEADLINE_ONLY','SUMMARY','NO_CITATION','WRONG_CITATION','WRONG_QUOTE','NOT_REVIEWED']){
    const p=structuredClone(f.p),d=sourceDraftFixture(p);let reviewed=['claim-one'];
    if(['HEADLINE_ONLY','SUMMARY'].includes(patch))p.payload.materials[0].coverage=patch;
    if(patch==='NO_CITATION')d.statements[0].citations=[];if(patch==='WRONG_CITATION')d.statements[0].citations[0].materialId='missing';if(patch==='WRONG_QUOTE')d.statements[0].citations[0].quote='not in source';if(patch==='NOT_REVIEWED')reviewed=[];
    const r={...requestFor(f,{path:'unused'}),reviewedClaims:reviewed};assert.equal(assessSourceComparison(p,d,r,f.state.manual.data,at(5)).bindings[0].status,'MANUAL_REVIEW_REQUIRED');
  }
}));
await test('factual conflict remains review-required, not averaged or resolved by source count',()=>temp(f=>{
  const {request}=saveDraft(f,d=>d.relations.push({kind:'FACTUAL_CONFLICT',statementIds:['claim-one'],explanation:'Conflicting initial release value'}));assert.equal(confirm(f,request).payload.assessment.bindings[0].status,'MANUAL_REVIEW_REQUIRED');
}));
await test('original checker rejects wrong metric adjustment, unit, period, vintage, event and source',()=>temp(f=>{
  for(const patch of [{unit:'BPS'},{period:'2026-07'},{releaseVersion:'REVISED'},{metric:'CPI_MOM_NSA'},{eventKey:'other-event'},{source:'https://example.com/other'}]){const d=sourceDraftFixture(f.p);Object.assign(d.facts[0],patch);const r=assessSourceComparison(f.p,d,requestFor(f,{path:'unused'}),f.state.manual.data,at(5));assert.equal(r.bindings[0].status,'MANUAL_REVIEW_REQUIRED');}
}));
await test('expectation frozen after release is not eligible, even when a fact matches',()=>temp(f=>{
  const report=structuredClone(f.state.manual.data);report.trades[0].registeredAt=at(1);const r=assessSourceComparison(f.p,sourceDraftFixture(f.p),requestFor(f,{path:'unused'}),report,at(5));assert.equal(r.bindings[0].status,'MANUAL_REVIEW_REQUIRED');
}));
await test('late material, future analysis and old-as-of comparison handoffs are rejected',()=>temp(f=>{
  assert.throws(()=>prepareSourcePackage(f.root,ledgerId,{...f.p.payload.request,id:'old-time',asOf:at(-1)},f.catalog,at(5)),/NOT_YET_AVAILABLE/);
  assert.throws(()=>receiveSourceDraft(f.root,{...sourceDraftFixture(f.p),generatedAt:at(6)},at(4)),/GENERATION_CLOCK/);
  const {request}=saveDraft(f),s=confirm(f,request),plan=sourcePlanOptions(f.state.manual.data)[0];assert.throws(()=>verifySourceHandoff(f.root,plan,s.payload.assessment.bindings[0].evidence,at(4)),/NOT_YET_AVAILABLE/);
}));
await test('preview binding or semantic edit invalidates confirmation; repeated save is idempotent',()=>temp(f=>{
  const {request}=saveDraft(f),p=previewSourceComparison(f.root,ledgerId,request,at(5));assert.throws(()=>saveSourceComparison(f.root,ledgerId,{...request,note:'changed'},p.previewFingerprint,at(5)),/PREVIEW_CHANGED/);
  const s=saveSourceComparison(f.root,ledgerId,request,p.previewFingerprint,at(5));assert(saveSourceComparison(f.root,ledgerId,request,p.previewFingerprint,at(6)).alreadyRecorded);assert(!sourcePreviewMatches(p,{...request,reviewedClaims:[]}));assert.equal(readSourceRecord(f.root,s.path).fingerprint,s.fingerprint);
}));
await test('narrative reference never sends an invalidation; qualified Owner fact uses original evaluator',()=>temp(async f=>{
  const {request}=saveDraft(f),ref=confirm(f,{...request,id:'reference-only',bindings:request.bindings.map(b=>({...b,factClaimId:''}))});assert.equal(ref.payload.assessment.bindings[0].evidence,null);
  const saved=confirm(f,request),e=saved.payload.assessment.bindings[0].evidence;f.setClock(at(6));const before=readManualLedger(f.root,ledgerId,()=>at(6));
  const body={action:'SAVE_REVIEW',requestId:'original-evaluation',tradeId:watchId,exitCostUsd:'0',evidence:Object.fromEntries(Object.entries(e).filter(([k])=>!['savedAt','confirmation'].includes(k))),note:'Explicit isolated Owner confirmation',reportedAction:'NO_ACTION_REPORTED',correctionOf:''};
  const result=f.service.positionWatch(body);assert.equal(result.review.result.thesisStatus,'INVALIDATED');assert(result.review.result.triggered.includes('THESIS_INVALIDATED:event'));
  const after=readManualLedger(f.root,ledgerId,()=>at(6));assert.deepEqual(after.report.trades[0].plan,before.report.trades[0].plan);assert.equal(after.report.trades[0].effectiveFills.length,before.report.trades[0].effectiveFills.length);
  f.setClock(at(3601));const fresh=await f.service.state(),row=fresh.positionWatch.data.rows[0];assert(row.thesis.triggered.includes('THESIS_INVALIDATED:event'));assert(row.thesis.triggered.includes('TIME_EXIT_DUE'));assert.equal(row.liquidationValueAtBidUsd,null);
}));
await test('new comparison revision preserves original content and references',()=>temp(f=>{
  const {request}=saveDraft(f),a=confirm(f,request),b=confirm(f,{...request,id:'comparison-two',supersedes:a.path,note:'Additional explanation'});assert.equal(readSourceRecord(f.root,a.path).fingerprint,a.fingerprint);assert.equal(b.payload.request.supersedes,a.path);
}));
await test('wrong original plan version cannot attach eligible evidence',()=>temp(f=>{const {request}=saveDraft(f);request.bindings[0].planVersion='sha256:'+'a'.repeat(64);assert.equal(confirm(f,request).payload.assessment.bindings[0].status,'MANUAL_REVIEW_REQUIRED');}));
await test('source material mutation never replaces the immutable copied selection',()=>temp(f=>{const {request}=saveDraft(f),a=confirm(f,request);f.catalog.materials[0].text='Later revised release';assert.notEqual(readSourceRecord(f.root,f.p.path).payload.materials[0].text,f.catalog.materials[0].text);assert.equal(readSourceRecord(f.root,a.path).fingerprint,a.fingerprint);}));
await test('HTML rendering keeps five sections, source limits and separate clocks, with escaping',()=>temp(f=>{
  const {request}=saveDraft(f,d=>{d.interpretations[0].text='<script>bad</script>';});confirm(f,request);const r=sourceComparisonRecords(f.root,ledgerId,at(6)).records.find(r=>r.kind==='saved'),html=sourceCard(r);for(const label of ['1. Source statements','2. Attributed interpretations','3. Agreements and differences','4. Gaps and counterevidence','5. Original-plan relevance','Owner-confirmation'])assert(html.includes(label));assert(!html.includes('<script>'));assert(sourceBackrefs({records:[r]},watchId).includes('Co-display is not real-time'));assert(sourceComparisonPanel({...f.state,sourceComparisons:{data:{...f.catalog,...sourceComparisonRecords(f.root,ledgerId,at(6))}}},{}).includes('Prepare evidence package'));
}));
await test('saved targeted quote and comparison coexist, while stale quote still permits time exit',()=>temp(async f=>{
  const {request}=saveDraft(f);confirm(f,request);preparePositionQuotes(f.root,ledgerId,'targeted-test',null,at(6));const begin=beginPositionQuotes(f.root,'targeted-test',at(7),{allowSynthetic:true});let calls=0;
  const raw=await collectPositionQuotes({request:begin.request,clock:async()=>at(8),authorize:async i=>authorizePositionQuoteCall(f.root,'targeted-test',i,at(8),{allowSynthetic:true}),call:async(name,r)=>{calls++;if(name==='get_equity_quotes')return {data:{results:r.symbols.map(symbol=>({quote:{symbol,last_trade_price:'400',venue_last_trade_time:at(8),last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}))}};assert.equal(name,'get_option_quotes');return {data:{results:r.instrument_ids.map(instrument_id=>({quote:{instrument_id,bid_price:'1.5',ask_price:'1.51',bid_size:10,ask_size:10,updated_at:at(8)}}))}};}});
  recordPositionQuotes(f.root,'targeted-test',raw,at(8));f.setClock(at(3601));const s=await f.service.state();assert.equal(calls,2);assert.equal(s.positionWatch.data.rows[0].targetedReviewId,'targeted-test');assert.equal(s.positionWatch.data.rows[0].liquidationValueAtBidUsd,null);assert(s.positionWatch.data.rows[0].thesis.triggered.includes('TIME_EXIT_DUE'));assert(s.sourceComparisons.data.records.some(r=>r.kind==='saved'));
}));
await test('protected API receives, previews, confirms and recovers on restart without network or ledger writes',()=>temp(async f=>{
  let app=await startOptionsWorkbench({workspaceRoot:f.root,ledgerId,now:()=>at(5),port:0});try{
    const s=await(await fetch(app.url+'/api/state')).json(),headers={'Origin':app.url,'Content-Type':'application/json','X-Alpha-Session':s.session};const post=body=>fetch(app.url+'/api/source-comparison',{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await fetch(app.url+'/api/source-comparison',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const h=readManualLedger(f.root,ledgerId,()=>at(5)).headSha256;
    const d=await(await post({action:'RECEIVE_DRAFT',request:sourceDraftFixture(f.p),previewFingerprint:null})).json();assert(d.path);
    const r=requestFor(f,d),preview=await(await post({action:'PREVIEW',request:r,previewFingerprint:null})).json();assert(preview.previewFingerprint);
    const saved=await(await post({action:'SAVE',request:r,previewFingerprint:preview.previewFingerprint})).json();assert(saved.fingerprint);
    await app.close();app=await startOptionsWorkbench({workspaceRoot:f.root,ledgerId,now:()=>at(6),port:0});
    const state=await(await fetch(app.url+'/api/state')).json();assert(state.sourceComparisons.data.records.some(r=>r.fingerprint===saved.fingerprint));assert.equal(readManualLedger(f.root,ledgerId,()=>at(6)).headSha256,h);assert.equal(state.sourceComparisons.data.marketCalls,0);
    const count=readdirSync(join(f.root,'data/runtime/options-macro-comparisons')).length;await fetch(app.url+'/api/state');assert.equal(readdirSync(join(f.root,'data/runtime/options-macro-comparisons')).length,count);
  }finally{await app.close();}
}));
await test('saved draft condition can link without creating a holding or execution eligibility',()=>temp(f=>{
  f.setClock(at(5));const command={type:'SAVE_PLAN_DRAFT',tradeId:'draft-only',requestId:'draft-link',draft:{fields:{...registerDefaults(),tradeId:'draft-only'},thesis:{...thesisDefaults(),conditions:[f.condition]}}};
  const before=readManualLedger(f.root,ledgerId,()=>at(5)).report.counts.openTrades,p=f.service.preview(command);f.service.save({command,expectedHeadSha256:p.headSha256});
  const {request}=saveDraft(f),report=readManualLedger(f.root,ledgerId,()=>at(5)).report,draft=sourcePlanOptions(report).find(p=>p.kind==='DRAFT');request.bindings=[{planKey:draft.key,planVersion:draft.version,conditionId:'event',factClaimId:'claim-one'}];
  const r=confirm(f,request);assert.equal(r.payload.assessment.bindings[0].status,'REFERENCE_ONLY');assert.equal(report.counts.openTrades,before);
}));
await test('unreadable referenced draft preserves an explicit unavailable record instead of substitution',()=>temp(f=>{
  const {d,request}=saveDraft(f),s=confirm(f,request);writeFileSync(join(f.root,d.path),'corrupted fixture');const r=sourceComparisonRecords(f.root,ledgerId,at(6));assert(r.errors.some(e=>e.path===s.path&&e.status==='UNAVAILABLE_REFERENCE_OR_RECORD'));assert(!r.records.some(e=>e.id===s.id));
}));
await test('historical event remains selectable after its original calendar leaves the current catalog',()=>temp(f=>{
  const {request}=saveDraft(f),saved=confirm(f,request),view=sourceComparisonView(f.root,ledgerId,{},at(6));
  assert(view.events.some(e=>e.key===f.p.payload.event.key&&e.availability==='SAVED_EVENT_REFERENCE'));
  const record=view.records.find(r=>r.path===saved.path);assert.equal(record.originalAvailability,'UNAVAILABLE_IN_CURRENT_CATALOG_COPIED_SELECTION_RETAINED');
  assert(sourceComparisonPanel({sourceComparisons:{data:view}},{}).includes(saved.id));
}));
await test('client transport permits the protected comparison route without introducing any market endpoint',async()=>{
  // Exercise the same client used by the browser, not just the server route.
  const oldLocation=globalThis.location,oldFetch=globalThis.fetch;globalThis.location={origin:'http://127.0.0.1:4173'};const calls=[];
  globalThis.fetch=async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>path==='/api/state'?{session:'fixture-session'}:{received:true}};};
  try{const {request}=await import('../apps/options-workbench/api.js');await request('/api/state');assert((await request('/api/source-comparison',{action:'PREVIEW'})).received);assert.equal(calls[1].options.headers['X-Alpha-Session'],'fixture-session');assert.equal(calls[1].path,'/api/source-comparison');await assert.rejects(request('/api/market-quotes',{}),/Unsupported/);}
  finally{globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
console.log(`Source comparison tests passed: ${passed}/${passed}.`);
