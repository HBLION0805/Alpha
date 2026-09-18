import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {assessRobinhoodEtfBars} from '../src/engines/options-robinhood-data/RobinhoodEtfBars.ts';
import {recordRobinhoodEtfBars,verifyEtfSetup} from './lib/options-etf-setup-io.mjs';
import {runEtfSetup} from './options-etf-setup.mjs';
import {etfSourcePanel} from '../apps/options-workbench/etf-setup.js';

let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const now='2026-09-17T14:10:00.000Z';
function capture(){return {tool:'get_equity_historicals',request:{symbols:['GLD','IBIT'],start_time:'2026-09-17T13:30:00Z',end_time:'2026-09-17T13:40:00Z',interval:'5minute',bounds:'regular',adjustment_type:'none'},requestedAt:'2026-09-17T14:00:00.000Z',receivedAt:'2026-09-17T14:00:01.000Z',response:{structuredContent:{data:{results:['GLD','IBIT'].map(symbol=>({symbol,interval:'5minute',bounds:'regular',bars:[0,1].map(i=>({begins_at:`2026-09-17T13:${30+i*5}:00Z`,open_price:'43.240000',high_price:'43.310000',low_price:'43.130000',close_price:'43.169500',volume:1000,session:'reg'}))}))},guide:'SYNTHETIC TEST ONLY'}}};}
const asset=c=>c.response.structuredContent.data.results[0];
const assessment=c=>assessRobinhoodEtfBars(c,now).assets[0];
const temp=()=>mkdtempSync(join(tmpdir(),'alpha-etf-source-'));
function cleanup(root){const p=resolve(root);assert.ok(p.startsWith(resolve(tmpdir())+sep)&&p.includes('alpha-etf-source-'));rmSync(p,{recursive:true,force:true});}

