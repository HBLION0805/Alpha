import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readWorldModel,validateWorldModel} from './lib/macro-world-model.mjs';
import {lookupWorldModel} from '../apps/options-workbench/world-model-lookup.js';
import {worldModelPanel} from '../apps/options-workbench/world-model.js';
import {macroPlaybookPage,macroNoteDefaults,macroNoteRequest} from '../apps/options-workbench/macro-playbook.js';
import {macroCatalog} from '../src/engines/options-knowledge/MacroKnowledgeCatalog.ts';
import {assessMacroNote} from '../src/engines/options-knowledge/OptionsMacroPlaybook.ts';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {buildScenario,plannerDefaults} from '../apps/options-workbench/forms.js';

const root=resolve(import.meta.dirname,'..'),path='src/engines/macro-world-model/';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const approval=read(path+'BATCH_1_WORLD_MODEL_APPROVAL_V1.json'),catalog=read(path+'BATCH_1_WORLD_MODEL_V1.json');
const pack=read(approval.sourceReviewPath),runtime=lookupWorldModel(validateWorldModel(catalog,approval)),by=l=>runtime.items.find(i=>i.reviewLabel===l);
const hash=b=>createHash('sha256').update(b).digest('hex');
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const dir=mkdtempSync(resolve(tmpdir(),'alpha-world-model-test-'));try{await fn(dir);}finally{const rel=relative(resolve(tmpdir()),resolve(dir));assert(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-world-model-test-'));rmSync(dir,{recursive:true,force:true});}}

await test('explicit Owner subset loads exactly with original review unchanged',()=>{
 assert.equal(runtime.items.length,38);assert.equal(runtime.edges.length,5);
 assert.deepEqual(runtime.items.map(i=>i.id),approval.approvedCandidateIds);
 assert.equal(hash(readFileSync(resolve(root,approval.sourceReviewPath))),approval.sourceReviewSha256);
 assert(readFileSync(resolve(root,approval.sourceReviewPath)).equals(execFileSync('git',['show',approval.sourceReviewCommit+':'+approval.sourceReviewPath],{cwd:root,maxBuffer:1024*1024})));
 assert.equal(pack.status,'KNOWLEDGE_CANDIDATE_NOT_APPROVED');assert.equal(pack.runtimeUse,'PROHIBITED');
});
await test('current states and deferred flows/edges never load',()=>{
 for(const d of approval.deferred)assert(![...runtime.items,...runtime.edges].some(i=>i.id===d.id));
 assert(!runtime.items.some(i=>i.knowledgeType==='CURRENT_STATE'||i.reviewLabel==='FL02'));
 assert.deepEqual(runtime.edges.map(e=>e.reviewLabel),['L1','L2','L3','L4','L5']);
 assert.equal(runtime.currentStateEnabled,false);
});
await test('the three retypings and structural flow remain explicit',()=>{
 for(const [l,t] of Object.entries({F06:'CONCEPTUAL_BOUNDARY',F11:'MEASUREMENT_FRAMEWORK',F12:'EVIDENCE_TIME_RULE',FL01:'STRUCTURAL_FLOW_RELATION'}))assert.equal(by(l).knowledgeType,t);
 assert.equal(by('FL01').details.magnitude,null);assert.equal(by('FL01').details.flowStatus,'STRUCTURAL_RELATION_NOT_CURRENT_OBSERVATION');
 assert.equal(runtime.sharedEvidenceTimeRuleId,by('F12').id);assert.equal(runtime.items.filter(i=>i.id===by('F12').id).length,1);
});
await test('swap facility is authorization, never FUNDS or an observed draw',()=>{
 assert.equal(by('A02').details.relationType,'CENTRAL_BANK_SWAP_BACKSTOP');assert.equal(by('A02').details.measurementType,'AUTHORIZATION');assert.equal(by('A02').details.observedCurrentDraw,null);
 assert(!JSON.stringify(runtime.items).includes('"relationType":"FUNDS"'));
});
await test('all original evidence grades, including conditional and inference, survive',()=>{
 for(const original of pack.candidates){const i=runtime.items.find(x=>x.id===original.knowledgeId);if(i)assert.equal(i.evidenceStatus,original.evidenceStatus,i.reviewLabel);}
 for(const e of runtime.edges)assert.equal(e.evidenceStatus,pack.edges.find(x=>x.edgeId===e.id).evidenceStatus);
 assert.equal(by('T01').knowledgeType,'HYPOTHESIS_ONLY_CONTEXT');assert.equal(by('T02').evidenceStatus,'ALPHA_INFERENCE');
 for(const i of runtime.items.filter(x=>x.knowledgeType==='MECHANISM'))assert(i.details.counterforces.length&&i.details.falsification.length&&i.details.observableConfirmation.length);
});
await test('every open question stays UNKNOWN and unresolved; watches are not scheduled',()=>{
 for(const l of ['Q01','Q02','Q03','Q04','Q05']){assert.equal(by(l).evidenceStatus,'UNKNOWN');assert.equal(by(l).details.resolvedBy,null);assert(by(l).details.whatEvidenceWouldResolve.length);}
 for(const l of ['W01','W02','W03','W04','W05'])assert.equal(by(l).details.automaticMonitoring,false);
});
await test('both conflicting values and unbridged definitions are retained without a canonical value',()=>{
 const [m,e]=runtime.items.filter(i=>i.knowledgeType==='CONFLICT');
 assert.equal(m.evidenceStatus,'CONFLICTED');assert.equal(m.details.claimA.value,24.9);assert.equal(m.details.claimB.value,24);assert.equal(m.details.canonicalValue,null);
 assert.equal(e.status,'UNBRIDGED');assert.equal(e.evidenceStatus,'UNKNOWN');assert.equal(e.details.canonicalValue,null);assert(e.details.claimA&&e.details.claimB);
});
await test('all runtime lineage resolves through the unchanged review and dossier source maps',()=>{
 const originals=[...pack.candidates,...pack.watchQuestions,...pack.openQuestions,...pack.conflicts,...pack.edges];
 for(const i of [...runtime.items,...runtime.edges]){
  const p=originals.find(x=>[x.knowledgeId,x.watchId,x.conflictId,x.edgeId].includes(i.candidateId));assert(p,i.id);
  assert.deepEqual(i.sourceRefs,p.sourceRefs);assert.equal(i.reviewRef,approval.sourceReviewPath);
  assert.deepEqual(i.dossierRefs.map(r=>r.section),p.dossierRefs.map(r=>r.section));
  for(const r of i.dossierRefs){const text=readFileSync(resolve(root,r.path),'utf8');assert(new RegExp('^## '+r.section.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[. ]','m').test(text),r.path+' '+r.section);assert(r.anchor);}
  for(const ref of i.sourceRefs){const s=runtime.sourceMap.find(x=>x.sourceRef===ref),old=pack.sourceMap.find(x=>x.sourceRef===ref);assert(s&&old);assert.deepEqual(s.urls,old.urls);assert.equal(s.savedSupportAndLimitations,old.savedSupportAndLimitations);assert.equal(s.reopenedInThisGate,false);for(const url of s.urls)assert.equal(new URL(url).protocol,'https:');}
 }
});
for(const [query,labels] of [['SWIFT',['F03']],['fiscal dominance',['F06','Q03']],['yen carry',['F07','F08','ME05','ME06','W04','Q04']],['gold',['T01']]])await test('deterministic search: '+query,()=>{
 const result=readWorldModel({keyword:query});for(const label of labels)assert(result.items.some(i=>i.reviewLabel===label));assert.deepEqual(result,lookupWorldModel(readWorldModel(),{keyword:query}));
 assert.equal(result.executionAllowed,false);assert.equal(result.tradingInfluence,false);
 assert(!result.items.some(i=>/^R|^D/.test(i.reviewLabel)));
});
await test('theme/type/evidence filters compose and unknown queries do not guess',()=>{
 const r=readWorldModel({theme:'M04',knowledgeType:'OPEN_QUESTION',evidenceStatus:'UNKNOWN',keyword:'yen carry'});assert.deepEqual(r.items.map(i=>i.reviewLabel),['Q04']);
 assert.equal(readWorldModel({keyword:'nonexistent topic'}).items.length,0);
 for(const query of [{theme:'INVALID'},{knowledgeType:'CURRENT_STATE'},{evidenceStatus:'FACT'},{keyword:'a'.repeat(161)},{signal:'BUY'}])assert.throws(()=>readWorldModel(query),/QUERY_INVALID/);
});
await test('saved-news phrases retrieve approved mechanism details and equivalent BOJ name',()=>{
 const spreads=readWorldModel({keyword:'crack spreads'});assert.deepEqual(spreads.items.map(i=>i.reviewLabel),['ME01']);
 assert.equal(spreads.items[0].evidenceStatus,'CONDITIONAL_HYPOTHESIS');assert(spreads.items[0].details.counterforces.length);
 assert.deepEqual(readWorldModel({keyword:'Bank of Japan'}),readWorldModel({keyword:'BOJ'}));
 assert.deepEqual(readWorldModel({keyword:'BANK   OF JAPAN',knowledgeType:'HISTORICAL_FACT'}).items.map(i=>i.reviewLabel),['H02']);
 assert.deepEqual(readWorldModel({keyword:'Bitcoin Core'}).items,[]);assert.deepEqual(readWorldModel({keyword:'fee changes'}).items,[]);
 const c=structuredClone(runtime);c.guardrails[0].interpretation='uniqueguardrailphrase';c.sourceMap[0].savedCitation='uniquesourcephrase';
 for(const keyword of ['uniqueguardrailphrase','uniquesourcephrase'])assert.deepEqual(lookupWorldModel(c,{keyword}).items,[]);
});
await test('guardrail interpretations are readable audit exclusions, never affirmative matches or inverse facts',()=>{
 assert.deepEqual(runtime.guardrails.filter(g=>g.disposition==='REJECT_FROM_RUNTIME').map(g=>g.reviewLabel),['R01','R02','R03','R04','R05','R06','R07','R08']);
 for(const g of runtime.guardrails){assert.equal(g.assertion,false);assert.equal(g.notInverseFact,true);assert(g.reason&&g.dossierRefs.length);}
 const hits=readWorldModel({keyword:'SWIFT'}).items;assert(hits.some(i=>i.reviewLabel==='F03'));assert(!hits.some(i=>i.statement==='SWIFT removal = total isolation'));
});
for(const [label,mutate] of [
 ['unapproved candidate',c=>c.items[0].id='unapproved'],['grade upgrade',c=>c.items.find(i=>i.reviewLabel==='ME01').evidenceStatus='VERIFIED'],
 ['canonical conflict value',c=>c.items.find(i=>i.knowledgeType==='CONFLICT').details.canonicalValue=24.9],
 ['unknown filled in',c=>c.items.find(i=>i.reviewLabel==='Q04').details.resolvedBy='invented'],
 ['swap actual funds',c=>c.items.find(i=>i.reviewLabel==='A02').details.relationType='FUNDS'],
 ['trade influence',c=>c.tradingInfluence=true],['source missing',c=>c.items[0].sourceRefs=['missing']],['guardrail treated as fact',c=>c.guardrails[0].assertion=true]
])await test('fail closed on '+label,()=>{const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateWorldModel(c,approval),/WORLD_MODEL_/);});
await test('reader and lookup callers cannot mutate later reads',()=>{const c=readWorldModel();c.items[0].statement='changed';assert.notEqual(readWorldModel().items[0].statement,'changed');});
await test('compact UI preserves warnings, provenance and HTML escaping',()=>{
 const html=worldModelPanel({data:readWorldModel()},{});assert(html.includes('Macro World Model — Batches 1–2'));assert(!/<details[^>]*\sopen[\s>]/.test(html));
 for(const text of ['CONDITIONAL_HYPOTHESIS','ALPHA_INFERENCE','UNKNOWN','CONFLICTED','UNBRIDGED','Hypothesis only','Current state enabled'])if(text!=='Current state enabled')assert(html.includes(text),text);
 assert(html.includes('not promoted to Runtime World Model'));assert(html.includes(approval.sourceReviewPath));
 const c=structuredClone(runtime);c.items[0].statement='<script>bad()</script>';assert(worldModelPanel({data:c},{}).includes('&lt;script&gt;'));assert(!worldModelPanel({data:c},{}).includes('<script>'));
 assert(worldModelPanel(null).includes('No research fallback'));
});
await test('legacy playbook notes do not absorb the World Model or gain approval',()=>{
 const catalog=macroCatalog(),input=macroNoteRequest({...macroNoteDefaults(catalog),title:'Test'},catalog,'00000000-0000-4000-8000-000000000000');
 const before=JSON.stringify(assessMacroNote(input,catalog)),original=JSON.stringify(catalog);
 macroPlaybookPage({macroPlaybook:{data:{catalog,notes:[],errors:[]}},macroWorldModel:{data:runtime}},{});
 assert.equal(JSON.stringify(catalog),original);assert.equal(JSON.stringify(assessMacroNote(input,catalog)),before);assert(!original.includes('MACRO_WORLD_MODEL'));
});
await test('saved-state read is additive, writes nothing, and leaves existing planning results unchanged',()=>temp(async dir=>{
 const s=createWorkbenchData({workspaceRoot:dir,now:()=> '2026-09-20T17:00:00.000Z'});
 const scenario=buildScenario({...plannerDefaults(),bid:'0.19',ask:'0.20',fees:'0.10',slippage:'0.20'}),before=s.evaluate(scenario);
 const state=await s.state();assert.equal(state.macroWorldModel.state,'AVAILABLE');assert.equal(state.macroWorldModel.data.items.length,74);
 readWorldModel({keyword:'gold'});assert.deepEqual(s.evaluate(scenario),before);assert.equal(readdirSync(dir).length,0);assert.equal(state.executionAllowed,false);
}));
await test('workbench HTTP lookup shares results, stays read-only and preserves local-origin guards',()=>temp(async dir=>{
 const app=await startOptionsWorkbench({port:0,workspaceRoot:dir,refreshContext:false});
 try{
  const response=await fetch(app.url+'/api/macro-world-model?keyword=SWIFT');assert.equal(response.status,200);assert.deepEqual(await response.json(),readWorldModel({keyword:'SWIFT'}));
  for(const query of ['?keyword=a&keyword=b','?unexpected=x','?theme=INVALID'])assert.equal((await fetch(app.url+'/api/macro-world-model'+query)).status,400);
  assert.equal((await fetch(app.url+'/api/macro-world-model',{method:'POST'})).status,404);
  assert.equal((await fetch(app.url+'/api/macro-world-model',{headers:{Origin:'https://example.com'}})).status,403);
  for(const asset of ['world-model.js','world-model-lookup.js'])assert.equal((await fetch(app.url+'/'+asset)).status,200);
  const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.macroWorldModel.data.items.length,74);assert.equal(state.backgroundContextRefreshEnabled,false);assert.equal(readdirSync(dir).length,0);
 }finally{await app.close();}
}));
console.log(`Macro World Model: ${passed}/${passed} tests passed.`);
