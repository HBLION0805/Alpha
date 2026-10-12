import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs,snapshotCents} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {inferOptionsStructure} from '../../src/engines/options-structure-comparison/OptionsStructureComparisonEngine.ts';
import {normalizeTechOptionCapture,normalizeEngineeringOptionCapture} from './options-tech-quote-adapter.mjs';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const int=(v,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=100000000;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const ns=v=>{try{return snapshotNs(v);}catch{return null;}};
const kinds=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
const identity=q=>[q.id,q.symbol,q.expiry,q.type,snapshotCents(q.strike),q.multiplier].join('|');

/** Explicit bounded file read only. Hash refers to original bytes, never reserialization. */
export function readTechSpreadOriginal(path,expectedSha256){
 check(typeof path==='string'&&/^[a-f0-9]{64}$/.test(expectedSha256),'ORIGINAL_REFERENCE');
 const before=fs.lstatSync(path);check(before.isFile()&&!before.isSymbolicLink()&&before.size<=2e6,'ORIGINAL_FILE');
 const bytes=fs.readFileSync(path),after=fs.lstatSync(path);
 check(before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ino===after.ino,'ORIGINAL_CHANGED_DURING_READ');
 check(sha(bytes)===expectedSha256,'ORIGINAL_HASH_MISMATCH');
 return {rawJson:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:expectedSha256};
}

/** Saved-source replay only. No source calls, fill model, registration or admission. */
export function assessTechSpreadPreflight(input){return assessSpreadPreflight(input,false);}
export function assessEngineeringSpreadPreflight(input){return assessSpreadPreflight(input,true);}
function assessSpreadPreflight(input,engineeringSPY){
 const report={version:'TECH_SPREAD_PREFLIGHT_V1',assessedAt:input?.at??null,
  mode:'UNKNOWN',status:'BLOCKED',originals:[],legs:[],staticStructure:{status:'NOT_ASSESSED',structure:null},
  quotePair:{status:'NOT_ASSESSED',sourceClockDifferenceNs:null,sameCapture:false,economics:null},
  costs:{status:'UNKNOWN',reserveCents:null},account:{status:'UNKNOWN',authenticated:false},checks:[],
  paperAdmissionAllowed:false,executionAllowed:false,sourceCalls:0,fills:0,pnl:null,realPaperAcceptance:'NOT_TESTED',
  producerCapability:'TECH_OPTION_CAPTURE_V1_SELECTS_ONE_STRIKE_ONLY_NO_SAME_BATCH_DEBIT_VERTICAL',
  limitation:'Hashes bind supplied bytes, not provider authenticity. Static validity and engineering quote references never grant admission.'};
 const gate=(code,passed,source,scope,detail=null)=>report.checks.push({code,status:passed?'PASS':'BLOCKED',source,scope,detail});
 try{
  check(input?.version==='TECH_SPREAD_PREFLIGHT_INPUT_V1'&&['REAL_SAVED_SOURCE_REPLAY','MOCK_CONTROL'].includes(input.mode),'INPUT_SCOPE');
  const now=snapshotNs(input.at),decision=snapshotNs(input.decisionAt);check(decision<=now,'DECISION_FROM_FUTURE');report.mode=input.mode;
  check(Array.isArray(input.originals)&&input.originals.length>=1&&input.originals.length<=2,'ORIGINAL_COUNT');
  check(Array.isArray(input.legs)&&input.legs.length===2,'LEG_COUNT');
  const sources=new Map();
  for(const o of input.originals){
   check(text(o.id)&&!sources.has(o.id)&&typeof o.rawJson==='string'&&Buffer.byteLength(o.rawJson)<=2e6&&sha(o.rawJson)===o.sha256,'ORIGINAL_INTEGRITY');
   const r=parseChainSurveyJson(o.rawJson),c=r?.capture;
   const batch=c?.version==='TECH_OPTION_CAPTURE_V2';
   check(r?.version===(batch?'TECH_QUOTES_RECEIPT_V2':'TECH_QUOTES_RECEIPT_V1')&&r.executionAllowed===false&&c&&r.captureSha256===sha(JSON.stringify(c)),'RECEIPT_INTEGRITY');
   check(r.intent?.version===(batch?'TECH_QUOTES_REQUEST_V2':'TECH_QUOTES_REQUEST_V1')&&JSON.stringify(r.intent.selection)===JSON.stringify(c.selection)&&r.intent.accountAccessed===false&&r.intent.executionAllowed===false,'INTENT_BINDING');
   if(batch)check(r.intent.origin===c.origin&&c.batchId===r.intent.selection.batchId,'BATCH_INTENT_BINDING');
   check(snapshotNs(r.intent.requestedAt)<=snapshotNs(c.startedAt)&&snapshotNs(c.capturedAt)<=snapshotNs(r.recordedAt)&&snapshotNs(r.recordedAt)<=now,'ORIGINAL_RECEIPT_CLOCK');
   check(c.origin===(input.mode==='MOCK_CONTROL'?'SYNTHETIC_FIXTURE':'HOST_MARKET_TOOL_RESPONSES'),'MIXED_OR_UNDECLARED_ORIGIN');
   const normalized=(engineeringSPY?normalizeEngineeringOptionCapture:normalizeTechOptionCapture)(c,input.at);sources.set(o.id,{o,r,c,normalized});
   if(batch)report.producerCapability='TWO_EXPLICIT_STRIKES_ONE_QUOTE_BATCH_NO_ATOMIC_SNAPSHOT';
   report.originals.push({id:o.id,sha256:o.sha256,captureSha256:r.captureSha256,origin:c.origin,
    requestedAt:r.intent.requestedAt,startedAt:c.startedAt,capturedAt:c.capturedAt,recordedAt:r.recordedAt,
    selection:c.selection,...(batch?{batchId:c.batchId,atomicSnapshot:false}:{}),normalizationStatus:normalized.status,originalAuthentication:'NOT_ESTABLISHED_BY_HASH'});
  }
  const selected=input.legs.map(l=>{
   check(['LONG','SHORT'].includes(l.direction)&&int(l.quantity,1),'LEG_DIRECTION_OR_QUANTITY');
   const s=sources.get(l.originalId);check(s,'LEG_ORIGINAL_MISSING');
   const q=s.normalized.quotes.find(q=>q.id===l.contract?.id);check(q?.snapshot,'LEG_QUOTE_MISSING');
   check(identity(q.snapshot)===identity(l.contract),'EXACT_CONTRACT_MISMATCH');
   if(s.c.version==='TECH_OPTION_CAPTURE_V2'){
    check(s.c.selection.legs.some(x=>x.id===q.id&&x.direction===l.direction),'BATCH_SELECTED_LEG_BINDING');
    check(q.batchId===s.c.batchId&&q.acquisition&&['instrumentRequestedAt','instrumentReceivedAt','quoteRequestedAt','quoteReceivedAt'].every(k=>ns(q.acquisition[k])!==null)&&q.acquisition.quoteReceivedAt===q.snapshot.receivedAt,'BATCH_ACQUISITION_METADATA_REQUIRED');
   }
   return {l,s,q};
  });
  const [a,b]=selected,qa=a.q.snapshot,qb=b.q.snapshot;
  const staticValid=qa.id!==qb.id&&qa.symbol===qb.symbol&&qa.expiry===qb.expiry&&qa.type===qb.type&&
   snapshotCents(qa.strike)!==snapshotCents(qb.strike)&&qa.multiplier===100&&qb.multiplier===100&&
   a.l.quantity===b.l.quantity&&a.l.direction!==b.l.direction;
  let structure=null;
  if(staticValid)structure=inferOptionsStructure(selected.map(({l,q})=>({side:l.direction==='LONG'?'BUY':'SELL',contract:{contractId:q.snapshot.id,optionType:q.snapshot.type.toUpperCase(),strikePriceCents:snapshotCents(q.snapshot.strike)}})));
  const debit=staticValid&&['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'].includes(structure);
  report.staticStructure={status:debit?'VALID_STATIC_DEBIT_VERTICAL':'INVALID_OR_UNSUPPORTED',structure};
  gate('STATIC_DEBIT_VERTICAL',debit,'OptionsStructureComparisonEngine.inferOptionsStructure + exact selected identities','STATIC_IDENTITY_ONLY');
  for(const {l,s,q} of selected){
   const snap=q.snapshot,clock=ns(snap.updatedAt);
   report.legs.push({originalId:l.originalId,direction:l.direction,quantity:l.quantity,snapshot:snap,
    sourceAgeNs:clock===null?null:(now-clock).toString(),...(q.batchId?{batchId:q.batchId,acquisition:q.acquisition}:{}),contractEvidence:q.contractEvidence,status:q.status,blockers:q.blockers});
   gate('INHERITED_QUOTE_ASSESSMENT',q.status==='QUALIFIED_SNAPSHOT_ONLY','normalizeTechOptionCapture / assessSnapshotQuote','ENGINEERING_REFERENCE_NOT_OWNER_SPREAD_POLICY',{id:snap.id,blockers:q.blockers,maxAgeSeconds:60,mechanicalSpreadLimitCents:q.mechanicalSpreadLimitCents,session:'EXISTING_REVIEWED_2026_REGULAR_SESSION'});
   gate('QUOTE_AFTER_DECISION',clock!==null&&clock>decision&&snapshotNs(snap.receivedAt)>decision,'Prospective decision-before-quote requirement','EVIDENCE_ORDER',{id:snap.id,decisionAt:input.decisionAt,sourceAt:snap.updatedAt,receivedAt:snap.receivedAt});
   gate('DISPLAYED_BOTH_SIDE_QUANTITY',snap.bidSize>=l.quantity&&snap.askSize>=l.quantity,'Existing two-leg entry and exit size checks','DISPLAYED_SIZE_NOT_FILL',{id:snap.id});
   gate('CONTRACT_DELIVERABLE_AND_EXERCISE',q.contractEvidence?.deliverable==='STANDARD_100_SHARES_USD'&&q.contractEvidence?.exerciseStyle==='AMERICAN','Existing contract feasibility requirements','MISSING_PROVIDER_FIELDS_REMAIN_UNKNOWN',{id:snap.id,deliverable:q.contractEvidence?.deliverable??null,exerciseStyle:q.contractEvidence?.exerciseStyle??null});
  }
  const ca=ns(qa.updatedAt),cb=ns(qb.updatedAt),diff=ca===null||cb===null?null:ca-cb;
  // Byte-identical capture references are the same capture; separate captures are never stitched.
  const sameCapture=a.s.r.captureSha256===b.s.r.captureSha256;
  const batch=a.s.c.version==='TECH_OPTION_CAPTURE_V2'&&b.s.c.version==='TECH_OPTION_CAPTURE_V2',pair=batch?a.s.normalized.pair:null;
  const sameBatch=batch&&sameCapture&&a.s.c.batchId===b.s.c.batchId;
  const prospective=selected.every(({q})=>ns(q.snapshot.updatedAt)!==null&&ns(q.snapshot.updatedAt)>decision&&snapshotNs(q.snapshot.receivedAt)>decision);
  const coherent=sameBatch&&debit&&prospective&&pair?.status==='COHERENT_BATCH_EVIDENCE_ONLY';
  report.quotePair={status:coherent?'COHERENT_BATCH_EVIDENCE_ONLY':'NOT_EXECUTABLE',sameCapture,sourceClockDifferenceNs:diff===null?null:(diff<0n?-diff:diff).toString(),economics:null,...(batch?{batchId:sameBatch?a.s.c.batchId:null,atomicSnapshot:false,maxSourceSkewMs:pair?.maxSourceSkewMs??null}: {})};
  gate('SAME_CAPTURE',sameCapture,'TECH_OPTION_CAPTURE original receipt lineage','SOURCE_COHERENCE_NOT_EXECUTION_PROOF');
  if(batch){
   report.producerCapability='TWO_EXPLICIT_STRIKES_ONE_QUOTE_BATCH_NO_ATOMIC_SNAPSHOT';
   gate('SAME_EXPLICIT_BATCH',sameBatch,'TECH_OPTION_CAPTURE_V2 batch and original hash','NO_CROSS_BATCH_STITCHING');
   gate('EXPLICIT_BATCH_TIMING',sameBatch&&pair?.status==='COHERENT_BATCH_EVIDENCE_ONLY','Frozen selection maxSourceSkewMs + existing individual quote checks','REQUEST_ENGINEERING_ASSUMPTION_NOT_OWNER_STRATEGY',pair);
  }else gate('SYNCHRONOUS_SOURCE_CLOCK_REFERENCE',diff===0n,'OptionsStructureComparisonEngine LEG_OBSERVATION_CLOCKS_DIFFER','INHERITED_ENGINEERING_REFERENCE_NOT_APPROVED_SPREAD_TIME_TOLERANCE');
  if(!sameCapture)gate('SEPARATE_CAPTURES_NOT_A_COMBINED_QUOTE',false,'Original receipt identities','NO_EXECUTABLE_QUOTE_STITCHING');
  const costs=input.costs;
  if(costs){
   const known=text(costs.reference)&&['OWNER_ASSUMPTION','SYNTHETIC_FIXTURE'].includes(costs.origin)&&snapshotNs(costs.frozenAt)<=decision&&
    [costs.entryFeesCents,costs.exitFeesCents,costs.exitSlippageReserveCents].every(v=>int(v))&&
    (input.mode==='MOCK_CONTROL')===(costs.origin==='SYNTHETIC_FIXTURE');
   if(known){const reserve=costs.entryFeesCents+costs.exitFeesCents+costs.exitSlippageReserveCents;check(int(reserve),'COST_OVERFLOW');report.costs={status:'EXPLICIT_ASSUMPTION_ONLY',reserveCents:reserve,reference:costs.reference,origin:costs.origin,frozenAt:costs.frozenAt,entryFeesCents:costs.entryFeesCents,exitFeesCents:costs.exitFeesCents,exitSlippageReserveCents:costs.exitSlippageReserveCents};}
  }
  gate('COSTS_EXPLICIT',report.costs.status==='EXPLICIT_ASSUMPTION_ONLY','Existing structure total cost reserve fields','ATTRIBUTED_ASSUMPTION_NOT_VERIFIED_FEES');
  if(input.accountEvidence){
   const e=input.accountEvidence;check(text(e.accountId),'ACCOUNT_ID');
   const v=readTechEvidenceRecords({inputs:e.records,kinds,now,decision,validThrough:now});
   check(e.records.every(r=>(r.origin==='SYNTHETIC_FIXTURE')===(input.mode==='MOCK_CONTROL')),'MIXED_ACCOUNT_ORIGIN');
   const p=v.payloads.get('PRODUCT_PERMISSION'),d=v.payloads.get('DATA_ENTITLEMENT'),f=v.payloads.get('ACCOUNT_FUNDS'),r=v.payloads.get('RISK_LIMITS');
   const problems=[...v.blockers];
   if(!debit||p.accountId!==e.accountId||p.enabled!==true||!Array.isArray(p.symbols)||!p.symbols.includes(qa.symbol)||!Array.isArray(p.products)||!p.products.includes(structure))problems.push('SPREAD_PERMISSION_UNKNOWN');
   if(d.provider!=='ROBINHOOD_OFFICIAL_MCP'||!Array.isArray(d.symbols)||!d.symbols.includes(qa.symbol)||d.realtimeOptions!==true||d.localRetention!==true)problems.push('DATA_ENTITLEMENT_UNKNOWN');
   if(f.accountId!==e.accountId||f.currency!=='USD'||!int(f.settledCashCents)||!int(f.reservedCashCents)||f.reservedCashCents>f.settledCashCents)problems.push('FUNDS_UNKNOWN');
   if(r.accountId!==e.accountId||!int(r.tradeBudgetMaxCents,1)||!int(r.maximumLossCents,1))problems.push('RISK_LIMITS_UNKNOWN');
   report.account={status:problems.length?'BLOCKED':'ATTRIBUTED_DOCUMENT_CHECKS_ONLY',authenticated:false,blockers:problems,
    evidence:e.records.map(r=>({kind:r.kind,sha256:r.sha256,origin:r.origin,source:r.source,observedAt:r.observedAt,receivedAt:r.receivedAt,reviewedAt:r.reviewedAt,validThrough:r.validThrough})),availableSettledCashCents:problems.includes('FUNDS_UNKNOWN')?null:f.settledCashCents-f.reservedCashCents,sufficiency:'NOT_ASSESSED_WITHOUT_EXECUTABLE_SPREAD_ECONOMICS'};
  }
  gate('ACCOUNT_EVIDENCE',report.account.status==='ATTRIBUTED_DOCUMENT_CHECKS_ONLY','readTechEvidenceRecords + explicit spread product/account fields','ATTRIBUTED_DOCUMENTS_NOT_ACCOUNT_AUTHENTICATION');
 }catch(error){gate(/^[A-Z_]+$/.test(error?.message)?error.message:'INPUT_INVALID',false,'Preflight input and original integrity checks','INPUT_REJECTED');}
 gate('REAL_SPREAD_ADMISSION_POLICY_UNREGISTERED',false,'Current Alpha capability boundary','NO_NEW_OWNER_RULES');
 gate('REAL_SPREAD_LIFECYCLE_NOT_QUALIFIED',false,'Atomic spread lifecycle is MOCK only','REAL_PAPER_ACCEPTANCE_NOT_TESTED');
 report.notApplied=['Single-leg full-premium budget is not a spread budget','Seven-minute engineering rehearsal window is not a spread strategy','20/30/50 is not a frozen Owner rule'];
 return report;
}
