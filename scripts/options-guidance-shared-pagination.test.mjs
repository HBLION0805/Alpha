import assert from 'node:assert/strict';
import {collectGuidanceMarket} from './lib/options-guidance-host.mjs';
import {normalizeGuidanceCapture} from './lib/options-guidance-io.mjs';

// Synthetic in-memory tool replies only: no source calls or runtime writes.
const at='2026-09-08T14:00:00.000Z',symbols=['GLD','IBIT'];
const uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const expiries=['2026-09-25','2026-10-02','2026-10-16'];
const token=page=>Buffer.from('p='+page).toString('base64');
const chainId=symbol=>uuid(symbol==='GLD'?1:2);
const instrumentId=(symbol,page,index)=>uuid((symbol==='GLD'?100000:200000)+page*1000+index);
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}

function market({sizes={GLD:1,IBIT:1},next,reply,tracked=false}={}) {
  const calls=[],pages={GLD:0,IBIT:0},metadata=new Map();
  const make=(symbol,page,index,expiry,type,strike)=>({id:instrumentId(symbol,page,index),chain_id:chainId(symbol),chain_symbol:symbol,expiration_date:expiry,type,strike_price:String(strike),state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}});
  const trackedContracts=tracked?symbols.flatMap(symbol=>Array.from({length:3},(_,n)=>({id:instrumentId(symbol,1,100+n),symbol,expiry:expiries[n],type:'call',strike:String(180+n),multiplier:100}))):[];
  async function call(tool,request){
    calls.push({tool,request:structuredClone(request)});
    if(tool==='get_equity_quotes')return {data:{results:symbols.map(symbol=>({quote:{symbol,last_trade_price:'105',venue_last_trade_time:at,last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null},close:{symbol,date:'2026-09-04',price:'108',interpolated:false,source:'sip-list-exchange-close'}}))}};
    if(tool==='get_option_chains')return {data:{chains:[{id:chainId(request.underlying_symbol),symbol:request.underlying_symbol,expiration_dates:expiries}]}};
    if(tool==='get_option_instruments'){
      const symbol=request.chain_id===chainId('GLD')?'GLD':'IBIT',page=++pages[symbol];
      if(page===1)assert.equal(Object.hasOwn(request,'cursor'),false);
      else assert.equal(request.cursor,token(page-1));
      assert.equal(request.expiration_dates,expiries.join(','));
      const instruments=page===1?expiries.flatMap((expiry,e)=>['call','put'].flatMap((type,t)=>[104,106,107].map((strike,s)=>make(symbol,page,e*6+t*3+s,expiry,type,strike)))):[make(symbol,page,0,expiries[0],'call',page===sizes[symbol]?105:300+page)];
      if(tracked&&page===1)for(let n=0;n<3;n++)instruments.push(make(symbol,page,100+n,expiries[n],'call',180+n));
      for(const instrument of instruments)metadata.set(instrument.id,instrument);
      const data={instruments,next:next?next({symbol,page,request}):page>=sizes[symbol]?null:token(page)};
      return reply?reply({symbol,page,request,data}):{data};
    }
    if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:'0.19',ask_price:'0.20',bid_size:20,ask_size:20,delta:metadata.get(id).type==='call'?'0.5':'-0.5',updated_at:at}}))}};
    throw Error('UNAUTHORIZED_FIXTURE_TOOL');
  }
  return {calls,pages,metadata,trackedContracts,call};
}
async function collect(m,{clock=async()=>at,collector=collectGuidanceMarket}={}) {
  const capture=await collector({call:m.call,clock,trackedContracts:m.trackedContracts});
  assert.equal(capture.calls,m.calls.length);
  assert(capture.calls<=24);assert(capture.selectedIds.length<=36);
  assert.equal(capture.accountAccessed,false);assert.equal(capture.executionAllowed,false);
  assert.deepEqual(m.calls.slice(0,3).map(c=>[c.tool,c.request.underlying_symbol??c.request.symbols]),[['get_equity_quotes',symbols],['get_option_chains','GLD'],['get_option_chains','IBIT']]);
  assert(m.calls.every(c=>['get_equity_quotes','get_option_chains','get_option_instruments','get_option_quotes'].includes(c.tool)));
  for(const symbol of symbols)assert(capture.selectedIds.filter(id=>m.metadata.get(id)?.chain_symbol===symbol).length<=18);
  return capture;
}
const traversal=m=>m.calls.filter(c=>c.tool==='get_option_instruments').map(c=>c.request.chain_id===chainId('GLD')?'GLD':'IBIT');
const quotes=m=>m.calls.filter(c=>c.tool==='get_option_quotes');
const partial=capture=>capture.failures.filter(f=>f.code==='INSTRUMENT_LIST_PARTIAL').map(f=>f.symbol).sort();

