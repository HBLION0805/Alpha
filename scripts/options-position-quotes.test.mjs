import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {seedPositionWatch,watchClock as at,watchId,watchCommands,watchFrame} from './lib/options-position-watch-fixtures.mjs';
import {readManualLedger,runOptionsManualLedgerCommand} from './options-manual-ledger.mjs';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {normalizeGuidanceCapture} from './lib/options-guidance-io.mjs';
import {collectPositionQuotes} from './lib/options-guidance-host.mjs';
import {preparePositionQuotes,beginPositionQuotes,authorizePositionQuoteCall,recordPositionQuotes,positionQuoteRecords,targetedPositionWatch} from './lib/options-position-quotes.mjs';
import {runPositionQuotes} from './options-position-quotes.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {positionWatchPanel} from '../apps/options-workbench/position-watch.js';
import {conditionDefaults,thesisDefaults} from '../apps/options-workbench/trade-thesis.js';

const ledgerId='synthetic-watch',options={allowSynthetic:true};let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-position-watch-quotes-'));try{await seedPositionWatch(root);await fn(root);}finally{const p=realpathSync(root),rel=relative(realpathSync(tmpdir()),p);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-position-watch-quotes-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(p,{recursive:true,force:true});}}
function append(root,command,n=1){if(command.fill){command.fill.externalExecutionRef=command.fillId;const previous=readManualLedger(root,ledgerId,()=>at(n)).input.events.filter(e=>e.command.tradeId===command.tradeId).map(e=>e.command.fill?.executionSequence??0);command.fill.executionSequence=Math.max(0,...previous)+1;}writeFileSync(join(root,'next-command.json'),JSON.stringify(command));return runOptionsManualLedgerCommand(['--append',ledgerId,'next-command.json'],{workspaceRoot:root,now:()=>at(n)});}
function updateCapture(root,change){const path=join(root,watchFrame().path),r=JSON.parse(readFileSync(path));change(r.input);r.report=normalizeGuidanceCapture(r.input);r.inputFingerprint=paperFingerprint(r.input);r.reportFingerprint=paperFingerprint(r.report);writeFileSync(path,JSON.stringify(r));}
function quotes(tool,query,n=3,patch={}){
  if(tool==='get_equity_quotes')return {data:{results:query.symbols.map(symbol=>({quote:{symbol,last_trade_price:'400.123456',venue_last_trade_time:at(n),last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}))}};
  assert.equal(tool,'get_option_quotes');return {data:{results:query.instrument_ids.map(instrument_id=>({quote:{instrument_id,bid_price:'0.80',ask_price:'0.81',bid_size:10,ask_size:10,updated_at:at(n),...patch}}))}};
}
async function collect(root,reviewId='review-one',n=3,callback=null){
  const request=preparePositionQuotes(root,ledgerId,reviewId,null,at(n-2));
  const begin=beginPositionQuotes(root,request.reviewId,at(n-1),options);assert(begin.claimed);
  const observed=[];
  const raw=await collectPositionQuotes({request:begin.request,clock:async()=>at(n),authorize:async index=>authorizePositionQuoteCall(root,request.reviewId,index,at(n),options),call:async(tool,query)=>{observed.push([tool,query]);return callback?callback(tool,query):quotes(tool,query,n);}});
  return {request,begin,raw,observed,result:recordPositionQuotes(root,request.reviewId,raw,at(n))};
}

await test('empty, closed and plan-only ledgers prepare zero-call no-position results',()=>temp(async root=>{
  runOptionsManualLedgerCommand(['--create','owner-empty'],{workspaceRoot:root,now:()=>at(0)});
  assert.equal(preparePositionQuotes(root,'owner-empty','empty-one',null,at(1)).status,'NO_OPEN_POSITIONS');
  const close=watchCommands()[2];close.requestId='close-rest';close.fillId='close-rest';close.fill.quantity=2;close.fill.executedAt=at(1);append(root,close,1);
  assert.equal(preparePositionQuotes(root,ledgerId,'closed-one',null,at(2)).calls,0);
  const plan=watchCommands()[0];plan.tradeId='plan-only';plan.requestId='plan-only';append(root,plan,2);
  assert.equal(preparePositionQuotes(root,ledgerId,'planned-one',null,at(3)).status,'NO_OPEN_POSITIONS');
}));
await test('two calls only, deduplicated IDs, raw persistence and original stop check',()=>temp(async root=>{
  const commands=watchCommands().slice(0,2);for(const c of commands){c.tradeId='second-plan';c.requestId='second-'+c.requestId;if(c.fillId)c.fillId='second-fill';append(root,c,1);}
  const {result,observed}=await collect(root);
  assert.deepEqual(observed.map(x=>x[0]),['get_equity_quotes','get_option_quotes']);assert.equal(observed[1][1].instrument_ids.length,1);
  assert.equal(result.calls,2);assert.equal(result.returnedOptionRows,1);assert.equal(result.localWrites,6);assert.equal(result.rows.length,2);assert(result.rows.every(r=>r.checks.stop==='OBSERVED_AT_OR_BELOW_STOP'));
  assert(result.rows.every(r=>r.actualExitConfirmed===false));assert.equal(result.costUsd,'UNKNOWN');
  assert.equal(positionQuoteRecords(root,ledgerId,at(4))[0].result.fingerprint,result.fingerprint);
  assert.equal(readManualLedger(root,ledgerId,()=>at(4)).report.openTrades,undefined);
}));
await test('production Host cannot authorize synthetic or closed-session calls',()=>temp(async root=>{
  preparePositionQuotes(root,ledgerId,'closed-host',null,at(1));assert.throws(()=>beginPositionQuotes(root,'closed-host',at(2)),/SYNTHETIC_NOT_LIVE/);
  assert.throws(()=>beginPositionQuotes(root,'closed-host','2026-09-19T14:00:00.000Z',options),/REGULAR_SESSION_REQUIRED/);
  assert.throws(()=>beginPositionQuotes(root,'closed-host','2026-09-08T19:50:00.000Z',options),/ROUTINE_WINDOW_RESERVED/);
}));
await test('unverified hand-written contracts are uncovered without chain fallback',()=>temp(async root=>{
  updateCapture(root,raw=>raw.receipts.filter(r=>r.tool==='get_option_instruments').forEach(r=>r.response.data.instruments.forEach(i=>i.strike_price='410')));
  const r=preparePositionQuotes(root,ledgerId,'no-identity',null,at(1));assert.equal(r.status,'MISSING_VERIFIED_CONTRACT_IDENTITY');assert.equal(r.calls,0);
}));
await test('conflicting historical IDs cannot silently choose a contract',()=>temp(async root=>{
  updateCapture(root,raw=>{const receipt=raw.receipts.find(r=>r.tool==='get_option_instruments');receipt.response.data.instruments.push({...receipt.response.data.instruments[0],id:'00000000-0000-0000-0000-000000009999'});});
  assert.equal(preparePositionQuotes(root,ledgerId,'ambiguous-one',null,at(1)).status,'MISSING_VERIFIED_CONTRACT_IDENTITY');
}));
await test('seven distinct contracts require selection; excluded positions remain explicit',()=>temp(async root=>{
  updateCapture(root,raw=>{const r=raw.receipts.find(r=>r.tool==='get_option_instruments');for(let i=1;i<=6;i++)r.response.data.instruments.push({...r.response.data.instruments[0],id:'00000000-0000-0000-0000-'+String(100+i).padStart(12,'0'),strike_price:String(400+i)});});
  for(let i=1;i<=6;i++)for(const c of watchCommands().slice(0,2)){c.tradeId='position-'+i;c.requestId='position-'+i+'-'+c.requestId;if(c.contract)c.contract.strikeUsd=String(400+i);if(c.fillId)c.fillId='fill-'+i;append(root,c,1);}
  assert.equal(preparePositionQuotes(root,ledgerId,'all-seven',null,at(2)).status,'SELECTION_REQUIRED');
  const r=preparePositionQuotes(root,ledgerId,'one-chosen',[watchId],at(2));assert.equal(r.contracts.length,1);assert.equal(r.positions.filter(p=>!p.selected).length,6);
}));
await test('repeat preparation, claim, permit and result are bounded and idempotent',()=>temp(async root=>{
  const r=preparePositionQuotes(root,ledgerId,'repeat-one',null,at(1));assert.equal(preparePositionQuotes(root,ledgerId,'repeat-two',null,at(1)).reviewId,r.reviewId);
  const {result,raw}=await collect(root,'repeat-one');assert.equal(beginPositionQuotes(root,r.reviewId,at(4),options).claimed,false);
  assert.throws(()=>authorizePositionQuoteCall(root,r.reviewId,0,at(4),options),/PERMIT_EXPIRED/);
  assert.equal(recordPositionQuotes(root,r.reviewId,raw,at(5)).fingerprint,result.fingerprint);
  assert.throws(()=>recordPositionQuotes(root,r.reviewId,{...raw,calls:1},at(5)),/RESULT_CONFLICT/);
}));
await test('missing or stale replies retain independent time exits, no current value',()=>temp(async root=>{
  const n=3601,{result}=await collect(root,'missing-one',n,(tool,query)=>tool==='get_option_quotes'?{data:{results:[null]}}:quotes(tool,query,n));
  assert.equal(result.rows[0].liquidationValueAtBidUsd,null);assert.equal(result.rows[0].checks.time,'DUE_UNRESOLVED');assert.equal(result.coverage[0].status,'QUOTE_MISSING');
}));
await test('source stale, future, zero bid and wrong IDs cannot value a position',async()=>{
  for(const patch of [{updated_at:at(-70)},{updated_at:at(5)},{bid_price:'0'},{instrument_id:'00000000-0000-0000-0000-000000009999'}])await temp(async root=>{const {result}=await collect(root,'bad-quote',3,(tool,query)=>quotes(tool,query,3,patch));assert.equal(result.rows[0].liquidationValueAtBidUsd,null);});
});
await test('saved stop stays triggered after aging and restart without copying the old bid',()=>temp(async root=>{
  const {result}=await collect(root);assert(result.rows[0].usableQuote);
  const state=await createWorkbenchData({workspaceRoot:root,ledgerId,now:()=>at(70)}).state(),row=state.positionWatch.data.rows[0];
  assert.equal(row.liquidationValueAtBidUsd,null);assert(row.thesis.triggered.includes('STOP_REFERENCE_REACHED'));assert.equal(row.thesis.action,'EXIT_CONDITION_TRIGGERED');
  const html=positionWatchPanel(state.positionWatch);assert(html.includes(result.reviewId));assert(html.includes('2 tool calls'));assert(html.includes('manual action required'));assert(html.includes('Saved exit checks'));
}));
await test('ledger changes before authorization stop reads; during response invalidate binding',()=>temp(async root=>{
  const {result,raw}=await collect(root,'race-one',3,async(tool,query)=>{
    if(tool==='get_option_quotes'){const c=watchCommands()[2];c.requestId='race-close';c.fillId='race-close';c.fill.quantity=2;c.fill.executedAt=at(3);append(root,c,3);}return quotes(tool,query,3);
  });
  assert.equal(raw.calls,2);assert.equal(result.binding,'POSITIONS_CHANGED');assert.equal(result.rows.length,0);
  assert.equal(readManualLedger(root,ledgerId,()=>at(4)).report.counts.openTrades,0);
}));
await test('provider failure stops without retry and preserves real attempted call count',()=>temp(async root=>{
  const {raw,result}=await collect(root,'failure-one',3,()=>{throw Error('RATE_LIMIT');});
  assert.equal(raw.calls,1);assert.equal(result.calls,1);assert.equal(result.returnedOptionRows,0);assert.equal(result.rows[0].usableQuote,false);
}));
await test('protected preparation API and result state recover after server restart',()=>temp(async root=>{
  const opts={workspaceRoot:root,ledgerId,now:()=>at(1),port:0};let app=await startOptionsWorkbench(opts);
  try{const state=await(await fetch(app.url+'/api/state')).json(),body={action:'PREPARE_QUOTES',reviewId:'api-review',tradeIds:[watchId]};
    assert.equal((await fetch(app.url+'/api/position-watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,403);
    const r=await fetch(app.url+'/api/position-watch',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':state.session},body:JSON.stringify(body)});assert.equal(r.status,200);assert.equal((await r.json()).status,'PREPARED_NOT_COLLECTED');
  }finally{await app.close();}
  // Use the same prepared request via the injected Host path.
  const begin=beginPositionQuotes(root,'api-review',at(2),options);
  const raw=await collectPositionQuotes({request:begin.request,clock:async()=>at(3),authorize:async n=>authorizePositionQuoteCall(root,'api-review',n,at(3),options),call:async(t,q)=>quotes(t,q)});recordPositionQuotes(root,'api-review',raw,at(3));
  app=await startOptionsWorkbench({...opts,now:()=>at(3)});
  try{const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.positionWatch.data.rows[0].checks.stop,'OBSERVED_AT_OR_BELOW_STOP');assert.equal(state.positionWatch.data.targeted.records[0].reviewId,'api-review');}finally{await app.close();}
}));
await test('CLI local scope and results never invoke market tools or change ledger',()=>temp(async root=>{
  const before=readManualLedger(root,ledgerId,()=>at(1)).headSha256;
  const r=runPositionQuotes(['--scope',ledgerId],{workspaceRoot:root,now:()=>at(1)});assert.equal(r.positions.length,1);
  assert.deepEqual(runPositionQuotes(['--results',ledgerId],{workspaceRoot:root,now:()=>at(1)}),[]);
  assert.equal(readManualLedger(root,ledgerId,()=>at(1)).headSha256,before);
}));
await test('first response followed by a ledger correction prevents the second market call',()=>temp(async root=>{
  const {result,raw}=await collect(root,'race-before-second',3,(tool,query)=>{
    const correction={type:'CORRECT_FILL',requestId:'fix-fill',tradeId:watchId,fillId:'buy-one',expectedRevision:1,reason:'Isolated correction',replacement:{...watchCommands()[1].fill,pricePerShareUsd:'1.01'}};
    append(root,correction,3);return quotes(tool,query);
  });
  assert.equal(raw.calls,1);assert.equal(raw.failures[0].code,'CALL_NOT_AUTHORIZED');assert.equal(result.binding,'POSITIONS_CHANGED');assert.equal(result.rows[0].liquidationValueAtBidUsd,null);
}));
await test('future ETF time blocks valuation rather than falling back to the older regular trade',()=>temp(async root=>{
  const {result}=await collect(root,'future-etf',3,(tool,query)=>{
    const r=quotes(tool,query);if(tool==='get_equity_quotes')Object.assign(r.data.results[0].quote,{last_non_reg_trade_price:'401',venue_last_non_reg_trade_time:at(4)});return r;
  });assert.equal(result.rows[0].liquidationValueAtBidUsd,null);
}));
await test('missing new response does not reuse an older good quote; prior trigger survives',()=>temp(async root=>{
  await collect(root,'first-quote',3);const {result}=await collect(root,'second-quote',3603,(t,q)=>t==='get_option_quotes'?{data:{results:[]}}:quotes(t,q,3603));
  assert.equal(result.rows[0].liquidationValueAtBidUsd,null);assert(result.rows[0].thesis.triggered.includes('STOP_REFERENCE_REACHED'));
  const report=readManualLedger(root,ledgerId,()=>at(3604)).report,row=targetedPositionWatch(root,report,null,at(3604)).rows[0];assert.equal(row.quote,null);assert(row.thesis.triggered.includes('STOP_REFERENCE_REACHED'));
}));
await test('future receipts are absent from historical checks and result tampering fails closed',()=>temp(async root=>{
  await collect(root);const report=readManualLedger(root,ledgerId,()=>at(1)).report;
  const old=targetedPositionWatch(root,report,null,at(1));assert.equal(old.rows[0].targetedReviewId,undefined);assert.equal(old.targeted.records[0].result,null);
  const path=join(root,'data/runtime/options-position-quotes/review-one/result.json'),r=JSON.parse(readFileSync(path));r.rows[0].liquidationValueAtBidUsd='999999';writeFileSync(path,JSON.stringify(r));
  const current=targetedPositionWatch(root,readManualLedger(root,ledgerId,()=>at(3601)).report,null,at(3601));assert.equal(current.targeted.error,'TARGETED_RECOVERY_UNAVAILABLE');assert.equal(current.rows[0].checks.time,'DUE_UNRESOLVED');
}));
await test('exported Host source executes only through injected two-tool callbacks',()=>temp(async root=>{
  preparePositionQuotes(root,ledgerId,'source-round',null,at(1));const b=beginPositionQuotes(root,'source-round',at(2),options),fn=new Function('return ('+b.source+')')(),calls=[];
  const raw=await fn({clock:async()=>at(3),authorize:async n=>authorizePositionQuoteCall(root,'source-round',n,at(3),options),call:async(t,q)=>{calls.push(t);return quotes(t,q);}});
  assert.deepEqual(calls,['get_equity_quotes','get_option_quotes']);assert.equal(recordPositionQuotes(root,'source-round',raw,at(3)).quoteRows,1);
  const duplicate=await fn({clock:async()=>at(4),authorize:async n=>authorizePositionQuoteCall(root,'source-round',n,at(4),options),call:async()=>assert.fail('duplicate call')});assert.equal(duplicate.calls,0);
}));
await test('targeted ETF invalidation reaches the original thesis evaluator and saved review command',()=>temp(async root=>{
  const name='synthetic-targeted-thesis',base=join(root,'data/runtime/options-manual-ledger',name);mkdirSync(base,{recursive:true});
  writeFileSync(join(base,'manifest.json'),JSON.stringify({version:'OPTIONS_MANUAL_LEDGER_STORE_V1',ledgerId:name,origin:'SYNTHETIC_FIXTURE',createdAt:at(-200),executionAllowed:false},null,2)+'\n');
  const commands=watchCommands();commands[0].plan.targetNetProfitUsd='1000';commands[0].plan.invalidation={...thesisDefaults(),tradeDate:'2026-09-08',realizationStartAt:at(-20),realizationEndAt:at(3000),nextCheckAt:at(0),holdThroughEvent:'YES',manualFallback:'Inspect original source manually',conditions:[{...conditionDefaults('PRICE','price'),basis:'Isolated ETF structure',checkAt:at(-30),missingAction:'Verify ETF quote manually',target:'ETF',comparator:'AT_OR_BELOW',threshold:'395',confirmation:'TOUCH'}]};
  for(const [n,c]of commands.entries()){writeFileSync(join(root,'thesis-command.json'),JSON.stringify(c));runOptionsManualLedgerCommand(['--append',name,'thesis-command.json'],{workspaceRoot:root,now:()=>at(n===0?-100:0)});}
  preparePositionQuotes(root,name,'thesis-quotes',null,at(1));const b=beginPositionQuotes(root,'thesis-quotes',at(2),options);
  const raw=await collectPositionQuotes({request:b.request,clock:async()=>at(3),authorize:async n=>authorizePositionQuoteCall(root,'thesis-quotes',n,at(3),options),call:async(t,q)=>{const r=quotes(t,q,3,{bid_price:'1.50',ask_price:'1.51'});if(t==='get_equity_quotes')r.data.results[0].quote.last_trade_price='390';return r;}});
  const saved=recordPositionQuotes(root,'thesis-quotes',raw,at(3));assert.equal(saved.rows[0].thesis.thesisStatus,'INVALIDATED');assert(saved.rows[0].thesis.triggered.includes('THESIS_INVALIDATED:price'));assert.equal(saved.rows[0].checks.stop,'NOT_OBSERVED');
  const service=createWorkbenchData({workspaceRoot:root,ledgerId:name,now:()=>at(3)}),review=service.positionWatch({action:'SAVE_REVIEW',requestId:'save-targeted-thesis',tradeId:watchId,exitCostUsd:'0',evidence:null,note:'Isolated targeted evidence review',reportedAction:'NO_ACTION_REPORTED',correctionOf:''});
  assert.equal(review.review.result.thesisStatus,'INVALIDATED');assert.equal(review.review.market.price.price,'390');assert.equal(review.review.watch.quote.id,b.request.contracts[0].id);
}));
console.log(`Targeted position quote tests passed: ${passed}/${passed}.`);
