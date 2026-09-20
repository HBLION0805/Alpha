import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export const BATCH2_APPROVAL_FILE='BATCH_2_WORLD_MODEL_APPROVAL_V1.json';
export const BATCH2_CATALOG_FILE='BATCH_2_WORLD_MODEL_V1.json';
const APPROVAL_SHA256='5581fc1824f4af3e0e81fa1932fcf0d26445cbe2c45f6be4a5eb3fd73f91cb43';
const root=resolve(import.meta.dirname,'../../src/engines/macro-world-model');
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=c=>{throw Error('WORLD_MODEL_BATCH2_'+c);};
const idsEqual=(a,b)=>new Set(a).size===a.length&&a.length===b.length&&a.every(x=>b.includes(x));
const read=(file,max)=>{const p=resolve(root,file),s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.size>max)fail('FILE');return readFileSync(p);};
export function validateBatch2(c,a,batch1){
 if(c.version!=='MACRO_WORLD_MODEL_BATCH_2_V1'||a.id!=='BATCH_2_WORLD_MODEL_APPROVAL_V1'||a.version!==1||a.scope!=='READ_ONLY_REFERENCE_NO_TRADE_INFLUENCE')fail('VERSION');
 if(c.executionAllowed!==false||c.tradingInfluence!==false||c.currentStateEnabled!==false)fail('BOUNDARY');
 if(c.items.length!==36||c.edges.length!==4||c.guardrails.length!==13||c.themes.map(t=>t.themeId).join()!=='M06,M07,M08,M09,M10')fail('BOUND');
 if(!idsEqual(c.items.map(x=>x.id),a.approvedCandidateIds)||!idsEqual(c.items.map(x=>x.id),a.approvedItems.map(x=>x.candidateId))||!idsEqual(c.edges.map(x=>x.id),a.approvedEdges.map(x=>x.candidateId))||!idsEqual(c.guardrails.map(x=>x.id),a.guardrailIds))fail('APPROVAL_IDS');
 const all=[...c.items,...c.edges],allIds=all.map(i=>i.id),sources=c.sourceMap.map(s=>s.sourceRef),themes=[...batch1.themes,...c.themes].map(t=>t.themeId),canonicalIds=batch1.items.map(i=>i.id);
 if(new Set(allIds).size!==allIds.length||new Set(sources).size!==sources.length||allIds.some(id=>canonicalIds.includes(id)))fail('DUPLICATE');
 for(const i of all){
  const d=[...a.approvedItems,...a.approvedEdges].find(x=>x.candidateId===i.id);
  if(i.id!==i.candidateId||i.version!==1||i.approvedBy!=='OWNER'||i.approvedAt!==a.approvalRecordedAt||i.approvalRef!==c.approvalRef||d?.evidenceStatus!==i.evidenceStatus)fail('APPROVAL');
  if(!i.statement||!i.limitations?.length||!i.sourceRefs?.length||!i.dossierRefs?.length||i.sourceRefs.some(s=>!sources.includes(s))||i.dossierRefs.some(r=>!/^docs\/research\/macro\/batch-2\/[A-Z0-9_]+\.md$/.test(r.path)||!r.section||!r.anchor))fail('PROVENANCE');
  if(i.knowledgeType){
   if(!['STRUCTURAL_FACT','CONCEPTUAL_BOUNDARY','MEASUREMENT_FRAMEWORK','MECHANISM','WATCH_QUESTION','OPEN_QUESTION','CONFLICT'].includes(i.knowledgeType)||i.knowledgeType!==d.knowledgeType||!themes.includes(i.themeId)||i.themeLinks.some(t=>!themes.includes(t)))fail('TYPE');
   if(i.canonicalRefs?.some(id=>!canonicalIds.includes(id)))fail('CANONICAL_REFERENCE');
   if(i.knowledgeType==='OPEN_QUESTION'&&(i.evidenceStatus!=='UNKNOWN'||i.details.resolvedBy!==null))fail('UNKNOWN');
   if(i.knowledgeType==='CONFLICT'&&(i.details.canonicalValue!==null||!i.details.claimA||!i.details.claimB||!['INCOMPARABLE','UNBRIDGED','DISPUTED'].includes(i.status)))fail('CONFLICT');
   if(i.knowledgeType==='WATCH_QUESTION'&&i.details.automaticMonitoring!==false)fail('MONITORING');
   if(i.knowledgeType==='MECHANISM'&&['trigger','firstOrderEffect','secondOrderEffects','counterforces','observableConfirmation','falsification','timeHorizon'].some(k=>!i.details[k]?.length))fail('MECHANISM');
  }else if(!themes.includes(i.fromTheme)||!themes.includes(i.toTheme)||!c.items.some(m=>m.id===i.mechanismRef&&m.knowledgeType==='MECHANISM'))fail('EDGE');
 }
 if(a.deferred.some(d=>allIds.includes(d.id))||a.rejectedIds.some(id=>allIds.includes(id)))fail('DEFERRED');
 for(const g of c.guardrails)if(g.assertion!==false||g.notInverseFact!==true||g.disposition!=='REJECT_FROM_RUNTIME'||!g.reason||!g.dossierRefs.length)fail('GUARDRAIL');
 for(const r of c.canonicalReferences)if(!canonicalIds.includes(r.canonicalKnowledgeId)||r.runtimeMutation!==false)fail('CANONICAL_REFERENCE');
 const l7=c.edges.find(e=>e.reviewLabel==='B2-L7');
 if(l7?.statement!==a.revisedEdges.find(e=>e.candidateId===l7.id)?.approvedStatement||/financing viability/i.test(l7.statement))fail('L7_REVISION');
 return c;
}
export function readBatch2(batch1){
 const approvalBytes=read(BATCH2_APPROVAL_FILE,32768);if(hash(approvalBytes)!==APPROVAL_SHA256)fail('APPROVAL_INTEGRITY');
 const a=JSON.parse(approvalBytes),bytes=read(BATCH2_CATALOG_FILE,196608);
 if(hash(bytes)!==a.catalogSha256||bytes.length!==a.catalogBytes)fail('CATALOG_INTEGRITY');
 return validateBatch2(JSON.parse(bytes),a,batch1);
}
