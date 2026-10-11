import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';import {tmpdir} from 'node:os';
import {collectTechOptionQuotes,normalizeTechOptionCapture as normalize,validateTechQuoteSelection} from './lib/options-tech-quote-adapter.mjs';
import {saveTechQuoteCapture,buildTechQuoteHostPrompt,techQuotesCli} from './options-tech-quotes.mjs';
import {resolveTechQuoteHost,summarizeTechHostStatus,TECH_QUOTE_MARKET_TOOLS} from './lib/options-tech-quote-host.mjs';
let total=0,passed=0;const test=(n,fn)=>{total++;nodeTest(n,async()=>{await fn();passed++;});};after(()=>console.log('Tech quote adapter: '+passed+'/'+total+' tests passed.'));
const stamp=s=>'2026-10-09T15:30:'+s+'.000Z',chainId='11111111-1111-4111-8111-111111111111',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const selection={symbol:'AAPL',expiry:'2026-10-16',strike:'335.0000'};
function sources(){
 const chain={id:chainId,symbol:'AAPL',expiration_dates:['2026-10-16'],trade_value_multiplier:'100.0000',late_close_state:'disabled',can_open_position:true};
 const i={id,chain_id:chainId,chain_symbol:'AAPL',expiration_date:'2026-10-16',strike_price:'335.0000',type:'put',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100.0000',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}};
 const e={symbol:'AAPL',last_trade_price:'334.123456',venue_last_trade_time:stamp('05'),bid_price:'334.12',ask_price:'334.15',venue_bid_time:'2026-10-09T15:30:05.123456789Z',venue_ask_time:'2026-10-09T15:30:05.223456789Z',state:'active',has_traded:true};
 const q={instrument_id:id,bid_price:'4.20',ask_price:'4.30',bid_size:3,ask_size:8,updated_at:'2026-10-09T15:30:07.123456789Z',mark_price:'4.255',delta:'-0.5'};
 return {get_option_chains:{data:{chains:[chain]}},get_option_instruments:{data:{instruments:[i]}},get_equity_quotes:{data:{results:[{quote:e}]}},get_option_quotes:{data:{results:[{quote:q}]}}};
}
async function capture(change=()=>{}){
 const data=sources();change(data);let n=0;const calls=[];
 const result=await collectTechOptionQuotes({selection,origin:'SYNTHETIC_FIXTURE',clock:async()=>stamp(String(n++).padStart(2,'0')),call:async(tool,args)=>{calls.push({tool,args});return {structuredContent:data[tool]};}});
 return {result,data,calls};
}
test('four bounded calls preserve exact data and normalize source clocks separately',async()=>{
 const {result,data,calls}=await capture(),a=normalize(result,stamp('10'));
 assert.equal(calls.length,4);assert.deepEqual(result.receipts[3].response.structuredContent,data.get_option_quotes);
 assert.equal(a.quotes[0].snapshot.updatedAt,'2026-10-09T15:30:07.123456789Z');assert.equal(a.underlying.regularTradeAt,stamp('05'));
 assert.notEqual(a.underlying.bidAt,a.underlying.regularTradeAt);assert.equal(a.quotes[0].snapshot.underlyingPriceUsd,'334.123456');
 assert.equal(a.quotes[0].snapshot.bidCents,420);assert.equal(a.quotes[0].snapshot.askCents,430);
 assert.equal(a.quotes[0].status,'QUALIFIED_SNAPSHOT_ONLY');assert.equal(a.accountPermission,null);assert.equal(a.quotes[0].contractEvidence.deliverable,null);assert.equal(a.executionAllowed,false);assert.equal(a.synthetic,true);
});
test('tool throws once without retries and blocked capture is retained',async()=>{
 let calls=0,n=0;const r=await collectTechOptionQuotes({selection,clock:async()=>stamp(String(n++).padStart(2,'0')),call:async()=>{calls++;throw Error('Auth');}});
 assert.equal(calls,1);assert.equal(r.status,'BLOCKED');assert.equal(r.failures[0].code,'SOURCE_CALL_FAILED');
});
for(const [name,change] of [
 ['multiple chains',s=>s.get_option_chains.data.chains.push(structuredClone(s.get_option_chains.data.chains[0]))],
 ['wrong multiplier',s=>s.get_option_instruments.data.instruments[0].trade_value_multiplier='10'],
 ['wrong strike',s=>s.get_option_instruments.data.instruments[0].strike_price='330'],
 ['wrong expiry',s=>s.get_option_instruments.data.instruments[0].expiration_date='2026-10-23'],
 ['pagination',s=>s.get_option_instruments.data.next='opaque'],
 ['untradable',s=>s.get_option_instruments.data.instruments[0].tradability='untradable'],
 ['duplicated type',s=>s.get_option_instruments.data.instruments.push({...s.get_option_instruments.data.instruments[0],id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})],
])test(name+' stops before quote requests',async()=>{const {result,calls}=await capture(change);assert.equal(result.status,'BLOCKED');assert.ok(calls.length<=2);});
for(const [name,change,block] of [
 ['no option source clock',s=>delete s.get_option_quotes.data.results[0].quote.updated_at,'SOURCE_CLOCK_MISSING'],
 ['stale regular trade despite fresh bidask',s=>s.get_equity_quotes.data.results[0].quote.venue_last_trade_time='2026-10-09T15:20:00.000Z','UNDERLYING_STALE_AT_RECEIPT'],
 ['unknown sizes',s=>s.get_option_quotes.data.results[0].quote.ask_size=null,'SIZE_UNKNOWN'],
 ['zero price',s=>s.get_option_quotes.data.results[0].quote.bid_price='0','PRICE_OR_TICK_INVALID'],
 ['off tick',s=>s.get_option_quotes.data.results[0].quote.ask_price='4.31','PRICE_OR_TICK_INVALID'],
 ['wide spread',s=>s.get_option_quotes.data.results[0].quote.ask_price='4.35','EXISTING_MECHANICAL_SPREAD_LIMIT'],
 ['future option clock',s=>s.get_option_quotes.data.results[0].quote.updated_at=stamp('59'),'SOURCE_AFTER_RECEIPT'],
 ['halted equity',s=>s.get_equity_quotes.data.results[0].quote.state='inactive','UNDERLYING_ACTIVITY_UNKNOWN'],
])test(name+' cannot qualify',async()=>{const {result}=await capture(change),a=normalize(result,stamp('10'));assert.equal(a.quotes[0].status,'BLOCKED_QUOTE');assert.ok(a.quotes[0].blockers.includes(block));});
test('missing result stays missing and never takes mid or mark',async()=>{const {result}=await capture(s=>s.get_option_quotes.data.results=[]);assert.equal(normalize(result,stamp('10')).quotes[0].snapshot,null);});
test('foreign identity rejects the envelope',async()=>{const {result}=await capture(s=>s.get_option_quotes.data.results[0].quote.instrument_id='foreign');assert.throws(()=>normalize(result,stamp('10')),/QUOTE_IDENTITY/);});
test('reordered requests, future capture and altered selection reject',async()=>{
 for(const mutate of [r=>r.receipts[2].request.symbols=['QQQ'],r=>r.capturedAt=stamp('59'),r=>r.selectedIds=['foreign']]){
 const {result}=await capture();mutate(result);assert.throws(()=>normalize(result,stamp('10')));}
});
test('source remains stale at later assessment',async()=>{const {result}=await capture();assert.ok(normalize(result,'2026-10-09T15:32:00.000Z').quotes[0].blockers.includes('QUOTE_STALE_NOW'));});
test('collector source is self-contained for an equipped host',async()=>{
 const fn=(0,eval)('('+collectTechOptionQuotes.toString()+')');let n=0;const data=sources();
 const r=await fn({selection,origin:'SYNTHETIC_FIXTURE',clock:async()=>stamp(String(n++).padStart(2,'0')),call:async t=>data[t]});assert.equal(r.status,'CAPTURED');
});
test('invalid CLI and unsupported symbol cannot start a host',async()=>{
 assert.throws(()=>validateTechQuoteSelection({...selection,symbol:'GLD'}));
 await assert.rejects(techQuotesCli(['--arm']));await assert.rejects(techQuotesCli(['--capture','--symbol','AAPL']));
 assert.ok(buildTechQuoteHostPrompt().includes('No retry'));
});
test('isolated sink preserves original and refuses overwrite and out-of-scope paths',async()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-tech-quote-test-'));try{
 const run=join(root,'data/runtime/options-workbench-development/test');mkdirSync(run,{recursive:true});
 writeFileSync(join(run,'request.json'),JSON.stringify({selection,requestedAt:stamp('00')}));
 const {result}=await capture();result.origin='HOST_MARKET_TOOL_RESPONSES';
 const saved=saveTechQuoteCapture(root,run,result,()=>stamp('10'));assert.equal(saved.quoteCount,1);
 assert.deepEqual(JSON.parse(readFileSync(join(run,'capture.json'),'utf8')).capture,result);
 assert.throws(()=>saveTechQuoteCapture(root,run,result,()=>stamp('10')));
 assert.throws(()=>saveTechQuoteCapture(root,root,result,()=>stamp('10')),/OUTPUT_SCOPE/);
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Cleanup scope');rmSync(root,{recursive:true});}
});

