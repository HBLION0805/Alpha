import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {reconcileManualLedger,validateManualLedgerCommand} from '../../src/engines/options-manual-ledger/OptionsManualLedger.ts';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {readSourceRecord,sourceRecordFiles,sourcePlanOptions,validateSourceDraft} from './options-source-comparison.mjs';
import {verifyExpectation} from './options-market-expectation-io.mjs';
import {verifyScenario} from './options-scenario-research.mjs';
import {evidenceLoopView} from './options-evidence-loop.mjs';
import {repositoryKinds,repository,repositoryExport,eventEntity,canonicalRepository} from './options-case-repositories.mjs';

export const SOURCE_BASE='data/runtime/options-macro-comparisons/';
export const caseSha=v=>createHash('sha256').update(v).digest('hex');
export const caseJson=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
export const caseFail=c=>{throw Error('CASE_EXPORT_'+c);};
const same=(a,b)=>fp(a)===fp(b);
const exact=(v,keys)=>{if(!v||Object.keys(v).sort().join()!==keys.split(',').sort().join())caseFail('RECORD_SHAPE');};
export const storePaths=id=>({prediction:`data/runtime/prediction-log/${id}.ndjson`,journal:`data/runtime/alpha-journal/${id}.ndjson`,research:'data/runtime/research-lab/research-lab-v1.ndjson',strategy:'data/runtime/strategy-versioning/strategy-versioning-v1.ndjson'});
function visit(v,fn,parent=null,key=''){
  fn(v,parent,key);if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))visit(x,fn,v,k);
}
// Only complete structured local references; prose and publisher URLs are not paths.
export function recordLinks(v){
  const links=[];visit(v,(x,parent,key)=>{
    if(typeof x!=='string'||!x.startsWith('data/runtime/'))return;
    if(/[\s]/.test(x))return; // A narrative mentioning a path is not a file request.
    if(x.includes('..')||x.includes('\\')||!/^data\/runtime\/[a-zA-Z0-9_/.-]+(?:#sha256:[a-f0-9]{64})?$/.test(x))caseFail('REFERENCE_PATH');
    const fingerprint=key==='path'?parent.fingerprint:key.endsWith('Path')?parent[key.replace(/Path$/,'Fingerprint')]:null;
    links.push({target:x,fingerprint:fingerprint??null});
  });return [...new Map(links.map(x=>[x.target+'|'+x.fingerprint,x])).values()].sort((a,b)=>a.target.localeCompare(b.target));
}
function sourceSeeds(record,caseId,plans){
  const p=record.payload;
  return p.tradeId===caseId||p.request?.tradeId===caseId||
    p.request?.planKey&&plans.some(x=>x.key===p.request.planKey&&x.version===p.request.planVersion)||
    (p.assessment?.bindings??[]).some(b=>b.tradeId===caseId&&plans.some(x=>x.key===b.planKey&&x.version===b.planVersion));
}
const textRefs=v=>{const out=[];visit(v,(x,p,k)=>{if(typeof x==='string'&&(['researchId','versionId','strategyVersionId'].includes(k)||k==='referenceId'&&['RESEARCH','STRATEGY'].includes(p.recordType)))out.push(x);});return out;};
function safeEvents(root,path){
  if(!existsSync(resolve(root,path)))return [];
  if(existsSync(resolve(root,path.replace(/\.ndjson$/,'.lock')))||existsSync(resolve(root,path.slice(0,path.lastIndexOf('/'))+'/writer.lock')))caseFail('SOURCE_LOCKED');
  const raw=io.readBytes(root,path,32*1024*1024).toString('utf8');
  if(!raw)return [];if(!raw.endsWith('\n'))caseFail('TRUNCATED_STORE');
  const lines=raw.slice(0,-1).split('\n');if(lines.length>1000)caseFail('SOURCE_BOUND');
  return lines.map(line=>{const e=JSON.parse(line);if(![JSON.stringify(e),canonicalRepository(e)].includes(line))caseFail('REPOSITORY_ENCODING');return e;});
}
function ownedJournal(e,caseId,predictions){
  const entry=e.entry;return entry&&(entry.correlationId===caseId||(entry.evidence?.trades??[]).some(t=>t.referenceId===caseId)||(entry.evidence?.predictions??[]).some(p=>predictions.has(p.referenceId)));
}
export function resolveCase(root,ledgerId,caseId,at){
  const raw=readManualLedger(root,ledgerId,()=>at),events=raw.input.events.filter(e=>e.command.tradeId===caseId);
  if(!events.length)caseFail('CASE_NOT_FOUND');
  const metadata={ledgerId,origin:raw.input.origin,createdAt:raw.input.createdAt,sourceHeadSha256:raw.headSha256};
  const records=events.map(e=>({kind:'manual',id:'manual:'+e.sequence,sourcePath:raw.base+'/'+String(e.sequence).padStart(6,'0')+'.json',value:{event:e,payload:raw.payloads[e.sequence-1],receipt:JSON.parse(raw.files.find(f=>f.path===raw.base+'/'+String(e.sequence).padStart(6,'0')+'.receipt.json').bytes)}}));
  const plans=sourcePlanOptions(raw.report).filter(p=>p.tradeId===caseId),catalog=new Map();
  for(const file of sourceRecordFiles(root)){const path=SOURCE_BASE+file;const r=readSourceRecord(root,path);catalog.set(path,r);}
  const selected=new Set([...catalog.values()].filter(r=>sourceSeeds(r,caseId,plans)).map(r=>r.path));
  for(const ref of recordLinks(events))if(ref.target.startsWith(SOURCE_BASE))selected.add(ref.target);
  for(const path of selected){const r=catalog.get(path);if(r)for(const ref of recordLinks(r.payload))if(ref.target.startsWith(SOURCE_BASE))selected.add(ref.target);}
  for(const path of [...selected].sort()){const r=catalog.get(path);if(r){const {path:_,...value}=r;records.push({kind:'source',id:path,sourcePath:path,value});}}
  const stores=storePaths(ledgerId),all={};
  for(const kind of repositoryKinds){all[kind]=safeEvents(root,stores[kind]);repository(kind,all[kind]);}
  const predIds=new Set(all.prediction.filter(e=>e.prediction?.manualOrigin?.planId===caseId).map(e=>eventEntity('prediction',e)));
  const journalIds=new Set(all.journal.filter(e=>ownedJournal(e,caseId,predIds)).map(e=>eventEntity('journal',e)));
  const chosen={prediction:all.prediction.filter(e=>predIds.has(eventEntity('prediction',e))),journal:all.journal.filter(e=>journalIds.has(eventEntity('journal',e))),research:[],strategy:[]};
  // Generic research/strategy records are included only by explicit identity, never
  // by title, ticker or a shared event. Research supersession adds required lineage.
  const refs=new Set(textRefs([records,chosen]));
  const researchIds=new Set(all.research.filter(e=>e.record&&refs.has(e.record.researchId)).map(e=>e.record.researchId));
  let changed=true;while(changed){changed=false;for(const e of all.research){const s=e.supersession;if(s&&(researchIds.has(s.priorResearchId)||researchIds.has(s.newResearchId)))for(const id of [s.priorResearchId,s.newResearchId])if(!researchIds.has(id)){researchIds.add(id);changed=true;}}}
  chosen.research=all.research.filter(e=>researchIds.has(eventEntity('research',e)));
  textRefs(chosen.research).forEach(x=>refs.add(x));
  const definitions=new Set(all.strategy.filter(e=>e.version&&refs.has(e.version.versionId)).map(e=>e.version.definitionId));
  const versions=new Set(all.strategy.filter(e=>e.version&&definitions.has(e.version.definitionId)).map(e=>e.version.versionId));
  chosen.strategy=all.strategy.filter(e=>definitions.has(eventEntity('strategy',e))||versions.has(eventEntity('strategy',e)));
  for(const kind of repositoryKinds)for(const e of chosen[kind])records.push({kind,id:kind+':'+(e.sequence??all[kind].indexOf(e)+1),sourcePath:stores[kind],value:e});
  return {caseId,ledgerId,at,metadata,records};
}
function reportFor(bundle){
  const original=bundle.records.filter(r=>r.kind==='manual').map(r=>r.value.event),input={ledgerId:bundle.ledgerId,origin:bundle.metadata.origin,createdAt:bundle.metadata.createdAt,events:original.map((e,i)=>({...e,sequence:i+1}))};
  const report=reconcileManualLedger(input,bundle.at);
  // The public view receives original event clocks/identities, not local ordinals.
  return {...report,events:original,planRecords:original.filter(e=>['SAVE_PLAN_DRAFT','SAVE_POSITION_REVIEW'].includes(e.command.type))};
}
export function validateCaseRecords(bundle){
  exact(bundle,'caseId,ledgerId,at,metadata,records');exact(bundle.metadata,'ledgerId,origin,createdAt,sourceHeadSha256');
  if(bundle.metadata.ledgerId!==bundle.ledgerId||!/^[a-f0-9]{64}$/.test(bundle.metadata.sourceHeadSha256))caseFail('LEDGER_PROVENANCE');
  const ids=new Set(),manual=[];
  for(const r of bundle.records){
    exact(r,'kind,id,sourcePath,value');
    const receivedAt=r.value.event?.savedAt??r.value.savedAt??r.value.acceptedAt;
    if(receivedAt&&receivedAt>bundle.at)caseFail('RECORD_AFTER_EXPORT_CLOCK');
    if(ids.has(r.id))caseFail('DUPLICATE_RECORD');ids.add(r.id);
    if(r.kind==='manual'){
      const {event:e,payload:p,receipt:t}=r.value;
      if(e.command.tradeId!==bundle.caseId||p.ledgerId!==bundle.ledgerId||t.ledgerId!==bundle.ledgerId)caseFail('FOREIGN_CASE');
      const c=validateManualLedgerCommand(JSON.parse(p.sourceText),p.recordedAt);
      if(p.version!=='OPTIONS_MANUAL_EVENT_V1'||t.version!=='OPTIONS_MANUAL_RECEIPT_V1'||r.id!=='manual:'+e.sequence||r.sourcePath!==`data/runtime/options-manual-ledger/${bundle.ledgerId}/${String(e.sequence).padStart(6,'0')}.json`||p.sequence!==e.sequence||t.sequence!==e.sequence||!same(c,e.command)||p.commandFingerprint!==fp(c)||p.sourceSha256!==caseSha(Buffer.from(p.sourceText))||t.payloadSha256!==caseSha(caseJson(p))||t.savedAt!==e.savedAt||p.recordedAt!==e.recordedAt||t.executionAllowed!==false)caseFail('MANUAL_INTEGRITY');
      if(!/^[a-f0-9]{64}$/.test(p.previousSha256)||t.savedAt<e.recordedAt||manual.length&&(manual.at(-1).sequence>=e.sequence||manual.at(-1).savedAt>e.recordedAt))caseFail('MANUAL_ORDER');manual.push(e);
    }else if(r.kind==='source'){
      const {fingerprint,...p}=r.value;
      if(p.version!=='OPTIONS_SOURCE_COMPARISON_V1'||fp(p)!==fingerprint||r.id!==r.sourcePath||r.sourcePath!==SOURCE_BASE+'source-'+p.kind+'-'+p.id+'.json')caseFail('BUSINESS_FINGERPRINT');
      if(p.payload.ledgerId&&p.payload.ledgerId!==bundle.ledgerId)caseFail('FOREIGN_CASE');
    }else if(!repositoryKinds.includes(r.kind)||r.sourcePath!==storePaths(bundle.ledgerId)[r.kind])caseFail('RECORD_WHITELIST');
  }
  if(!manual.length)caseFail('CASE_NOT_FOUND');
  const report=reportFor(bundle),plans=sourcePlanOptions(report),sources=bundle.records.filter(r=>r.kind==='source'),selected=new Set(sources.filter(r=>sourceSeeds(r.value,bundle.caseId,plans)).map(r=>r.id));
  recordLinks(manual).forEach(ref=>{if(ref.target.startsWith(SOURCE_BASE))selected.add(ref.target);});
  for(const id of selected){const r=sources.find(x=>x.id===id);if(r)recordLinks(r.value.payload).forEach(ref=>{if(ref.target.startsWith(SOURCE_BASE))selected.add(ref.target);});}
  if(sources.some(r=>!selected.has(r.id)))caseFail('FOREIGN_CASE');
  const repos={};for(const kind of repositoryKinds){const rows=bundle.records.filter(r=>r.kind===kind);repos[kind]=repository(kind,rows.map(r=>r.value),true);}
  const preds=repos.prediction.query();if(preds.some(p=>p.manualOrigin?.planId!==bundle.caseId))caseFail('FOREIGN_CASE');
  const predIds=new Set(preds.map(p=>p.predictionId));
  if(bundle.records.some(r=>r.kind==='journal'&&r.value.entry&&!ownedJournal(r.value,bundle.caseId,predIds)))caseFail('FOREIGN_CASE');
  const explicit=new Set(textRefs([manual,sources,bundle.records.filter(r=>['prediction','journal'].includes(r.kind))]));
  const research=bundle.records.filter(r=>r.kind==='research');let allowed=new Set(research.filter(r=>r.value.record&&explicit.has(r.value.record.researchId)).map(r=>r.value.record.researchId));
  let changed=true;while(changed){changed=false;for(const r of research){const s=r.value.supersession;if(s&&(allowed.has(s.priorResearchId)||allowed.has(s.newResearchId)))for(const id of [s.priorResearchId,s.newResearchId])if(!allowed.has(id)){allowed.add(id);changed=true;}}}
  if(research.some(r=>!allowed.has(eventEntity('research',r.value))))caseFail('FOREIGN_CASE');
  textRefs(research).forEach(x=>explicit.add(x));
  const strategy=bundle.records.filter(r=>r.kind==='strategy'),defs=new Set(strategy.filter(r=>r.value.version&&explicit.has(r.value.version.versionId)).map(r=>r.value.version.definitionId));
  const vers=new Set(strategy.filter(r=>r.value.version&&defs.has(r.value.version.definitionId)).map(r=>r.value.version.versionId));
  if(strategy.some(r=>!defs.has(eventEntity('strategy',r.value))&&!vers.has(eventEntity('strategy',r.value))))caseFail('FOREIGN_CASE');
  const graph=[],unresolved=[];
  for(const r of bundle.records)for(const ref of recordLinks(r.kind==='source'?r.value.payload:r.value)){
    const target=sources.find(s=>s.id===ref.target);
    if(target&&ref.fingerprint&&target.value.fingerprint!==ref.fingerprint)caseFail('REFERENCE_FINGERPRINT');
    const edge={from:r.id,...ref,status:target?'RESOLVED':'UNRESOLVED_REFERENCE'};graph.push(edge);if(!target)unresolved.push(edge);
  }
  for(const r of sources.filter(r=>r.value.kind==='saved')){
    const p=r.value.payload;
    for(const [target,expected] of [[p.request.draftPath,p.draftFingerprint],[p.packagePath,p.packageFingerprint]]){
      const found=sources.find(s=>s.id===target);if(found&&found.value.fingerprint!==expected)caseFail('REFERENCE_FINGERPRINT');
    }
  }
  // Revisions and source packages form an acyclic dependency graph. Never
  // substitute a newer version to repair a cycle or a mismatched pinned link.
  const done=new Set(),active=new Set();
  const walk=id=>{if(active.has(id))caseFail('REFERENCE_CYCLE');if(done.has(id))return;active.add(id);for(const e of graph.filter(e=>e.from===id&&e.status==='RESOLVED'))walk(e.target);active.delete(id);done.add(id);};
  sources.forEach(r=>walk(r.id));
  // Explicit IDs not mapped by a supported store stay visible, including source
  // fingerprint references used by the original Options Prediction adapter.
  const known=new Set([...sources.map(r=>r.value.fingerprint),...repos.research.query().map(r=>r.researchId),...repos.strategy.query().map(r=>r.versionId)]);
  for(const ref of explicit)if(!known.has(ref))unresolved.push({from:'explicit-id',target:ref,fingerprint:null,status:'UNRESOLVED_REFERENCE'});
  return {report,repos,graph,unresolvedReferences:unresolved};
}
export function reconstructCase(bundle,isolatedRoot){
  const {report,repos,graph,unresolvedReferences}=validateCaseRecords(bundle);
  io.directory(isolatedRoot,'case-evidence');io.writeExclusive(isolatedRoot,'case-evidence/original-records.json',caseJson(bundle));
  for(const r of bundle.records.filter(r=>r.kind==='source')){
    io.directory(isolatedRoot,SOURCE_BASE.slice(0,-1));io.writeExclusive(isolatedRoot,r.sourcePath,Buffer.from(JSON.stringify(r.value)+'\n'));
  }
  for(const kind of ['prediction','journal'])if(bundle.records.some(r=>r.kind===kind)){
    const path=storePaths(bundle.ledgerId)[kind];io.directory(isolatedRoot,path.slice(0,path.lastIndexOf('/')));
    io.writeExclusive(isolatedRoot,path,Buffer.from(repos[kind].allEvents().map(e=>kind==='prediction'?JSON.stringify(e):canonicalRepository(e)).join('\n')+'\n'));
  }
  const incomplete=new Set(unresolvedReferences.filter(e=>e.target.startsWith(SOURCE_BASE)).map(e=>e.from));
  let changed=true;while(changed){changed=false;for(const e of graph)if(incomplete.has(e.target)&&!incomplete.has(e.from)){incomplete.add(e.from);changed=true;}}
  const semanticChecks=[];
  for(const r of bundle.records.filter(r=>r.kind==='source')){
    readSourceRecord(isolatedRoot,r.sourcePath);
    semanticChecks.push({id:r.id,status:incomplete.has(r.id)?'ORIGINAL_REFERENCE_UNAVAILABLE_FINGERPRINT_ONLY':'EXISTING_VALIDATORS_AND_REFERENCES_CHECKED'});
    if(incomplete.has(r.id))continue; // Preserve transitive gaps, never claim full qualification.
    if(r.value.kind==='draft')validateSourceDraft(r.value.payload,readSourceRecord(isolatedRoot,r.value.payload.packagePath),bundle.at);
    if(r.value.kind==='expectation')verifyExpectation(isolatedRoot,r.sourcePath);
    if(r.value.kind==='scenario')verifyScenario(isolatedRoot,r.sourcePath,bundle.ledgerId,bundle.at,report);
  }
  const view=evidenceLoopView(isolatedRoot,bundle.ledgerId,report,bundle.at),exports={};
  for(const kind of repositoryKinds)if(bundle.records.some(r=>r.kind===kind))exports[kind]=repositoryExport(kind,repos[kind],bundle.at);
  const latest=report.planRecords.filter(e=>e.command.type==='SAVE_PLAN_DRAFT').at(-1),trade=report.trades[0],loop=view.rows[0];
  const scenarios=bundle.records.filter(r=>r.kind==='source'&&r.value.kind==='scenario').map(r=>({id:r.value.id,fingerprint:r.value.fingerprint,assessment:r.value.payload.assessment}));
  const originalScenario=trade?.plan?.invalidation?.scenarioSet??latest?.command.draft.thesis.scenarioSet;
  const relevantScenarios=bundle.records.filter(r=>r.kind==='source'&&r.value.kind==='scenario'&&(originalScenario?r.sourcePath===originalScenario.path&&r.value.fingerprint===originalScenario.fingerprint:r.value.payload.request.planKey==='draft:'+latest?.command.requestId));
  const status={plan:trade?.plan?'FROZEN':latest?'DRAFT':'NOT_CONFIGURED',prediction:loop?.predictionStatus??'NOT_CREATED',trade:loop?.execution.execution??'NO_TRADE',netPnlUsd:loop?.execution.netPnlUsd??null,
    assumptionEV:relevantScenarios.length===1?relevantScenarios[0].value.payload.assessment.status:'NOT_AVAILABLE_OR_MULTIPLE_VERSIONS',validatedEV:'UNKNOWN'};
  return {caseId:bundle.caseId,ledgerId:bundle.ledgerId,assessedAt:bundle.at,status,manualReport:{trades:report.trades,planRecords:report.planRecords},evidenceLoop:view,scenarios,exports,graph,unresolvedReferences,semanticChecks,
    missingRecords:[...(!exports.prediction?[{recordType:'Prediction',status:trade?'PRE_ENTRY_PREDICTION_UNAVAILABLE':'NOT_CREATED'}]:[]),...(!trade||!trade.contractsBought?[{recordType:'Trade',status:'NO_TRADE'}]:[]),...(!loop?.outcome?[{recordType:'Outcome',status:'NOT_AVAILABLE'}]:[]),...(!exports.journal?[{recordType:'Journal',status:'NOT_CREATED'}]:[])],
    knownUnknowns:['Validated EV = UNKNOWN','Export does not establish causal validity, execution quality or trading permission.',...(!trade||!trade.contractsBought?['No trade P&L exists.']:[])],
    privacyClass:'PRIVATE_LOCAL_ONLY'};
}
