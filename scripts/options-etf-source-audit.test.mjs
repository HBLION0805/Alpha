import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,sep} from 'node:path';
import {compareRobinhoodEtfBars} from '../src/engines/options-robinhood-data/RobinhoodEtfBarAudit.ts';
import {recordEtfSourceAudit,recordRobinhoodEtfBars,verifyEtfSetup} from './lib/options-etf-setup-io.mjs';
import {runEtfSetup} from './options-etf-setup.mjs';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {etfSourceAuditPanel} from '../apps/options-workbench/etf-setup.js';

const at='2026-09-17T14:00:00.000Z';
function capture(interval){
  const fine=interval==='minute';
  return {tool:'get_equity_historicals',request:{symbols:['GLD','IBIT'],start_time:'2026-09-17T13:30:00Z',end_time:'2026-09-17T13:40:00Z',interval,bounds:'regular',adjustment_type:'none'},requestedAt:at,receivedAt:at,response:{structuredContent:{data:{results:['GLD','IBIT'].map(symbol=>({symbol,interval,bounds:'regular',bars:Array.from({length:fine?10:2},(_,i)=>({begins_at:new Date(Date.parse('2026-09-17T13:30:00Z')+i*(fine?60000:300000)).toISOString(),open_price:'43.240000',high_price:'43.310000',low_price:'43.130000',close_price:'43.169500',volume:fine?100:500,session:'reg'}))}))}}}};
}
const fixture=()=>({fiveMinuteCapture:capture('5minute'),minuteCapture:capture('minute')});
const result=v=>v.minuteCapture.response.structuredContent.data.results[0];
const bar=v=>result(v).bars[0];
const assess=v=>compareRobinhoodEtfBars(v,at);
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const temp=()=>mkdtempSync(join(tmpdir(),'alpha-etf-audit-'));
function cleanup(root){const p=resolve(root);assert.ok(p.startsWith(resolve(tmpdir())+sep)&&p.includes('alpha-etf-audit-'));rmSync(p,{recursive:true,force:true});}

