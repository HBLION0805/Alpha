import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal,throws,deepStrictEqual} from 'node:assert/strict';
import {normalizeCpiMarketCapture,acceptCpiMarketFile,CPI_EVENT_ID} from './lib/options-cpi-market-evidence.mjs';
import {collectCpiMarketEvidence} from './options-cpi-market-host-source.mjs';
import {listEventObservations} from './lib/options-event-intelligence-observation.mjs';

const quote=(symbol,last,bid,ask,tradeAt,bboAt)=>({quote:{symbol,last_trade_price:last,venue_last_trade_time:tradeAt,last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null,bid_price:bid,venue_bid_time:bboAt,ask_price:ask,venue_ask_time:bboAt,has_traded:true,state:'active'}});
const response={data:{results:[
 quote('GLD','400.100000','400.090000','400.110000','2026-10-14T12:29:59.700000000Z','2026-10-14T12:29:59.900000000Z'),
 quote('IBIT','50.200000','50.190000','50.210000','2026-10-14T12:29:59.710000000Z','2026-10-14T12:29:59.910000000Z')
]}};
const raw={version:'CPI_MARKET_CAPTURE_V1',origin:'ROBINHOOD_MARKET_TOOL_RESPONSE',startedAt:'2026-10-14T12:29:59.000Z',capturedAt:'2026-10-14T12:30:00.100Z',calls:1,receipts:[{tool:'get_equity_quotes',request:{symbols:['GLD','IBIT']},requestedAt:'2026-10-14T12:29:59.100Z',receivedAt:'2026-10-14T12:30:00.000Z',response}],failures:[],accountAccessed:false,executionAllowed:false};

const normal=normalizeCpiMarketCapture(raw);
equal(normal.quotes.length,2);equal(normal.quotes[0].midpoint,400.1);equal(normal.quotes[1].midpoint,50.2);
throws(()=>normalizeCpiMarketCapture({...raw,accountAccessed:true}),/AUTHORITY/);
throws(()=>normalizeCpiMarketCapture({...raw,receipts:[{...raw.receipts[0],request:{symbols:['GLD','IBIT','SPY']}}]}),/TOOL_SCOPE/);
const crossed=structuredClone(raw);crossed.receipts[0].response.data.results[0].quote.bid_price='401.000000';throws(()=>normalizeCpiMarketCapture(crossed),/CROSSED/);
const future=structuredClone(raw);future.receipts[0].response.data.results[0].quote.venue_bid_time='2026-10-14T12:30:01.000Z';throws(()=>normalizeCpiMarketCapture(future),/BBO_CLOCK/);

const hostCalls=[],times=['2026-10-14T12:29:59.000Z','2026-10-14T12:29:59.100Z','2026-10-14T12:30:00.000Z','2026-10-14T12:30:00.100Z'];let ti=0;
const host=await collectCpiMarketEvidence({clock:async()=>times[ti++],call:async(tool,args)=>{hostCalls.push({tool,args});return response;}});
equal(hostCalls.length,1);deepStrictEqual(hostCalls[0],{tool:'get_equity_quotes',args:{symbols:['GLD','IBIT']}});equal(host.accountAccessed,false);equal(host.executionAllowed,false);

const root=mkdtempSync(join(tmpdir(),'alpha-cpi-market-'));
try{
 const file=join(root,'input.json');writeFileSync(file,JSON.stringify(raw));
 const saved=acceptCpiMarketFile(root,file);equal(saved.quotes.length,2);equal(saved.executionAllowed,false);
 const evidence=listEventObservations(root,CPI_EVENT_ID,'2026-10-14T12:31:00.000Z').map(x=>x.evidence);
 equal(evidence.length,2);equal(evidence.find(x=>x.marketObservation.instrument==='GLD').numericObservation.metric,'GLD_MID_PRICE_USD');equal(evidence.find(x=>x.marketObservation.instrument==='IBIT').sourceId,'robinhood-equity-quote');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('CPI market evidence adapter tests passed');
