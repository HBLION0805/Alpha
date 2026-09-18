import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,cpSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {macroCatalog} from '../src/engines/options-knowledge/MacroKnowledgeCatalog.ts';
import {assessMacroNote,validateMacroNote} from '../src/engines/options-knowledge/OptionsMacroPlaybook.ts';
import {macroPlaybookView,saveMacroNote,readMacroNote} from './lib/options-macro-playbook-io.mjs';
import {macroNoteDefaults,macroNoteRequest,macroPlaybookPage} from '../apps/options-workbench/macro-playbook.js';
import {startOptionsWorkbench} from './options-workbench.mjs';

const at='2026-09-18T03:00:00.000Z';
const note=()=>macroNoteRequest({...macroNoteDefaults(macroCatalog()),title:'Synthetic decision note'},macroCatalog(),randomUUID());
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-macro-playbook-'));try{await fn(root);}finally{const rel=relative(resolve(tmpdir()),resolve(root));assert.ok(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-macro-playbook-'));rmSync(root,{recursive:true,force:true});}}

await test('catalog covers every submitted topic family and names no active rules',()=>{
  const c=macroCatalog();assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);assert.equal(new Set(c.items.map(i=>i.id)).size,c.items.length);
  for(const i of c.items){assert.ok(i.limits&&i.application);for(const id of i.sources)assert.ok(c.sources.some(s=>s.id===id));}
  const text=JSON.stringify(c.items);for(const topic of ['Travel','Scalper','Long-term investor','Value','Narrative','Mechanical stop','Positional stop','Thesis stop','MACD','Time-based stop','Built-in stop','Volatility stop','Overnight stop','Hedging stop','Cost control','Stop hunting','30% remaining time','One loss addition','Meditation','Lottery profit curve','Bull trap','Technical confirmation','Turbulent gain','Confidence formula'])assert.ok(text.includes(topic),topic);
  for(const id of ['mechanical','thirty-thirty','adding','windfall','giveback','catalyst-runner'])assert.equal(c.items.find(i=>i.id===id).status,'CANDIDATE_UNTESTED');
});
await test('catalog callers cannot mutate future catalogs',()=>{const c=macroCatalog();c.items[0].title='changed';assert.notEqual(macroCatalog().items[0].title,'changed');});
await test('empty answers are unknown with no qualification',()=>{const a=assessMacroNote(note());assert.equal(a.documentedFields,0);assert.equal(a.process.status,'UNKNOWN');assert.equal(a.outcome.status,'UNKNOWN');assert.equal(a.approvedLesson,false);assert.equal(a.strategyStatus,'UNVALIDATED');});
await test('full prose coverage is not truth, approval or trading readiness',()=>{const n=note();for(const k of Object.keys(n.answers))n.answers[k]='Unknown claim';const a=assessMacroNote(n);assert.equal(a.documentedFields,12);assert.equal(a.executionAllowed,false);assert.match(a.coverageMeaning,/not verified/);assert.equal(a.timing,'SERVER_RECEIPT_ONLY_NOT_VERIFIED_PRE_ENTRY');});
await test('whitespace is undocumented and inputs remain untouched',()=>{const n=note();n.answers.horizons=' \n ';const copy=JSON.stringify(n);assert.equal(assessMacroNote(n).documentedFields,0);assert.equal(JSON.stringify(n),copy);});
await test('missing original plan blocks even a profitable claimed process',()=>{const n={...note(),phase:'REVIEW_NOTE',process:'FOLLOWED',outcome:'PROFIT',reviewEvidence:'Self-report only'};const a=assessMacroNote(n);assert.equal(a.process.status,'UNKNOWN');assert.equal(a.outcome.status,'PROFIT');});
await test('missing review evidence blocks process classification',()=>{const n={...note(),phase:'REVIEW_NOTE',process:'DEVIATED',originalPlanRef:'some-plan'};assert.equal(assessMacroNote(n).process.status,'UNKNOWN');});
for(const process of ['FOLLOWED','DEVIATED'])for(const outcome of ['PROFIT','LOSS','FLAT','UNKNOWN'])await test(`${process} and ${outcome} remain independent self-reports`,()=>{const n={...note(),phase:'REVIEW_NOTE',process,outcome,originalPlanRef:'original',reviewEvidence:'Synthetic comparison'};const a=assessMacroNote(n);assert.equal(a.process.status,process);assert.equal(a.outcome.status,outcome);assert.equal(a.process.basis,'OWNER_REPORTED_NOT_VERIFIED');});
await test('pre-trade notes cannot attach hindsight outcome assessments',()=>{assert.throws(()=>assessMacroNote({...note(),outcome:'LOSS'}),/PRE_TRADE_OUTCOME/);assert.throws(()=>assessMacroNote({...note(),process:'FOLLOWED'}),/PRE_TRADE_OUTCOME/);});
for(const [name,change] of [
  ['extra field',n=>n.execute=true],['wrong universe',n=>n.symbol='QQQ'],['path request ID',n=>n.requestId='../escape'],
  ['oversize text',n=>n.answers.sources='x'.repeat(1401)],['missing question',n=>delete n.answers.costs],
  ['unknown outcome',n=>n.outcome='WIN_CONFIRMED'],['client clock',n=>n.recordedAt=at],['empty title',n=>n.title=' '],
])await test(name+' is rejected',()=>{const n=note();change(n);assert.throws(()=>validateMacroNote(n));});
await test('save and exact retry preserve receipt, catalog and one record',()=>temp(root=>{const n=note(),a=saveMacroNote(root,n,at),b=saveMacroNote(root,n,'2026-09-19T03:00:00.000Z');assert.equal(b.alreadyRecorded,true);assert.equal(b.recordedAt,at);const r=readMacroNote(root,a.path);assert.deepEqual(r.input,n);assert.deepEqual(r.catalog,macroCatalog());assert.equal(macroPlaybookView(root).notes.length,1);assert.throws(()=>saveMacroNote(root,{...n,title:'changed'},at),/RETRY_CONTENT_CHANGED/);}));
await test('new revision retains both original and referenced update',()=>temp(root=>{const n=note();saveMacroNote(root,n,at);saveMacroNote(root,{...n,requestId:randomUUID(),originalPlanRef:n.requestId,title:'Revision'},at);assert.equal(macroPlaybookView(root).notes.length,2);}));
await test('copied record recovers without source stores or original notes',()=>temp(root=>temp(copy=>{const a=saveMacroNote(root,note(),at);mkdirSync(resolve(copy,'data/runtime/options-macro-playbook/notes'),{recursive:true});cpSync(resolve(root,a.path),resolve(copy,a.path));assert.deepEqual(readMacroNote(copy,a.path),readMacroNote(root,a.path));assert.equal(macroPlaybookView(copy).notes.length,1);})));
await test('tampered record is retained as an error while good records stay visible',()=>temp(root=>{const a=saveMacroNote(root,note(),at);saveMacroNote(root,note(),at);const p=resolve(root,a.path),r=JSON.parse(readFileSync(p,'utf8'));r.assessment.documentedFields=12;writeFileSync(p,JSON.stringify(r));const v=macroPlaybookView(root);assert.equal(v.notes.length,1);assert.equal(v.errors.length,1);assert.throws(()=>readMacroNote(root,a.path),/INTEGRITY/);}));
await test('path escape and invalid clocks fail without writes',()=>temp(root=>{assert.throws(()=>readMacroNote(root,'../outside.json'),/PATH/);assert.throws(()=>saveMacroNote(root,note(),'yesterday'),/CLOCK/);assert.equal(macroPlaybookView(root).notes.length,0);}));
await test('browser mapping normalizes pre-trade review fields to unknown',()=>{const n=macroNoteRequest({...macroNoteDefaults(macroCatalog()),title:'Test',process:'FOLLOWED',outcome:'PROFIT'},macroCatalog(),randomUUID());assert.equal(n.process,'UNKNOWN');assert.equal(n.outcome,'UNKNOWN');validateMacroNote(n);});
await test('HTML escapes owner notes and source text; source links remain usable',()=>temp(root=>{const n=note();n.title='<img src=x onerror=alert(1)>';n.answers.sources='<script>bad</script>';saveMacroNote(root,n,at);const v=macroPlaybookView(root);const html=macroPlaybookPage({macroPlaybook:{data:v}},{});assert.ok(!html.includes('<script>bad'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('href="https://macro-trading.pages.dev/"'));assert.ok(html.includes('Undocumented'));assert.ok(html.includes('0 active rules'));assert.ok(macroPlaybookPage({},{}).includes('unavailable'));}));
await test('search exposes runner caveats and no unrelated rule activation',()=>temp(root=>{const html=macroPlaybookPage({macroPlaybook:{data:macroPlaybookView(root)}},{macroKnowledgeSearch:'90% exit'});assert.ok(html.includes('One contract cannot be split'));assert.ok(!html.includes('knowledge-horizons'));}));
await test('HTTP and browser helper save locally, reject unknown routes and missing origin',()=>temp(async root=>{
 const app=await startOptionsWorkbench({port:0,workspaceRoot:root,refreshContext:false});const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
 try{
   assert.equal((await fetch(app.url+'/macro-playbook.js')).status,200);
   assert.equal((await fetch(app.url+'/api/macro-playbook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'SAVE',request:note()})})).status,403);
   globalThis.location={origin:app.url};globalThis.fetch=(path,options)=>originalFetch(app.url+path,{...options,headers:{...options.headers,Origin:app.url}});
   const {request}=await import('../apps/options-workbench/api.js');const state=await request('/api/state');assert.equal(state.macroPlaybook.state,'AVAILABLE');
   const n=note();assert.equal((await request('/api/macro-playbook',{action:'PREVIEW',request:n})).documentedFields,0);
   const saved=await request('/api/macro-playbook',{action:'SAVE',request:n});assert.equal(saved.executionAllowed,false);assert.equal(readMacroNote(root,saved.path).input.title,n.title);
   assert.equal((await request('/api/macro-playbook',{action:'SAVE',request:n})).alreadyRecorded,true);
   await assert.rejects(()=>request('/api/macro-playbook',{action:'ACTIVATE_RULE',request:n}));await assert.rejects(()=>request('/api/orders',{}),/Unsupported/);
 }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;await app.close();}
}));
console.log(`Macro playbook: ${passed}/${passed} tests passed.`);
