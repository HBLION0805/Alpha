import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,realpathSync,rmSync,linkSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {assessRobinhoodBarQuality as assess} from '../src/engines/options-robinhood-data/RobinhoodBarQuality.ts';
import {assessRobinhoodCapture} from '../src/engines/options-robinhood-data/RobinhoodCaptureEngine.ts';
import {runRobinhoodCaptureCommand} from './options-robinhood-capture.mjs';
import {readBarQualityDesk,readBarQualityCapture} from './lib/options-bar-quality-io.mjs';
import {runBarQualityCommand} from './options-bar-quality.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {barQualityPanel,candleSeriesCard} from '../apps/options-workbench/bar-quality.js';

const fixture=readFileSync(new URL('../fixtures/options-robinhood-data/capture.synthetic.json',import.meta.url),'utf8');
const at='2026-09-04T14:00:10.000Z';
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const hist=v=>v.calls.find(c=>c.tool==='get_option_historicals');
const bars=v=>hist(v).data.results[0].bars;
function input(){
  const v=JSON.parse(fixture),h=hist(v);h.args.start_time='2026-09-04T13:50:00.000Z';
  h.data.results[0].bars=Array.from({length:10},(_,i)=>({begins_at:new Date(Date.parse(h.args.start_time)+i*60000).toISOString(),open_price:'1.010001',high_price:'1.040000',low_price:'1.000000',close_price:i===9?'1.030001':'1.010005',session:'reg',interpolated:false}));
  return v;
}
const report=v=>assess(JSON.stringify(v),at);
const series=v=>report(v).series[0];
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-bar-test-'));try{await fn(root);}finally{const path=realpathSync(root),rel=relative(realpathSync(tmpdir()),path);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-bar-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(path,{recursive:true,force:true});}}
function save(root,v=input(),time=at){const path=v.captureId+'-input.json';writeFileSync(resolve(root,path),JSON.stringify(v));return runRobinhoodCaptureCommand(['--inspect',path,'--save'],{workspaceRoot:root,now:()=>time}).persistence.path;}
function rewrite(root,path,fn){const r=JSON.parse(readFileSync(resolve(root,path),'utf8'));fn(r);const {artifactSha256,...payload}=r;r.artifactSha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');writeFileSync(resolve(root,path),JSON.stringify(r));}

await test('complete source-declared OHLC retains exact rational return and no trading authority',()=>{
  const r=report(input()),s=r.series[0];assert.equal(s.status,'COMPLETE_DECLARED_OHLC');assert.equal(s.counts.declaredNoninterpolated,10);
  assert.deepEqual(s.windowReturnBps,{numerator:'200000000',denominator:'1010001'});assert.equal(s.longestDeclaredRun,10);
  assert.equal(r.status,'NO_REPLAY');assert.equal(r.executionAllowed,false);assert.equal(s.signalAllowed,false);assert.equal(s.stopTargetPathQualified,false);
  assert.equal(s.volumeAvailable,false);assert.equal(s.underlyingCandlesAvailable,false);assert.equal(s.exchangeCalendarQualified,false);assert.equal(r.winProbability,null);
});
await test('changing source prices do not establish a missing interpolation flag',()=>{const v=input();bars(v).forEach(b=>delete b.interpolated);const s=series(v);assert.equal(s.counts.unknown,10);assert.equal(s.windowReturnBps,null);assert.equal(s.slots[9].source.close_price,'1.030001');});
await test('true interpolation remains excluded from return and uninterrupted run',()=>{const v=input();bars(v)[5].interpolated=true;const s=series(v);assert.equal(s.counts.interpolated,1);assert.equal(s.windowReturnBps,null);assert.equal(s.longestDeclaredRun,5);});
await test('unknown and synthesized slots are counted separately',()=>{const v=input();delete bars(v)[0].interpolated;bars(v)[9].interpolated=true;const s=series(v);assert.deepEqual(s.counts,{declaredNoninterpolated:8,interpolated:1,unknown:1,missing:0});});
for(const [name,index] of [['leading',0],['internal',4],['trailing',9]])await test(name+' missing interval is retained in its exact grid location',()=>{const v=input();bars(v).splice(index,1);const s=series(v);assert.equal(s.expectedSlotCount,10);assert.equal(s.slots[index].status,'MISSING');assert.equal(s.slots[index].source,null);assert.equal(s.counts.missing,1);assert.equal(s.windowReturnBps,null);});
await test('empty resolved history differs from an absent requested response',()=>{const v=input();bars(v).splice(0);let s=series(v);assert.equal(s.counts.missing,10);assert(!s.blockers.includes('HISTORY_RESPONSE_MISSING'));hist(v).data.results=[];s=series(v);assert(s.blockers.includes('HISTORY_RESPONSE_MISSING'));hist(v).data.not_found=hist(v).args.instrument_ids;s=series(v);assert(s.blockers.includes('CONTRACT_NOT_FOUND'));});
await test('five-minute aligned grid uses the declared interval',()=>{const v=input(),h=hist(v);h.args.interval='5minute';h.data.results[0].interval='5minute';h.data.results[0].bars=[bars(v)[0],bars(v)[5]];const s=series(v);assert.equal(s.expectedSlotCount,2);assert.equal(s.counts.declaredNoninterpolated,2);});
await test('repeated historical requests retain independent series instead of merging revisions',()=>{const v=input();v.calls.push(structuredClone(hist(v)));const r=report(v);assert.equal(r.series.length,2);assert.notEqual(r.series[0].key,r.series[1].key);});
function moveWindow(v,start){const h=hist(v),n=Date.parse(start);h.args.start_time=new Date(n).toISOString();h.args.end_time=new Date(n+10*60000).toISOString();bars(v).forEach((b,i)=>b.begins_at=new Date(n+i*60000).toISOString());}
for(const [name,start] of [['weekend','2026-08-30T13:50:00Z'],['pre-open','2026-09-04T13:10:00Z'],['post-close','2026-09-03T20:00:00Z']])await test(name+' range does not produce a qualified session grid',()=>{const v=input();moveWindow(v,start);const s=series(v);assert.equal(s.status,'UNSUPPORTED_WINDOW');assert.equal(s.expectedSlotCount,null);assert.equal(s.windowReturnBps,null);assert.equal(s.slots.length,0);});
await test('winter session envelope follows New York instead of a fixed UTC offset',()=>{const v=input();moveWindow(v,'2026-01-02T14:30:00Z');assert.equal(series(v).counts.declaredNoninterpolated,10);moveWindow(v,'2026-01-02T13:30:00Z');assert.equal(series(v).status,'UNSUPPORTED_WINDOW');});
await test('source nanoseconds cannot be rounded into an exact minute boundary',()=>{const v=input();bars(v)[0].begins_at='2026-09-04T13:50:00.000000001Z';assert.throws(()=>series(v),/BOUNDARY/);});
for(const [name,change,code] of [
  ['duplicate bar',v=>bars(v).splice(1,0,structuredClone(bars(v)[0])),'BAR_CLOCK_OR_ORDER'],
  ['future partial bar',v=>hist(v).args.end_time='2026-09-04T13:59:30.000Z','BAR_CLOCK_OR_ORDER'],
  ['OHLC contradiction',v=>bars(v)[0].low_price='2.0','BAR_OHLC'],
  ['negative price',v=>bars(v)[0].close_price='-1','BAR_PRICE'],
  ['unexpected contract',v=>hist(v).data.results[0].instrument_id='00000000-0000-4000-8000-000000000099','HISTORY_IDENTITY'],
  ['wrong OCC',v=>hist(v).data.results[0].occ_symbol='SPY','HISTORY_CONTRACT'],
  ['missing price',v=>delete bars(v)[0].open_price,'BAR_PRICE'],
  ['invalid interpolation type',v=>bars(v)[0].interpolated=null,'INTERPOLATION_FLAG'],
])await test(name+' is rejected by the unchanged capture validator',()=>{const v=input();change(v);assert.throws(()=>series(v),new RegExp(code));});
await test('projection does not mutate raw source or original assessment',()=>{const v=input(),text=JSON.stringify(v),before=assessRobinhoodCapture(text,at);report(v);assert.equal(JSON.stringify(v),text);assert.deepEqual(assessRobinhoodCapture(text,at),before);});
await test('full-range large decimal return stays exact beyond safe integer intermediate products',()=>{const v=input();bars(v).forEach(b=>Object.assign(b,{open_price:'99999999.000001',high_price:'99999999.999999',low_price:'0.000001',close_price:'0.000001'}));assert.deepEqual(series(v).windowReturnBps,{numerator:'-999999990000000000',denominator:'99999999000001'});});
await test('saved original artifacts recover without the mutable input file',()=>temp(root=>{const v=input(),path=save(root,v);writeFileSync(resolve(root,v.captureId+'-input.json'),'invalid');const before=readFileSync(resolve(root,path));const r=readBarQualityCapture(root,path,at);assert.equal(r.series.length,1);assert(readFileSync(resolve(root,path)).equals(before));assert.equal(runBarQualityCommand(['--inspect',path],{workspaceRoot:root,now:()=>at}).sourceSha256,r.sourceSha256);}));
await test('synthetic histories are excluded and latest market capture never falls back to better provenance',()=>temp(root=>{save(root);assert.equal(readBarQualityDesk(root,at).latest,null);const a=input();a.captureId='first-market';a.declaredOrigin='OWNER_AUTHORIZED_MCP_CAPTURE';save(root,a);const b=input();b.captureId='new-unknown';b.declaredOrigin='OWNER_AUTHORIZED_MCP_CAPTURE';bars(b).forEach(x=>delete x.interpolated);save(root,b,'2026-09-04T14:01:00.000Z');const r=readBarQualityDesk(root,'2026-09-04T14:02:00.000Z');assert.equal(r.latest.captureId,b.captureId);assert.equal(r.latest.series[0].windowReturnBps,null);assert.equal(r.syntheticCaptures,1);}));
await test('corrupt capture prevents silent fallback and unknown partial files are rejected',()=>temp(root=>{const path=save(root);writeFileSync(resolve(root,path),'{}');assert.throws(()=>readBarQualityDesk(root,at),/INTEGRITY/);writeFileSync(resolve(root,'data/runtime/options-robinhood-data/captures/partial.tmp'),'{}');assert.throws(()=>readBarQualityDesk(root,at),/CATALOG_ENTRY/);}));
await test('rehashed altered report still fails original recomputation',()=>temp(root=>{const path=save(root);rewrite(root,path,r=>r.originalAssessment.histories[0].barCount++);assert.throws(()=>readBarQualityCapture(root,path,at),/RECOMPUTE/);}));
await test('later recording cannot enter an earlier assessment',()=>temp(root=>{const path=save(root);assert.throws(()=>readBarQualityCapture(root,path,'2026-09-04T14:00:09.000Z'),/FUTURE/);}));
await test('path traversal hard links and directory junctions are rejected',()=>temp(root=>{const path=save(root);assert.throws(()=>readBarQualityCapture(root,'../escape.json',at),/PATH/);linkSync(resolve(root,path),resolve(root,'data/runtime/options-robinhood-data/captures/linked.json'));assert.throws(()=>readBarQualityCapture(root,path,at));const other=resolve(root,'nested'),target=resolve(root,'target');mkdirSync(other);mkdirSync(target);symlinkSync(target,resolve(other,'data'),process.platform==='win32'?'junction':'dir');assert.throws(()=>readBarQualityDesk(other,at),/DIRECTORY/);}));
await test('unexpected commands cannot initiate market collection or mutation',()=>temp(root=>{for(const a of [[],['--record','anything'],['--inspect'],['--report','extra'],['--fetch']])assert.throws(()=>runBarQualityCommand(a,{workspaceRoot:root,now:()=>at}),/ARGUMENTS/);assert.equal(readBarQualityDesk(root,at).latest,null);}));
await test('frontend unknown bars are gray, excluded bars remain gaps, full source table is escaped',()=>{const v=input();delete bars(v)[0].interpolated;bars(v)[1].interpolated=true;const s=series(v),html=candleSeriesCard(s);assert(html.includes('candle-unknown'));assert(html.includes('candle-gap'));assert(html.includes('1.010001'));assert(html.includes('Unavailable'));s.symbol='<img src=x onerror=alert(1)>';const escaped=candleSeriesCard(s);assert(!escaped.includes('<img'));assert(escaped.includes('&lt;img'));});
await test('frontend displays source clocks and unknown provenance without a live-price claim',()=>{const r=report(input()),html=barQualityPanel({state:'AVAILABLE',data:{latest:r,captures:[],syntheticCaptures:0}},'2026-09-04T15:00:10.000Z');assert(html.includes('60 min since receipt'));assert(html.includes('retrospective histories'));assert(html.includes('do not fill prospective'));assert(barQualityPanel({state:'BLOCKED',error:'<script>'},at).includes('&lt;script&gt;'));});
await test('local HTTP exposes the saved projection and asset with no bar mutation route',()=>temp(async root=>{const v=input();v.declaredOrigin='OWNER_AUTHORIZED_MCP_CAPTURE';save(root,v);const before=readFileSync(resolve(root,'data/runtime/options-robinhood-data/captures/'+v.captureId+'.json'));const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at});try{const r=await(await fetch(app.url+'/api/state')).json();assert.equal(r.barQuality.state,'AVAILABLE');assert.equal(r.barQuality.data.latest.series.length,1);assert.equal(r.executionAllowed,false);const asset=await fetch(app.url+'/bar-quality.js');assert.equal(asset.status,200);assert(asset.headers.get('content-security-policy').includes("connect-src 'self'"));assert.equal((await fetch(app.url+'/api/bar-quality',{method:'POST'})).status,404);assert(readFileSync(resolve(root,'data/runtime/options-robinhood-data/captures/'+v.captureId+'.json')).equals(before));}finally{await app.close();}}));
console.log(passed+'/'+passed+' tests passed.');
