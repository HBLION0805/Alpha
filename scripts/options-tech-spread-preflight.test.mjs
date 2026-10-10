import nodeTest,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {collectTechOptionQuotes} from './lib/options-tech-quote-adapter.mjs';
import {assessTechSpreadPreflight as assess,readTechSpreadOriginal} from './lib/options-tech-spread-preflight.mjs';
import {techSpreadPreflightCli} from './options-tech-spread-preflight.mjs';
let total=0,passed=0;const test=(n,fn)=>{total++;nodeTest(n,async()=>{await fn();passed++;});};after(()=>console.log('Saved two-leg quote preflight: '+passed+'/'+total+' tests passed.'));
const sha=x=>createHash('sha256').update(x).digest('hex'),stamp=s=>'2026-10-09T15:30:'+s+'.000Z',ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],chain='11111111-1111-4111-8111-111111111111';
async function original(strike='335.0000',type='call',n=0,paired=false){
 const selection={symbol:'AAPL',expiry:'2026-10-16',strike};
 const instrument=(type,id)=>({id,chain_id:chain,chain_symbol:selection.symbol,expiration_date:selection.expiry,strike_price:strike,type,state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100.0000',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}});
 const instruments=paired?[instrument('call',ids[0]),instrument('put',ids[1])]:[instrument(type,ids[n])];
 const data={get_option_chains:{data:{chains:[{id:chain,symbol:'AAPL',expiration_dates:[selection.expiry],trade_value_multiplier:'100.0000',late_close_state:'disabled'}]}},get_option_instruments:{data:{instruments}},get_equity_quotes:{data:{results:[{quote:{symbol:'AAPL',last_trade_price:'334.123456',venue_last_trade_time:stamp('05'),state:'active',has_traded:true}}]}},get_option_quotes:{data:{results:instruments.map(i=>({quote:{instrument_id:i.id,bid_price:'2.00',ask_price:'2.02',bid_size:5,ask_size:5,updated_at:'2026-10-09T15:30:07.123456789Z'}}))}}};
 let t=0;const capture=await collectTechOptionQuotes({selection,origin:'SYNTHETIC_FIXTURE',clock:async()=>stamp(String(t++).padStart(2,'0')),call:async name=>data[name]});
 const r={version:'TECH_QUOTES_RECEIPT_V1',recordedAt:stamp('10'),intent:{version:'TECH_QUOTES_REQUEST_V1',selection,requestedAt:stamp('00'),accountAccessed:false,executionAllowed:false},capture,captureSha256:sha(JSON.stringify(capture)),executionAllowed:false};
 const rawJson=JSON.stringify(r);return {id:'source-'+n,rawJson,sha256:sha(rawJson)};
}
function rehash(o,fn){const r=JSON.parse(o.rawJson);fn(r);r.captureSha256=sha(JSON.stringify(r.capture));o.rawJson=JSON.stringify(r);o.sha256=sha(o.rawJson);}
async function fixture(type='call',paired=false){const originals=paired?[await original('335.0000',type,0,true)]:[await original('335.0000',type,0),await original('340.0000',type,1)];return {version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:'MOCK_CONTROL',at:stamp('10'),decisionAt:'2026-10-09T15:29:59.000Z',originals,legs:[0,1].map(n=>({originalId:paired?'source-0':'source-'+n,direction:(type==='call'?n===0:n===1)?'LONG':'SHORT',quantity:1,contract:{id:ids[n],symbol:'AAPL',expiry:'2026-10-16',strike:paired||n===0?'335.0000':'340.0000',type:paired&&n===1?'put':type,multiplier:100}}))};}
const blocked=(r,c)=>assert(r.checks.some(g=>g.code===c&&g.status==='BLOCKED'),JSON.stringify(r.checks));
const locked=r=>{assert.equal(r.paperAdmissionAllowed,false);assert.equal(r.executionAllowed,false);assert.equal(r.quotePair.economics,null);assert.equal(r.fills,0);assert.equal(r.sourceCalls,0);assert.equal(r.realPaperAcceptance,'NOT_TESTED');};
for(const type of ['call','put'])test(type+' static vertical uses existing inference but never stitches separate sources',async()=>{const r=assess(await fixture(type));assert.equal(r.staticStructure.status,'VALID_STATIC_DEBIT_VERTICAL');assert.equal(r.staticStructure.structure,type==='call'?'BULL_CALL_DEBIT':'BEAR_PUT_DEBIT');blocked(r,'SEPARATE_CAPTURES_NOT_A_COMBINED_QUOTE');blocked(r,'CONTRACT_DELIVERABLE_AND_EXERCISE');blocked(r,'ACCOUNT_EVIDENCE');locked(r);});
test('one-strike real-producer shape call plus put is never CDS or PDS',async()=>{const q=await fixture('call',true),r=assess(q);assert.equal(r.quotePair.sameCapture,true);blocked(r,'STATIC_DEBIT_VERTICAL');locked(r);});
for(const [name,change,code] of [
 ['outer hash',q=>q.originals[0].sha256='0'.repeat(64),'ORIGINAL_INTEGRITY'],
 ['inner hash',q=>{const o=q.originals[0],r=JSON.parse(o.rawJson);r.captureSha256='0'.repeat(64);o.rawJson=JSON.stringify(r);o.sha256=sha(o.rawJson);},'RECEIPT_INTEGRITY'],
 ['future decision',q=>q.decisionAt=stamp('59'),'DECISION_FROM_FUTURE'],
 ['future recorded receipt',q=>rehash(q.originals[0],r=>r.recordedAt=stamp('59')),'ORIGINAL_RECEIPT_CLOCK'],
 ['intent mismatch',q=>rehash(q.originals[0],r=>r.intent.selection={...r.intent.selection,strike:'330.00'}),'INTENT_BINDING'],
 ['mixed origin',q=>rehash(q.originals[0],r=>r.capture.origin='HOST_MARKET_TOOL_RESPONSES'),'MIXED_OR_UNDECLARED_ORIGIN'],
 ['wrong contract',q=>q.legs[0].contract.symbol='TSLA','EXACT_CONTRACT_MISMATCH'],
 ['wrong multiplier',q=>q.legs[0].contract.multiplier=10,'EXACT_CONTRACT_MISMATCH'],
 ['fractional size',q=>q.legs[0].quantity=.5,'LEG_DIRECTION_OR_QUANTITY'],
 ['duplicate original id',q=>q.originals[1].id=q.originals[0].id,'ORIGINAL_INTEGRITY'],
 ['missing original',q=>q.legs[1].originalId='absent','LEG_ORIGINAL_MISSING'],
 ['old quote before decision',q=>q.decisionAt=stamp('09'),'QUOTE_AFTER_DECISION'],
 ['quantity mismatch',q=>q.legs[1].quantity=2,'STATIC_DEBIT_VERTICAL'],
 ['credit directions',q=>q.legs.forEach((l,n)=>l.direction=n?'LONG':'SHORT'),'STATIC_DEBIT_VERTICAL'],
 ['size unavailable',q=>q.legs.forEach(l=>l.quantity=6),'DISPLAYED_BOTH_SIDE_QUANTITY'],
 ['stale weekend',q=>q.at='2026-10-10T15:30:10.000Z','INHERITED_QUOTE_ASSESSMENT'],
 ['costs missing',q=>{},'COSTS_EXPLICIT'],
 ['cost freeze late',q=>q.costs={origin:'SYNTHETIC_FIXTURE',reference:'MOCK',frozenAt:stamp('09'),entryFeesCents:1,exitFeesCents:1,exitSlippageReserveCents:1},'COSTS_EXPLICIT'],
])test(name+' blocks without authority',async()=>{const q=await fixture();change(q);const r=assess(q);blocked(r,code);locked(r);});
test('source nanosecond difference retained under named inherited scope',async()=>{const q=await fixture();rehash(q.originals[1],r=>r.capture.receipts[3].response.data.results[0].quote.updated_at='2026-10-09T15:30:07.123456790Z');const r=assess(q);assert.equal(r.quotePair.sourceClockDifferenceNs,'1');blocked(r,'SYNCHRONOUS_SOURCE_CLOCK_REFERENCE');assert(r.checks.every(g=>g.source&&g.scope));});
test('explicit costs do not override status or create executable economics',async()=>{const q=await fixture();q.costs={origin:'SYNTHETIC_FIXTURE',reference:'MOCK',frozenAt:q.decisionAt,entryFeesCents:10,exitFeesCents:10,exitSlippageReserveCents:100,status:'APPROVED',reserveCents:0};const r=assess(q);assert.equal(r.costs.status,'EXPLICIT_ASSUMPTION_ONLY');assert.equal(r.costs.reserveCents,120);locked(r);});
function accounts(q){const payloads={DATA_ENTITLEMENT:{provider:'ROBINHOOD_OFFICIAL_MCP',symbols:['AAPL'],realtimeOptions:true,localRetention:true},PRODUCT_PERMISSION:{accountId:'MOCK',enabled:true,symbols:['AAPL'],products:['BULL_CALL_DEBIT']},ACCOUNT_FUNDS:{accountId:'MOCK',currency:'USD',settledCashCents:100000,reservedCashCents:0},RISK_LIMITS:{accountId:'MOCK',tradeBudgetMaxCents:10000,maximumLossCents:10000}};q.accountEvidence={accountId:'MOCK',records:Object.entries(payloads).map(([kind,p])=>{const rawJson=JSON.stringify(p);return {kind,origin:'SYNTHETIC_FIXTURE',source:'MOCK',reviewedBy:'MOCK',observedAt:q.decisionAt,receivedAt:q.decisionAt,reviewedAt:q.decisionAt,validThrough:'2026-10-09T16:00:00.000Z',verdict:'PASS',rawJson,sha256:sha(rawJson)};})};}
function accountChange(q,kind,fn){const r=q.accountEvidence.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p,r);r.rawJson=JSON.stringify(p);r.sha256=sha(r.rawJson);}
test('documentary account checks stay attributed and do not assess sufficiency',async()=>{const q=await fixture();accounts(q);const r=assess(q);assert.equal(r.account.status,'ATTRIBUTED_DOCUMENT_CHECKS_ONLY');assert.equal(r.account.authenticated,false);assert.equal(r.account.availableSettledCashCents,100000);assert.match(r.account.sufficiency,/NOT_ASSESSED/);locked(r);});
for(const [kind,fn,code] of [
 ['PRODUCT_PERMISSION',p=>p.products=['LONG_CALL'],'SPREAD_PERMISSION_UNKNOWN'],
 ['PRODUCT_PERMISSION',p=>p.products='BULL_CALL_DEBIT','SPREAD_PERMISSION_UNKNOWN'],
 ['DATA_ENTITLEMENT',p=>p.realtimeOptions=null,'DATA_ENTITLEMENT_UNKNOWN'],
 ['ACCOUNT_FUNDS',p=>p.settledCashCents=null,'FUNDS_UNKNOWN'],
 ['RISK_LIMITS',p=>p.maximumLossCents=null,'RISK_LIMITS_UNKNOWN'],
 ['RISK_LIMITS',(p,r)=>r.reviewedAt=stamp('01'),'RISK_LIMITS_CLOCK_OR_VALIDITY'],
])test('account evidence retains '+code,async()=>{const q=await fixture();accounts(q);accountChange(q,kind,fn);const r=assess(q);assert(r.account.blockers.includes(code),JSON.stringify(r));locked(r);});
test('account hash tampering cannot qualify',async()=>{const q=await fixture();accounts(q);q.accountEvidence.records[0].sha256='0'.repeat(64);blocked(assess(q),'EVIDENCE_INTEGRITY');});
test('real declared sources remain replay only, stale and unauthenticated',async()=>{const q=await fixture('call',true);q.mode='REAL_SAVED_SOURCE_REPLAY';rehash(q.originals[0],r=>r.capture.origin='HOST_MARKET_TOOL_RESPONSES');q.at='2026-10-10T15:30:10.000Z';const r=assess(q);assert.equal(r.mode,'REAL_SAVED_SOURCE_REPLAY');blocked(r,'INHERITED_QUOTE_ASSESSMENT');locked(r);});
test('file adapter retains exact bytes and fails hash without writes',async()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-spread-preflight-'));try{const q=await fixture(),p=join(root,'original.json');fs.writeFileSync(p,q.originals[0].rawJson);assert.deepEqual(readTechSpreadOriginal(p,q.originals[0].sha256),{rawJson:q.originals[0].rawJson,sha256:q.originals[0].sha256});assert.throws(()=>readTechSpreadOriginal(p,'0'.repeat(64)),/HASH/);assert.equal(fs.readdirSync(root).length,1);assert.equal(fs.readFileSync(p,'utf8'),q.originals[0].rawJson);}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});
test('CLI has no capture save or arm command',()=>{for(const a of ['--capture','--save','--arm'])assert.throws(()=>techSpreadPreflightCli([a]),/ARGUMENTS/);});
test('pure assessment preserves original bytes and input object',async()=>{const q=await fixture(),before=JSON.stringify(q);assess(q);assert.equal(JSON.stringify(q),before);});

for(const [name,change,code] of [
 ['crossed book',r=>r.capture.receipts[3].response.data.results[0].quote.bid_price='2.05','INHERITED_QUOTE_ASSESSMENT'],
 ['zero displayed size',r=>r.capture.receipts[3].response.data.results[0].quote.bid_size=0,'DISPLAYED_BOTH_SIDE_QUANTITY'],
 ['missing source clock',r=>delete r.capture.receipts[3].response.data.results[0].quote.updated_at,'QUOTE_AFTER_DECISION'],
 ['omitted quote',r=>r.capture.receipts[3].response.data.results=[],'LEG_QUOTE_MISSING'],
 ['reordered acquisition',r=>r.capture.receipts.reverse(),'TECH_QUOTES_TOOL_ORDER'],
 ['future source clock',r=>r.capture.receipts[3].response.data.results[0].quote.updated_at=stamp('59'),'INHERITED_QUOTE_ASSESSMENT'],
])test(name+' is retained as a source limitation',async()=>{const q=await fixture();rehash(q.originals[0],change);const r=assess(q);blocked(r,code);locked(r);});
test('CLI reads explicit files without mutation calls',async()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-spread-preflight-'));try{const q=await fixture();q.originals=q.originals.map((o,n)=>{const path=join(root,'source-'+n+'.json');fs.writeFileSync(path,o.rawJson);return {id:o.id,path,sha256:o.sha256};});const p=join(root,'request.json');fs.writeFileSync(p,JSON.stringify(q));const before=fs.readdirSync(root).map(n=>[n,sha(fs.readFileSync(join(root,n)))]),names=['writeFileSync','appendFileSync','mkdirSync','rmSync','unlinkSync','renameSync','linkSync','truncateSync'],saved=Object.fromEntries(names.map(n=>[n,fs[n]]));let r;try{for(const n of names)fs[n]=()=>{throw Error('FORBIDDEN_MUTATION_'+n);};r=techSpreadPreflightCli(['--input',p]);}finally{Object.assign(fs,saved);}assert.equal(r.staticStructure.status,'VALID_STATIC_DEBIT_VERTICAL');assert.deepEqual(fs.readdirSync(root).map(n=>[n,sha(fs.readFileSync(join(root,n)))]),before);}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});

for(const [name,from,to,field] of [['mixed symbol','AAPL','TSLA','symbol'],['mixed expiry','2026-10-16','2026-10-23','expiry'],['equal strikes','340.0000','335.0000','strike']])test(name+' cannot become a static debit vertical',async()=>{const q=await fixture(),o=q.originals[1];o.rawJson=o.rawJson.replaceAll(from,to);const r=JSON.parse(o.rawJson);r.captureSha256=sha(JSON.stringify(r.capture));o.rawJson=JSON.stringify(r);o.sha256=sha(o.rawJson);q.legs[1].contract[field]=to;blocked(assess(q),'STATIC_DEBIT_VERTICAL');});
