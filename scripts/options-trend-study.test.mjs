import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {TREND_RULES_V1,futureTrendDates,validateTrendStudy,trendNyClock,assessTrendDay,trendObservationDiagnostics,trendObservationWindow} from '../src/engines/options-daily-guidance/OptionsTrendStudy.ts';
import {registerTrendStudy,observeTrendStudies,observeTrendStudiesSafely,trendStudyView,verifyTrendRecord,trendStudyTracking} from './lib/options-trend-study-io.mjs';
import {paperCollectionSchedule} from '../src/engines/options-robinhood-data/OptionsPaperCollectionPlan.ts';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {recordRobinhoodEtfBars} from './lib/options-etf-setup-io.mjs';
import {saveGuidanceSettings,normalizeGuidanceCapture} from './lib/options-guidance-io.mjs';
import {collectGuidanceMarket} from './lib/options-guidance-host.mjs';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {trendStudyPanel} from '../apps/options-workbench/trend-study.js';
import {startOptionsWorkbench} from './options-workbench.mjs';

const registered='2026-09-18T01:00:00.000Z',date='2026-09-18';
const at=n=>new Date(Date.parse(date+'T14:40:00.000Z')+n*1000).toISOString();
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const settings=()=>({currentEquityCents:100000,settledCashCents:100000,roundTripFeesCents:null,slippageReserveCents:null,stopLossBps:2000,rewardMultipleMilliR:2000,tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}});
const study=()=>({version:'OPTIONS_TREND_STUDY_V1',id:'forward-test',registeredAt:registered,dates:futureTrendDates(registered),settings:settings(),rules:TREND_RULES_V1});
function source({flags=false,bear=false,count=14}={}){
  return {tool:'get_equity_historicals',request:{symbols:['IBIT'],start_time:date+'T13:30:00Z',end_time:new Date(Date.parse(date+'T13:30:00Z')+count*300000).toISOString(),interval:'5minute',bounds:'regular',adjustment_type:'none'},requestedAt:at(1),receivedAt:at(1),response:{structuredContent:{data:{results:[{symbol:'IBIT',interval:'5minute',bounds:'regular',bars:Array.from({length:count},(_,i)=>{const close=bear?(i<12?43.2-i/100:i===12?43.01:43):(i<12?43+i/100:i===12?43.18:43.19);return {begins_at:new Date(Date.parse(date+'T13:30:00Z')+i*300000).toISOString(),open_price:close.toFixed(6),high_price:(close+0.005).toFixed(6),low_price:(close-0.005).toFixed(6),close_price:close.toFixed(6),volume:i<12?100:200,session:'reg',...(flags===null?{}:{interpolated:flags})};})}]}}}};
}
const bars=s=>s.response.structuredContent.data.results[0].bars;
function frame(n=1,{bid=145,ask=150,type='call'}={}){return {path:`data/runtime/options-daily-guidance/captures/${date}/f${n}.json`,sha256:'a'.repeat(64),recordedAt:at(n),capturedAt:at(n),origin:'SYNTHETIC_FIXTURE',quotes:[{id:uid(10),symbol:'IBIT',expiry:'2026-10-09',type,strike:'43',multiplier:100,bidCents:bid,askCents:ask,tickCents:1,bidSize:20,askSize:20,delta:type==='call'?0.5:-0.5,updatedAt:at(n),receivedAt:at(n),underlyingPriceCents:null,underlyingPriceUsd:'43.195000',underlyingAt:at(n),aboveTickCents:5,belowTickCents:1,cutoffCents:300,chainSession:{chainId:uid(2),lateCloseState:'enabled',receivedAt:at(n)}}]};}
const event=(n=2,s=source(),f=frame(n-1))=>({at:at(n),source:s,audit:null,frame:f});
const input=()=>({study:study(),date,at:at(2),events:[event()]});
const ibit=i=>assessTrendDay(i).assets[1];
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-trend-study-'));try{await fn(root);}finally{const rel=relative(resolve(tmpdir()),resolve(root));assert.ok(!isAbsolute(rel)&&!rel.startsWith('..')&&rel.startsWith('alpha-trend-study-'));rmSync(root,{recursive:true,force:true});}}

