import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {readGuidanceResearchFrames,claimGuidanceSlot} from './options-guidance-io.mjs';
import {extendPositionThesis} from './options-trade-thesis-io.mjs';
import {collectPositionQuotes,routeDailyGuidance} from './options-guidance-host.mjs';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotCents,snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {guidanceLocal} from '../../src/engines/options-daily-guidance/OptionsGuidanceClock.ts';
import {assessPositionWatch} from '../../src/engines/options-manual-ledger/OptionsPositionWatch.ts';
import {manualUsdUnits} from '../../src/engines/options-manual-ledger/OptionsManualLedger.ts';

const BASE='data/runtime/options-position-quotes',MAX=8*1024*1024,TOTAL=64*1024*1024;
const fail=c=>{throw Error('POSITION_WATCH_'+c);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v)?v:fail('ID');
const pathFor=(reviewId,name)=>`${BASE}/${id(reviewId)}/${name}.json`;
const read=(root,path)=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX)));
function load(root,reviewId,name){const value=read(root,pathFor(reviewId,name)),{fingerprint,...payload}=value;if(paperFingerprint(payload)!==fingerprint)fail('REVIEW_INTEGRITY');return value;}
function list(root){
  let current=root;
  for(const part of BASE.split('/')){current=resolve(current,part);if(!existsSync(current))return [];if(lstatSync(current).isSymbolicLink()||!lstatSync(current).isDirectory())fail('UNSAFE_STORE');}
  const entries=readdirSync(current,{withFileTypes:true});if(entries.length>100||entries.some(e=>!e.isDirectory()||e.isSymbolicLink()))fail('CATALOG_LIMIT');
  return entries.map(e=>id(e.name));
}
function capacity(root){
  let bytes=0;const ids=list(root);
  for(const reviewId of ids){const dir=resolve(root,BASE,reviewId),entries=readdirSync(dir,{withFileTypes:true});
    if(entries.length>5||entries.some(e=>!e.isFile()||e.isSymbolicLink()||!['request.json','claim.json','call-0.json','call-1.json','result.json'].includes(e.name)))fail('STORE_ENTRIES');
    for(const e of entries){const n=lstatSync(resolve(dir,e.name)).size;if(n>MAX)fail('RECORD_LIMIT');bytes+=n;}}
  return {ids,bytes};
}
function save(root,reviewId,name,payload){
  const value={...payload,fingerprint:paperFingerprint(payload)},bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'),state=capacity(root);
  if(bytes.length>MAX||state.bytes+bytes.length>TOTAL||!state.ids.includes(reviewId)&&state.ids.length>=100)fail('STORAGE_CAPACITY');
  const path=pathFor(reviewId,name);io.directory(root,`${BASE}/${id(reviewId)}`);io.writeExclusive(root,path,bytes);return value;
}
const planKey=t=>paperFingerprint({contract:t.contract,plan:t.plan,registeredAt:t.registeredAt});
const positionKey=t=>paperFingerprint({plan:planKey(t),openContracts:t.openContracts,lastExecutionAt:t.lastExecutionAt,netCashFlowUsd:t.netCashFlowUsd,remainingCostBasisUsd:t.remainingCostBasisUsd});
const key=c=>JSON.stringify([c.symbol,c.expiry,c.optionType??c.type.toUpperCase(),manualUsdUnits(c.strikeUsd??c.strike),c.multiplier],(_,v)=>typeof v==='bigint'?v.toString():v);

