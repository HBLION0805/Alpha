import {assessSnapshotQuote,snapshotNs,snapshotCents,snapshotUnderlyingMicros} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';

export function validateTechQuoteSelection(s){
 if(!s||Object.keys(s).sort().join()!=='expiry,strike,symbol'||!['AAPL','TSM','QQQ','TSLA'].includes(s.symbol)||
 !/^\d{4}-\d\d-\d\d$/.test(s.expiry)||new Date(s.expiry+'T00:00:00Z').toISOString().slice(0,10)!==s.expiry||
 snapshotCents(s.strike)===null||snapshotCents(s.strike)<=0)throw Error('TECH_QUOTES_SELECTION');
 return s;
}
/** Serializable bounded collector, executed only in an equipped authorized Host. */
export async function collectTechOptionQuotes({selection,call,clock,origin='HOST_MARKET_TOOL_RESPONSES'}){
 const fail=c=>{throw Error(c)},uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
 if(!selection||Object.keys(selection).sort().join()!=='expiry,strike,symbol'||!['AAPL','TSM','QQQ','TSLA'].includes(selection.symbol)||
 !/^\d{4}-\d\d-\d\d$/.test(selection.expiry)||!/^\d{1,8}(?:\.\d{1,4})?$/.test(selection.strike)||Number(selection.strike)<=0||
 !['HOST_MARKET_TOOL_RESPONSES','SYNTHETIC_FIXTURE'].includes(origin))fail('TECH_QUOTES_SELECTION');
 const receipts=[],failures=[],selectedIds=[];let previous=null,calls=0;
 const now=async()=>{const t=await clock();if(typeof t!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(t)||new Date(t).toISOString()!==t||previous&&t<previous)fail('CLOCK');previous=t;return t;};
 const startedAt=await now();
 async function read(tool,request){
  const requestedAt=await now();if(calls>=4||Date.parse(requestedAt)-Date.parse(startedAt)>=120000)fail('COLLECTION_BOUND');calls++;
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
  const instruments=await read('get_option_instruments',{chain_id:chain.id,expiration_dates:selection.expiry,strike_price:selection.strike,state:'active'});
  if(instruments.next)fail('PAGINATION_NOT_ALLOWED');
  if(!Array.isArray(instruments.instruments)||!instruments.instruments.length||instruments.instruments.length>2)fail('INSTRUMENT_COUNT');
  const types=new Set();
  for(const i of instruments.instruments){
   if(!uuid(i.id)||selectedIds.includes(i.id)||types.has(i.type)||!['call','put'].includes(i.type)||i.chain_id!==chain.id||
    i.chain_symbol!==selection.symbol||i.expiration_date!==selection.expiry||Number(i.strike_price)!==Number(selection.strike)||
    i.state!=='active'||i.tradability!=='tradable'||i.underlying_type!=='equity'||Number(i.trade_value_multiplier)!==100)fail('INSTRUMENT_IDENTITY');
   types.add(i.type);selectedIds.push(i.id);
  }
  await read('get_equity_quotes',{symbols:[selection.symbol]});
  await read('get_option_quotes',{instrument_ids:selectedIds});
  status='CAPTURED';
 }catch(e){const code=/^[A-Z_]+$/.test(e?.message)?e.message:'INPUT_OR_SOURCE_INVALID';if(!failures.some(f=>f.code===code))failures.push({code});}
 const capturedAt=await now();if(Date.parse(capturedAt)-Date.parse(startedAt)>=120000){status='BLOCKED';failures.push({code:'COLLECTION_BOUND'});}
 return {version:'TECH_OPTION_CAPTURE_V1',origin,selection,startedAt,capturedAt,calls,selectedIds,receipts,failures,status,accountAccessed:false,executionAllowed:false};
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
export function normalizeTechOptionCapture(capture,asOf){
 const v=capture;validateTechQuoteSelection(v?.selection);
 check(v.version==='TECH_OPTION_CAPTURE_V1'&&['HOST_MARKET_TOOL_RESPONSES','SYNTHETIC_FIXTURE'].includes(v.origin)&&v.accountAccessed===false&&v.executionAllowed===false,'SCOPE');
 const now=snapshotNs(asOf),started=snapshotNs(v.startedAt),finished=snapshotNs(v.capturedAt);
 check(started<=finished&&finished<=now&&finished-started<120000000000n,'CAPTURE_CLOCK');
 check(Array.isArray(v.receipts)&&v.receipts.length<=4&&Number.isSafeInteger(v.calls)&&v.calls>=v.receipts.length&&v.calls<=4&&Array.isArray(v.failures),'COUNTS');
 if(v.status!=='CAPTURED'||v.failures.length)return {version:'TECH_OPTION_NORMALIZED_V1',status:'BLOCKED_SOURCE',failures:v.failures,quotes:[],executionAllowed:false};
 check(v.receipts.length===4&&v.calls===4,'INCOMPLETE_CAPTURE');
 const expected=['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes'];
 let last=started;
 for(const [n,r] of v.receipts.entries()){check(r.tool===expected[n],'TOOL_ORDER');const begin=snapshotNs(r.requestedAt),end=snapshotNs(r.receivedAt);check(last<=begin&&begin<=end&&end<=finished,'RECEIPT_CLOCK');last=end;}
 const [cr,ir,er,qr]=v.receipts,[chains,instruments,equities,options]=v.receipts.map(r=>body(r.response));
 check(Array.isArray(chains.chains)&&chains.chains.length===1,'CHAIN_COUNT');const ch=chains.chains[0],s=v.selection;
 check(typeof ch.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(ch.id)&&cr.request.underlying_symbol===s.symbol&&Object.keys(cr.request).length===1&&ch.symbol===s.symbol&&ch.expiration_dates?.includes(s.expiry)&&Number(ch.trade_value_multiplier)===100,'CHAIN_IDENTITY');
 check(JSON.stringify(ir.request)===JSON.stringify({chain_id:ch.id,expiration_dates:s.expiry,strike_price:s.strike,state:'active'}),'INSTRUMENT_REQUEST');
 check(!instruments.next&&Array.isArray(instruments.instruments)&&instruments.instruments.length>0&&instruments.instruments.length<=2,'INSTRUMENT_COUNT');
 const ids=[],types=new Set();
 for(const i of instruments.instruments){
  check(typeof i.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(i.id)&&!ids.includes(i.id)&&!types.has(i.type)&&['call','put'].includes(i.type)&&i.chain_id===ch.id&&i.chain_symbol===s.symbol&&i.expiration_date===s.expiry&&snapshotCents(i.strike_price)===snapshotCents(s.strike)&&i.state==='active'&&i.tradability==='tradable'&&i.underlying_type==='equity'&&Number(i.trade_value_multiplier)===100,'INSTRUMENT_IDENTITY');
  ids.push(i.id);types.add(i.type);
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
  const ask=positiveCents(raw.ask_price),below=positiveCents(i.min_ticks?.below_tick),above=positiveCents(i.min_ticks?.above_tick),cutoff=positiveCents(i.min_ticks?.cutoff_price);
  const snapshot={id:i.id,symbol:s.symbol,expiry:i.expiration_date,type:i.type,strike:i.strike_price,multiplier:Number(i.trade_value_multiplier),bidCents:positiveCents(raw.bid_price),askCents:ask,bidSize:count(raw.bid_size),askSize:count(raw.ask_size),tickCents:ask===null||cutoff===null?null:ask>=cutoff?above:below,aboveTickCents:above,belowTickCents:below,cutoffCents:cutoff,delta:typeof raw.delta==='string'&&Number.isFinite(Number(raw.delta))?Number(raw.delta):null,updatedAt:sourceClock(raw.updated_at),receivedAt:qr.receivedAt,underlyingPriceUsd,underlyingPriceCents:null,underlyingAt,chainSession:{chainId:ch.id,lateCloseState:['enabled','disabled'].includes(ch.late_close_state)?ch.late_close_state:'unknown',receivedAt:cr.receivedAt}};
  const atReceipt=assessSnapshotQuote(snapshot,qr.receivedAt,true,true),current=assessSnapshotQuote(snapshot,asOf,true,true),blockers=[...current.blockers];
  if(current.staleNow)blockers.push('QUOTE_STALE_NOW');
  if(!paperSession(asOf,snapshot.chainSession).isOpen)blockers.push('ASSESSMENT_OUTSIDE_SESSION');
  if(equity.state!=='active'||equity.has_traded!==true)blockers.push('UNDERLYING_ACTIVITY_UNKNOWN');
  if(underlyingAt&&snapshotNs(underlyingAt)>snapshotNs(er.receivedAt))blockers.push('UNDERLYING_AFTER_OWN_RECEIPT');
  if(snapshot.bidSize===0||snapshot.askSize===0)blockers.push('DISPLAYED_SIZE_INSUFFICIENT');
  const spread=snapshot.askCents===null||snapshot.bidCents===null?null:snapshot.askCents-snapshot.bidCents;
  const mechanical=snapshot.tickCents&&snapshot.askCents?Math.max(snapshot.tickCents,Math.min(10,Math.floor(snapshot.askCents/10/snapshot.tickCents)*snapshot.tickCents||snapshot.tickCents)):null;
  if(spread!==null&&mechanical!==null&&spread>mechanical)blockers.push('EXISTING_MECHANICAL_SPREAD_LIMIT');
  return {id:i.id,symbol:s.symbol,status:blockers.length?'BLOCKED_QUOTE':'QUALIFIED_SNAPSHOT_ONLY',blockers:[...new Set(blockers)],snapshot,atReceipt,current,spreadCents:spread,mechanicalSpreadLimitCents:mechanical,contractEvidence:{deliverable:null,exerciseStyle:null,tradability:i.tradability,selloutDatetime:i.sellout_datetime??null},sourceClockMeaning:'Provider quote refresh; independent bid/ask exchange timestamps are not exposed by this option response.'};
 });
 return {version:'TECH_OPTION_NORMALIZED_V1',status:quotes.some(q=>q.status==='QUALIFIED_SNAPSHOT_ONLY')?'SNAPSHOT_AVAILABLE':'NO_QUALIFIED_SNAPSHOT',assessedAt:asOf,origin:v.origin,selection:s,underlying,quotes,source:'ROBINHOOD_OFFICIAL_MCP',transport:'EXISTING_LOCAL_CODEX_OAUTH_HOST',synthetic:v.origin==='SYNTHETIC_FIXTURE',accountPermission:null,dataEntitlement:null,funds:null,costs:null,executionAllowed:false,paperAdmissionAllowed:false,limitation:'Source mapping only; no plan, admission, fill or account authority. Missing deliverable/permissions/funds/costs remain unknown.'};
}
