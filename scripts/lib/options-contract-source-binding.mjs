import {createHash} from 'node:crypto';
import {parseChainSurveyJson as parse} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs,snapshotCents} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';

const check=(v,c)=>{if(!v)throw Error('CONTRACT_SOURCE_'+c);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const contractSourceHash=v=>createHash('sha256').update(v).digest('hex');
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const exact=(o,n)=>check(o&&typeof o==='object'&&!Array.isArray(o)&&same(Object.keys(o).sort(),n.split(' ').sort()),'FIELDS');
export function contractSourceClock(v){check(typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19),'CLOCK');return snapshotNs(v);}
const clock=contractSourceClock;
function pointer(o,p){
 check(typeof p==='string'&&p.length<=200&&(/^\//.test(p)||p==='')&&!/~(?:[^01]|$)/.test(p),'POINTER');
 if(p==='')return o;
 for(const token of p.slice(1).split('/')){const k=token.replaceAll('~1','/').replaceAll('~0','~');check(!['__proto__','prototype','constructor'].includes(k)&&o!==null&&typeof o==='object'&&Object.hasOwn(o,k)&&(!Array.isArray(o)||/^(0|[1-9]\d*)$/.test(k)),'POINTER');o=o[k];}return o;
}
function sourceRow(ref,documents,used){
 exact(ref,'sourceId pointer fields');const d=documents.get(ref.sourceId);check(d&&d.mediaType==='application/json','JSON_SOURCE_REQUIRED');used.add(d.id);const row=pointer(d.parsed,ref.pointer);
 check(row&&typeof row==='object'&&!Array.isArray(row)&&ref.fields&&typeof ref.fields==='object'&&!Array.isArray(ref.fields),'ROW');
 // Every mapped value is a direct property of this one source record. Field
 // paths cannot reach another row, parent object, array index, or generated OSI.
 const keys=Object.values(ref.fields);check(new Set(keys).size===keys.length,'FIELD_REUSE');
 const semanticKeys={classCode:['classCode','class_code','contract_class','series_class','standard_series_class'],seriesId:['seriesId','series_id','option_series_id','contract_series_id','occ_symbol']};
 const out={};for(const [name,key]of Object.entries(ref.fields)){check(!semanticKeys[name]||semanticKeys[name].includes(key),'FIELD_SEMANTICS');check(['id','seriesId','symbol','expiry','type','strike','multiplier','tradability','components','settlement','currency','exerciseStyle','classCode'].includes(name)&&typeof key==='string'&&/^[a-zA-Z_][a-zA-Z0-9_]{0,79}$/.test(key)&&!['__proto__','prototype','constructor'].includes(key)&&Object.hasOwn(row,key),'FIELD_LOCATION');out[name]=row[key];}
 return out;
}
/** Decode only an actually returned fixed-width OCC identity; root is not a deliverable rule. */
export function matchReturnedContractOccIdentity(row,selection){
 check(row&&row.instrument_id===selection.id&&row.symbol===selection.symbol,'OCC_UUID_OR_UNDERLYING');
 const raw=row.occ_symbol;check(typeof raw==='string'&&raw.length===21,'OCC_FORMAT');
 const root=raw.slice(0,6).trimEnd();check(/^[A-Z][A-Z0-9]{0,5}$/.test(root)&&root.padEnd(6,' ')===raw.slice(0,6)&&/^\d{6}[CP]\d{8}$/.test(raw.slice(6)),'OCC_FORMAT');
 check(selection.symbol==='SPY'&&(root==='SPY'||/^SPY[0-9]{1,3}$/.test(root)),'OCC_ROOT_SCOPE');
 const date=raw.slice(6,12),expiry='20'+date.slice(0,2)+'-'+date.slice(2,4)+'-'+date.slice(4,6);clock(expiry+'T00:00:00Z');
 const type=raw[12]==='C'?'call':'put',strikeMillis=BigInt(raw.slice(13)),cents=snapshotCents(selection.strike);
 check(expiry===selection.expiry&&type===selection.type&&cents!==null&&strikeMillis===BigInt(cents)*10n,'OCC_EXACT_SERIES');
 return {instrumentId:row.instrument_id,occSymbol:raw,root,expiry,type,strikeMillis:String(strikeMillis),identityMatched:true,deliverableEstablished:false,adjustmentStatus:'UNKNOWN',historicalPricesUsableForEntry:false};
}
function identity(row,s,occ=false){
 if(occ){matchReturnedContractOccIdentity({instrument_id:row.id,occ_symbol:row.seriesId,symbol:row.symbol},s);for(const k of ['expiry','type','strike'])if(row[k]!==undefined)check(k==='strike'?snapshotCents(row[k])===snapshotCents(s[k]):row[k]===s[k],'OCC_FIELD_CONFLICT');return;}

 check(row.symbol===s.symbol&&row.expiry===s.expiry&&row.type===s.type&&typeof row.strike==='string'&&snapshotCents(row.strike)!==null&&snapshotCents(row.strike)===snapshotCents(s.strike),'EXACT_SERIES');
}
function standardBasket(row){
 check(row.settlement==='PHYSICAL'&&row.currency==='USD'&&Array.isArray(row.components)&&row.components.length>=1&&row.components.length<=2,'DELIVERABLE_UNKNOWN');
 let equities=0;
 for(const c of row.components){if(c.kind==='EQUITY'){exact(c,'kind symbol quantity unit');check(c.symbol==='SPY'&&c.quantity===100&&c.unit==='SHARES','DELIVERABLE_UNSUPPORTED');equities++;}else{exact(c,'kind amount currency');check(c.kind==='CASH'&&c.amount===0&&c.currency==='USD','DELIVERABLE_UNSUPPORTED');}}
 check(equities===1,'DELIVERABLE_UNSUPPORTED');
}
function productStyle(rule,documents,used){
 exact(rule,'sourceId excerpt');const d=documents.get(rule.sourceId);check(d&&d.mediaType==='text/plain'&&d.source==='https://www.cboe.com/tradable_products/sp_500/mini_spx_options/european_style/'&&rule.excerpt==='SPY (ETF) options are American style'&&d.rawText.includes(rule.excerpt),'PRODUCT_RULE');used.add(d.id);return 'AMERICAN';
}

/** Source-bound supplement to the existing CONTRACT record, never source authentication. */
export function inspectContractSourceBinding(input,at){
 const out={version:'CONTRACT_SOURCE_ASSESSMENT_V1',assessedAt:at,status:'UNKNOWN',context:input?.context??'UNKNOWN',blockers:[],contracts:null,record:null,sourceCalls:0,accountWrites:0,fills:0,executionAllowed:false,paperAdmissionAllowed:false,realAcceptance:'NOT_TESTED',authentication:'ATTRIBUTED_ORIGINALS_NOT_PROVIDER_AUTHENTICATION'};
 try{
  exact(input,'version context selection originals legs productRule review window conflicts');
  check(input.version==='CONTRACT_SOURCE_BINDING_V1'&&['TEST_FIXTURE_ONLY','REAL_MARKET_DATA_SIMULATION'].includes(input.context),'VERSION_OR_CONTEXT');
  const fixture=input.context==='TEST_FIXTURE_ONLY',now=clock(at);exact(input.review,'by at verdict');exact(input.window,'from through');
  const reviewed=clock(input.review.at),from=clock(input.window.from),through=clock(input.window.through);
  check(text(input.review.by)&&input.review.verdict==='PASS'&&reviewed<=now&&reviewed<=from&&from<through&&now<=through,'REVIEW_OR_WINDOW');
  check(Array.isArray(input.conflicts)&&input.conflicts.length===0,'UNRESOLVED_CONFLICTS');
  check(Array.isArray(input.selection)&&input.selection.length===2&&Array.isArray(input.legs)&&input.legs.length===2&&Array.isArray(input.originals)&&input.originals.length>=1&&input.originals.length<=8,'BOUND');
  const documents=new Map(),used=new Set();let bytes=0,observed=0n,received=0n,observedAt=null,receivedAt=null;
  for(const d of input.originals){
   exact(d,'id origin representation source sourceVersion publishedAt observedAt receivedAt applicableFrom applicableThrough mediaType rawText sha256');
   check(/^[a-z0-9][a-z0-9-]{0,59}$/.test(d.id)&&!documents.has(d.id)&&text(d.source)&&text(d.sourceVersion),'SOURCE_IDENTITY');
   check(fixture?d.origin==='SYNTHETIC_FIXTURE':['OWNER_DOCUMENT','PROVIDER_DOCUMENT'].includes(d.origin),'SOURCE_CONTEXT');
   check(['ORIGINAL_PROVIDER_DATA','ORIGINAL_OWNER_SUPPLIED_DOCUMENT'].includes(d.representation)&&(d.origin!=='PROVIDER_DOCUMENT'||d.representation==='ORIGINAL_PROVIDER_DATA'),'DERIVED_EXTRACTION_NOT_ORIGINAL');
   check(['application/json','text/plain'].includes(d.mediaType)&&typeof d.rawText==='string'&&d.rawText.length>0&&contractSourceHash(d.rawText)===d.sha256,'ORIGINAL_HASH');
   bytes+=Buffer.byteLength(d.rawText);check(bytes<=45000,'ORIGINAL_BOUND');
   check(fixture||!/(?:TEST_FIXTURE_ONLY|SYNTHETIC_FIXTURE|TEST_FIXTURE_|FICTIONAL_SERIES)/i.test(d.rawText),'FIXTURE_ORIGINAL');
   const o=clock(d.observedAt),r=clock(d.receivedAt),a=clock(d.applicableFrom),z=clock(d.applicableThrough);
   check(o<=r&&r<=reviewed&&a<=from&&z>=through&&a<z,'SOURCE_CLOCK_OR_APPLICABILITY');
   if(d.publishedAt!==null)check(clock(d.publishedAt)<=r,'SOURCE_PUBLICATION');
   if(o>=observed){observed=o;observedAt=d.observedAt;}if(r>=received){received=r;receivedAt=d.receivedAt;}
   documents.set(d.id,{...d,parsed:d.mediaType==='application/json'?parse(d.rawText):null});
  }
  const mappedStyle=input.productRule===null?null:productStyle(input.productRule,documents,used);
  const ids=new Set(),contracts=[];
  for(const s of input.selection){
   exact(s,'id symbol expiry type strike multiplier tradability');check(uuid(s.id)&&!ids.has(s.id)&&s.symbol==='SPY'&&['call','put'].includes(s.type)&&typeof s.strike==='string'&&snapshotCents(s.strike)>0&&s.multiplier===100&&s.tradability==='tradable','SELECTION');ids.add(s.id);check(through<clock(s.expiry+'T00:00:00Z'),'PRE_EXPIRY_WINDOW');
   const bindings=input.legs.filter(l=>l.id===s.id);check(bindings.length===1,'LEG_BINDING');const l=bindings[0];exact(l,'id route identity current classRule');
   const original=sourceRow(l.identity,documents,used);identity(original,s,l.identity.fields.seriesId==='occ_symbol');check(original.id===s.id&&Number(original.multiplier)===s.multiplier&&(typeof original.multiplier==='number'||typeof original.multiplier==='string'&&/^100(?:\.0+)?$/.test(original.multiplier))&&original.tradability===s.tradability,'PROVIDER_IDENTITY');
   const current=sourceRow(l.current,documents,used);identity(current,s,l.current.fields.seriesId==='occ_symbol');
   if(current.seriesId!==undefined&&original.seriesId!==undefined)check(current.seriesId===original.seriesId,'CONFLICTING_SERIES_ID');
   if(current.id!==undefined)check(current.id===s.id,'EXACT_UUID');
   else check(text(original.seriesId)&&text(current.seriesId)&&current.seriesId===original.seriesId,'RETURNED_SERIES_ID_REQUIRED');
   let facts=current;
   if(l.route==='DIRECT_CURRENT_DELIVERABLE')check(l.classRule===null,'DIRECT_RULE_SCOPE');
   else{check(l.route==='DOCUMENTED_CURRENT_CLASS'&&text(current.classCode),'CURRENT_CLASS_UNKNOWN');facts=sourceRow(l.classRule,documents,used);check(facts.symbol===s.symbol&&text(facts.classCode)&&facts.classCode===current.classCode,'CLASS_RULE_BINDING');}
   standardBasket(facts);
   const style=facts.exerciseStyle??mappedStyle;check(style==='AMERICAN','EXERCISE_STYLE_UNKNOWN');
   contracts.push({contract:{id:s.id,symbol:s.symbol,expiry:s.expiry,type:s.type,strike:s.strike,multiplier:s.multiplier,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:s.tradability},adjustmentStatus:'UNADJUSTED',standardSeriesEstablished:true,basis:l.route==='DIRECT_CURRENT_DELIVERABLE'?'DIRECT_SERIES_EVIDENCE':'RULE_MAPPED_EXACT_STANDARD_SERIES',seriesEvidenceReference:contractSourceHash(JSON.stringify({identity:l.identity,current:l.current,classRule:l.classRule,sourceHashes:input.originals.map(d=>({id:d.id,sha256:d.sha256}))}))});
  }
  check(input.selection[0].expiry===input.selection[1].expiry&&input.selection[0].type===input.selection[1].type&&snapshotCents(input.selection[0].strike)!==snapshotCents(input.selection[1].strike),'PAIR_SCOPE');
  check(used.size===documents.size,'UNREVIEWED_EXTRA_ORIGINAL');
  const payload={contracts,sourceBinding:input},rawJson=JSON.stringify(payload);
  const record={kind:'CONTRACT',origin:fixture?'SYNTHETIC_FIXTURE':'OWNER_DOCUMENT',source:'OFFLINE_REVIEWED_CONTRACT_ORIGINALS',reviewedBy:input.review.by,observedAt,receivedAt,reviewedAt:input.review.at,validThrough:input.window.through,verdict:'PASS',rawJson,sha256:contractSourceHash(rawJson)};
  const envelope=readTechEvidenceRecords({inputs:[record],kinds:['CONTRACT'],now,decision:from,validThrough:through});check(!envelope.blockers.length,'ENVELOPE_CLOCK');
  Object.assign(out,{status:fixture?'TEST_FIXTURE_ONLY':'ATTRIBUTED_CONTRACT_EVIDENCE_READY',contracts,record,sourceHashes:input.originals.map(d=>({id:d.id,sha256:d.sha256})),currentDeliverableScope:'CURRENT_STANDARD_ECONOMICS_NOT_NEVER_ADJUSTED'});
 }catch(e){out.blockers=[/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'CONTRACT_SOURCE_INVALID'];}
 return out;
}

/** Mandatory at the real continuation consumer; deleting a binding cannot downgrade. */
export function verifyBoundContinuationContract(payload,{context,contracts,decisionAt,validThrough,record=null}){
 check(payload?.sourceBinding,'BINDING_REQUIRED');const source=payload.sourceBinding;check(source.context===context,'CONSUMER_CONTEXT');
 check(clock(source.window.from)<=clock(decisionAt)&&clock(source.window.through)>=clock(validThrough),'CONSUMER_WINDOW');
 const r=inspectContractSourceBinding(source,decisionAt);check(r.record&&r.status===(context==='TEST_FIXTURE_ONLY'?'TEST_FIXTURE_ONLY':'ATTRIBUTED_CONTRACT_EVIDENCE_READY'),'CONSUMER_SOURCE_REJECTED');
 if(record)check(Object.keys(r.record).every(k=>record[k]===r.record[k]),'CONSUMER_ENVELOPE_BINDING');
 check(same(payload.contracts,r.contracts)&&contracts.length===2&&contracts.every(c=>r.contracts.some(x=>same(x.contract,c))),'CONSUMER_CONTRACT_BINDING');return r;
}
