/** Serializable Host collector. Existing snapshot V3 remains the only paper authority. */
export async function collectSnapshotPaperMarket({contract,call,clock}) {
  const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
  const strike=v=>typeof v==='string'&&/^\d+(?:\.\d{1,6})?$/.test(v)&&Number(v)>0?Number(v):null;
  if(!contract||Object.keys(contract).sort().join()!=='chainId,expiry,id,multiplier,strike,symbol,type'||!uuid(contract.id)||!uuid(contract.chainId)||!['GLD','IBIT'].includes(contract.symbol)||!['call','put'].includes(contract.type)||contract.multiplier!==100||strike(contract.strike)===null||!/^\d{4}-\d\d-\d\d$/.test(contract.expiry)||new Date(contract.expiry+'T00:00:00Z').toISOString().slice(0,10)!==contract.expiry)throw Error('PAPER_CAPTURE_SCOPE');
  const stamp=async()=>{const v=await clock();if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||new Date(v).toISOString()!==v)throw Error('PAPER_CAPTURE_CLOCK');return v;};
  const startedAt=await stamp(),receipts=[],failures=[];let lastClock=startedAt,calls=0;
  const now=async()=>{const v=await stamp();if(v<lastClock)throw Error('PAPER_CAPTURE_CLOCK_REGRESSION');lastClock=v;return v;};
  const stop=code=>{throw Error(code);};
  async function read(tool,request){
    const requestedAt=await now();if(calls>=6||Date.parse(requestedAt)-Date.parse(startedAt)>=180000)stop('COLLECTION_BOUND_REACHED');calls++;
    let response;try{response=await call(tool,request);}catch{failures.push({tool,request,requestedAt,code:'MARKET_SOURCE_FAILED'});stop('MARKET_SOURCE_FAILED');}
    const receivedAt=await now();receipts.push({tool,request,requestedAt,receivedAt,response});
    if(Date.parse(receivedAt)-Date.parse(startedAt)>=180000)stop('COLLECTION_BOUND_REACHED');
    if(!response?.data||response.isError===true)stop('SOURCE_SHAPE');return response.data;
  }
  function cursorValue(next,request){
    if(typeof next!=='string'||!next||next.length>2048)stop('CURSOR_INVALID');let value=next;
    if(next.includes('://')){
      const prefix='http://edge-internal.brokeback-shard-router.region.rh/options/instruments/?';
      if(!next.startsWith(prefix)||next.includes('#'))stop('CURSOR_INVALID');const fields=new Map();
      for(const part of next.slice(prefix.length).split('&')){const n=part.indexOf('='),key=part.slice(0,n);if(n<=0||!['chain_id','cursor','expiration_dates','state'].includes(key)||fields.has(key))stop('CURSOR_INVALID');fields.set(key,decodeURIComponent(part.slice(n+1).replace(/\+/g,' ')));}
      if(fields.size!==4||fields.get('chain_id')!==request.chain_id||fields.get('expiration_dates')!==request.expiration_dates||fields.get('state')!==request.state)stop('CURSOR_INVALID');value=fields.get('cursor');
    }
    if(typeof value!=='string'||value.length<4||value.length>512||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))stop('CURSOR_INVALID');return value;
  }
  let status='NO_CAPTURE';
  try{
    const chains=await read('get_option_chains',{underlying_symbol:contract.symbol});
    if(!Array.isArray(chains.chains)||chains.chains.length!==1)stop('CHAIN_IDENTITY');
    const chain=chains.chains[0];if(chain.id!==contract.chainId||chain.symbol!==contract.symbol||!Array.isArray(chain.expiration_dates)||!chain.expiration_dates.includes(contract.expiry))stop('CHAIN_IDENTITY');
    let cursor=null,found=false;const seen=new Set(),ids=new Set();
    for(let page=0;page<3&&!found;page++){
      const request={chain_id:contract.chainId,expiration_dates:contract.expiry,state:'active',...(cursor?{cursor}:{})};
      const data=await read('get_option_instruments',request);
      if(!Array.isArray(data.instruments)||data.instruments.length>100)stop('INSTRUMENT_SHAPE');
      for(const i of data.instruments){
        if(!i||!uuid(i.id)||ids.has(i.id)||i.chain_id!==contract.chainId||i.chain_symbol!==contract.symbol||i.expiration_date!==contract.expiry)stop('INSTRUMENT_IDENTITY');ids.add(i.id);
        if(i.id===contract.id){if(i.type!==contract.type||strike(i.strike_price)!==strike(contract.strike)||i.state!=='active'||i.tradability!=='tradable'||i.underlying_type!=='equity'||Number(i.trade_value_multiplier)!==100)stop('CONTRACT_IDENTITY');found=true;}
      }
      if(found)break;if(data.next===null||data.next===undefined)break;
      cursor=cursorValue(data.next,request);if(seen.has(cursor))stop('CURSOR_REPEATED');seen.add(cursor);
    }
    if(!found)stop('EXACT_CONTRACT_NOT_FOUND');
    const equity=await read('get_equity_quotes',{symbols:['GLD','IBIT']});
    if(!Array.isArray(equity.results)||equity.results.length!==2||new Set(equity.results.map(r=>r?.quote?.symbol)).size!==2||equity.results.some(r=>!['GLD','IBIT'].includes(r?.quote?.symbol)))stop('EQUITY_SHAPE');
    const quotes=await read('get_option_quotes',{instrument_ids:[contract.id]});
    if(!Array.isArray(quotes.results)||quotes.results.length!==1||quotes.results[0]?.quote?.instrument_id!==contract.id)stop('EXACT_QUOTE_MISSING');
    status='CAPTURED';
  }catch(error){const code=/^[A-Z_]+$/.test(error?.message)?error.message:'SOURCE_SHAPE';if(!failures.some(f=>f.code===code))failures.push({tool:'PAPER_CAPTURE',code});}
  const capturedAt=await now();
  if(Date.parse(capturedAt)-Date.parse(startedAt)>=180000){status='NO_CAPTURE';if(!failures.some(f=>f.code==='COLLECTION_BOUND_REACHED'))failures.push({tool:'PAPER_CAPTURE',code:'COLLECTION_BOUND_REACHED'});}
  const attempt={version:'OPTIONS_PAPER_CAPTURE_ATTEMPT_V1',contract,startedAt,capturedAt,calls,receipts,failures,accountAccessed:false,executionAllowed:false};
  const capture=status==='CAPTURED'?{version:'OPTIONS_GUIDANCE_MARKET_CAPTURE_V1',origin:'HOST_MARKET_TOOL_RESPONSES',startedAt,capturedAt,calls,receipts,failures,selectedIds:[contract.id],selection:'One exact frozen engineering paper contract; partial guidance coverage, not a full chain survey.',accountAccessed:false,executionAllowed:false}:null;
  return {status,capture,attempt};
}