await test('actual-shaped omitted flags stay null with positive share volume',()=>{const c=capture(),original=JSON.stringify(c),r=assessment(c);assert.equal(r.status,'QUALITY_BLOCKED');assert.equal(r.unknownInterpolation,2);assert.equal(r.rows[0].bar.interpolated,null);assert.equal(r.rows[0].bar.close,'43.169500');assert.equal(r.normalized,null);assert.equal(r.observations.openToLastCloseBps,-16);assert.equal(r.observations.officialDailyClose,false);assert.equal(r.observations.volume,2000);assert.equal(JSON.stringify(c),original);});
await test('explicit false validates local shape but never qualifies source or installs a plan',()=>{const c=capture();for(const b of asset(c).bars)b.interpolated=false;const r=assessment(c);assert.equal(r.status,'LOCALLY_VALIDATED_UNQUALIFIED_EXPORT');assert.equal(r.normalized.bars[0].interpolated,false);assert.equal(r.sourceQualified,false);assert.equal(r.setupInputAutomaticallyInstalled,false);});
for(const [name,change,code] of [
  ['true flag',b=>{b.interpolated=true;b.volume=0;},'INTERPOLATED_BAR'],
  ['true flag with volume',b=>b.interpolated=true,'INTERPOLATED_VOLUME_CONFLICT'],
  ['nonboolean flag',b=>b.interpolated='false','INTERPOLATION_FLAG_INVALID'],
  ['null flag',b=>b.interpolated=null,'INTERPOLATION_FLAG_INVALID'],
  ['missing session',b=>delete b.session,'SESSION_UNKNOWN_OR_NONREGULAR'],
  ['extended session',b=>b.session='post','SESSION_UNKNOWN_OR_NONREGULAR'],
  ['invalid range',b=>b.low_price='50','INVALID_OHLC'],
  ['numeric price',b=>b.close_price=43.2,'ETF_SOURCE_PRICE'],
  ['excess precision',b=>b.close_price='43.1695001','ETF_SOURCE_PRICE'],
  ['negative volume',b=>b.volume=-1,'ETF_SOURCE_VOLUME'],
  ['fractional volume',b=>b.volume=2.5,'ETF_SOURCE_VOLUME'],
  ['missing volume',b=>delete b.volume,'ETF_SOURCE_VOLUME'],
  ['invalid date',b=>b.begins_at='2026-02-30T13:30:00Z','ETF_SOURCE_CLOCK'],
  ['off-grid time',b=>b.begins_at='2026-09-17T13:31:00Z','GRID_OR_ORDER_MISMATCH']
])await test('retain blocked response for '+name,()=>{const c=capture();change(asset(c).bars[0]);const r=assessment(c);assert.ok(r.blockers.includes(code));assert.equal(r.normalized,null);assert.equal(r.observations,null);});
await test('result bounds and interval must echo request',()=>{for(const patch of [{bounds:'extended'},{interval:'minute'}]){const c=capture();Object.assign(asset(c),patch);assert.ok(assessment(c).blockers.includes('RESPONSE_SCOPE_MISMATCH'));}});
await test('gaps and duplicates remain visible',()=>{const c=capture();asset(c).bars.pop();assert.ok(assessment(c).blockers.includes('BAR_COUNT_MISMATCH'));const d=capture();asset(d).bars[1]=structuredClone(asset(d).bars[0]);assert.ok(assessment(d).blockers.includes('GRID_OR_ORDER_MISMATCH'));});
await test('elapsed completion uses request clock rather than a later receipt',()=>{const c=capture();c.requestedAt='2026-09-17T13:37:00.000Z';assert.equal(assessment(c).rows[1].bar.complete,false);assert.ok(assessment(c).blockers.includes('BAR_NOT_COMPLETE_AT_REQUEST'));});
await test('empty, omitted, not-found and null result evidence stays distinct',()=>{const c=capture();asset(c).bars=[];assert.ok(assessment(c).blockers.includes('EMPTY_BARS'));c.response.structuredContent.data.results=[];assert.ok(assessment(c).blockers.includes('RESULT_OMITTED'));c.response.structuredContent.data.not_found=['GLD'];assert.ok(assessment(c).blockers.includes('SYMBOL_NOT_FOUND'));c.response.structuredContent.data.results=null;assert.ok(assessment(c).blockers.includes('SYMBOL_NOT_FOUND'));});
await test('null bar is not silently dropped from coverage',()=>{const c=capture();asset(c).bars[0]=null;const r=assessment(c);assert.equal(r.returnedBars,2);assert.equal(r.normalizedBars,1);assert.equal(r.rows.length,2);assert.equal(r.observations,null);});
for(const [name,change] of [
  ['wrong request asset',c=>c.request.symbols=['BTC']],['duplicate requested asset',c=>c.request.symbols=['GLD','GLD']],
  ['wrong raw adjustment',c=>c.request.adjustment_type='split'],['wrong interval',c=>c.request.interval='minute'],
  ['future receipt',c=>c.receivedAt='2026-09-17T15:00:00.000Z'],['reversed clocks',c=>c.requestedAt='2026-09-17T14:05:00.000Z'],
  ['unexpected result',c=>asset(c).symbol='SPY'],['duplicate result',c=>c.response.structuredContent.data.results[1]=asset(c)],
  ['contradictory not-found',c=>c.response.structuredContent.data.not_found=['GLD']],['tool error',c=>c.response.isError=true],
  ['holiday window',c=>{c.request.start_time='2026-09-07T13:30:00Z';c.request.end_time='2026-09-07T13:40:00Z';}],
  ['multi-session request',c=>c.request.end_time='2026-09-18T13:40:00Z'],['extra input field',c=>c.approved=true]
])await test('reject '+name,()=>{const c=capture();change(c);assert.throws(()=>assessment(c),/ETF_SOURCE_/);});
await test('early-close session rejects an ordinary late request',()=>{const c=capture();c.request.start_time='2026-11-27T14:30:00Z';c.request.end_time='2026-11-27T21:00:00Z';c.requestedAt='2026-11-27T22:00:00.000Z';c.receivedAt='2026-11-27T22:00:01.000Z';assert.throws(()=>assessRobinhoodEtfBars(c,'2026-11-27T22:01:00.000Z'),/REQUEST_WINDOW/);});
await test('source records recover from copied input and reject tampering without creating strict imports',()=>{const root=temp(),other=temp();try{const saved=recordRobinhoodEtfBars(root,capture(),now),target=join(other,saved.path);mkdirSync(resolve(target,'..'),{recursive:true});cpSync(join(root,saved.path),target);const r=verifyEtfSetup(other,saved.path);assert.equal(r.report.assets[0].unknownInterpolation,2);assert.ok(!existsSync(join(root,'data/runtime/options-etf-setup/bars')));assert.ok(!existsSync(join(root,'data/runtime/options-etf-setup/plans')));const bad=JSON.parse(readFileSync(target,'utf8'));bad.report.assets[0].sourceQualified=true;writeFileSync(target,JSON.stringify(bad));assert.throws(()=>verifyEtfSetup(other,saved.path),/INTEGRITY/);}finally{cleanup(root);cleanup(other);}});
await test('source CLI records exact wire inputs using actual supplied test clock',async()=>{const root=temp();try{writeFileSync(join(root,'capture.json'),JSON.stringify(capture()));const saved=await runEtfSetup(['--record-source','capture.json'],{workspaceRoot:root,now:()=>now});assert.equal(saved.assets[0].unknownInterpolation,2);const r=verifyEtfSetup(root,saved.path);assert.deepEqual(r.input,capture());}finally{cleanup(root);}});
await test('source UI keeps prices, unavailable summaries and unknown flags visible and escapes text',()=>{const assets=assessRobinhoodEtfBars(capture(),now).assets;const html=etfSourcePanel(assets);assert.ok(html.includes('43.169500'));assert.ok(html.includes('2 unknown interpolation flags'));assert.ok(html.includes('not official daily closes'));assets[0].blockers.push('<img src=x>');assets[0].observations=null;const unsafe=etfSourcePanel(assets);assert.ok(!unsafe.includes('<img'));assert.ok(unsafe.includes('Summary unavailable'));assert.equal(etfSourcePanel(), '');});
console.log(`Robinhood ETF bars: ${passed}/${passed} tests passed.`);
