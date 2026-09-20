import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readWorldModel} from './lib/macro-world-model.mjs';
import {validateBatch2} from './lib/macro-world-model-batch2.mjs';
import {worldModelPanel} from '../apps/options-workbench/world-model.js';
import {lookupWorldModel} from '../apps/options-workbench/world-model-lookup.js';
import {paperFingerprint as fp} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
const root=resolve(import.meta.dirname,'..'),dir='src/engines/macro-world-model/';
const read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8'));
const a=read(dir+'BATCH_2_WORLD_MODEL_APPROVAL_V1.json'),c=read(dir+'BATCH_2_WORLD_MODEL_V1.json'),b=read(dir+'BATCH_1_WORLD_MODEL_V1.json'),p=read(a.sourceReviewPath),r=readWorldModel();
const sha=v=>createHash('sha256').update(v).digest('hex'),by=l=>c.items.find(i=>i.reviewLabel===l);
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
await test('Batch 2 exact approval is additive; research and review bytes stay immutable',()=>{
 assert.equal(c.items.length,36);assert.equal(c.edges.length,4);assert.equal(r.items.length,74);assert.equal(r.themes.length,10);
 assert.deepEqual(c.items.map(i=>i.id),a.approvedCandidateIds);assert.equal(sha(readFileSync(a.sourceReviewPath)),a.sourceReviewSha256);
 for(const file of [a.sourceReviewPath,...p.sourceBatch.files.map(f=>'docs/research/macro/batch-2/'+f.path.replace('../',''))])assert(readFileSync(file).equals(execFileSync('git',['show',a.sourceReviewCommit+':'+file],{maxBuffer:1024*1024})),file);
 assert.equal(p.status,'KNOWLEDGE_CANDIDATE_NOT_APPROVED');assert.equal(p.runtimeUse,'PROHIBITED');
});
await test('approved types, evidence grades, limitations and dedup lineage are preserved',()=>{
 const originals=[...p.candidates,...p.watchQuestions,...p.openQuestions,...p.conflicts];
 for(const i of c.items){const o=originals.find(x=>x.reviewLabel===i.reviewLabel);assert.equal(i.knowledgeType,o.knowledgeType);if(o.evidenceStatus)assert.equal(i.evidenceStatus,o.evidenceStatus);
  assert.deepEqual(i.sourceRefs,o.sourceRefs);assert.deepEqual(i.dossierRefs.map(d=>[d.section,d.anchor]),o.dossierRefs.map(d=>[d.section,d.anchor]));
  assert.deepEqual(i.originalReview.limitations,o.limitations||o.sourceLimitations||o.whatItCannotProve||[o.whyUnresolved]);
  if(o.dedupReview)assert.deepEqual(i.originalReview.dedupReview,o.dedupReview);assert(i.limitations.length);
 }
 assert.deepEqual(c.canonicalReferences.map(x=>x.canonicalKnowledgeId),p.aliasReferences.map(x=>x.canonicalKnowledgeId));
 for(const ref of c.canonicalReferences)assert(b.items.some(i=>i.id===ref.canonicalKnowledgeId));
});
await test('no Current State, actor/flow graph, dossier-only knowledge or affirmative rejection',()=>{
 assert(!c.items.some(i=>['CURRENT_STATE','ACTOR_RELATION','STRUCTURAL_FLOW_RELATION','HYPOTHESIS_ONLY_CONTEXT'].includes(i.knowledgeType)));
 for(const d of a.deferred)assert(![...r.items,...r.edges].some(i=>i.id===d.id));
 assert.equal(c.guardrails.length,13);for(const g of c.guardrails){assert.equal(g.disposition,'REJECT_FROM_RUNTIME');assert.equal(g.assertion,false);assert.equal(g.notInverseFact,true);assert(!r.items.some(i=>i.id===g.id));}
});
await test('four conflicts keep null canonical values, attribution and differing vintages',()=>{
 const cs=c.items.filter(i=>i.knowledgeType==='CONFLICT');assert.equal(cs.length,4);
 assert.deepEqual(cs.map(i=>i.status),['INCOMPARABLE','UNBRIDGED','UNBRIDGED','DISPUTED']);
 for(const i of cs){assert.equal(i.details.canonicalValue,null);assert.equal(i.details.resolvedBy,null);assert(i.details.claimA.sourceRef&&i.details.claimB.sourceRef);}
 assert.equal(by('B2-CF01').details.claimB.value,null);assert(by('B2-CF04').details.claimA.attribution.includes('government'));assert(by('B2-CF04').details.claimB.attribution.includes('Company'));
});
await test('unknowns and watches gain no resolution or background observation',()=>{
 assert.equal(c.items.filter(i=>i.knowledgeType==='OPEN_QUESTION').length,6);
 for(const i of c.items.filter(i=>i.knowledgeType==='OPEN_QUESTION')){assert.equal(i.evidenceStatus,'UNKNOWN');assert.equal(i.details.resolvedBy,null);}
 for(const i of c.items.filter(i=>i.knowledgeType==='WATCH_QUESTION')){assert.equal(i.details.automaticMonitoring,false);assert.equal(i.details.notice,'Question, not assertion.');}
});
await test('mechanism grades and all conditional reasoning fields stay explicit',()=>{
 assert.deepEqual(['01','02','03','04'].map(n=>by('B2-ME'+n).evidenceStatus),['CONDITIONAL_HYPOTHESIS','SUPPORTED_MECHANISM','SUPPORTED_MECHANISM','CONDITIONAL_HYPOTHESIS']);
 for(const i of c.items.filter(i=>i.knowledgeType==='MECHANISM'))for(const k of ['trigger','firstOrderEffect','secondOrderEffects','counterforces','observableConfirmation','falsification','timeHorizon'])assert(i.details[k]?.length,k);
});
await test('L7 is revised to utilization and route viability, never direct financing',()=>{
 const l=c.edges.find(e=>e.reviewLabel==='B2-L7');assert(l.statement.includes('transport infrastructure utilization / route viability'));assert(!/financing viability/i.test(l.statement));assert.equal(l.evidenceStatus,'SUPPORTED_MECHANISM');
 assert.equal(a.revisedEdges[0].approvedStatement,l.statement);assert.notEqual(a.revisedEdges[0].originalStatement,l.statement);assert(l.limitations[0].includes('B2-ME03/B2-ME04'));
 assert.deepEqual(c.edges.map(e=>e.reviewLabel),['B2-L1','B2-L3','B2-L4','B2-L7']);
});
await test('Batch 1 items, edges, original fingerprints and lookup behavior remain unchanged',()=>{
 for(const x of [...b.items,...b.edges]){const y=[...r.items,...r.edges].find(i=>i.id===x.id);assert.deepEqual(y,x);assert.equal(fp(y),fp(x));}
 assert.equal(r.approvalRef,b.approvalRef);
 for(const q of ['SWIFT','yen carry','gold','GLD','IBIT','Bitcoin Core']){const old=lookupWorldModel(b,{keyword:q}),next=readWorldModel({keyword:q});assert.deepEqual(next.items,old.items,q);assert.deepEqual(next.edges,old.edges,q);}
});
for(const [q,labels] of [['one China',['B2-K01']],['semiconductor',['B2-K03']],['foundry',['B2-K05']],['export controls',['B2-ME01']],['globalization',['B2-K06']],['deglobalization',['B2-K06','B2-K07']],['reshoring',['B2-K07']],['trade diversion',['B2-K06']],['data center',['B2-K08']],['AI power',['B2-K08','B2-K09','B2-K10']],['GW',['B2-K09']],['TWh',['B2-K09']],['PP&E',['B2-K11']],['cobalt',['B2-K12']],['mineral rights',['B2-K12']],['Africa',['B2-K12']],['BRI',['B2-K14']],['Belt and Road',['B2-K14']],['debt trap',['B2-K17']],['project debt',['B2-K16']]])await test('deterministic Batch 2 lookup: '+q,()=>{
 const hit=readWorldModel({keyword:q});for(const l of labels)assert(hit.items.some(i=>i.reviewLabel===l),l);assert.deepEqual(hit,lookupWorldModel(r,{keyword:q}));assert.equal(hit.tradingInfluence,false);assert(!hit.items.some(i=>i.reviewLabel.startsWith('B2-R')));
});
await test('political boundaries and reference UI retain attribution, gaps and English warnings',()=>{
 assert(by('B2-K01').statement.includes('PRC One-China Principle, US One-China Policy'));assert(by('B2-K01').limitations[0].includes('not a sovereignty ruling'));
 assert(by('B2-K12').statement.includes('does not establish control'));assert(by('B2-K17').statement.includes('does not establish a prearranged debt trap'));
 const html=worldModelPanel({data:r});for(const text of ['Batches 1–2','Measurement frameworks','Question, not assertion.','INCOMPARABLE','DISPUTED','UNBRIDGED','UNKNOWN','Provenance and approval','not promoted to Runtime World Model','Existing canonical references'])assert(html.includes(text),text);
 assert(!/<details[^>]*\sopen[\s>]/.test(html));
});
for(const [name,mutate] of [['unapproved ID',x=>x.items[0].id='new-id'],['trade influence',x=>x.tradingInfluence=true],['current-state item',x=>x.items[0].knowledgeType='CURRENT_STATE'],['false resolved conflict',x=>x.items.find(i=>i.knowledgeType==='CONFLICT').details.canonicalValue=40],['unknown resolved',x=>x.items.find(i=>i.knowledgeType==='OPEN_QUESTION').details.resolvedBy='invented'],['upgraded mechanism',x=>x.items.find(i=>i.reviewLabel==='B2-ME01').evidenceStatus='VERIFIED'],['L7 financing',x=>x.edges[3].statement='Resource cargo creates financing viability'],['guardrail fact',x=>x.guardrails[0].assertion=true]])await test('Batch 2 fails closed: '+name,()=>{const x=structuredClone(c);mutate(x);assert.throws(()=>validateBatch2(x,a,b),/WORLD_MODEL_BATCH2_/);});
await test('reading Batch 2 and searches do not write records or change any trade projection',async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'alpha-batch2-test-'));
 try{const s=createWorkbenchData({workspaceRoot:dir,now:()=> '2026-09-20T17:00:00.000Z'}),before=await s.state();for(const keyword of ['AI power','debt trap','one China'])readWorldModel({keyword});const after=await s.state();
  for(const k of ['guidance','candidateChecks','manual','positionWatch','marketExpectations','eventEntryPlans','capitalPolicy','storylines'])assert.deepEqual(after[k],before[k],k);assert.equal(readdirSync(dir).length,0);
 }finally{const rel=relative(tmpdir(),dir);assert(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-batch2-test-'));rmSync(dir,{recursive:true});}
});
console.log(`Batch 2 World Model: ${passed}/${passed} tests passed.`);
