import {createHash} from 'node:crypto';
import {collectTechOptionQuotes,techQuoteCollectorSource} from './options-tech-quote-adapter.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export const mockBatchStamp=s=>'2026-10-09T15:30:'+s+'.000Z';
/** Fictional transport only. No provider, credentials or account access. */
export function mockTechSpreadQuoteFixture(structure='BULL_CALL_DEBIT'){
 const type=structure==='BULL_CALL_DEBIT'?'call':'put';
 const selection={version:'TECH_DEBIT_SPREAD_SELECTION_V1',batchId:'mock-tech-spread-batch',symbol:'AAPL',expiry:'2026-10-16',type,structure,maxSourceSkewMs:1000,
  legs:[{direction:'LONG',id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',strike:type==='call'?'335.00':'340.00'},
   {direction:'SHORT',id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',strike:type==='call'?'340.00':'335.00'}]};
 const chain='11111111-1111-4111-8111-111111111111';
 const data=[{data:{chains:[{id:chain,symbol:selection.symbol,expiration_dates:[selection.expiry],trade_value_multiplier:'100.0000',late_close_state:'disabled'}]}},
  ...selection.legs.map(l=>({data:{instruments:[{id:l.id,chain_id:chain,chain_symbol:selection.symbol,expiration_date:selection.expiry,strike_price:l.strike,type,state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100.0000',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}]}})),
  {data:{results:[{quote:{symbol:selection.symbol,last_trade_price:'337.123456',venue_last_trade_time:mockBatchStamp('07'),state:'active',has_traded:true}}]}},
  {data:{results:selection.legs.map((l,n)=>({quote:{instrument_id:l.id,bid_price:n?'1.00':'2.00',ask_price:n?'1.02':'2.02',bid_size:4,ask_size:4,updated_at:'2026-10-09T15:30:09.'+(n?'600000001':'500000001')+'Z'}}))}}];
 return {selection,data};
}
export async function collectMockTechSpreadFixture(f=mockTechSpreadQuoteFixture(),{collector=collectTechOptionQuotes,failAt=-1,clock}={}){
 const calls=[];let t=0;
 const capture=await collector({selection:f.selection,origin:'SYNTHETIC_FIXTURE',clock:clock??(async()=>mockBatchStamp(String(t++).padStart(2,'0'))),call:async(tool,args)=>{const n=calls.length;calls.push({tool,args});if(n===failAt)throw Error('MOCK_TRANSPORT_FAILURE');return {structuredContent:f.data[n]};}});
 const intent={version:'TECH_QUOTES_REQUEST_V2',origin:'SYNTHETIC_FIXTURE',requestedAt:mockBatchStamp('00'),selection:f.selection,collectorSha256:sha(techQuoteCollectorSource(f.selection)),maximumMarketCalls:5,maximumContracts:2,accountAccessed:false,executionAllowed:false};
 const record={version:'TECH_QUOTES_RECEIPT_V2',recordedAt:mockBatchStamp('12'),intent,capture,captureSha256:sha(JSON.stringify(capture)),executionAllowed:false};
 const rawJson=JSON.stringify(record),original={id:'mock-batch-original',rawJson,sha256:sha(rawJson)};
 const preflight={version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:'MOCK_CONTROL',at:mockBatchStamp('12'),decisionAt:'2026-10-09T15:29:59.000Z',originals:[original],legs:f.selection.legs.map(l=>({originalId:original.id,direction:l.direction,quantity:1,contract:{id:l.id,symbol:f.selection.symbol,expiry:f.selection.expiry,type:f.selection.type,strike:l.strike,multiplier:100}}))};
 return {calls,capture,intent,record,original,preflight};
}
