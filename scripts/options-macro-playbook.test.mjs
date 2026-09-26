import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,cpSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {macroCatalog,macroKnowledge,macroSources,macroWorksheetFields,MACRO_PLAYBOOK_VERSION} from '../src/engines/options-knowledge/MacroKnowledgeCatalog.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {assessMacroNote,validateMacroNote} from '../src/engines/options-knowledge/OptionsMacroPlaybook.ts';
import {macroPlaybookView,saveMacroNote,readMacroNote} from './lib/options-macro-playbook-io.mjs';
import {macroNoteDefaults,macroNoteRequest,macroPlaybookPage,appendMacroReflection} from '../apps/options-workbench/macro-playbook.js';
import {startOptionsWorkbench} from './options-workbench.mjs';

const at='2026-09-18T03:00:00.000Z';
const note=()=>macroNoteRequest({...macroNoteDefaults(macroCatalog()),title:'Synthetic decision note'},macroCatalog(),randomUUID());
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-macro-playbook-'));try{await fn(root);}finally{const rel=relative(resolve(tmpdir()),resolve(root));assert.ok(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-macro-playbook-'));rmSync(root,{recursive:true,force:true});}}
// Read actual historical catalogs, never newly enriched text disguised as an old revision.
async function historicalCatalog(base){let catalog;await temp(async root=>{
 const cwd=fileURLToPath(new URL('..',import.meta.url));
 for(const name of ['MacroKnowledgeCatalog','MacroPsychologyCatalog'])writeFileSync(resolve(root,name+'.ts'),execFileSync('git',['show',base+':src/engines/options-knowledge/'+name+'.ts'],{cwd,encoding:'utf8'}));
 const historical=await import(pathToFileURL(resolve(root,'MacroKnowledgeCatalog.ts')).href);
 catalog=historical.macroCatalog();
});return catalog;}
const originalV1=await historicalCatalog('50d9ac7babe637603b1915f65ca063eaea4d9e53');
const originalV2=await historicalCatalog('db398f30fac7b4638b293a16bae7441bf20e194f');
const originalV3=await historicalCatalog('621143338a417337ee963e493bbf69682e6bcd88');
assert.equal(originalV1.contentRevision,'OWNER_PSYCHOLOGY_20260917_V1');
assert.equal(originalV2.contentRevision,'OWNER_PSYCHOLOGY_20260923_V2');
assert.equal(originalV3.contentRevision,'OWNER_PSYCHOLOGY_20260924_V3');

