import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {lookupWorldModel} from '../../apps/options-workbench/world-model-lookup.js';
import {readBatch2} from './macro-world-model-batch2.mjs';

const root=resolve(import.meta.dirname,'../../src/engines/macro-world-model');
export const WORLD_MODEL_APPROVAL_FILE='BATCH_1_WORLD_MODEL_APPROVAL_V1.json';
export const WORLD_MODEL_CATALOG_FILE='BATCH_1_WORLD_MODEL_V1.json';
const APPROVAL_SHA256='bfdd59f16a87f69a1de2d938ee95f71431a033db37a6e38ade6ec13721d40cb1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Error('WORLD_MODEL_'+code);};
function bounded(file,max){const p=resolve(root,file),s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.size>max)fail('FILE');return readFileSync(p);}
const types=['STRUCTURAL_FACT','CONCEPTUAL_BOUNDARY','MEASUREMENT_FRAMEWORK','EVIDENCE_TIME_RULE','HISTORICAL_FACT','MECHANISM','ACTOR_RELATION','STRUCTURAL_FLOW_RELATION','WATCH_QUESTION','OPEN_QUESTION','HYPOTHESIS_ONLY_CONTEXT','CONFLICT'];
function sameIds(a,b){return new Set(a).size===a.length&&a.length===b.length&&a.every(id=>b.includes(id));}
export function validateWorldModel(c,a){
  if(c.version!=='MACRO_WORLD_MODEL_V1'||a.id!=='BATCH_1_WORLD_MODEL_APPROVAL_V1'||a.version!==1||a.scope!=='READ_ONLY_REFERENCE_NO_TRADE_INFLUENCE')fail('VERSION');
  if(c.executionAllowed!==false||c.tradingInfluence!==false||c.currentStateEnabled!==false)fail('BOUNDARY');
  if(c.items.length!==38||c.edges.length!==5||c.guardrails.length!==15||c.themes.length!==5)fail('BOUND');
  if(!sameIds(c.items.map(i=>i.id),a.approvedCandidateIds)||!sameIds(c.items.map(i=>i.id),a.approvedItems.map(i=>i.candidateId))||!sameIds(c.edges.map(i=>i.id),a.approvedEdges.map(i=>i.candidateId))||!sameIds(c.guardrails.map(i=>i.id),a.guardrailIds))fail('APPROVAL_IDS');
  const all=[...c.items,...c.edges],ids=all.map(i=>i.id),sources=c.sourceMap.map(s=>s.sourceRef),themes=c.themes.map(t=>t.themeId);
  if(new Set(ids).size!==ids.length||new Set(sources).size!==sources.length)fail('DUPLICATE');
  for(const i of all){
    const decision=[...a.approvedItems,...a.approvedEdges].find(d=>d.candidateId===i.id);
    if(i.id!==i.candidateId||i.version!==1||i.approvedBy!=='OWNER'||i.approvedAt!==a.approvalRecordedAt||i.approvalRef!==c.approvalRef||decision?.evidenceStatus!==i.evidenceStatus)fail('APPROVAL');
    if(!i.statement||!i.limitations?.length||!i.sourceRefs?.length||!i.dossierRefs?.length||i.sourceRefs.some(s=>!sources.includes(s)))fail('PROVENANCE');
    if(i.dossierRefs.some(r=>!/^docs\/research\/macro\/batch-1\/[A-Z0-9_]+\.md$/.test(r.path)||!r.section||!r.anchor))fail('PROVENANCE');
    if(i.knowledgeType){
      if(!types.includes(i.knowledgeType)||decision.knowledgeType!==i.knowledgeType||!themes.includes(i.themeId)||i.themeLinks.some(t=>!themes.includes(t)))fail('TYPE');
      if(i.knowledgeType==='OPEN_QUESTION'&&(i.evidenceStatus!=='UNKNOWN'||i.details.resolvedBy!==null))fail('UNKNOWN');
      if(i.knowledgeType==='CONFLICT'&&(i.details.canonicalValue!==null||!i.details.claimA||!i.details.claimB||!['CONFLICTED','UNBRIDGED'].includes(i.status)))fail('CONFLICT');
      if(i.knowledgeType==='HYPOTHESIS_ONLY_CONTEXT'&&i.evidenceStatus!=='ALPHA_INFERENCE')fail('INFERENCE');
      if(i.knowledgeType==='MECHANISM'&&['trigger','firstOrderEffect','secondOrderEffects','counterforces','observableConfirmation','falsification','timeHorizon'].some(k=>!i.details[k]||i.details[k].length===0))fail('MECHANISM');
      if(i.knowledgeType==='WATCH_QUESTION'&&i.details.automaticMonitoring!==false)fail('MONITORING');
      if(i.canonicalRefs?.some(id=>!ids.includes(id)))fail('REFERENCE');
    }else if(!themes.includes(i.fromTheme)||!themes.includes(i.toTheme)||!c.items.some(x=>x.id===i.mechanismRef&&x.knowledgeType==='MECHANISM'))fail('EDGE');
  }
  for(const [label,type] of Object.entries({F06:'CONCEPTUAL_BOUNDARY',F11:'MEASUREMENT_FRAMEWORK',F12:'EVIDENCE_TIME_RULE',FL01:'STRUCTURAL_FLOW_RELATION'}))if(!c.items.some(i=>i.reviewLabel===label&&i.knowledgeType===type))fail('RETYPING');
  const swap=c.items.find(i=>i.reviewLabel==='A02');
  if(swap?.details.relationType!=='CENTRAL_BANK_SWAP_BACKSTOP'||swap.details.measurementType!=='AUTHORIZATION'||swap.details.observedCurrentDraw!==null)fail('SWAP');
  if(c.sharedEvidenceTimeRuleId!==c.items.find(i=>i.reviewLabel==='F12').id)fail('SHARED_TIME_RULE');
  if(a.deferred.some(d=>ids.includes(d.id))||a.rejectedIds.some(id=>ids.includes(id)))fail('DEFERRED');
  for(const g of c.guardrails)if(g.assertion!==false||g.notInverseFact!==true||!g.reason||!g.dossierRefs.length||!['DOSSIER_ONLY','REJECT_FROM_RUNTIME'].includes(g.disposition))fail('GUARDRAIL');
  return c;
}
export function readWorldModel(filters={}){
  // Separately pinned approval/catalog pairs; no dossier or private-record fallback.
  const approvalBytes=bounded(WORLD_MODEL_APPROVAL_FILE,32768);
  if(hash(approvalBytes)!==APPROVAL_SHA256)fail('APPROVAL_INTEGRITY');
  const a=JSON.parse(approvalBytes);
  const bytes=bounded(WORLD_MODEL_CATALOG_FILE,196608);
  if(bytes.length!==a.catalogBytes||hash(bytes)!==a.catalogSha256)fail('CATALOG_INTEGRITY');
  const c=validateWorldModel(JSON.parse(bytes),a);
  const b=readBatch2(c);
  // Original Batch 1 objects and approvalRef stay byte-equivalent for saved links.
  return lookupWorldModel({...c,items:[...c.items,...b.items],edges:[...c.edges,...b.edges],
    themes:[...c.themes,...b.themes],guardrails:[...c.guardrails,...b.guardrails],
    sourceMap:[...c.sourceMap,...b.sourceMap],canonicalReferences:b.canonicalReferences,
    approvalRefs:[c.approvalRef,b.approvalRef],
    currentStateNotice:'Current-state material remains in dated research; not promoted to Runtime World Model.'},filters);
}
