import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {mockSpreadFixture} from './lib/options-tech-mock-spread-fixtures.mjs';
import {startMockSpread,appendMockSpread,recoverMockSpread} from './lib/options-tech-mock-spread.mjs';
import {mockSpreadCli} from './options-tech-mock-spread.mjs';
let total=0,passed=0;
const test=(name,fn)=>{total++;nodeTest(name,()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-mock-spread-'));try{fn(root);passed++;}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}});};
after(()=>console.log('Technology MOCK debit spreads: '+passed+'/'+total+' tests passed.'));
const runId='mock-spread-test',at='2026-10-09T14:23:30.000Z';
function start(root,structure='CDS',symbol='AAPL'){const f=mockSpreadFixture(structure,symbol);startMockSpread({root,runId,input:f.input});return f;}
const append=(root,event,extra={})=>appendMockSpread({root,runId,event,...extra});
const recover=(root,time=at)=>recoverMockSpread({root,runId,asOf:time});
for(const structure of ['CDS','PDS'])for(const symbol of ['AAPL','TSM','QQQ','TSLA'])test(structure+' '+symbol+' two-leg cash and recovery',root=>{
 const f=start(root,structure,symbol),open=append(root,f.entry);assert.equal(open.status,'OPEN_UNRESOLVED',JSON.stringify(open.diagnostics));assert.deepEqual(open.orders[0].legs.map(l=>l.side),['BUY_TO_OPEN','SELL_TO_OPEN']);assert.deepEqual(open.orders[0].legs.map(l=>l.priceCents),[202,100]);assert.deepEqual(open.position.modeledLegs.map(l=>l.signedQuantity),[1,-1]);assert.equal(open.account.settledCashCents,9790);assert.equal(open.terminalRisk.maximumLossCents,10420);
 const closed=append(root,f.exit);assert.equal(closed.status,'CLOSED_MODELED',JSON.stringify(closed.diagnostics));assert.deepEqual(closed.orders[1].legs.map(l=>l.side),['SELL_TO_CLOSE','BUY_TO_CLOSE']);assert.deepEqual(closed.orders[1].legs.map(l=>l.priceCents),[189,96]);assert.deepEqual(closed.position.modeledLegs.map(l=>l.signedQuantity),[0,0]);assert.equal(closed.account.netPnlCents,-920);assert.equal(closed.account.unsettledProceedsCents,9290);assert.equal(closed.account.settledCashCents,9790);assert.equal(closed.account.totalCashCents,19080);assert.equal(closed.atomicFillsAreBrokerGuarantee,false);assert.equal(closed.actualTrades,0);assert.deepEqual(recover(root).report,closed);
});
for(const [name,change]of [
 ['mixed symbol',p=>p.legs[1].contract.symbol='TSM'],['mixed expiry',p=>p.legs[1].contract.expiry='2026-10-23'],
 ['ratio',p=>p.legs[1].quantity=2],['multiplier',p=>p.legs[1].contract.multiplier=10],['naked short',p=>p.legs=p.legs.slice(1)],
 ['wrong strike orientation',p=>p.legs[0].contract.strike='350.00'],['different option types',p=>p.legs[1].contract.type='put'],
 ['production account',p=>p.account.mode='REAL'],['real candidate',p=>p.candidate.origin='HOST_MARKET_TOOL_RESPONSES'],
 ['overnight plan',p=>p.timeExitAt='2026-10-12T14:23:30.000Z'],['expiry day',p=>p.legs.forEach(l=>l.contract.expiry='2026-10-09')],
 ['assignment path',p=>p.assignment=true],['unsupported structure',p=>p.structure='CREDIT'],['extra entry leg',p=>p.legs.push(structuredClone(p.legs[0]))],
])test(name+' hard rejected',root=>{const f=mockSpreadFixture();change(f.input);assert.throws(()=>startMockSpread({root,runId,input:f.input}));});
for(const [name,change,code]of [
 ['unknown permission',p=>p.account.permission='UNKNOWN','MOCK_SPREAD_PERMISSION_NOT_PASSED'],
 ['single-leg-only permission',p=>p.account.products=[],'MOCK_SPREAD_PERMISSION_NOT_PASSED'],
 ['unknown funds',p=>p.account.settledCashCents=null,'MOCK_FUNDS_UNKNOWN_OR_INVALID'],
 ['unknown entitlement',p=>p.account.dataEntitlement='UNKNOWN','MOCK_ENTITLEMENT_NOT_PASSED'],
 ['unknown risk',p=>p.account.maximumLossCents=null,'MOCK_RISK_LIMITS_UNKNOWN'],
 ['unknown fee',p=>p.legs[1].exitFeeCents=null,'COSTS_UNKNOWN'],
 ['cash shortfall',p=>p.account.settledCashCents=10000,'CASH_OR_MAXIMUM_LOSS_OR_BUDGET'],
 ['maximum loss cap',p=>p.account.maximumLossCents=10000,'CASH_OR_MAXIMUM_LOSS_OR_BUDGET'],
 ['budget cap',p=>p.account.tradeBudgetMaxCents=10000,'CASH_OR_MAXIMUM_LOSS_OR_BUDGET'],
 ['entry limit',p=>p.entryDebitLimitCents=101,'DEBIT_OR_WIDTH_OR_LIMIT'],
])test(name+' saves no entry with explicit blocker',root=>{const f=mockSpreadFixture();change(f.input);startMockSpread({root,runId,input:f.input});const r=append(root,f.entry);assert.equal(r.orders.length,0);assert(r.diagnostics[0].codes.includes(code),JSON.stringify(r));});
for(const [name,change,code]of [
 ['one missing leg',e=>e.quote.legs.pop(),'BOTH_EXACT_LEG_QUOTES_REQUIRED'],
 ['different leg clock',e=>e.quote.legs[1].updatedAt='2026-10-09T14:16:40.000Z','UNSYNCHRONIZED_LEG_QUOTES'],
 ['stale short quote',e=>e.quote.legs[1].updatedAt='2026-10-09T14:14:00.000Z','STALE_AT_RECEIPT'],
 ['unknown short size',e=>e.quote.legs[1].bidSize=null,'SIZE_UNKNOWN'],
 ['short opening size zero',e=>e.quote.legs[1].bidSize=0,'ENTRY_AND_CLOSING_SIZE_REQUIRED'],
 ['last only',e=>{e.quote.legs[0].bidCents=null;e.quote.legs[0].last=201;},'PRICE_OR_TICK_INVALID'],
 ['wide short spread',e=>e.quote.legs[1].askCents=120,'LEG_SPREAD_EXCEEDED'],
 ['identity change',e=>e.quote.legs[1].strike='350.00','LEG_IDENTITY_CHANGED'],
 ['receipt mismatch',e=>e.quote.legs[1].receivedAt='2026-10-09T14:16:42.000Z','LEG_RECEIPT_OR_SESSION'],
 ['underlying mismatch',e=>e.quote.legs[1].underlyingPriceUsd='334.00','UNSYNCHRONIZED_LEG_QUOTES'],
])test(name+' cannot fabricate atomic entry',root=>{const f=start(root);change(f.entry);const r=append(root,f.entry);assert.equal(r.orders.length,0);assert(r.diagnostics[0].codes.includes(code),JSON.stringify(r.diagnostics));});
test('missing exit quote retains both legs and pending time exit',root=>{const f=start(root);append(root,f.entry);f.exit.quote.legs.pop();const r=append(root,f.exit);assert.equal(r.orders.length,1);assert.deepEqual(r.position.modeledLegs.map(l=>l.signedQuantity),[1,-1]);assert.equal(r.position.pendingExit,'TIME_EXIT');assert.equal(r.account.netPnlCents,null);const later=f.event('mock-later','14:24:00',200,202,100,102);assert.equal(append(root,later).orders[1].reason,'TIME_EXIT');});
test('short repurchase ask size is required for atomic close',root=>{const f=start(root);append(root,f.entry);f.exit.quote.legs[1].askSize=0;const r=append(root,f.exit);assert.equal(r.orders.length,1);assert(r.diagnostics.at(-1).codes.includes('BOTH_EXIT_SIZES_REQUIRED'));});
test('explicit early close survives unavailable quotes and rebound',root=>{const f=start(root);append(root,f.entry);const early=f.event('mock-request-close','14:17:00');early.quote.action='CLOSE';early.quote.legs=[];assert.equal(append(root,early).position.pendingExit,'EXPLICIT_MOCK_CLOSE');const later=f.event('mock-ready','14:17:30');assert.equal(append(root,later).orders[1].reason,'EXPLICIT_MOCK_CLOSE');});
for(const state of ['PARTIAL_FILL','SINGLE_LEG_FILL'])test(state+' is auditable and permanently blocks invented full resolution',root=>{const f=start(root);append(root,f.entry);const partial=f.event('mock-partial','14:17:00');partial.quote.executionState=state;partial.quote.legs.pop();const r=append(root,partial);assert.equal(r.status,'BLOCKED_UNSUPPORTED_RESIDUAL');assert.equal(r.position.unmodeledResidual,'UNKNOWN_NOT_CLEARED');assert.equal(r.orders.length,1);const later=append(root,f.exit);assert.equal(later.orders.length,1);assert.equal(later.account.netPnlCents,null);assert.equal(recover(root).events.length,3);});
test('cross-day quote is retained but cannot close',root=>{const f=start(root);append(root,f.entry);f.exit.quote.receivedAt='2026-10-12T14:23:30.000Z';const r=append(root,f.exit);assert.equal(r.orders.length,1);assert.equal(r.status,'OPEN_UNRESOLVED');assert(r.diagnostics.at(-1).codes.includes('OVERNIGHT_UNSUPPORTED'));});
test('duplicate and conflicting requests cannot duplicate either leg',root=>{const f=start(root);append(root,f.entry);assert.equal(append(root,f.entry).orders.length,1);const closed=append(root,f.exit);assert.deepEqual(append(root,f.exit),closed);f.exit.quote.legs[0].bidCents=185;assert.throws(()=>append(root,f.exit),/IDEMPOTENCY_CONFLICT/);assert.equal(recover(root).events.length,2);});
for(const interrupt of ['BEFORE_PUBLICATION','AFTER_LINK','AFTER_PUBLICATION'])test('atomic exit recovery at '+interrupt,root=>{const f=start(root);append(root,f.entry);assert.throws(()=>append(root,f.exit,{interrupt}),/SIMULATED_INTERRUPTION/);const r=append(root,f.exit);assert.equal(r.orders.length,2);assert.deepEqual(r.position.modeledLegs.map(l=>l.signedQuantity),[0,0]);assert.equal(recover(root).events.length,2);});
test('new process restores exactly two balanced orders',root=>{const f=start(root);append(root,f.entry);append(root,f.exit);const url=new URL('./lib/options-tech-mock-spread.mjs',import.meta.url).href;const code='import {recoverMockSpread} from '+JSON.stringify(url)+';console.log(JSON.stringify(recoverMockSpread('+JSON.stringify({root,runId,asOf:at})+').report));';const r=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{cwd:process.cwd(),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),recover(root).report);});
test('tampered leg price fails persisted hash recovery',root=>{const f=start(root);append(root,f.entry);const p=join(root,'data/runtime/options-workbench-development',runId,'event-0001.json'),e=JSON.parse(fs.readFileSync(p));e.event.quote.legs[1].bidCents=99;fs.writeFileSync(p,JSON.stringify(e));assert.throws(()=>recover(root),/EVENT_HASH/);});
test('short credits cannot replenish settled cash or release other reservations',root=>{const f=mockSpreadFixture();f.input.account.settledCashCents=25000;f.input.account.reservedCashCents=5000;startMockSpread({root,runId,input:f.input});append(root,f.entry);const r=append(root,f.exit);assert.equal(r.account.initialAvailableCashCents,20000);assert.equal(r.account.otherReservedCashCents,5000);assert.equal(r.account.settledCashCents,9790);assert.equal(r.account.unsettledProceedsCents,9290);});
test('bad terminal debit sign is not treated as free credit',root=>{const f=start(root);f.entry.quote.legs[1].bidCents=203;f.entry.quote.legs[1].askCents=205;const r=append(root,f.entry);assert.equal(r.orders.length,0);assert(r.diagnostics[0].codes.includes('DEBIT_OR_WIDTH_OR_LIMIT'));});
test('CLI refuses production arm and path traversal',root=>{assert.throws(()=>mockSpreadCli(['--arm'],{root}),/ARGUMENTS/);assert.throws(()=>startMockSpread({root,runId:'../escape',input:mockSpreadFixture().input}),/RUN_ID/);assert.match(mockSpreadCli(['--help']).help,/model assumption/);});
test('no later quote cannot manufacture a time exit',root=>{const f=start(root);append(root,f.entry);const r=recover(root).report;assert.equal(r.position.pendingExit,'TIME_EXIT');assert.equal(r.orders.length,1);assert.equal(r.account.netPnlCents,null);});
test('early close may exceed terminal model loss without hiding the excess',root=>{const f=start(root);append(root,f.entry);const e=f.event('mock-expensive-close','14:17:00',50,52,70,72);e.quote.action='CLOSE';const r=append(root,e);assert.equal(r.orders.length,2);assert.equal(r.account.unsettledProceedsCents,0);assert.equal(r.account.totalCashCents,7380);assert.equal(r.account.netPnlCents,-12620);assert.equal(r.earlyCloseLossExceededTerminalModel,true);});
test('unfunded close remains open instead of allowing negative cash',root=>{const f=start(root);append(root,f.entry);const e=f.event('mock-unfunded-close','14:17:00',10,12,300,305);e.quote.action='CLOSE';const r=append(root,e);assert.equal(r.orders.length,1);assert.equal(r.position.pendingExit,'EXPLICIT_MOCK_CLOSE');assert(r.diagnostics.at(-1).codes.includes('EXIT_CASH_INSUFFICIENT'));});
test('a repeated source on one leg cannot independently close the spread',root=>{const f=start(root);append(root,f.entry);f.exit.quote.legs.forEach(x=>x.updatedAt=f.entry.quote.legs[0].updatedAt);assert.equal(append(root,f.exit).orders.length,1);});
test('leg ordering does not alter side, cost or signed position',root=>{const f=mockSpreadFixture();f.input.legs.reverse();f.entry.quote.legs.reverse();f.exit.quote.legs.reverse();startMockSpread({root,runId,input:f.input});append(root,f.entry);const r=append(root,f.exit);assert.deepEqual(r.orders[0].legs.map(l=>l.side),['SELL_TO_OPEN','BUY_TO_OPEN']);assert.equal(r.account.netPnlCents,-920);});
test('out-of-session residual report is not discarded as merely a late quote',root=>{const f=start(root);append(root,f.entry);f.exit.quote.receivedAt='2026-10-12T14:23:30.000Z';f.exit.quote.executionState='PARTIAL_FILL';const r=append(root,f.exit);assert.equal(r.status,'BLOCKED_UNSUPPORTED_RESIDUAL');assert.equal(r.position.unmodeledResidual,'UNKNOWN_NOT_CLEARED');});