/** Only metadata from recomputed, fingerprint-verified captures can identify a contract. */
function identities(root,origin,at){
  const rows=[];let bytes=0;
  for(const frame of readGuidanceResearchFrames(root).filter(f=>f.origin===origin&&snapshotNs(f.recordedAt)<=snapshotNs(at))){
    const raw=io.readBytes(root,frame.path,MAX);bytes+=raw.length;if(bytes>TOTAL)fail('IDENTITY_SOURCE_LIMIT');
    const record=parseChainSurveyJson(raw.toString('utf8')),chains=new Map();
    for(const receipt of record.input.receipts)if(receipt.tool==='get_option_chains')for(const c of receipt.response.data.chains)chains.set(c.id,{...c,receivedAt:receipt.receivedAt});
    for(const receipt of record.input.receipts)if(receipt.tool==='get_option_instruments')for(const i of receipt.response.data.instruments){
      const c=chains.get(i.chain_id);
      if(!c||c.symbol!==i.chain_symbol||i.underlying_type!=='equity'||Number(i.trade_value_multiplier)!==100||i.state!=='active'||i.tradability!=='tradable')continue;
      rows.push({id:i.id,symbol:i.chain_symbol,expiry:i.expiration_date,type:i.type,strike:i.strike_price,multiplier:100,ticks:i.min_ticks??null,
        chainSession:{chainId:i.chain_id,lateCloseState:['enabled','disabled'].includes(c.late_close_state)?c.late_close_state:'unknown',receivedAt:c.receivedAt},
        provenance:{path:frame.path,sha256:sha(raw),recordedAt:frame.recordedAt,receivedAt:receipt.receivedAt,kind:'HISTORICAL_IDENTITY_ONLY'}});
    }
  }
  return rows;
}
export function positionQuoteScope(root,ledgerId,at){
  const ledger=readManualLedger(root,ledgerId,()=>at),open=ledger.report.trades.filter(t=>t.openContracts>0);
  const origin=ledger.report.origin==='SYNTHETIC_FIXTURE'?'SYNTHETIC_FIXTURE':'HOST_MARKET_TOOL_RESPONSES';
  let refs=[],identityError=null;try{if(open.length)refs=identities(root,origin,at);}catch{identityError='IDENTITY_SOURCE_UNAVAILABLE';}
  const positions=open.map(t=>{
    const candidates=refs.filter(c=>key(c)===key(t.contract)),ids=[...new Set(candidates.map(c=>c.id))];
    const identity=ids.length===1&&!refs.some(c=>c.id===ids[0]&&key(c)!==key(t.contract))?candidates.sort((a,b)=>a.provenance.recordedAt.localeCompare(b.provenance.recordedAt)).at(-1):null;
    return {tradeId:t.tradeId,openContracts:t.openContracts,contract:t.contract,planFingerprint:planKey(t),positionFingerprint:positionKey(t),identity,status:identity?'IDENTIFIED':'MISSING_VERIFIED_CONTRACT_IDENTITY'};
  });
  return {ledger,origin,positions,identityError};
}
export function preparePositionQuotes(root,ledgerId,reviewId,tradeIds,at){
  id(reviewId);id(ledgerId);snapshotNs(at);
  if(tradeIds!==null&&(!Array.isArray(tradeIds)||!tradeIds.length||tradeIds.length>100||new Set(tradeIds).size!==tradeIds.length))fail('SELECTION');
  tradeIds?.forEach(id);
  const submission={ledgerId,tradeIds};
  if(existsSync(resolve(root,pathFor(reviewId,'request')))){const r=load(root,reviewId,'request');if(paperFingerprint(r.submission)!==paperFingerprint(submission))fail('REQUEST_CONFLICT');return r;}
  const {ledger,origin,positions,identityError}=positionQuoteScope(root,ledgerId,at);
  if(!positions.length)return {status:'NO_OPEN_POSITIONS',calls:0,executionAllowed:false};
  const pending=positionQuoteRecords(root,ledgerId,at).find(v=>!v.claim&&!v.result&&v.request.ledgerHead===ledger.headSha256&&paperFingerprint(v.request.submission)===paperFingerprint(submission));
  if(pending)return pending.request;
  if(tradeIds?.some(v=>!positions.some(p=>p.tradeId===v)))fail('SELECTION_NOT_OPEN');
  const chosen=positions.filter(p=>!tradeIds||tradeIds.includes(p.tradeId)),contracts=[...new Map(chosen.filter(p=>p.identity).map(p=>[p.identity.id,p.identity])).values()];
  if(contracts.length>6)return {status:'SELECTION_REQUIRED',positions,maximumContracts:6,calls:0,executionAllowed:false};
  if(!contracts.length)return {status:'MISSING_VERIFIED_CONTRACT_IDENTITY',positions,identityError,calls:0,executionAllowed:false};
  const request={version:'OPTIONS_POSITION_QUOTES_REQUEST_V1',reviewId,submission,ledgerId,ledgerHead:ledger.headSha256,origin,preparedAt:at,
    positions:positions.map(p=>({...p,selected:chosen.includes(p)&&!!p.identity})),contracts,status:'PREPARED_NOT_COLLECTED',maximumCalls:2,maximumContracts:6,costUsd:'UNKNOWN',executionAllowed:false};
  // Reserve room for the bounded result before any market request.
  if(capacity(root).bytes+MAX>TOTAL)fail('STORAGE_CAPACITY');
  return save(root,reviewId,'request',request);
}
function eligible(root,r,at,allowSynthetic=false){
  if(r.origin==='SYNTHETIC_FIXTURE'&&!allowSynthetic)fail('SYNTHETIC_NOT_LIVE');
  const session=paperSession(at,undefined),local=guidanceLocal(at);
  if(!session.isOpen)fail('REGULAR_SESSION_REQUIRED');
  // Leave the installed routine window and its slot exclusively to Host V4.
  if(local.minute>=950&&local.minute<960)fail('ROUTINE_WINDOW_RESERVED');
  const ledger=readManualLedger(root,r.ledgerId,()=>at);
  if(ledger.headSha256!==r.ledgerHead)fail('POSITIONS_CHANGED');
  if(!r.contracts.length||r.contracts.length>6||r.positions.some(p=>p.selected&&!ledger.report.trades.some(t=>t.tradeId===p.tradeId&&t.openContracts===p.openContracts&&t.openContracts>0&&planKey(t)===p.planFingerprint)))fail('POSITIONS_CHANGED');
  if(capacity(root).bytes+MAX>TOTAL)fail('STORAGE_CAPACITY');
  return session;
}
export function beginPositionQuotes(root,reviewId,at,{allowSynthetic=false}={}){
  const r=load(root,reviewId,'request');eligible(root,r,at,allowSynthetic);
  if(existsSync(resolve(root,pathFor(reviewId,'claim'))))return {claimed:false,reviewId};
  const route=routeDailyGuidance(at,{ongoing:true}),slot=route.slot;
  const shared=claimGuidanceSlot(root,slot);if(!shared.claimed)return {claimed:false,reviewId,reason:'SHARED_HOST_SLOT_ALREADY_CLAIMED',slot};
  const session=paperSession(at,undefined),local=guidanceLocal(at),remaining=(session.closeMinute-local.minute)*60000-new Date(at).getUTCSeconds()*1000-new Date(at).getUTCMilliseconds();
  const claim=save(root,reviewId,'claim',{reviewId,requestFingerprint:r.fingerprint,startedAt:at,slot,slotPath:shared.path,expiresAt:new Date(Date.parse(at)+Math.min(180000,remaining)).toISOString(),reservedCalls:2,reservedQuotes:r.contracts.length});
  const request={reviewId:r.reviewId,fingerprint:r.fingerprint,origin:r.origin,contracts:r.contracts.map(({id,symbol})=>({id,symbol}))};
  return {claimed:true,request,claim,source:`async function(params){return (${collectPositionQuotes.toString()})({...params,request:${JSON.stringify(request)}});}`};
}
export function authorizePositionQuoteCall(root,reviewId,index,at,{allowSynthetic=false}={}){
  if(![0,1].includes(index))fail('CALL_INDEX');const r=load(root,reviewId,'request'),claim=load(root,reviewId,'claim');
  eligible(root,r,at,allowSynthetic);
  if(claim.requestFingerprint!==r.fingerprint||snapshotNs(at)<snapshotNs(claim.startedAt)||snapshotNs(at)>=snapshotNs(claim.expiresAt)||existsSync(resolve(root,pathFor(reviewId,'result'))))fail('PERMIT_EXPIRED');
  if(index===1&&!existsSync(resolve(root,pathFor(reviewId,'call-0'))))fail('CALL_ORDER');
  save(root,reviewId,`call-${index}`,{reviewId,index,authorizedAt:at,requestFingerprint:r.fingerprint});
  return {authorized:true,reviewId,index,expiresAt:claim.expiresAt};
}
const clock=v=>{try{snapshotNs(v);return v;}catch{return null;}};
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
function normalize(root,r,raw,at){
  if(raw?.version!=='OPTIONS_POSITION_QUOTES_RAW_V1'||raw.reviewId!==r.reviewId||raw.requestFingerprint!==r.fingerprint||raw.origin!==r.origin||raw.accountAccessed!==false||raw.executionAllowed!==false||!Number.isInteger(raw.calls)||raw.calls<0||raw.calls>2||!Array.isArray(raw.receipts)||raw.receipts.length>raw.calls||!Array.isArray(raw.failures)||raw.failures.length>2)fail('RAW_SCOPE');
  const claim=load(root,r.reviewId,'claim');
  if(snapshotNs(raw.startedAt)<snapshotNs(claim.startedAt)||snapshotNs(raw.capturedAt)<snapshotNs(raw.startedAt)||snapshotNs(raw.capturedAt)>snapshotNs(at))fail('RAW_CLOCK');
  for(let n=0;n<raw.calls;n++)load(root,r.reviewId,`call-${n}`);
  const expected=[{tool:'get_equity_quotes',request:{symbols:[...new Set(r.contracts.map(c=>c.symbol))].sort()}},{tool:'get_option_quotes',request:{instrument_ids:r.contracts.map(c=>c.id)}}];
  const equities=[],quotes=[],issues=[];let previous=raw.startedAt,returnedEquityRows=0,returnedOptionRows=0;
  for(let n=0;n<raw.receipts.length;n++){
    const receipt=raw.receipts[n],permit=load(root,r.reviewId,`call-${n}`);
    if(receipt.tool!==expected[n].tool||paperFingerprint(receipt.request)!==paperFingerprint(expected[n].request))fail('RECEIPT_IDENTITY');
    if(snapshotNs(receipt.requestedAt)<snapshotNs(previous)||snapshotNs(receipt.receivedAt)<snapshotNs(receipt.requestedAt)||snapshotNs(receipt.receivedAt)>snapshotNs(raw.capturedAt)||snapshotNs(receipt.requestedAt)>=snapshotNs(claim.expiresAt)||snapshotNs(permit.authorizedAt)>snapshotNs(receipt.requestedAt))fail('RECEIPT_CLOCK');
    previous=receipt.receivedAt;
    const rows=receipt.response?.data?.results;if(!Array.isArray(rows)){issues.push('SOURCE_RESPONSE_INVALID');continue;}
    if(rows.length>(n===0?2:6))fail('RETURN_LIMIT');
    if(n===0){returnedEquityRows=rows.length;for(const symbol of expected[0].request.symbols){
      const matches=rows.filter(row=>row?.quote?.symbol===symbol);if(matches.length!==1){issues.push('ETF_MISSING_OR_AMBIGUOUS:'+symbol);continue;}
      const q=matches[0].quote;
      // Retain the newest reported timestamp even when future/invalid; do not fall back.
      const prices=[[q.last_trade_price,q.venue_last_trade_time],[q.last_non_reg_trade_price,q.venue_last_non_reg_trade_time]].filter(p=>clock(p[1])).sort((a,b)=>snapshotNs(a[1])>snapshotNs(b[1])?-1:1);
      const [price,sourceAt]=prices[0]??[null,null];
      equities.push({symbol,price,sourceAt,receivedAt:receipt.receivedAt});
    }}else{returnedOptionRows=rows.length;for(const c of r.contracts){
      const matches=rows.filter(row=>row?.quote?.instrument_id===c.id);if(matches.length!==1){issues.push('OPTION_MISSING_OR_AMBIGUOUS:'+c.id);continue;}
      const q=matches[0].quote,e=equities.find(e=>e.symbol===c.symbol),ticks=c.ticks;
      const underlyingValid=e&&clock(e.sourceAt)&&snapshotNs(e.sourceAt)<=snapshotNs(e.receivedAt);
      quotes.push({id:c.id,symbol:c.symbol,expiry:c.expiry,type:c.type,strike:c.strike,multiplier:c.multiplier,chainSession:c.chainSession,
        bidCents:snapshotCents(q.bid_price),askCents:snapshotCents(q.ask_price),bidSize:count(q.bid_size),askSize:count(q.ask_size),delta:null,tickCents:null,
        aboveTickCents:snapshotCents(ticks?.above_tick),belowTickCents:snapshotCents(ticks?.below_tick),cutoffCents:snapshotCents(ticks?.cutoff_price),
        updatedAt:clock(q.updated_at),receivedAt:receipt.receivedAt,underlyingPriceCents:underlyingValid?snapshotCents(e.price):null,underlyingPriceUsd:underlyingValid?e.price:null,underlyingAt:underlyingValid?e.sourceAt:null});
    }if(rows.some(row=>row?.quote&&!r.contracts.some(c=>c.id===row.quote.instrument_id)))issues.push('UNREQUESTED_OPTION_IDENTITY');}
  }
  // A wrong-ID batch is conflicted, never a source from which to choose favorable rows.
  if(issues.includes('UNREQUESTED_OPTION_IDENTITY'))quotes.length=0;
  return {equities,quotes,issues,returnedEquityRows,returnedOptionRows};
}
export function positionQuoteRecords(root,ledgerId,at){
  return list(root).map(reviewId=>{
    const request=load(root,reviewId,'request');if(request.ledgerId!==ledgerId||snapshotNs(request.preparedAt)>snapshotNs(at))return null;
    const result=existsSync(resolve(root,pathFor(reviewId,'result')))?load(root,reviewId,'result'):null;
    const savedClaim=existsSync(resolve(root,pathFor(reviewId,'claim')))?load(root,reviewId,'claim'):null;
    const claim=savedClaim&&snapshotNs(savedClaim.startedAt)<=snapshotNs(at)?savedClaim:null;
    return {request,claim,result:result&&snapshotNs(result.recordedAt)<=snapshotNs(at)?result:null};
  }).filter(Boolean).sort((a,b)=>a.request.preparedAt.localeCompare(b.request.preparedAt)||a.request.reviewId.localeCompare(b.request.reviewId));
}
function evaluate(root,report,frame,at,costs,records,market=null,candidate=null){
  const priorByTrade={};for(const t of report.trades)priorByTrade[t.tradeId]=[...new Set(records.flatMap(r=>r.result?.binding==='MATCHED'?r.result.rows.filter(row=>row.tradeId===t.tradeId&&row.planFingerprint===planKey(t)).flatMap(row=>row.thesis?.triggered??row.attentionReasons):[]))];
  return extendPositionThesis(root,report,assessPositionWatch(report,frame,at,costs),at,candidate,{priorByTrade,market});
}
export function recordPositionQuotes(root,reviewId,raw,at){
  const r=load(root,reviewId,'request');
  if(existsSync(resolve(root,pathFor(reviewId,'result')))){const result=load(root,reviewId,'result');if(paperFingerprint(raw)!==paperFingerprint(result.raw))fail('RESULT_CONFLICT');return result;}
  const normalized=normalize(root,r,raw,at),ledger=readManualLedger(root,r.ledgerId,()=>at),binding=ledger.headSha256===r.ledgerHead?'MATCHED':'POSITIONS_CHANGED';
  const path=pathFor(reviewId,'result'),frame={path,sha256:paperFingerprint(raw),recordedAt:at,capturedAt:raw.capturedAt,origin:r.origin,quotes:normalized.quotes};
  const market=Object.fromEntries(normalized.equities.map(e=>[e.symbol,{...e,recordedAt:at,path,fingerprint:paperFingerprint(raw),origin:r.origin}]));
  for(const c of r.contracts)market[c.symbol]??={symbol:c.symbol,price:null,sourceAt:null,receivedAt:null,recordedAt:at,path,fingerprint:paperFingerprint(raw),origin:r.origin};
  const report=evaluate(root,ledger.report,binding==='MATCHED'?frame:null,at,{},positionQuoteRecords(root,r.ledgerId,at),market);
  const rows=report.rows.filter(row=>r.positions.some(p=>p.selected&&p.tradeId===row.tradeId)).map(({reviewHistory,reviewInput,...row})=>({...row,planFingerprint:planKey(ledger.report.trades.find(t=>t.tradeId===row.tradeId))}));
  return save(root,reviewId,'result',{version:'OPTIONS_POSITION_QUOTES_RESULT_V1',reviewId,recordedAt:at,requestFingerprint:r.fingerprint,ledgerHeadAtSave:ledger.headSha256,binding,raw,frame,market,rows,
    coverage:r.positions.map(p=>({tradeId:p.tradeId,selected:p.selected,identityId:p.identity?.id??null,status:!p.selected?p.status==='IDENTIFIED'?'NOT_SELECTED':p.status:binding!=='MATCHED'?binding:normalized.quotes.some(q=>q.id===p.identity.id)?'QUOTE_RETURNED':'QUOTE_MISSING'})),
    issues:normalized.issues,calls:raw.calls,returnedEquityRows:normalized.returnedEquityRows,returnedOptionRows:normalized.returnedOptionRows,quoteRows:normalized.quotes.length,
    localWrites:4+[0,1].filter(n=>existsSync(resolve(root,pathFor(reviewId,`call-${n}`)))).length,costUsd:'UNKNOWN',executionAllowed:false,actualExitConfirmed:false});
}
/** Current checks can age; saved evaluations retain the original observation time. */
export function targetedPositionWatch(root,report,defaultFrame,at,costs={},candidate=null){
  let records;try{records=positionQuoteRecords(root,report.ledgerId,at);}catch{
    return {...extendPositionThesis(root,report,assessPositionWatch(report,null,at,costs),at,candidate),targeted:{error:'TARGETED_RECOVERY_UNAVAILABLE',records:[]}};
  }
  const base=evaluate(root,report,defaultFrame,at,costs,records,null,candidate);
  const rows=base.rows.map(row=>{
    const latest=records.filter(r=>r.claim&&r.request.positions.some(p=>p.selected&&p.tradeId===row.tradeId)).sort((a,b)=>a.claim.startedAt.localeCompare(b.claim.startedAt)).at(-1);
    if(!latest||defaultFrame&&snapshotNs(defaultFrame.capturedAt)>snapshotNs(latest.claim.startedAt))return row;
    const r=latest.result,trade=report.trades.find(t=>t.tradeId===row.tradeId),samePlan=latest.request.positions.find(p=>p.tradeId===row.tradeId)?.planFingerprint===planKey(trade);
    const valid=r?.binding==='MATCHED'&&samePlan&&latest.request.positions.find(p=>p.tradeId===row.tradeId)?.positionFingerprint===positionKey(trade);
    const watch=evaluate(root,report,valid?r.frame:null,at,costs,records,r?.market??{},candidate);
    return {...watch.rows.find(x=>x.tradeId===row.tradeId),targetedReviewId:latest.request.reviewId,targetedBinding:valid?'MATCHED':r?'POSITIONS_CHANGED':'AWAITING_HOST_RECEIPT'};
  });
  return {...base,rows,attentionCount:rows.filter(r=>r.thesis?.triggered?.length||r.attentionReasons.length).length,targeted:{records:records.map(({request,claim,result})=>({reviewId:request.reviewId,preparedAt:request.preparedAt,positions:request.positions.map(({identity,...p})=>({...p,identityId:identity?.id??null})),status:result?result.binding:claim?'AWAITING_HOST_RECEIPT':'PREPARED_NOT_COLLECTED',claimAt:claim?.startedAt??null,result:result?(({raw,frame,market,...summary})=>summary)(result):null})).reverse()}};
}
