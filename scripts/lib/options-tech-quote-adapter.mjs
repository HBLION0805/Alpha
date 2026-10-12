import {assessSnapshotQuote,snapshotNs,snapshotCents,snapshotUnderlyingMicros} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';

export function validateTechQuoteSelection(s){
 if(s?.version==='TECH_DEBIT_SPREAD_SELECTION_V1')return validateTechSpreadSelection(s);
 if(!s||Object.keys(s).sort().join()!=='expiry,strike,symbol'||!['AAPL','TSM','QQQ','TSLA'].includes(s.symbol)||
 !/^\d{4}-\d\d-\d\d$/.test(s.expiry)||new Date(s.expiry+'T00:00:00Z').toISOString().slice(0,10)!==s.expiry||
 snapshotCents(s.strike)===null||snapshotCents(s.strike)<=0)throw Error('TECH_QUOTES_SELECTION');
 return s;
}
/** Serializable request schema. Timing is an explicit engineering assumption, not a trading rule. */
export function validateTechSpreadSelection(s,engineeringSPY=false){
 const fail=()=>{throw Error('TECH_QUOTES_SPREAD_SELECTION');},uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
 const cents=v=>{if(typeof v!=='string'||!/^\d{1,8}(?:\.\d{1,4})?$/.test(v))return null;const [w,f='']=v.split('.');return /[1-9]/.test(f.slice(2))?null:Number(w)*100+Number((f+'00').slice(0,2));};
 if(!s||Object.keys(s).sort().join()!=='batchId,expiry,legs,maxSourceSkewMs,structure,symbol,type,version'||s.version!=='TECH_DEBIT_SPREAD_SELECTION_V1'||
  !/^[a-z0-9][a-z0-9-]{0,79}$/.test(s.batchId)||!(engineeringSPY?s.symbol==='SPY':['AAPL','TSM','QQQ','TSLA'].includes(s.symbol))||
  !/^\d{4}-\d\d-\d\d$/.test(s.expiry)||new Date(s.expiry+'T00:00:00Z').toISOString().slice(0,10)!==s.expiry||
  !['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'].includes(s.structure)||s.type!==(s.structure==='BULL_CALL_DEBIT'?'call':'put')||
  !Number.isSafeInteger(s.maxSourceSkewMs)||s.maxSourceSkewMs<0||s.maxSourceSkewMs>60000||!Array.isArray(s.legs)||s.legs.length!==2)fail();
 for(const [n,l]of s.legs.entries())if(!l||Object.keys(l).sort().join()!=='direction,id,strike'||!uuid(l.id)||
  l.direction!==(n===0?'LONG':'SHORT')||cents(l.strike)===null||cents(l.strike)<=0)fail();
 if(s.legs[0].id===s.legs[1].id||!(s.type==='call'?cents(s.legs[0].strike)<cents(s.legs[1].strike):cents(s.legs[0].strike)>cents(s.legs[1].strike)))fail();
 return s;
}
export function techQuoteCollectorSource(selection){
 validateTechQuoteSelection(selection);
 return selection.version==='TECH_DEBIT_SPREAD_SELECTION_V1'?'(()=>{const validateTechSpreadSelection='+validateTechSpreadSelection.toString()+';return '+collectTechOptionQuotes.toString()+';})()':collectTechOptionQuotes.toString();
}
/** Serializable bounded collector, executed only in an equipped authorized Host. */
export async function collectTechOptionQuotes({selection,call,clock,origin='HOST_MARKET_TOOL_RESPONSES'}){
 const fail=c=>{throw Error(c)},uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
 const spread=selection?.version==='TECH_DEBIT_SPREAD_SELECTION_V1',maximumCalls=spread?5:4;
 if(spread)validateTechSpreadSelection(selection);
 if(!spread&&(!selection||Object.keys(selection).sort().join()!=='expiry,strike,symbol'||!['AAPL','TSM','QQQ','TSLA'].includes(selection.symbol)||
 !/^\d{4}-\d\d-\d\d$/.test(selection.expiry)||!/^\d{1,8}(?:\.\d{1,4})?$/.test(selection.strike)||Number(selection.strike)<=0||
 !['HOST_MARKET_TOOL_RESPONSES','SYNTHETIC_FIXTURE'].includes(origin)))fail('TECH_QUOTES_SELECTION');
 if(!['HOST_MARKET_TOOL_RESPONSES','SYNTHETIC_FIXTURE'].includes(origin))fail('TECH_QUOTES_SELECTION');
 const receipts=[],failures=[],selectedIds=[];let previous=null,calls=0;
 const now=async()=>{const t=await clock();if(typeof t!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(t)||new Date(t).toISOString()!==t||previous&&t<previous)fail('CLOCK');previous=t;return t;};
 const startedAt=await now();
 async function read(tool,request){
  const requestedAt=await now();if(calls>=maximumCalls||Date.parse(requestedAt)-Date.parse(startedAt)>=120000)fail('COLLECTION_BOUND');calls++;
  let response;try{response=await call(tool,request)}catch{failures.push({tool,code:'SOURCE_CALL_FAILED'});fail('SOURCE_CALL_FAILED');}
  const receivedAt=await now();receipts.push({tool,request,requestedAt,receivedAt,response});
  if(response?.isError||response?.is_error)fail('SOURCE_ERROR');
  let body=response?.structuredContent??response?.structured_content??response;
  if(!body?.data){const blocks=response?.content?.filter(x=>x.type==='text')??[];if(blocks.length!==1)fail('SOURCE_SHAPE');body=JSON.parse(blocks[0].text);}
  if(!body?.data)fail('SOURCE_SHAPE');return body.data;
 }
 let status='BLOCKED';
 try{
  const data=await read('get_option_chains',{underlying_symbol:selection.symbol});
  if(!Array.isArray(data.chains)||data.chains.length!==1)fail('CHAIN_AMBIGUOUS');
  const chain=data.chains[0];
  if(!uuid(chain.id)||chain.symbol!==selection.symbol||!chain.expiration_dates?.includes(selection.expiry)||Number(chain.trade_value_multiplier)!==100)fail('CHAIN_IDENTITY');
  for(const leg of spread?selection.legs:[{strike:selection.strike}]){
  const instruments=await read('get_option_instruments',{chain_id:chain.id,expiration_dates:selection.expiry,strike_price:leg.strike,state:'active'});
  if(instruments.next)fail('PAGINATION_NOT_ALLOWED');
  if(!Array.isArray(instruments.instruments)||!instruments.instruments.length||instruments.instruments.length>2)fail('INSTRUMENT_COUNT');
  const types=new Set();
  const selected=spread?instruments.instruments.filter(i=>i.id===leg.id):instruments.instruments;
  if(spread&&(selected.length!==1||selected[0].type!==selection.type))fail('EXPLICIT_CONTRACT_MISSING');
  for(const i of selected){
   if(!uuid(i.id)||selectedIds.includes(i.id)||types.has(i.type)||!['call','put'].includes(i.type)||i.chain_id!==chain.id||
    i.chain_symbol!==selection.symbol||i.expiration_date!==selection.expiry||Number(i.strike_price)!==Number(leg.strike)||
    i.state!=='active'||i.tradability!=='tradable'||i.underlying_type!=='equity'||Number(i.trade_value_multiplier)!==100)fail('INSTRUMENT_IDENTITY');
   types.add(i.type);selectedIds.push(i.id);
  }
  }
  await read('get_equity_quotes',{symbols:[selection.symbol]});
  await read('get_option_quotes',{instrument_ids:selectedIds});
  status='CAPTURED';
 }catch(e){const code=/^[A-Z_]+$/.test(e?.message)?e.message:'INPUT_OR_SOURCE_INVALID';if(!failures.some(f=>f.code===code))failures.push({code});}
 let capturedAt;
 try{capturedAt=await now();}catch(error){if(!spread)throw error;capturedAt=null;status='BLOCKED';failures.push({code:'FINAL_CLOCK_UNKNOWN_OR_BACKWARD'});}
 if(capturedAt!==null&&Date.parse(capturedAt)-Date.parse(startedAt)>=120000){status='BLOCKED';failures.push({code:'COLLECTION_BOUND'});}
 return {version:spread?'TECH_OPTION_CAPTURE_V2':'TECH_OPTION_CAPTURE_V1',...(spread?{batchId:selection.batchId,atomicSnapshot:false}:{}),origin,selection,startedAt,capturedAt,calls,selectedIds,receipts,failures,status,accountAccessed:false,executionAllowed:false};
}
const check=(yes,code)=>{if(!yes)throw Error('TECH_QUOTES_'+code);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function body(result){
 check(object(result)&&!result.isError&&!result.is_error,'SOURCE_ERROR');
 const v=result.structuredContent??result.structured_content??(result.data?result:null);
 if(v){check(object(v.data),'SOURCE_SHAPE');return v.data;}
 const texts=result.content?.filter(c=>c.type==='text')??[];check(texts.length===1,'SOURCE_SHAPE');
 const p=parseChainSurveyJson(texts[0].text);check(object(p.data),'SOURCE_SHAPE');return p.data;
}
const sourceClock=v=>{try{snapshotNs(v);return v}catch{return null}};
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const positiveCents=v=>{const c=snapshotCents(v);return c!==null&&c>0?c:null};
export function normalizeTechOptionCapture(capture,asOf){return normalizeCapture(capture,asOf,false);}
/** Saved engineering inputs only; the collector's allowed symbols are unchanged. */
export function normalizeEngineeringOptionCapture(capture,asOf){return normalizeCapture(capture,asOf,true);}
function normalizeCapture(capture,asOf,engineeringSPY){
 const v=capture;if(engineeringSPY)validateTechSpreadSelection(v?.selection,true);else validateTechQuoteSelection(v?.selection);
 const isSpreadBatch=v.version==='TECH_OPTION_CAPTURE_V2',maximumCalls=isSpreadBatch?5:4;
 check((isSpreadBatch||v.version==='TECH_OPTION_CAPTURE_V1')&&isSpreadBatch===(v.selection.version==='TECH_DEBIT_SPREAD_SELECTION_V1')&&['HOST_MARKET_TOOL_RESPONSES','SYNTHETIC_FIXTURE'].includes(v.origin)&&v.accountAccessed===false&&v.executionAllowed===false,'SCOPE');
 if(isSpreadBatch)check(v.batchId===v.selection.batchId&&v.atomicSnapshot===false,'BATCH_BINDING');
 const now=snapshotNs(asOf),started=snapshotNs(v.startedAt),finished=snapshotNs(v.capturedAt);
 check(started<=finished&&finished<=now&&finished-started<120000000000n,'CAPTURE_CLOCK');
 check(Array.isArray(v.receipts)&&v.receipts.length<=maximumCalls&&Number.isSafeInteger(v.calls)&&v.calls>=v.receipts.length&&v.calls<=maximumCalls&&Array.isArray(v.failures),'COUNTS');
 if(v.status!=='CAPTURED'||v.failures.length)return {version:'TECH_OPTION_NORMALIZED_V1',status:'BLOCKED_SOURCE',failures:v.failures,quotes:[],executionAllowed:false};
 check(v.receipts.length===maximumCalls&&v.calls===maximumCalls,'INCOMPLETE_CAPTURE');
 const expected=isSpreadBatch?['get_option_chains','get_option_instruments','get_option_instruments','get_equity_quotes','get_option_quotes']:['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes'];
 let last=started;
 for(const [n,r] of v.receipts.entries()){check(r.tool===expected[n],'TOOL_ORDER');const begin=snapshotNs(r.requestedAt),end=snapshotNs(r.receivedAt);check(last<=begin&&begin<=end&&end<=finished,'RECEIPT_CLOCK');last=end;}
 const cr=v.receipts[0],irs=v.receipts.slice(1,isSpreadBatch?3:2),er=v.receipts.at(-2),qr=v.receipts.at(-1);
 const chains=body(cr.response),equities=body(er.response),options=body(qr.response),instruments={instruments:[]},instrumentReceipts=new Map();
 check(Array.isArray(chains.chains)&&chains.chains.length===1,'CHAIN_COUNT');const ch=chains.chains[0],s=v.selection;
 check(typeof ch.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(ch.id)&&cr.request.underlying_symbol===s.symbol&&Object.keys(cr.request).length===1&&ch.symbol===s.symbol&&ch.expiration_dates?.includes(s.expiry)&&Number(ch.trade_value_multiplier)===100,'CHAIN_IDENTITY');
 const ids=[];
 for(const [n,ir] of irs.entries()){
  const target=isSpreadBatch?s.legs[n]:{strike:s.strike},data=body(ir.response),types=new Set();
  check(JSON.stringify(ir.request)===JSON.stringify({chain_id:ch.id,expiration_dates:s.expiry,strike_price:target.strike,state:'active'}),'INSTRUMENT_REQUEST');
  check(!data.next&&Array.isArray(data.instruments)&&data.instruments.length>0&&data.instruments.length<=2,'INSTRUMENT_COUNT');
  const selected=isSpreadBatch?data.instruments.filter(i=>i.id===target.id):data.instruments;
  if(isSpreadBatch)check(selected.length===1&&selected[0].type===s.type,'EXPLICIT_CONTRACT_MISSING');
  for(const i of selected){
   check(typeof i.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(i.id)&&!ids.includes(i.id)&&!types.has(i.type)&&['call','put'].includes(i.type)&&i.chain_id===ch.id&&i.chain_symbol===s.symbol&&i.expiration_date===s.expiry&&snapshotCents(i.strike_price)===snapshotCents(target.strike)&&i.state==='active'&&i.tradability==='tradable'&&i.underlying_type==='equity'&&Number(i.trade_value_multiplier)===100,'INSTRUMENT_IDENTITY');
   ids.push(i.id);types.add(i.type);instruments.instruments.push(i);instrumentReceipts.set(i.id,ir);
  }
 }
 check(JSON.stringify(v.selectedIds)===JSON.stringify(ids)&&JSON.stringify(qr.request)===JSON.stringify({instrument_ids:ids}),'QUOTE_REQUEST');
 check(JSON.stringify(er.request)===JSON.stringify({symbols:[s.symbol]})&&Array.isArray(equities.results)&&equities.results.length===1,'EQUITY_REQUEST');
 const equity=equities.results[0]?.quote;check(equity?.symbol===s.symbol,'EQUITY_IDENTITY');
 const underlyingPriceUsd=snapshotUnderlyingMicros(equity.last_trade_price)===null?null:equity.last_trade_price,underlyingAt=sourceClock(equity.venue_last_trade_time);
 const underlying={symbol:s.symbol,regularTradePriceUsd:underlyingPriceUsd,regularTradeAt:underlyingAt,bidPriceUsd:equity.bid_price??null,askPriceUsd:equity.ask_price??null,bidAt:sourceClock(equity.venue_bid_time),askAt:sourceClock(equity.venue_ask_time),receivedAt:er.receivedAt,state:equity.state??null,hasTraded:equity.has_traded??null};
 check(Array.isArray(options.results)&&options.results.length<=ids.length,'QUOTE_COUNT');
 const byId=new Map();
 for(const row of options.results){if(row?.quote===null)continue;const q=row?.quote;check(q&&ids.includes(q.instrument_id)&&!byId.has(q.instrument_id),'QUOTE_IDENTITY');byId.set(q.instrument_id,q);}
 const quotes=instruments.instruments.map(i=>{
  const raw=byId.get(i.id);
  if(!raw)return {id:i.id,symbol:s.symbol,status:'MISSING_QUOTE',blockers:['EXACT_OPTION_QUOTE_MISSING'],snapshot:null};
  const ask=positiveCents(raw.ask_price),below=positiveCents(i.min_ticks?.below_tick),above=positiveCents(i.min_ticks?.above_tick),cutoff=engineeringSPY?snapshotCents(i.min_ticks?.cutoff_price):positiveCents(i.min_ticks?.cutoff_price);
  const snapshot={id:i.id,symbol:s.symbol,expiry:i.expiration_date,type:i.type,strike:i.strike_price,multiplier:Number(i.trade_value_multiplier),bidCents:positiveCents(raw.bid_price),askCents:ask,bidSize:count(raw.bid_size),askSize:count(raw.ask_size),tickCents:ask===null||cutoff===null?null:ask>=cutoff?above:below,aboveTickCents:above,belowTickCents:below,cutoffCents:cutoff,delta:typeof raw.delta==='string'&&Number.isFinite(Number(raw.delta))?Number(raw.delta):null,updatedAt:sourceClock(raw.updated_at),receivedAt:qr.receivedAt,underlyingPriceUsd,underlyingPriceCents:null,underlyingAt,chainSession:{chainId:ch.id,lateCloseState:['enabled','disabled'].includes(ch.late_close_state)?ch.late_close_state:'unknown',receivedAt:cr.receivedAt}};
  const atReceipt=assessSnapshotQuote(snapshot,qr.receivedAt,true,true),current=assessSnapshotQuote(snapshot,asOf,true,true),blockers=[...current.blockers];
  if(current.staleNow)blockers.push('QUOTE_STALE_NOW');
  if(!paperSession(asOf,snapshot.chainSession).isOpen)blockers.push('ASSESSMENT_OUTSIDE_SESSION');
  if(equity.state!=='active'||equity.has_traded!==true)blockers.push('UNDERLYING_ACTIVITY_UNKNOWN');
  if(underlyingAt&&snapshotNs(underlyingAt)>snapshotNs(er.receivedAt))blockers.push('UNDERLYING_AFTER_OWN_RECEIPT');
  if(snapshot.bidSize===0||snapshot.askSize===0)blockers.push('DISPLAYED_SIZE_INSUFFICIENT');
  const bidAskSpreadCents=snapshot.askCents===null||snapshot.bidCents===null?null:snapshot.askCents-snapshot.bidCents;
  const mechanical=snapshot.tickCents&&snapshot.askCents?Math.max(snapshot.tickCents,Math.min(10,Math.floor(snapshot.askCents/10/snapshot.tickCents)*snapshot.tickCents||snapshot.tickCents)):null;
  if(bidAskSpreadCents!==null&&mechanical!==null&&bidAskSpreadCents>mechanical)blockers.push('EXISTING_MECHANICAL_SPREAD_LIMIT');
  return {id:i.id,symbol:s.symbol,...(isSpreadBatch?{batchId:v.batchId,acquisition:{instrumentRequestedAt:instrumentReceipts.get(i.id).requestedAt,instrumentReceivedAt:instrumentReceipts.get(i.id).receivedAt,quoteRequestedAt:qr.requestedAt,quoteReceivedAt:qr.receivedAt}}:{}),status:blockers.length?'BLOCKED_QUOTE':'QUALIFIED_SNAPSHOT_ONLY',blockers:[...new Set(blockers)],snapshot,atReceipt,current,spreadCents:bidAskSpreadCents,mechanicalSpreadLimitCents:mechanical,contractEvidence:{deliverable:null,exerciseStyle:null,tradability:i.tradability,selloutDatetime:i.sellout_datetime??null},sourceClockMeaning:'Provider quote refresh; independent bid/ask exchange timestamps are not exposed by this option response.'};
 });
 let pair=null;
 if(isSpreadBatch){
  const clocks=quotes.map(q=>q.snapshot?.updatedAt??null),skew=clocks.every(Boolean)?snapshotNs(clocks[0])-snapshotNs(clocks[1]):null,absolute=skew===null?null:skew<0n?-skew:skew;
  const blockers=[];if(quotes.length!==2||quotes.some(q=>q.status!=='QUALIFIED_SNAPSHOT_ONLY'))blockers.push('PAIR_LEG_NOT_QUALIFIED');
  if(absolute===null)blockers.push('PAIR_SOURCE_CLOCK_UNKNOWN');else if(absolute>BigInt(s.maxSourceSkewMs)*1000000n)blockers.push('PAIR_SOURCE_SKEW_EXCEEDED');
  pair={batchId:v.batchId,atomicSnapshot:false,sourceClockDifferenceNs:absolute?.toString()??null,maxSourceSkewMs:s.maxSourceSkewMs,timingAuthority:'EXPLICIT_REQUEST_ENGINEERING_ASSUMPTION_NOT_OWNER_STRATEGY',status:blockers.length?'BLOCKED_PAIR':'COHERENT_BATCH_EVIDENCE_ONLY',blockers};
 }
 return {version:'TECH_OPTION_NORMALIZED_V1',...(isSpreadBatch?{pair}:{}),status:isSpreadBatch?pair.status:quotes.some(q=>q.status==='QUALIFIED_SNAPSHOT_ONLY')?'SNAPSHOT_AVAILABLE':'NO_QUALIFIED_SNAPSHOT',assessedAt:asOf,origin:v.origin,selection:s,underlying,quotes,source:'ROBINHOOD_OFFICIAL_MCP',transport:'EXISTING_LOCAL_CODEX_OAUTH_HOST',synthetic:v.origin==='SYNTHETIC_FIXTURE',accountPermission:null,dataEntitlement:null,funds:null,costs:null,executionAllowed:false,paperAdmissionAllowed:false,limitation:'Source mapping only; no plan, admission, fill or account authority. Missing deliverable/permissions/funds/costs remain unknown.'};
}
