const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export const line=v=>Buffer.from(JSON.stringify(v)+'\n');
export const now=()=>new Date().toISOString();
export function capture(){
  const capturedAt=now(),startedAt=new Date(Date.parse(capturedAt)-3000).toISOString();
  const expiry=new Date(Date.parse(capturedAt)+30*86400000).toISOString().slice(0,10);
  const instruments=['GLD','IBIT'].flatMap((symbol,n)=>Array.from({length:18},(_,i)=>({id:id(100+n*18+i),chain_id:id(n+1),chain_symbol:symbol,expiration_date:expiry,type:i%2?'put':'call',strike_price:String(100+i),state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}})));
  const receipts=[];
  const add=(tool,request,data)=>receipts.push({tool,request,requestedAt:capturedAt,receivedAt:capturedAt,response:{data}});
  add('get_equity_quotes',{symbols:['GLD','IBIT']},{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'105.1234',venue_last_trade_time:capturedAt,last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null},close:{symbol,date:new Date(Date.parse(capturedAt)-86400000).toISOString().slice(0,10),price:'104',interpolated:false,source:'sip-list-exchange-close'}}))});
  for(const [n,symbol] of ['GLD','IBIT'].entries())add('get_option_chains',{underlying_symbol:symbol},{chains:[{id:id(n+1),symbol,expiration_dates:[expiry]}]});
  for(const n of [0,1])add('get_option_instruments',{chain_id:id(n+1),expiration_dates:expiry,state:'active'},{instruments:instruments.slice(n*18,n*18+18),next:null});
  for(const n of [0,1])add('get_option_quotes',{instrument_ids:instruments.slice(n*18,n*18+18).map(i=>i.id)},{results:instruments.slice(n*18,n*18+18).map(i=>({quote:{instrument_id:i.id,bid_price:'0.19',ask_price:'0.20',bid_size:20,ask_size:20,delta:i.type==='call'?'0.5':'-0.5',updated_at:capturedAt}}))});
  return {version:'OPTIONS_GUIDANCE_MARKET_CAPTURE_V1',origin:'HOST_MARKET_TOOL_RESPONSES',startedAt,capturedAt,calls:receipts.length,receipts,failures:[],selectedIds:instruments.map(i=>i.id),selection:'Synthetic isolated local fixture',accountAccessed:false,executionAllowed:false};
}
export const note=(biases=['INSUFFICIENT_EVIDENCE','INSUFFICIENT_EVIDENCE'])=>({assessedAt:now(),assets:['GLD','IBIT'].map((symbol,i)=>({symbol,bias:biases[i],summary:'Isolated test assessment',supporting:[],opposing:[],invalidation:'Reassess with cited evidence',eventPlan:'No trade',sources:[]}))});