await test('numeric agreement preserves unknown flags, exact prices and unqualified source',()=>{
  const input=fixture(),original=JSON.stringify(input),r=assess(input),a=r.assets[0];
  assert.equal(a.matching,2);assert.equal(a.different,0);assert.equal(a.unknownMinuteFlags,10);assert.equal(a.unknownFiveMinuteFlags,2);
  assert.equal(a.rows[0].minuteAggregate.close,'43.169500');assert.equal(a.sourceQualified,false);assert.equal(a.canConfirmTrend,false);
  assert.equal(r.executionAllowed,false);assert.equal(r.omittedFlagSemantics,'UNSPECIFIED_IN_OBSERVED_OFFICIAL_SCHEMA');assert.equal(JSON.stringify(input),original);
});
await test('all five fields compare exactly and retain both versions without choosing a winner',()=>{
  const v=fixture();bar(v).open_price='43.25';bar(v).high_price='43.32';bar(v).low_price='43.12';bar(v).volume=101;result(v).bars[4].close_price='43.169501';
  const r=assess(v).assets[0];assert.equal(r.different,1);assert.equal(r.matching,1);assert.equal(r.differingFields,5);
  assert.equal(r.rows[0].fiveMinute.close,'43.169500');assert.equal(r.rows[0].minuteAggregate.close,'43.169501');assert.ok(r.qualityBlockers.includes('CROSS_INTERVAL_DISAGREEMENT'));
});
await test('decimal formatting differences are equal, not artificial discrepancies',()=>{const v=fixture();bar(v).open_price='43.24';assert.equal(assess(v).assets[0].different,0);});
await test('explicit false flags still do not grant qualification or a rule',()=>{const v=fixture();for(const c of Object.values(v))for(const r of c.response.structuredContent.data.results)for(const b of r.bars)b.interpolated=false;const a=assess(v).assets[0];assert.equal(a.matching,2);assert.equal(a.unknownMinuteFlags,0);assert.equal(a.sourceQualified,false);assert.equal(a.canConfirmTrend,false);});
for(const [name,change] of [
  ['missing minute',v=>result(v).bars.pop()],
  ['duplicate minute',v=>result(v).bars[1]=structuredClone(bar(v))],
  ['out-of-order minute',v=>result(v).bars.reverse()],
  ['out-of-window minute',v=>bar(v).begins_at='2026-09-17T13:29:00Z'],
  ['invalid date',v=>bar(v).begins_at='2026-02-30T13:30:00Z'],
  ['unknown session',v=>delete bar(v).session],
  ['nonregular session',v=>bar(v).session='post'],
  ['invalid OHLC',v=>bar(v).high_price='42.00'],
  ['numeric price',v=>bar(v).open_price=43.24],
  ['excess price precision',v=>bar(v).close_price='43.1695001'],
  ['negative volume',v=>bar(v).volume=-1],
  ['fractional volume',v=>bar(v).volume=1.5],
  ['missing volume',v=>delete bar(v).volume],
  ['null bar',v=>result(v).bars[0]=null],
  ['true interpolated flag',v=>{bar(v).interpolated=true;bar(v).volume=0;}],
  ['malformed flag',v=>bar(v).interpolated='false'],
  ['null flag',v=>bar(v).interpolated=null],
  ['nonmatching interval',v=>result(v).interval='5minute'],
  ['nonmatching bounds',v=>result(v).bounds='extended'],
  ['unfinished minute',v=>v.minuteCapture.requestedAt='2026-09-17T13:39:00.000Z'],
  ['invalid original five-minute bar',v=>v.fiveMinuteCapture.response.structuredContent.data.results[0].bars[0].high_price='42']
])await test('no numerical agreement from '+name,()=>{const v=fixture();change(v);const a=assess(v).assets[0];assert.equal(a.status,'NOT_COMPARABLE');assert.equal(a.comparable,0);assert.equal(a.matching,0);assert.equal(a.notComparable,2);assert.ok(a.rows.every(r=>r.minuteAggregate===null));});
await test('missing result, not found, empty and null bars remain unassessable',()=>{
  for(const mode of ['omitted','not-found','empty','null','null-results']){const v=fixture(),d=v.minuteCapture.response.structuredContent.data;if(mode==='empty')result(v).bars=[];else if(mode==='null')result(v).bars=null;else{d.results=[];if(mode==='not-found')d.not_found=['GLD'];if(mode==='null-results')d.results=null;}const r=assess(v).assets[0];assert.equal(r.comparable,0);assert.equal(r.notComparable,2);}
});
await test('one invalid asset cannot erase the other asset comparison',()=>{const v=fixture();bar(v).volume=-1;assert.equal(assess(v).assets[1].matching,2);});
for(const [name,change] of [
  ['wrong tool',v=>v.minuteCapture.tool='get_option_historicals'],
  ['wrong interval',v=>v.minuteCapture.request.interval='5minute'],
  ['adjustment mismatch',v=>v.minuteCapture.request.adjustment_type='split'],
  ['window mismatch',v=>v.minuteCapture.request.end_time='2026-09-17T13:45:00Z'],
  ['wrong asset',v=>v.minuteCapture.request.symbols=['SPY','IBIT']],
  ['duplicate request',v=>v.minuteCapture.request.symbols=['GLD','GLD']],
  ['unexpected result',v=>result(v).symbol='SPY'],
  ['duplicate result',v=>v.minuteCapture.response.structuredContent.data.results[1]=result(v)],
  ['contradictory not found',v=>v.minuteCapture.response.structuredContent.data.not_found=['GLD']],
  ['unexpected not found',v=>v.minuteCapture.response.structuredContent.data.not_found=['SPY']],
  ['future receipt',v=>v.minuteCapture.receivedAt='2026-09-17T14:01:00.000Z'],
  ['reversed clocks',v=>v.minuteCapture.requestedAt='2026-09-17T14:01:00.000Z'],
  ['tool error',v=>v.minuteCapture.response.isError=true],
  ['extra top-level field',v=>v.approved=true]
])await test('reject '+name,()=>{const v=fixture();change(v);assert.throws(()=>assess(v),/ETF_AUDIT_/);});
await test('symbol order does not alter identity matching',()=>{const v=fixture();v.minuteCapture.request.symbols.reverse();v.minuteCapture.response.structuredContent.data.results.reverse();assert.ok(assess(v).assets.every(a=>a.matching===2));});
await test('copied audit alone recovers, preserves old records and creates no plans or imports',()=>{
  const root=temp(),copy=temp();try{const input=fixture(),source=recordRobinhoodEtfBars(root,input.fiveMinuteCapture,at),old=readFileSync(join(root,source.path));
    const saved=recordEtfSourceAudit(root,input,at),target=join(copy,saved.path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,saved.path),target);
    assert.equal(verifyEtfSetup(copy,saved.path).report.assets[0].matching,2);assert.deepEqual(readFileSync(join(root,source.path)),old);assert.ok(!existsSync(join(root,'data/runtime/options-etf-setup/bars')));assert.ok(!existsSync(join(root,'data/runtime/options-etf-setup/plans')));
    const corrupt=JSON.parse(readFileSync(target,'utf8'));corrupt.report.assets[0].sourceQualified=true;corrupt.reportFingerprint=paperFingerprint(corrupt.report);writeFileSync(target,JSON.stringify(corrupt));assert.throws(()=>verifyEtfSetup(copy,saved.path),/AUDIT_RECOMPUTE/);
  }finally{cleanup(root);cleanup(copy);}
});
await test('CLI requires a verified source record and copies both original inputs',async()=>{
  const root=temp();try{const input=fixture(),s=recordRobinhoodEtfBars(root,input.fiveMinuteCapture,at);writeFileSync(join(root,'minute.json'),JSON.stringify(input.minuteCapture));const r=await runEtfSetup(['--audit-source',s.path,'minute.json'],{workspaceRoot:root,now:()=>at});assert.deepEqual(verifyEtfSetup(root,r.path).input,input);assert.equal(r.assets[0].matching,2);await assert.rejects(()=>runEtfSetup(['--audit-source',r.path,'minute.json'],{workspaceRoot:root,now:()=>at}),/SOURCE_RECORD_REQUIRED/);}finally{cleanup(root);}
});
await test('UI exposes differences, quality limitations and unsent questions with escaping',()=>{
  const v=fixture();bar(v).volume++;const r=assess(v),html=etfSourceAuditPanel(r);assert.ok(html.includes('1 different'));assert.ok(html.includes('501'));assert.ok(html.includes('draft, not sent'));assert.ok(html.includes('same')||html.includes('Same'));r.supportQuestions.push('<img src=x>');assert.ok(!etfSourceAuditPanel(r).includes('<img'));assert.equal(etfSourceAuditPanel(null),'');
});
console.log(`ETF source audit: ${passed}/${passed} tests passed.`);