await test('GLD exceeds eight pages and both terminal lists fit within the shared nineteen calls',async()=>{
  const m=market({sizes:{GLD:16,IBIT:3}}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:16,IBIT:3});assert.equal(capture.calls,24);
  assert.deepEqual(traversal(m).slice(0,6),['GLD','IBIT','GLD','IBIT','GLD','IBIT']);
  assert(capture.selectedIds.includes(instrumentId('GLD',16,0)));
  assert(capture.selectedIds.includes(instrumentId('IBIT',3,0)));
  assert.equal(capture.failures.length,0);assert.equal(normalizeGuidanceCapture(capture).complete,true);
  assert.equal(quotes(m).length,2);assert.deepEqual(quotes(m).map(c=>c.request.instrument_ids.length),[20,16]);
});
await test('two large lists alternate fairly, remain partial and reserve both final quote batches',async()=>{
  const m=market({sizes:{GLD:30,IBIT:30}}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:10,IBIT:9});assert.equal(capture.calls,24);
  assert.deepEqual(traversal(m),Array.from({length:19},(_,n)=>symbols[n%2]));
  assert.deepEqual(partial(capture),symbols);assert.equal(normalizeGuidanceCapture(capture).complete,false);
  assert.equal(capture.selectedIds.length,36);assert.equal(quotes(m).length,2);
  assert(m.calls.slice(-2).every(c=>c.tool==='get_option_quotes'));
});
for(const sizes of [{GLD:2,IBIT:2},{GLD:1,IBIT:1}])await test('small terminal lists leave unused shared capacity '+JSON.stringify(sizes),async()=>{
  const m=market({sizes}),capture=await collect(m);
  assert.deepEqual(m.pages,sizes);assert.equal(capture.calls,3+sizes.GLD+sizes.IBIT+2);
  assert.equal(capture.failures.length,0);assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
await test('swapped page sizes allow IBIT to consume capacity released by terminal GLD',async()=>{
  const m=market({sizes:{GLD:3,IBIT:16}}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:3,IBIT:16});assert.equal(capture.calls,24);
  assert.deepEqual(traversal(m).slice(0,6),['GLD','IBIT','GLD','IBIT','GLD','IBIT']);
  assert(traversal(m).slice(6).every(symbol=>symbol==='IBIT'));
  assert(capture.selectedIds.includes(instrumentId('IBIT',16,0)));assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
for(const terminal of [null,undefined])await test('null or absent cursor terminates without consuming remaining budget '+String(terminal),async()=>{
  const m=market({next:()=>terminal}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:1,IBIT:1});assert.equal(capture.calls,7);
  assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
for(const malformed of ['', 'not-a-base64-cursor', {cursor:'cD0x'}])await test('malformed cursor stops only its list with no retry '+JSON.stringify(malformed),async()=>{
  const m=market({sizes:{GLD:4,IBIT:3},next:({symbol,page})=>symbol==='GLD'?malformed:page===3?null:token(page)}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:1,IBIT:3});assert.deepEqual(partial(capture),['GLD']);
  assert(capture.failures.some(f=>f.symbol==='GLD'&&f.code==='CURSOR_INVALID'));
  assert.equal(quotes(m).length,2);assert.equal(normalizeGuidanceCapture(capture).complete,false);
});
await test('duplicate cursor stops its list without repeating a request or starving the other ETF',async()=>{
  const m=market({sizes:{GLD:4,IBIT:3},next:({symbol,page})=>symbol==='GLD'?token(1):page===3?null:token(page)}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:2,IBIT:3});assert.deepEqual(partial(capture),['GLD']);
  assert(capture.failures.some(f=>f.symbol==='GLD'&&f.code==='CURSOR_INVALID'));
  assert.equal(normalizeGuidanceCapture(capture).complete,false);
});
for(const mode of ['missing-data','source-failure'])await test(mode+' stops its list and preserves other collection without retry',async()=>{
  const m=market({sizes:{GLD:4,IBIT:3},reply:({symbol,page,data})=>{
    if(symbol==='GLD'&&page===2){if(mode==='source-failure')throw Error('PRIVATE_SOURCE_DETAIL');return {};}
    return {data};
  }}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:2,IBIT:3});assert.deepEqual(partial(capture),['GLD']);
  assert.equal(capture.failures.filter(f=>f.code==='MARKET_SOURCE_FAILED').length,1);
  assert.equal(quotes(m).length,2);assert.equal(normalizeGuidanceCapture(capture).complete,false);
  assert.equal(JSON.stringify(capture).includes('PRIVATE_SOURCE_DETAIL'),false);
});
await test('missing instrument array preserves the malformed receipt and cannot normalize complete',async()=>{
  const m=market({reply:({symbol,data})=>({data:symbol==='GLD'?{next:null}:data})}),capture=await collect(m);
  assert.deepEqual(m.pages,{GLD:1,IBIT:1});assert.deepEqual(partial(capture),['GLD']);
  assert(capture.failures.some(f=>f.symbol==='GLD'&&f.code==='INSTRUMENT_SHAPE'));
  assert.throws(()=>normalizeGuidanceCapture(capture),/GUIDANCE_ARRAY/);
});
await test('three-minute time bound prevents later source calls even when page capacity remains',async()=>{
  const m=market({sizes:{GLD:30,IBIT:30}}),capture=await collect(m,{clock:async()=>m.calls.length>=8?'2026-09-08T14:03:00.001Z':at});
  assert.equal(m.calls.length,8);assert.equal(quotes(m).length,0);
  assert.deepEqual(partial(capture),symbols);
  assert(capture.failures.some(f=>f.code==='COLLECTION_BOUND_REACHED'));
  assert.equal(normalizeGuidanceCapture(capture).complete,false);
});
await test('exact three-minute request-start boundary remains eligible',async()=>{
  const m=market();let clocks=0;
  const capture=await collect(m,{clock:async()=>clocks++?'2026-09-08T14:03:00.000Z':at});
  assert.equal(capture.calls,7);assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
await test('all six verified tracked identities remain first within the unchanged eighteen-per-ETF selection cap',async()=>{
  const m=market({sizes:{GLD:16,IBIT:3},tracked:true}),capture=await collect(m);
  assert.equal(capture.calls,24);assert.equal(capture.selectedIds.length,36);
  for(const symbol of symbols){
    const selected=capture.selectedIds.filter(id=>m.metadata.get(id).chain_symbol===symbol);
    assert.deepEqual(selected.slice(0,3),m.trackedContracts.filter(c=>c.symbol===symbol).map(c=>c.id));
  }
  assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
await test('serialized standalone collector retains shared traversal and normalized completeness',async()=>{
  const collector=(0,eval)('('+collectGuidanceMarket.toString()+')');
  const m=market({sizes:{GLD:16,IBIT:3}}),capture=await collect(m,{collector});
  assert.deepEqual(m.pages,{GLD:16,IBIT:3});assert.equal(capture.calls,24);
  assert.equal(normalizeGuidanceCapture(capture).complete,true);
});
console.log(`${passed} shared pagination tests passed; zero real source calls or runtime writes.`);