await test('twenty future sessions, weekend and holiday exclusion, DST clock',()=>{
 const s=study();validateTrendStudy(s);assert.equal(s.dates[0],date);assert.equal(s.dates.length,20);assert.ok(!s.dates.includes('2026-09-19'));
 assert.equal(futureTrendDates('2026-09-04T21:00:00.000Z')[0],'2026-09-08');
 assert.equal(trendNyClock('2026-11-27',760),'2026-11-27T17:40:00.000Z');
 assert.throws(()=>validateTrendStudy({...s,dates:['2026-09-17',...s.dates.slice(1)]}),/PROSPECTIVE/);
 assert.throws(()=>validateTrendStudy({...s,rules:{...s.rules,targetDte:30}}),/RULE_VERSION/);
});
await test('two closes create prospective selection, not a same-quote fill',()=>{
 const i=input(),before=JSON.stringify(i),a=ibit(i);assert.ok(a.decision.plan,JSON.stringify(a));assert.equal(a.decision.signal.at,at(0));assert.equal(a.status,'AWAITING_LATER_ENTRY_QUOTE');assert.equal(a.paper.fills.length,0);assert.equal(a.decision.plan.settings.roundTripFeesCents,null);assert.equal(JSON.stringify(i),before);
});
await test('bullish trend without second close cannot create a signal',()=>{const i=input();i.events[0].source=source({count:13});assert.equal(ibit(i).decision,null);});
await test('downward trend chooses put',()=>{const i=input();i.events=[event(2,source({bear:true}),frame(1,{type:'put'}))];assert.equal(ibit(i).decision.signal.side,'BEARISH');assert.ok(ibit(i).decision.plan);});
for(const [name,change] of [
 ['volume',b=>b[13].volume=100],['chase',b=>{b[13].close_price=b[13].open_price='44';b[13].high_price='44.01';b[13].low_price='43.99';}],
 ['mixed baseline',b=>{for(const x of b.slice(0,12)){x.open_price=x.close_price='43';x.high_price='43.01';x.low_price='42.99';}}]
])await test(name+' cannot confirm entry',()=>{const i=input();change(bars(i.events[0].source));assert.equal(ibit(i).decision,null);});
await test('unknown flags retain shadow signal but cannot create a paper plan',()=>{const i=input();i.events[0].source=source({flags:null});const a=ibit(i);assert.equal(a.status,'SIGNAL_BLOCKED');assert.ok(a.decision.blockers.includes('INTERPOLATION_UNKNOWN'));assert.equal(a.decision.plan,null);});
for(const [name,change] of [['interpolated',b=>b[0].interpolated=true],['missing',b=>b.splice(1,1)],['invalid OHLC',b=>b[0].high_price='42']])await test(name+' data blocks the setup',()=>{const i=input();change(bars(i.events[0].source));const a=ibit(i);assert.equal(a.decision,null);assert.ok(a.checks[0].codes.length);});
await test('late first processing cannot backfill a historical signal',()=>{const i=input();i.at=at(500);i.events[0].at=i.at;const a=ibit(i);assert.ok(a.decision.blockers.includes('FIRST_SIGNAL_WINDOW_MISSED'));assert.equal(a.decision.plan,null);});
await test('baseline revisions are retained and cannot choose the revised winner',()=>{const i=input();const early=source({count:12});early.requestedAt=early.receivedAt=date+'T14:30:01.000Z';const later=source();bars(later)[0].volume=101;i.events=[{at:date+'T14:30:02.000Z',source:early,audit:null,frame:null},event(2,later)];const a=ibit(i);assert.equal(a.baselineAt,date+'T14:30:02.000Z');assert.equal(a.conflictingBars.length,1);assert.ok(a.decision.blockers.includes('SOURCE_REVISIONS_OR_AUDIT_CONFLICT'));});
await test('a matching cross-interval audit conflict blocks the first signal',()=>{
 const i=input(),five=i.events[0].source,minute=structuredClone(five);minute.request.interval='minute';minute.response.structuredContent.data.results[0].interval='minute';
 minute.response.structuredContent.data.results[0].bars=bars(five).flatMap(b=>Array.from({length:5},(_,j)=>({...b,begins_at:new Date(Date.parse(b.begins_at)+j*60000).toISOString(),volume:b.volume/5})));
 bars(minute)[0].volume++;i.events[0].audit={fiveMinuteCapture:five,minuteCapture:minute};const a=ibit(i);assert.equal(a.decision.plan,null);assert.ok(a.decision.blockers.includes('SOURCE_REVISIONS_OR_AUDIT_CONFLICT'));
});
await test('partial later history cannot omit an earlier failed opportunity',()=>{
 const i=input(),first=source({count:12});first.requestedAt=first.receivedAt=date+'T14:30:01.000Z';const later=source();later.request.start_time=date+'T14:30:00Z';later.response.structuredContent.data.results[0].bars=bars(later).slice(12);
 i.events=[{at:date+'T14:30:02.000Z',source:first,audit:null,frame:null},event(2,later)];const a=ibit(i);assert.equal(a.decision,null);assert.ok(a.checks.at(-1).codes.includes('OPENING_TO_CURRENT_WINDOW_REQUIRED'));
});
await test('unknown baseline remains unknown after a later flag is supplied',()=>{const i=input(),early=source({count:12,flags:null});early.requestedAt=early.receivedAt=date+'T14:30:01.000Z';i.events=[{at:date+'T14:30:02.000Z',source:early,audit:null,frame:null},event()];assert.ok(ibit(i).decision.blockers.includes('INTERPOLATION_UNKNOWN'));});
await test('first blocked signal is frozen even when a later quote improves',()=>{const i=input();i.events[0].frame=null;i.events.push(event(20,source(),frame(19)));i.at=at(20);assert.equal(ibit(i).decision.plan,null);assert.equal(ibit(i).decision.at,at(2));});
for(const [name,change,code] of [
 ['side',q=>q.type='put','OPPOSITE_SIDE'],['expiry',q=>q.expiry='2026-09-25','DTE_OUTSIDE_14_45'],
 ['delta',q=>q.delta=0.1,'DELTA_OUTSIDE_RULE'],['wide spread',q=>q.bidCents=120,'SPREAD_EXCEEDED'],
 ['zero bid',q=>q.bidCents=0,'EXECUTABLE_SIDES_MISSING'],['missing size',q=>q.askSize=null,'EXECUTABLE_SIDES_MISSING'],
 ['old pre-signal quote',q=>q.updatedAt=at(-1),'QUOTE_NOT_CURRENT_AFTER_SIGNAL'],['fractional unsupported option money',q=>q.askCents=150.5,'PRICE_OR_TICK_INVALID'],
 ['unaffordable',q=>{q.askCents=600;q.bidCents=595;},'ALLOCATION_BUDGET_EXCEEDED']
])await test(name+' remains a recorded rejected candidate',()=>{const i=input();change(i.events[0].frame.quotes[0]);const a=ibit(i);assert.equal(a.decision.plan,null);assert.ok(a.decision.candidates[0].blockers.includes(code),JSON.stringify(a.decision.candidates[0].blockers));});
await test('ranking is stable and does not choose the cheapest by default',()=>{const i=input(),q=i.events[0].frame.quotes[0];i.events[0].frame.quotes.push({...q,id:uid(11),bidCents:110,askCents:115,delta:0.4});const a=ibit(i);i.events[0].frame.quotes.reverse();assert.equal(ibit(i).decision.plan.contract.id,a.decision.plan.contract.id);assert.equal(a.decision.plan.contract.id,uid(10));});
await test('independent later ask then bid produce estimated net outcome',()=>{const i=input();i.events.push(event(4,source(),frame(3)),event(24,source(),frame(23,{bid:220,ask:225})));i.at=at(24);const a=ibit(i);assert.equal(a.status,'CLOSED_MODELED');assert.equal(a.paper.fills[0].receivedAt,at(3));assert.equal(a.paper.fills[1].reason,'TARGET');assert.equal(a.paper.account.netPnlCents,6891);assert.equal(a.paper.review.outcome,'WIN');assert.equal(a.paper.executionAllowed,false);});
await test('missing exit quotes leave open exposure, overdue time and unknown net result',()=>{const i=input();i.events.push(event(4,source(),frame(3)));i.at=date+'T19:41:00.000Z';const a=ibit(i);assert.equal(a.status,'OPEN_UNRESOLVED');assert.equal(a.paper.account.netPnlCents,null);assert.equal(a.monitor.overdueTimeExit,true);assert.equal(a.monitor.staleWhileOpen,true);assert.ok(a.lessons.some(l=>l.code==='UNOBSERVED_QUOTE_PATH'));});
await test('fresh but unusable exit quote is diagnosed independently from staleness',()=>{const i=input(),f=frame(23);f.quotes[0].underlyingAt=null;i.events.push(event(4,source(),frame(3)),event(24,source(),f));i.at=at(24);const a=ibit(i);assert.equal(a.status,'OPEN_UNRESOLVED');assert.equal(a.monitor.staleWhileOpen,false);assert.equal(a.monitor.unusableWhileOpen,true);assert.ok(a.lessons.some(l=>l.code==='EXIT_QUOTE_UNUSABLE'));});
await test('independent stop can exceed planned risk and cannot be revised by a rebound',()=>{const i=input();i.events.push(event(4,source(),frame(3)),event(100,source(),frame(99,{bid:80,ask:85})),event(110,source(),frame(109,{bid:220,ask:225})));i.at=at(110);const a=ibit(i);assert.equal(a.paper.fills[1].reason,'STOP');assert.equal(a.paper.account.netPnlCents,-7109);assert.equal(a.paper.review.outcome,'LOSS');assert.ok(a.monitor.pathGap);});
await test('repeated source update cannot serve as an independent outcome',()=>{const i=input(),f=frame(20,{bid:220,ask:225});f.quotes[0].updatedAt=at(3);i.events.push(event(4,source(),frame(3)),event(21,source(),f));i.at=at(21);assert.equal(ibit(i).paper.fills.length,1);});
await test('future event and same-path altered quote are rejected',()=>{const i=input();i.events[0].at=at(3);assert.throws(()=>ibit(i),/EVENT_ORDER/);const j=input(),e=structuredClone(j.events[0]);e.at=at(4);e.frame.quotes[0].bidCents=140;j.events.push(e);j.at=at(4);assert.throws(()=>ibit(j),/FRAME_CONFLICT/);});
await test('missing whole session stays missing, not a loss or a tested no-trigger',()=>{const i=input();i.at=date+'T21:00:00.000Z';i.events=[{at:i.at,source:null,audit:null,frame:null}];const r=assessTrendDay(i);assert.equal(r.assets[0].status,'DATA_MISSING');assert.equal(r.counts.entries,0);assert.equal(r.winProbability,null);});

