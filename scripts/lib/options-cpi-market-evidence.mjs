import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {saveEventObservation} from './options-event-intelligence-observation.mjs';

export const CPI_EVENT_ID='cpi-20261014';
export const CPI_MARKET_SOURCE='robinhood-equity-quote';
const VERSION='CPI_MARKET_CAPTURE_V1';
const fail=c=>{throw Error('CPI_MARKET_'+c);};
const sha=x=>createHash('sha256').update(x).digest('hex');
const clock=x=>{if(typeof x!=='string'||!Number.isFinite(Date.parse(x)))fail('CLOCK');return Date.parse(x);};
const money=x=>{if(typeof x!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(x)||Number(x)<=0)fail('PRICE');return Number(x);};
const safeStamp=x=>new Date(x).toISOString().replace(/[:.]/g,'-').toLowerCase();
function exactKeys(o,keys,code){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!==[...keys].sort().join(','))fail(code);}
function latestTime(...values){const v=values.filter(x=>typeof x==='string'&&Number.isFinite(Date.parse(x))).sort((a,b)=>Date.parse(b)-Date.parse(a));return v[0]??null;}
function validateQuote(symbol,row,receiptAt){
  if(!row?.quote||row.quote.symbol!==symbol)fail('SYMBOL');
  const q=row.quote;if(q.state!=='active'||q.has_traded!==true)fail('STATE');
  const bid=money(q.bid_price),ask=money(q.ask_price);if(bid>ask)fail('CROSSED');
  const bidAt=q.venue_bid_time,askAt=q.venue_ask_time;if(!bidAt||!askAt||clock(bidAt)>clock(receiptAt)||clock(askAt)>clock(receiptAt))fail('BBO_CLOCK');
  const tradeCandidates=[[q.last_trade_price,q.venue_last_trade_time],[q.last_non_reg_trade_price,q.venue_last_non_reg_trade_time]]
    .filter(([p,t])=>typeof p==='string'&&Number(p)>0&&typeof t==='string'&&Number.isFinite(Date.parse(t))&&clock(t)<=clock(receiptAt))
    .sort((a,b)=>clock(b[1])-clock(a[1]));
  if(!tradeCandidates.length)fail('TRADE_CLOCK');
  const last=money(tradeCandidates[0][0]),tradeAt=tradeCandidates[0][1];
  const quoteObservedAt=latestTime(bidAt,askAt,tradeAt);if(!quoteObservedAt)fail('QUOTE_CLOCK');
  return {symbol,last,tradeAt,bid,ask,bidAt,askAt,quoteObservedAt,midpoint:(bid+ask)/2};
}
export function normalizeCpiMarketCapture(raw){
  exactKeys(raw,['version','origin','startedAt','capturedAt','calls','receipts','failures','accountAccessed','executionAllowed'],'RAW_FIELDS');
  if(raw.version!==VERSION||raw.origin!=='ROBINHOOD_MARKET_TOOL_RESPONSE'||raw.calls!==1||raw.accountAccessed!==false||raw.executionAllowed!==false||!Array.isArray(raw.receipts)||raw.receipts.length!==1||!Array.isArray(raw.failures)||raw.failures.length)fail('AUTHORITY');
  if(clock(raw.startedAt)>clock(raw.capturedAt))fail('CAPTURE_CLOCK');
  const r=raw.receipts[0];exactKeys(r,['tool','request','requestedAt','receivedAt','response'],'RECEIPT_FIELDS');
  if(r.tool!=='get_equity_quotes'||JSON.stringify(r.request)!==JSON.stringify({symbols:['GLD','IBIT']}))fail('TOOL_SCOPE');
  if(clock(r.requestedAt)<clock(raw.startedAt)||clock(r.receivedAt)<clock(r.requestedAt)||clock(r.receivedAt)>clock(raw.capturedAt))fail('RECEIPT_CLOCK');
  const results=r.response?.data?.results;if(!Array.isArray(results)||results.length!==2)fail('RESULTS');
  const by=new Map(results.map(x=>[x?.quote?.symbol,x]));if(by.size!==2||!by.has('GLD')||!by.has('IBIT'))fail('RESULT_IDENTITIES');
  const quotes=['GLD','IBIT'].map(s=>validateQuote(s,by.get(s),r.receivedAt));
  return {version:VERSION,origin:raw.origin,startedAt:new Date(raw.startedAt).toISOString(),capturedAt:new Date(raw.capturedAt).toISOString(),requestedAt:new Date(r.requestedAt).toISOString(),receivedAt:new Date(r.receivedAt).toISOString(),quotes,accountAccessed:false,executionAllowed:false};
}
export function saveCpiMarketCapture(root,raw){
  const normal=normalizeCpiMarketCapture(raw),bytes=Buffer.from(JSON.stringify(raw,null,2)+'\n');
  const dir='data/runtime/options-event-intelligence/raw-cpi-market/'+normal.capturedAt.slice(0,10);io.directory(root,dir);
  const rel=dir+'/'+safeStamp(normal.capturedAt)+'-'+sha(bytes).slice(0,16)+'-'+randomUUID()+'.json';io.writeExclusive(root,rel,bytes);
  const saved=[];
  for(const q of normal.quotes){
    const evidence={
      evidenceId:'cpi-'+q.symbol.toLowerCase()+'-'+safeStamp(normal.capturedAt),
      eventId:CPI_EVENT_ID,kind:'MARKET_OBSERVATION',sourceId:CPI_MARKET_SOURCE,sourceUrl:null,occurredAt:q.quoteObservedAt,sourcePublishedAt:null,vendorReceivedAt:null,
      receivedAt:normal.receivedAt,parsedAt:normal.capturedAt,availability:'CURRENT',
      summary:q.symbol+' Robinhood read-only equity quote: last '+q.last.toFixed(2)+', bid/ask '+q.bid.toFixed(2)+'/'+q.ask.toFixed(2)+'. Source clocks retained; no account or order access.',
      supersedesEvidenceId:null,expectationSnapshot:null,
      marketObservation:{instrument:q.symbol,quoteObservedAt:q.quoteObservedAt,declaredDelayMs:null,session:'REGULAR',comparability:'COMPARABLE',comparabilityReason:'Direct same-symbol read-only Robinhood equity quote with active state and positive uncrossed bid/ask.'},
      numericObservation:{metric:q.symbol+'_MID_PRICE_USD',value:q.midpoint,observedAt:q.quoteObservedAt,sourceId:CPI_MARKET_SOURCE,session:'REGULAR'}
    };
    saved.push(saveEventObservation(root,evidence,evidence.receivedAt).path);
  }
  return {version:VERSION,rawPath:rel,capturedAt:normal.capturedAt,receivedAt:normal.receivedAt,quotes:normal.quotes,saved,executionAllowed:false};
}
export function acceptCpiMarketFile(root,file){
  const rootReal=realpathSync(root),full=realpathSync(file),rel=relative(rootReal,full);
  if(isAbsolute(rel)||rel.startsWith('..')||rel==='')fail('INPUT_PATH');
  const bytes=readFileSync(full);if(bytes.length>1024*1024)fail('INPUT_SIZE');
  let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('INPUT_JSON');}
  return saveCpiMarketCapture(rootReal,raw);
}