test('read-only Host review validates without creating a capture file',async()=>{
 const {reviewTechQuoteCapture}=await import('./options-tech-quotes.mjs');
 const {existsSync}=await import('node:fs');
 const root=mkdtempSync(join(tmpdir(),'alpha-tech-quote-readonly-'));try{
 const run=join(root,'data/runtime/options-workbench-development/test');mkdirSync(run,{recursive:true});
 writeFileSync(join(run,'request.json'),JSON.stringify({selection,requestedAt:stamp('00')}));
 const {result}=await capture();result.origin='HOST_MARKET_TOOL_RESPONSES';
 const r=reviewTechQuoteCapture(root,run,result,()=>stamp('10'));
 assert.equal(r.normalized.quotes.length,1);assert.equal(existsSync(join(run,'capture.json')),false);
 assert.ok(buildTechQuoteHostPrompt().includes('review_capture'));
 assert.equal(buildTechQuoteHostPrompt().includes('record_capture'),false);
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Cleanup scope');rmSync(root,{recursive:true});}
});
test('V1 normalized output matches the complete pre-batch-extension golden result',async()=>{const {result}=await capture(),n=normalize(result,stamp('10'));assert.equal(createHash('sha256').update(JSON.stringify(n)).digest('hex'),'5f844c18732a68cbdd5bff3f2abadbdd6130010ea0d8e55c742f9b8f6dbc52d6');assert.equal(Object.hasOwn(n.quotes[0],'batchId'),false);assert.equal(Object.hasOwn(n.quotes[0],'acquisition'),false);});
test('V1 zero spread also retains its original schema',async()=>{const {result}=await capture(s=>s.get_option_quotes.data.results[0].quote.ask_price='4.20'),n=normalize(result,stamp('10'));assert.equal(n.quotes[0].spreadCents,0);assert.equal(Object.hasOwn(n.quotes[0],'batchId'),false);assert.equal(Object.hasOwn(n.quotes[0],'acquisition'),false);assert.equal(Object.hasOwn(n,'pair'),false);});

test('explicit reviewed Host pin survives redirected LOCALAPPDATA without executing test bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-tech-host-pin-')),exe=join(root,'codex.exe'),config=join(root,'host.json');
 const old=process.env.LOCALAPPDATA;
 try{process.env.LOCALAPPDATA=join(root,'sandbox-missing');writeFileSync(exe,'TEST_BYTES_NEVER_EXECUTED');
 const pin={version:'TECH_QUOTE_HOST_CONFIG_V1',executable:exe,sha256:createHash('sha256').update(readFileSync(exe)).digest('hex')};
 writeFileSync(config,JSON.stringify(pin));assert.equal(resolveTechQuoteHost(config).executable,exe);
 writeFileSync(exe,'CHANGED');assert.throws(()=>resolveTechQuoteHost(config),/HASH_MISMATCH/);
 for(const value of [{...pin,executable:'codex.exe'},{...pin,sha256:null},{...pin,version:'UNKNOWN'}]){writeFileSync(config,JSON.stringify(value));assert.throws(()=>resolveTechQuoteHost(config),/CONFIG_INVALID/);}
 writeFileSync(config,JSON.stringify({...pin,executable:join(root,'missing','codex.exe')}));assert.throws(()=>resolveTechQuoteHost(config),/NOT_ACCESSIBLE/);
 assert.throws(()=>resolveTechQuoteHost(''),/CONFIG_REQUIRED/);
 }finally{if(old===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=old;if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Cleanup scope');rmSync(root,{recursive:true});}
});
test('Host readiness requires actual exact scoped catalog, correct origin and no auth denial',()=>{
 const source={data:[{name:'robinhood_alpha_market_data',httpOrigin:'https://agent.robinhood.com',authStatus:'oAuth',toolsError:null,tools:Object.fromEntries(TECH_QUOTE_MARKET_TOOLS.map(n=>[n,{}]))}],nextCursor:null};
 assert.equal(summarizeTechHostStatus(source).status,'HOST_STARTED_MARKET_CATALOG_READY');
 assert.equal(summarizeTechHostStatus(source).connectionEstablished,'UNKNOWN_CATALOG_MAY_BE_CACHED');
 for(const mutate of [r=>r.data=[],r=>r.nextCursor='more',r=>r.data[0].toolsError='failed',r=>r.data[0].authStatus='notLoggedIn',r=>r.data[0].authStatus='unknown',r=>r.data[0].runtimeStatus='failed',r=>r.data[0].httpOrigin='https://example.com',r=>delete r.data[0].tools.get_option_quotes,r=>r.data[0].tools.get_accounts={}]){const r=structuredClone(source);mutate(r);assert.equal(summarizeTechHostStatus(r).status,'BLOCKED_HOST_CONNECTION');}
});
test('actual CLI capture rejects missing explicit config before writing a run',async()=>{
 const {captureTechQuotes}=await import('./options-tech-quotes.mjs');
 await assert.rejects(captureTechQuotes({root:process.cwd(),selection,runId:'host-missing-config-test',hostConfig:'',codexPath:'UNVERIFIED'}),/CONFIG_REQUIRED/);
 await assert.rejects(techQuotesCli(['--check-host','--host-config']),/ARGUMENTS/);
 await assert.rejects(techQuotesCli(['--check-host','--host-config','missing.json']),/CONFIG_INVALID/);
});