async function saveMarket(root,n,bid='1.45',ask='1.50',origin='SYNTHETIC_FIXTURE'){
 let seq=10;const instruments=new Map();const input=await collectGuidanceMarket({clock:async()=>at(n),call:async(tool,request)=>{
  if(tool==='get_equity_quotes')return {data:{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'43.195000',venue_last_trade_time:at(n),last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}))}};
  if(tool==='get_option_chains')return {data:{chains:[{id:uid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,late_close_state:'enabled',expiration_dates:['2026-10-09']}]}};
  if(tool==='get_option_instruments'){const symbol=request.chain_id===uid(1)?'GLD':'IBIT',list=['call','put'].map(type=>({id:uid(seq++),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:'2026-10-09',type,strike_price:'43',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}));list.forEach(i=>instruments.set(i.id,i));return {data:{instruments:list,next:null}};}
  if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:bid,ask_price:ask,bid_size:20,ask_size:20,delta:instruments.get(id).type==='call'?'0.5':'-0.5',updated_at:at(n)}}))}};
  throw Error('UNEXPECTED_TOOL');
 }});input.origin=origin;const report=normalizeGuidanceCapture(input),record={version:'OPTIONS_GUIDANCE_RECORD_V1',kind:'captures',recordedAt:at(n),input,report,inputFingerprint:paperFingerprint(input),reportFingerprint:paperFingerprint(report)},path=frame(n).path;mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),JSON.stringify(record));
}
await test('registration, idempotent recording, actual adapter lifecycle and copied-only recovery',()=>temp(async root=>temp(async copy=>{
 saveGuidanceSettings(root,settings());const r=registerTrendStudy(root,'forward-test',registered);verifyTrendRecord(root,r.path);assert.throws(()=>registerTrendStudy(root,'duplicate-test',registered),/COHORT_ALREADY_ACTIVE/);
 recordRobinhoodEtfBars(root,source(),at(1));await saveMarket(root,1);const first=observeTrendStudies(root,at(2));assert.equal(first.results[0].error,null,JSON.stringify(first));
 assert.equal(observeTrendStudies(root,at(2)).results.length,0);
 await saveMarket(root,3);observeTrendStudies(root,at(4));await saveMarket(root,23,'2.20','2.25');const pass=observeTrendStudies(root,at(24));assert.equal(pass.results[0].error,null,JSON.stringify(pass));
 const view=trendStudyView(root,at(24)),d=view.studies[0].days[0];assert.equal(d.report.assets[1].status,'CLOSED_MODELED');assert.equal(view.studies[0].counts.closed,1);
 const target=resolve(copy,d.path);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(root,d.path),target);assert.equal(verifyTrendRecord(copy,d.path).report.counts.closed,1);
 const bad=JSON.parse(readFileSync(target,'utf8'));bad.report.counts.closed=2;const {fingerprint,...payload}=bad;bad.fingerprint=paperFingerprint(payload);writeFileSync(target,JSON.stringify(bad));assert.throws(()=>verifyTrendRecord(copy,d.path),/RECOMPUTE/);
})));
await test('late restart records gaps once without enrolling old engineering plans',()=>temp(async root=>{
 saveGuidanceSettings(root,settings());registerTrendStudy(root,'forward-test',registered);const t='2026-09-21T21:00:00.000Z';const pass=observeTrendStudies(root,t);assert.equal(pass.results.length,2);assert.ok(pass.results.every(r=>r.error===null));assert.equal(observeTrendStudies(root,t).results.length,0);const view=trendStudyView(root,t);assert.equal(view.studies[0].counts.entries,0);assert.equal(view.studies[0].days[0].report.assets[1].status,'DATA_MISSING');
}));
await test('frontend shows denominator, saved clocks, unknown outcomes and escaped labels',()=>temp(async root=>{
 saveGuidanceSettings(root,settings());registerTrendStudy(root,'forward-test',registered);const desk=trendStudyView(root,registered);let html=trendStudyPanel({data:desk});assert.ok(html.includes('0 / 20'));assert.ok(html.includes('No extra market')||html.includes('no extra market'));desk.collectionGap='<img src=x>';html=trendStudyPanel({data:desk});assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('actual costs unknown'));assert.equal(trendStudyPanel(null),'');
}));
await test('static frontend and protected observation action preserve local-only boundary',async()=>{
 const app=await startOptionsWorkbench({port:0,refreshContext:false});try{assert.equal((await fetch(app.url+'/trend-study.js')).status,200);assert.equal((await fetch(app.url+'/api/etf-setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'OBSERVE_TREND',request:null})})).status,403);}finally{await app.close();}
});
await test('browser request helper can record saved evidence through the protected route',()=>temp(async root=>{
 const app=await startOptionsWorkbench({port:0,workspaceRoot:root,refreshContext:false}),originalFetch=globalThis.fetch,originalLocation=globalThis.location;
 globalThis.location={origin:app.url};globalThis.fetch=(path,options)=>originalFetch(app.url+path,{...options,headers:{...options.headers,Origin:app.url}});
 try{const {request}=await import('../apps/options-workbench/api.js');await request('/api/state');const result=await request('/api/etf-setup',{action:'OBSERVE_TREND',request:null});assert.deepEqual(result.results,[]);assert.equal(result.sourceReads,0);assert.equal(result.executionAllowed,false);await assert.rejects(()=>request('/api/orders',{}),/Unsupported/);}
 finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;await app.close();}
}));
await test('corrupt research store reports failure without blocking canonical publication caller',()=>temp(async root=>{
 const dir=resolve(root,'data/runtime/options-trend-study/broken-study');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'registration.json'),'{');
 const result=observeTrendStudiesSafely(root,registered);assert.equal(result.status,'FAILED');assert.equal(result.error,'TREND_STUDY_LOCAL_FAILURE');assert.equal(result.sourceReads,0);assert.deepEqual(result.results,[]);
}));
const observation=i=>trendObservationDiagnostics(i).assets[1];
await test('opening baseline alone is insufficient observation without rewriting the frozen no-entry report',()=>{
 const s=source({count:12});s.requestedAt=s.receivedAt=date+'T14:30:01.000Z';
 const i={study:study(),date,at:date+'T21:00:00.000Z',events:[{at:date+'T14:30:02.000Z',source:s,audit:null,frame:null}]};
 const before=paperFingerprint(assessTrendDay(i)),o=observation(i);assert.equal(ibit(i).status,'NO_ENTRY');
 assert.equal(o.classification,'INSUFFICIENT_OBSERVATION');assert.equal(o.coverage.required,47);assert.equal(o.coverage.timely,0);assert.equal(o.coverage.missing.length,47);assert.equal(paperFingerprint(assessTrendDay(i)),before);
});
function noSignalDay(flags=false){
 const i={study:study(),date,at:date+'T21:00:00.000Z',events:[]};
 for(let count=14;count<=60;count++){
  const s=source({count,flags});for(const b of bars(s).slice(12)){b.open_price=b.close_price='43.12';b.high_price='43.125';b.low_price='43.115';b.volume=100;}
  const end=Date.parse(s.request.end_time);s.requestedAt=s.receivedAt=new Date(end+1000).toISOString();
  i.events.push({at:new Date(end+2000).toISOString(),source:s,audit:null,frame:null});
 }
 return i;
}
await test('full timely no-signal coverage differs from late downloads, unknown flags and a missed close',()=>{
 const i=noSignalDay(),complete=observation(i);assert.equal(complete.classification,'FULLY_OBSERVED_NO_SIGNAL');assert.equal(complete.coverage.timely,47);
 const missed=structuredClone(i);missed.events.splice(20,1);assert.equal(observation(missed).classification,'INSUFFICIENT_OBSERVATION');assert.equal(observation(missed).coverage.missing.length,1);
 const late=structuredClone(i);late.events=[late.events.at(-1)];assert.equal(observation(late).coverage.timely,1);assert.equal(observation(late).classification,'INSUFFICIENT_OBSERVATION');
 assert.equal(observation(noSignalDay(null)).coverage.timely,0);assert.equal(observation(noSignalDay(null)).classification,'INSUFFICIENT_OBSERVATION');
 const revise=structuredClone(i);bars(revise.events[1].source)[0].volume++;assert.equal(observation(revise).classification,'INSUFFICIENT_OBSERVATION');assert.ok(observation(revise).coverage.qualityCodes.includes('SOURCE_REVISIONS_OR_AUDIT_CONFLICT'));
});
await test('blocked first signals and expired entry windows have separate denominators',()=>{
 const i=input();i.events[0].source=source({flags:null});assert.equal(observation(i).classification,'SIGNAL_BLOCKED');
 const j=input();j.at=at(400);assert.equal(observation(j).classification,'ENTRY_NOT_OBSERVED');assert.equal(observation(j).exit.netPnlCents,null);
});
await test('entry and repeated source clocks cannot be labelled independent exit observations',()=>{
 const i=input();i.events.push(event(4,source(),frame(3)));i.at=at(4);let o=observation(i);
 assert.equal(o.exit.latestSelectedQuoteAt,at(3));assert.equal(o.exit.independentQuoteAt,null);assert.equal(o.classification,'OPEN_UNRESOLVED');assert.equal(o.exit.monitoringInterrupted,false);
 const f=frame(20,{bid:220,ask:225});f.quotes[0].updatedAt=at(3);i.events.push(event(21,source(),f));i.at=at(21);o=observation(i);
 assert.equal(o.exit.independentQuoteAt,null);assert.ok(o.exit.latestRejectionCodes.includes('CONFLICTING_SOURCE_UPDATE'));assert.equal(o.exit.modeledExitAt,null);
});
await test('current read-only clock exposes stale monitoring and overdue exit without mutating saved input',()=>{
 const i=input();i.events.push(event(4,source(),frame(3)),event(24,source(),frame(23)));i.at=at(24);const before=JSON.stringify(i);
 let o=observation(i);assert.equal(o.exit.independentQuoteAt,at(23));assert.equal(o.exit.monitoringInterrupted,false);
 o=trendObservationDiagnostics(i,date+'T19:41:00.000Z').assets[1];assert.equal(o.exit.monitoringInterrupted,true);assert.equal(o.exit.overdueUnresolved,true);assert.equal(o.exit.netPnlCents,null);assert.equal(JSON.stringify(i),before);
});
await test('later time-exit evidence uses its real receipt and retains the unobserved price path',()=>{
 const i=input(),n=(Date.parse(date+'T19:50:00.000Z')-Date.parse(at(0)))/1000;
 i.events.push(event(4,source(),frame(3)),event(n+1,source(),frame(n)));i.at=at(n+1);const o=observation(i);
 assert.equal(o.classification,'CLOSED_MODELED');assert.equal(o.exit.reason,'TIME_EXIT');assert.equal(o.exit.modeledExitAt,date+'T19:50:00.000Z');assert.equal(o.exit.plannedAt,date+'T19:40:00.000Z');assert.equal(o.exit.lateExitSeconds,600);assert.equal(o.exit.pathUnknown,true);assert.equal(o.exit.actualFeesKnown,false);
});
await test('contract explanation preserves ranking and distinguishes filtering from selection and scenarios',()=>{
 const i=input(),q=i.events[0].frame.quotes[0];i.events[0].frame.quotes.push({...q,id:uid(11),delta:0.4,bidCents:110,askCents:115});
 const o=observation(i);assert.equal(o.candidates[0].selected,true);assert.equal(o.candidates[1].selected,false);assert.equal(o.candidates[1].screening,'PASSED_FILTERS');assert.equal(o.candidates[0].premiumAtAskCents,15000);assert.equal(o.candidates[0].preExpiryScenario,'NOT_ASSESSED');assert.equal(o.candidates[0].strategyBenefit,'NOT_ESTABLISHED');
});
await test('dated nominal schedules preserve disabled cadence, event uncertainty, holidays and early closes',()=>{
 const c={state:'AVAILABLE',sources:[],events:[]};
 assert.deepEqual(paperCollectionSchedule(date,registered,c).wakes.filter(w=>w.basis==='ROUTINE').map(w=>w.localTime),['15:50']);
 assert.equal(paperCollectionSchedule('2026-09-19',registered,c).wakes.length,0);
 assert.equal(paperCollectionSchedule('2026-11-27',registered,c).wakes.some(w=>w.basis==='ROUTINE'),false);
 assert.ok(paperCollectionSchedule(date,registered,{...c,state:'STALE'}).wakes.some(w=>w.basis==='EVENT_UNCONFIRMED'));
 const early=trendObservationWindow(study(),'2026-11-27');assert.equal(early.endAt,'2026-11-27T16:50:00.000Z');assert.equal(early.timeExitAt,'2026-11-27T17:40:00.000Z');
});
await test('existing Host source includes active trend identities within the shared limit and drops closed plans',()=>temp(async root=>{
 saveGuidanceSettings(root,settings());registerTrendStudy(root,'forward-test',registered);recordRobinhoodEtfBars(root,source(),at(1));
 await saveMarket(root,1,'1.45','1.50','HOST_MARKET_TOOL_RESPONSES');observeTrendStudies(root,at(2));
 const t=trendStudyTracking(root,at(2),[]),q=t.trackedContracts[0];assert.equal(t.rows[0].status,'INCLUDED');assert.equal(t.trackedContracts.length,1);
 const full=Array.from({length:6},(_,j)=>({...q,id:uid(100+j)}));assert.equal(trendStudyTracking(root,at(2),full).rows[0].status,'CAPACITY_WAIT');assert.deepEqual(trendStudyTracking(root,at(2),full).trackedContracts,full);
 assert.equal(trendStudyTracking(root,at(2),[q]).rows[0].status,'SHARED_EXISTING_ID');assert.equal(trendStudyTracking(root,at(2),[{...q,strike:'99'}]).rows[0].status,'IDENTITY_CONFLICT');
 const host=await runGuidanceCommand(['--host-source'],{workspaceRoot:root,now:()=>at(2)});assert.equal(host.trackedContracts,1);assert.ok(host.source.includes(q.id));assert.equal(host.trendTracking[0].status,'INCLUDED');
 assert.equal(trendStudyTracking(root,at(400),[]).rows[0].status,'ENTRY_WINDOW_ENDED');
 await saveMarket(root,3,'1.45','1.50','HOST_MARKET_TOOL_RESPONSES');observeTrendStudies(root,at(4));assert.equal(trendStudyTracking(root,at(400),[]).trackedContracts.length,1);
 await saveMarket(root,23,'2.20','2.25','HOST_MARKET_TOOL_RESPONSES');observeTrendStudies(root,at(24));assert.equal(trendStudyTracking(root,at(24),[]).trackedContracts.length,0);
}));
await test('synthetic plans never become Host tracking; read-only view preserves record bytes and renders new diagnostics',()=>temp(async root=>{
 saveGuidanceSettings(root,settings());registerTrendStudy(root,'forward-test',registered);recordRobinhoodEtfBars(root,source(),at(1));await saveMarket(root,1);observeTrendStudies(root,at(2));await saveMarket(root,3);const pass=observeTrendStudies(root,at(4));
 const path=resolve(root,pass.results[0].path),before=readFileSync(path,'utf8'),v=trendStudyView(root,date+'T19:41:00.000Z');assert.equal(v.tracking.rows[0].status,'SYNTHETIC_NOT_HOST_TRACKED');assert.equal(v.studies[0].days[0].observation.assets[1].exit.overdueUnresolved,true);assert.equal(v.studies[0].collectionProposal.enabled,false);assert.equal(readFileSync(path,'utf8'),before);
 const html=trendStudyPanel({data:v});assert.ok(html.includes('accepted independent quote after entry'));assert.ok(html.includes('NOT ASSESSED'));assert.ok(html.includes('Time exit is overdue'));assert.ok(html.includes('frequency proposal disabled'));assert.ok(!html.includes('<p>Independent quote '));
}));
await test('an unresolved prior-session entry can consume a fresh later-session exit without backdating or reopening closures',()=>temp(async root=>{
 saveGuidanceSettings(root,settings());registerTrendStudy(root,'forward-test',registered);recordRobinhoodEtfBars(root,source(),at(1));await saveMarket(root,1);observeTrendStudies(root,at(2));await saveMarket(root,3);observeTrendStudies(root,at(4));
 const closedClock=date+'T21:00:00.000Z';observeTrendStudies(root,closedClock);const before=trendStudyView(root,closedClock).studies[0].days[0];assert.equal(before.report.assets[1].status,'OPEN_UNRESOLVED');const bytes=readFileSync(resolve(root,before.path),'utf8');
 const n=3*86400+23;await saveMarket(root,n);const pass=observeTrendStudies(root,at(n+1));assert.ok(pass.results.every(r=>r.error===null));
 const after=trendStudyView(root,at(n+1)).studies[0].days[0];assert.equal(after.report.assets[1].status,'CLOSED_MODELED');assert.equal(after.report.assets[1].paper.fills[1].receivedAt,at(n));assert.equal(after.report.assets[1].paper.fills[1].reason,'TIME_EXIT');assert.equal(after.observation.assets[1].exit.pathUnknown,true);assert.equal(readFileSync(resolve(root,before.path),'utf8'),bytes);
 await saveMarket(root,n+20,'2.20','2.25');observeTrendStudies(root,at(n+21));assert.equal(trendStudyView(root,at(n+21)).studies[0].days[0].path,after.path);
}));
console.log(`Prospective trend study: ${passed}/${passed} tests passed.`);