await test('catalog covers every submitted topic family and names no active rules',()=>{
  const c=macroCatalog();assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);assert.equal(new Set(c.items.map(i=>i.id)).size,c.items.length);
  for(const i of c.items){assert.ok(i.limits&&i.application);for(const id of i.sources)assert.ok(c.sources.some(s=>s.id===id));}
  const text=JSON.stringify(c.items);for(const topic of ['Travel','Scalper','Long-term investor','Value','Narrative','Mechanical stop','Positional stop','Thesis stop','MACD','Time-based stop','Built-in stop','Volatility stop','Overnight stop','Hedging stop','Cost control','Stop hunting','30% remaining time','One loss addition','Meditation','Lottery profit curve','Bull trap','Technical confirmation','Turbulent gain','Confidence formula'])assert.ok(text.includes(topic),topic);
  for(const id of ['mechanical','thirty-thirty','adding','windfall','giveback','catalyst-runner'])assert.equal(c.items.find(i=>i.id===id).status,'CANDIDATE_UNTESTED');
});
await test('catalog callers cannot mutate future catalogs, including nested psychology',()=>{
 const c=macroCatalog(),original=macroCatalog();
 c.items[0].title='changed';c.items[0].topics[0]='changed';c.sources[0].coverage='changed';
 c.psychology.biases[0].prompt='changed';c.psychology.prompts[0].text='changed';
 assert.deepEqual(macroCatalog(),original);
});
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
await test('V4 psychology catalog has 60 unique entries and attributed reflection questions',()=>{
 const c=macroCatalog();assert.equal(c.contentRevision,'OWNER_PSYCHOLOGY_20260926_V4');assert.equal(c.psychology.revision,c.contentRevision);assert.equal(c.reviewedDateNewYork,'2026-09-26');
 assert.equal(c.items.length,60);assert.equal(new Set(c.items.map(i=>i.id)).size,60);
 assert.equal(c.items.filter(i=>i.group==='Psychology and evidence').length,30);
 assert.equal(c.psychology.biases.length,17);assert.equal(c.psychology.prompts.length,20);
 assert.equal(new Set(c.psychology.biases.map(b=>b.id)).size,17);assert.equal(new Set(c.psychology.prompts.map(p=>p.id)).size,20);
 for(const b of c.psychology.biases){assert.equal(b.status,'REFLECTION_ONLY_NOT_DIAGNOSIS');assert.ok(c.sources.some(s=>s.id===b.source));}
 for(const id of ['psych-72-hours','psych-30-30','psych-breakout-clock'])assert.equal(c.items.find(i=>i.id===id).status,'CANDIDATE_UNTESTED');
 assert.match(c.items.find(i=>i.id==='psych-30-30').limits,/not equivalent/);
 assert.equal(c.items.find(i=>i.id==='psych-tunnel-vision').status,'PROCESS_GUIDE');
 assert.equal(c.items.find(i=>i.id==='psych-short-weakness').status,'CANDIDATE_UNTESTED');
 assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);
});
await test('political and market-mechanics additions remain evidence questions rather than scores or facts',()=>{
 const c=macroCatalog(),item=id=>c.items.find(i=>i.id===id),political=item('psych-political-entity-separation');
 assert.equal(c.items.filter(i=>i.id==='psych-political-entity-separation').length,1);assert.equal(political.status,'PROCESS_GUIDE');
 for(const topic of ['Country','Government','Party','People','Policy','Narrative','Macro evidence','Economic conflict','Transmission'])assert(political.topics.includes(topic),topic);
 assert.match(political.application,/who spoke.*authority.*rhetoric.*proposal.*implementation.*economic variable.*causal channel.*market had already priced.*counterevidence/i);
 assert.match(political.limits,/No political score, ideology classifier, voting advice or execution rule/);
 assert.match(item('psych-news').title,/Cross-check claims, not political averages/);
 assert.match(item('psych-news').application,/same evidence standard.*United States.*China.*observed, inferred or unknown.*trace the cost/i);
 assert.match(item('psych-second-order').application,/both sides|financing.*inflation.*FX.*rates.*margins.*capital flows/i);
 assert.match(item('psych-second-order').limits,/neither zero cost nor equal suffering/);
 assert.match(item('psych-short-weakness').application,/sell-side volume.*downward price impact.*hypotheses/i);
 assert.match(item('psych-short-weakness').limits,/does not reveal counterparties.*neither bearish nor bullish.*no short rule/i);
 assert.equal(item('psych-short-weakness').status,'CANDIDATE_UNTESTED');
 assert.match(c.sources.find(s=>s.id==='owner-psychology-20260924').coverage,/current U.S.\/China claims.*require verification/i);
 for(const key of ['countryScore','partyScore','leaderScore','politicalRecommendation'])assert.equal(Object.hasOwn(c,key),false);
 assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);
});
await test('new experience items remain educational and do not extend the trading universe',()=>{
 const c=macroCatalog(),tunnel=c.items.find(i=>i.id==='psych-tunnel-vision'),short=c.items.find(i=>i.id==='psych-short-weakness');
 assert.ok(tunnel&&short);assert.equal(tunnel.title,'A trade system is more than the entry signal');
 for(const topic of ['Tunnel vision','Selective reading','Entry signal','Invalidation','No trade'])assert.ok(tunnel.topics.includes(topic),topic);
 assert.match([tunnel.principle,tunnel.application,tunnel.limits].join(' '),/counterevidence|contrary evidence/i);
 assert.match([short.principle,short.application,short.limits].join(' '),/100[–-]500%|prior gain|large rise/i);
 assert.match(short.limits,/untested/i);assert.match(short.limits,/GLD\/IBIT|trading scope/i);
});
await test('reflection append preserves draft and does not silently record an answer',()=>{
 const c=macroCatalog(),draft={...macroNoteDefaults(c),title:'Existing title',sources:'Original source',personalNote:'Existing reflection'};
 const before=structuredClone(draft),after=appendMacroReflection(draft,c,'holding-anchor');assert.deepEqual(draft,before);
 assert.equal(after.title,before.title);assert.equal(after.sources,before.sources);assert.ok(after.personalNote.startsWith('Existing reflection\n\n'));
 assert.match(after.personalNote,/My reflection: $/);assert.ok(!Object.hasOwn(after,'recordedAt'));
 const n=macroNoteRequest(after,c,randomUUID());assert.equal(assessMacroNote(n).documentedFields,1);assert.equal(assessMacroNote(n).process.status,'UNKNOWN');
});
await test('three V2 prompts append to a draft without changing assessment or saving',()=>temp(root=>{
 const c=macroCatalog();
 for(const [id,stage,title] of [
   ['holding-thesis-change','While holding','Price move or thesis break?'],
   ['holding-fresh-cash','While holding','Would I buy it fresh today?'],
   ['entry-size-confidence','Before entry','Risk budget or confidence?'],
 ]){
   const prompt=c.psychology.prompts.find(p=>p.id===id);assert.ok(prompt,id);assert.equal(prompt.stage,stage);assert.equal(prompt.title,title);
   const draft={...macroNoteDefaults(c),title:'Existing draft',personalNote:'Prior reflection'};
   const before=structuredClone(draft),beforeAssessment=assessMacroNote(macroNoteRequest(draft,c,randomUUID()));
   const after=appendMacroReflection(draft,c,id);
   assert.deepEqual(draft,before);assert.equal(after.title,before.title);
   assert.ok(after.personalNote.includes(prompt.text));assert.ok(after.personalNote.startsWith('Prior reflection\n\n'));
   assert.deepEqual(Object.keys(after).sort(),Object.keys(draft).sort());assert.ok(!Object.hasOwn(after,'recordedAt'));
   assert.deepEqual(assessMacroNote(macroNoteRequest(after,c,randomUUID())),beforeAssessment);
   assert.equal(macroPlaybookView(root).notes.length,0);
 }
 assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);
}));
await test('two V3 prompts remain optional and do not change assessment or save',()=>temp(root=>{
 const c=macroCatalog();
 for(const [id,stage] of [['entry-evidence-or-allegiance','Before entry'],['holding-pressure-or-weakness','While holding']]){
   const prompt=c.psychology.prompts.find(p=>p.id===id);assert.equal(prompt?.stage,stage);assert.equal(prompt.status,'REFLECTION_ONLY_NOT_DIAGNOSIS');
   const draft={...macroNoteDefaults(c),title:'Existing draft',personalNote:'Existing reflection'},before=structuredClone(draft);
   const assessment=assessMacroNote(macroNoteRequest(draft,c,randomUUID())),after=appendMacroReflection(draft,c,id);
   assert.deepEqual(draft,before);assert.equal(after.title,before.title);assert(after.personalNote.includes(prompt.text));
   assert.deepEqual(assessMacroNote(macroNoteRequest(after,c,randomUUID())),assessment);
   assert.equal(macroPlaybookView(root).notes.length,0);
 }
 assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);
}));
await test('seven distinct V4 additions retain process and inactive candidate statuses',()=>{
 const c=macroCatalog(),newIds=['psych-loss-attribution','psych-0dte-one-and-done','psych-extreme-point-precision','psych-daily-loss-limit','psych-two-hesitations','psych-rescue-complexity','psych-thesis-position-separation'];
 assert.deepEqual(c.items.filter(i=>!originalV3.items.some(old=>old.id===i.id)).map(i=>i.id).sort(),newIds.slice().sort());
 for(const id of newIds){const i=c.items.find(i=>i.id===id);assert.equal(i.status,['psych-0dte-one-and-done','psych-daily-loss-limit','psych-two-hesitations'].includes(id)?'CANDIDATE_UNTESTED':'PROCESS_GUIDE');assert.ok(i.sources.includes('owner-psychology-20260926'));}
 const source=c.sources.find(s=>s.id==='owner-psychology-20260926');assert.ok(source);assert.match(source.coverage,/experience|educational/i);assert.match(source.coverage,/not.*validat|unverified/i);
 assert.deepEqual(c.psychology.biases,originalV3.psychology.biases);
 assert.equal(c.activeRuleCount,0);assert.equal(c.executionAllowed,false);
});
await test('daily loss limit remains UNKNOWN with no numeric amount or executable rule',()=>{
 const i=macroCatalog().items.find(i=>i.id==='psych-daily-loss-limit'),text=[i.principle,i.application,i.limits].join(' ');
 assert.equal(i.status,'CANDIDATE_UNTESTED');assert.match(text,/dailyLossLimit\s*=\s*UNKNOWN/);
 assert.doesNotMatch(text,/dailyLossLimit\s*=\s*[\d$]|\$\s*\d|\d+\s*%/);
 assert.match(text,/realized.*unrealized/i);assert.match(text,/reset|timezone/i);assert.match(text,/Owner.*approval|approval.*Owner/i);
});
await test('six V4 prompts append only voluntary draft text without assessment or persistence',()=>temp(root=>{
 const c=macroCatalog(),prompts=[['review-loss-attribution','After a decision'],['entry-total-exposure','Before entry'],['entry-euphoria-gate','Before entry'],['holding-stop-drift','While holding'],['holding-rescue-complexity','While holding'],['holding-thesis-position','While holding']];
 assert.deepEqual(c.psychology.prompts.filter(p=>!originalV3.psychology.prompts.some(old=>old.id===p.id)).map(p=>p.id).sort(),prompts.map(([id])=>id).sort());
 for(const [id,stage] of prompts){
   const p=c.psychology.prompts.find(p=>p.id===id);assert.equal(p.stage,stage);assert.equal(p.status,'REFLECTION_ONLY_NOT_DIAGNOSIS');
   const draft={...macroNoteDefaults(c),title:'Unfrozen optional reflection',personalNote:'Voluntary statement'},before=structuredClone(draft),assessment=assessMacroNote(macroNoteRequest(draft,c,randomUUID()));
   const after=appendMacroReflection(draft,c,id);assert.deepEqual(draft,before);assert.ok(after.personalNote.includes(p.text));
   assert.deepEqual({...after,personalNote:before.personalNote},before);assert.deepEqual(assessMacroNote(macroNoteRequest(after,c,randomUUID())),assessment);
   assert.equal(macroPlaybookView(root).notes.length,0);assert.deepEqual(readdirSync(root),[]);
 }
}));
await test('thesis-position reflection and rescue text cannot assign loss cause or mutate predictions',()=>temp(root=>{
 const c=macroCatalog(),draft={...macroNoteDefaults(c),title:'Synthetic review',personalNote:'I feel euphoric; exit twice, roll and add size to recover the loss.'},assessment=assessMacroNote(macroNoteRequest(draft,c,randomUUID()));
 for(const id of ['holding-thesis-position','holding-rescue-complexity','review-loss-attribution']){
   const n=macroNoteRequest(appendMacroReflection(draft,c,id),c,randomUUID()),before=structuredClone(n);
   assert.deepEqual(assessMacroNote(n),assessment);assert.deepEqual(n,before);assert.equal(assessMacroNote(n).process.status,'UNKNOWN');
   assert.equal(Object.hasOwn(n,'prediction'),false);assert.equal(Object.hasOwn(n,'lossCause'),false);
   assert.throws(()=>validateMacroNote({...n,prediction:{accuracy:'CORRECT'}}),/FIELDS/);
   assert.throws(()=>validateMacroNote({...n,execute:true}),/FIELDS/);
 }
 const saved=saveMacroNote(root,macroNoteRequest(draft,c,randomUUID()),at);
 function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(path,e.name)):[relative(root,resolve(path,e.name)).replaceAll('\\','/')]);}
 assert.deepEqual(files(root),[saved.path]);assert.equal(saved.executionAllowed,false);
}));
await test('unknown prompt and overflow reject without truncating or changing input',()=>{
 const c=macroCatalog(),d={...macroNoteDefaults(c),personalNote:'x'.repeat(1400)},before=JSON.stringify(d);
 assert.throws(()=>appendMacroReflection(d,c,'entry-urge'),/exceed 1,400/);assert.equal(JSON.stringify(d),before);
 assert.throws(()=>appendMacroReflection(d,c,'missing'),/unavailable/);
});
await test('prompt length boundary accepts exactly 1400 and rejects 1401',()=>{
 const c=macroCatalog(),empty=appendMacroReflection(null,c,'entry-urge').personalNote;
 const d={...macroNoteDefaults(c),personalNote:'x'.repeat(1400-empty.length-2)};
 assert.equal(appendMacroReflection(d,c,'entry-urge').personalNote.length,1400);
 assert.throws(()=>appendMacroReflection({...d,personalNote:d.personalNote+'x'},c,'entry-urge'),/exceed/);
});
await test('emotional prose never changes assessment, confidence or allocation',()=>{
 const n=note(),a=assessMacroNote(n);n.personalNote='Panic, FOMO, I need to recover losses. I am certain the next trade will win.';
 assert.deepEqual(assessMacroNote(n),a);
 assert.equal(macroCatalog().activeRuleCount,0);assert.equal(macroCatalog().executionAllowed,false);
});
await test('legacy note recovers and retries using its original catalog without augmentation',()=>temp(root=>{
 const n=note(),catalog={version:MACRO_PLAYBOOK_VERSION,reviewedDateNewYork:'2026-09-17',sources:macroSources,items:macroKnowledge,fields:macroWorksheetFields,strategyStatus:'UNVALIDATED',activeRuleCount:0,executionAllowed:false,boundary:'Educational references and owner-authored notes. No new trading rule, source collection or study enrollment.'};
 const payload={version:MACRO_PLAYBOOK_VERSION,recordedAt:at,input:n,catalog,assessment:assessMacroNote(n,catalog)};
 const path='data/runtime/options-macro-playbook/notes/'+n.requestId+'.json';mkdirSync(resolve(root,'data/runtime/options-macro-playbook/notes'),{recursive:true});
 const bytes=JSON.stringify({...payload,fingerprint:paperFingerprint(payload)});writeFileSync(resolve(root,path),bytes);
 const recovered=readMacroNote(root,path);assert.equal(recovered.catalog.items.length,30);assert.equal(recovered.catalog.psychology,undefined);
 const retry=saveMacroNote(root,n,'2026-09-19T03:00:00.000Z');assert.equal(retry.recordedAt,at);assert.equal(retry.alreadyRecorded,true);assert.equal(readFileSync(resolve(root,path),'utf8'),bytes);
 assert.equal(macroPlaybookView(root).notes[0].catalog.psychology,undefined);
}));
await test('pre-V2 psychology note keeps its actual copied V1 catalog and original bytes',()=>temp(root=>{
 const n=note(),catalog=structuredClone(originalV1);
 assert.equal(catalog.items.length,50);assert.equal(catalog.psychology.prompts.length,9);
 const payload={version:MACRO_PLAYBOOK_VERSION,recordedAt:at,input:n,catalog,assessment:assessMacroNote(n,catalog)};
 const path='data/runtime/options-macro-playbook/notes/'+n.requestId+'.json',bytes=JSON.stringify({...payload,fingerprint:paperFingerprint(payload)});
 mkdirSync(resolve(root,'data/runtime/options-macro-playbook/notes'),{recursive:true});writeFileSync(resolve(root,path),bytes);
 const recovered=readMacroNote(root,path);assert.deepEqual(recovered.catalog,catalog);
 assert.equal(recovered.catalog.contentRevision,'OWNER_PSYCHOLOGY_20260917_V1');
 assert.equal(macroPlaybookView(root).catalog.contentRevision,'OWNER_PSYCHOLOGY_20260926_V4');
 assert.equal(macroPlaybookView(root).notes[0].catalog.contentRevision,'OWNER_PSYCHOLOGY_20260917_V1');
 assert.equal(saveMacroNote(root,n,'2026-09-24T03:00:00.000Z').alreadyRecorded,true);
 assert.equal(readFileSync(resolve(root,path),'utf8'),bytes);
}));
await test('pre-V3 psychology note recovers its copied V2 catalog and exact bytes',()=>temp(root=>{
 const n=note(),catalog=structuredClone(originalV2);
 assert.equal(catalog.items.length,52);assert.equal(catalog.psychology.prompts.length,12);
 const payload={version:MACRO_PLAYBOOK_VERSION,recordedAt:at,input:n,catalog,assessment:assessMacroNote(n,catalog)};
 const path='data/runtime/options-macro-playbook/notes/'+n.requestId+'.json',bytes=JSON.stringify({...payload,fingerprint:paperFingerprint(payload)});
 mkdirSync(resolve(root,'data/runtime/options-macro-playbook/notes'),{recursive:true});writeFileSync(resolve(root,path),bytes);
 assert.deepEqual(readMacroNote(root,path).catalog,catalog);assert.equal(macroPlaybookView(root).notes[0].catalog.contentRevision,'OWNER_PSYCHOLOGY_20260923_V2');
 assert.equal(saveMacroNote(root,n,'2026-09-25T03:00:00.000Z').alreadyRecorded,true);assert.equal(readFileSync(resolve(root,path),'utf8'),bytes);
}));
await test('actual pre-V4 V3 copied catalog recovers alone and retries with identical bytes',()=>temp(root=>temp(copy=>{
 const n=note(),catalog=structuredClone(originalV3),payload={version:MACRO_PLAYBOOK_VERSION,recordedAt:at,input:n,catalog,assessment:assessMacroNote(n,catalog)};
 assert.equal(catalog.items.length,53);assert.equal(catalog.psychology.prompts.length,14);
 const path='data/runtime/options-macro-playbook/notes/'+n.requestId+'.json',bytes=JSON.stringify({...payload,fingerprint:paperFingerprint(payload)});
 mkdirSync(resolve(root,'data/runtime/options-macro-playbook/notes'),{recursive:true});writeFileSync(resolve(root,path),bytes);
 mkdirSync(resolve(copy,'data/runtime/options-macro-playbook/notes'),{recursive:true});cpSync(resolve(root,path),resolve(copy,path));
 assert.deepEqual(readMacroNote(copy,path).catalog,originalV3);assert.deepEqual(readMacroNote(copy,path),readMacroNote(root,path));
 assert.equal(macroPlaybookView(copy).catalog.contentRevision,'OWNER_PSYCHOLOGY_20260926_V4');assert.deepEqual(macroPlaybookView(copy).notes[0].catalog,originalV3);
 assert.equal(saveMacroNote(copy,n,'2026-09-26T03:00:00.000Z').alreadyRecorded,true);assert.equal(readFileSync(resolve(copy,path),'utf8'),bytes);
})));
await test('new record copies the complete V4 catalog independently of callers',()=>temp(root=>{
 const current=macroCatalog(),saved=saveMacroNote(root,note(),at),c=macroCatalog();
 c.psychology.prompts[0].text='changed';c.psychology.biases[0].prompt='changed';c.items[0].title='changed';c.sources.at(-1).coverage='changed';
 const r=readMacroNote(root,saved.path);assert.deepEqual(r.catalog,current);
 assert.equal(r.catalog.contentRevision,'OWNER_PSYCHOLOGY_20260926_V4');
 assert.equal(r.catalog.items.length,60);assert.equal(r.catalog.psychology.prompts.length,20);
 assert.notEqual(r.catalog.psychology.prompts[0].text,'changed');
}));
await test('expanded catalog still permits a maximum-size valid note',()=>temp(root=>{
 const n=note();n.title='x'.repeat(160);n.originalPlanRef='x'.repeat(500);n.reviewEvidence='x'.repeat(2000);n.personalNote='x'.repeat(1400);
 for(const key of Object.keys(n.answers))n.answers[key]='界'.repeat(1400);
 const saved=saveMacroNote(root,n,at);assert.equal(readMacroNote(root,saved.path).input.personalNote.length,1400);
}));
await test('psychology rendering escapes reference content and legacy catalog stays usable',()=>temp(root=>{
 const desk=macroPlaybookView(root);desk.catalog.psychology.prompts[0].title='<img src=x>';desk.catalog.psychology.biases[0].prompt='<script>bad</script>';
 const html=macroPlaybookPage({macroPlaybook:{data:desk}},{});assert.ok(!html.includes('<img src=x>'));assert.ok(!html.includes('<script>bad</script>'));
 assert.ok(html.includes('data-macro-prompt="entry-urge"'));assert.ok(html.includes('Before entry'));assert.ok(html.includes('While holding'));assert.ok(html.includes('After a decision'));
 delete desk.catalog.psychology;assert.ok(!macroPlaybookPage({macroPlaybook:{data:desk}},{}).includes('id="macro-psychology"'));
}));
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
   for(const action of ['ACTIVATE_RULE','EXECUTE_TRADE','SET_ALLOCATION','SET_DAILY_LOSS_LIMIT','UPDATE_PREDICTION','ACTIVATE_EXIT'])await assert.rejects(()=>request('/api/macro-playbook',{action,request:n}));
   assert.equal((await originalFetch(app.url+'/api/macro-playbook/execute',{method:'POST',headers:{'content-type':'application/json',Origin:app.url},body:JSON.stringify({action:'SAVE',request:n})})).status,404);
   await assert.rejects(()=>request('/api/orders',{}),/Unsupported/);
 }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;await app.close();}
}));
console.log(`Macro playbook: ${passed}/${passed} tests passed.`);
