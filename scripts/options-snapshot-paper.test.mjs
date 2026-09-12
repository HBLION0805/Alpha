import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {snapshotNs,snapshotCents,assessSnapshotQuote,replaySnapshotPaper,validateSnapshotPlan,snapshotEntryEconomics} from '../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {defaultGuidanceSettings,assessDailyGuidance} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperEventKey} from '../src/engines/options-robinhood-data/OptionsPaperEventPlan.ts';
import {collectGuidanceMarket} from './lib/options-guidance-host.mjs';
import {normalizeGuidanceCapture,saveGuidanceSettings,guidanceView} from './lib/options-guidance-io.mjs';
import {mapSnapshotSource,snapshotSources,previewSnapshotPaper,registerSnapshotPaper,saveSnapshotPaperReport,verifySnapshotPaper,snapshotPaperView,saveSnapshotObservation,snapshotObservationEnd} from './lib/options-snapshot-paper-io.mjs';
import {enrollPaperObservation,cancelPaperObservation,paperObservationView,observePaperPlans,combinePaperTracking,savedPaperProcessReview} from './lib/options-paper-observation-io.mjs';
import {runLocalPaperFinalization,startPublicContextService} from './options-context-service.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {verifyGuidanceRecord} from './lib/options-guidance-io.mjs';
import {snapshotRequest,snapshotResult,snapshotPaperPanel,localPaperServicePanel,savedProcessReview,paperEventPanel} from '../apps/options-workbench/snapshot-paper.js';
import {request as browserRequest} from '../apps/options-workbench/api.js';
import {startOptionsWorkbench} from './options-workbench.mjs';

const at=n=>new Date(Date.parse('2026-09-08T14:00:00.000Z')+n*1000).toISOString();
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const settings=()=>({...defaultGuidanceSettings(),tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}});
const q=(n,bid=199,ask=200)=>({id:uid(10),symbol:'GLD',expiry:'2026-09-25',type:'call',strike:'400',multiplier:100,bidCents:bid,askCents:ask,tickCents:1,bidSize:20,askSize:20,delta:0.5,updatedAt:at(n),receivedAt:at(n),underlyingPriceCents:40000,underlyingAt:at(n),aboveTickCents:5,belowTickCents:1,cutoffCents:300});
const frame=(n,bid=199,ask=200)=>({path:'data/runtime/options-daily-guidance/captures/2026-09-08/f'+n+'.json',sha256:'a'.repeat(64),recordedAt:at(n),capturedAt:at(n),origin:'SYNTHETIC_FIXTURE',quotes:[q(n,bid,ask)]});
const plan=()=>({version:'OPTIONS_SNAPSHOT_PAPER_PLAN_V1',id:'synthetic-case',createdAt:at(1),contract:q(0),selectionPath:frame(0).path,decisionAt:at(2),entryDeadlineAt:at(20),timeExitAt:at(90),quantity:1,entryLimitCents:200,entryFeeCents:25,exitFeeCents:25,exitSlippageCents:1,maxSpreadCents:10,settings:settings()});
const run=(frames,p=plan(),end=100)=>replaySnapshotPaper(p,[frame(0),...frames],at(end));
const blocked=r=>r.diagnostics.flatMap(d=>d.codes);
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-snapshot-paper-'));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-snapshot-paper-'))throw Error('UNSAFE_CLEANUP');rmSync(full,{recursive:true,force:true});}}

await test('exact nanoseconds, leap-day validation and cent-exact decimals',()=>{
  assert.equal(snapshotNs('2026-09-08T14:00:00.123456789Z')-snapshotNs('2026-09-08T14:00:00.123456788Z'),1n);
  for(const s of ['2026-02-30T00:00:00Z','2026-09-08T14:00:00.1234567891Z','2026-09-08T14:00:00+00:00'])assert.throws(()=>snapshotNs(s),/CLOCK/);
  assert.equal(snapshotCents('2.000000'),200);assert.equal(snapshotCents('2.001'),null);assert.equal(snapshotCents('1e2'),null);
});
await test('ask entry and cost-aware target reconcile every cent without legacy caps',()=>{
  const r=run([frame(10),frame(30,285,286)]);assert.equal(r.status,'CLOSED_MODELED');assert.equal(r.fills[0].premiumCents,20000);assert.equal(r.fills[1].priceCents,284);assert.equal(r.account.netPnlCents,8350);assert.equal(r.account.cashLedgerCents,108350);assert.equal(r.account.plannedRiskCents,4150);assert.equal(r.review.outcome,'WIN');assert.equal(r.actualTrades,0);assert.equal(r.gates.completeRealPriceLifecycle,'OPEN');assert.equal(r.sourceQualification,'NOT_QUALIFIED');
});
await test('gap stop fills at later bid less slippage and records loss beyond R',()=>{
  const r=run([frame(10),frame(80,100,101)]);assert.equal(r.fills[1].reason,'STOP');assert.equal(r.account.netPnlCents,-10150);assert.equal(r.review.outcome,'LOSS');assert(r.review.candidateLessons.some(l=>l.code==='LOSS_EXCEEDED_PLANNED_R'));assert(r.quoteGapObserved);
});
await test('time exit uses observed bid; no quote means unresolved, never forced liquidation',()=>{
  assert.equal(run([frame(10),frame(90)]).fills[1].reason,'TIME_EXIT');const r=run([frame(10)]);assert.equal(r.status,'OPEN_UNRESOLVED');assert.equal(r.account.netPnlCents,null);assert.equal(r.account.openPremiumExposureCents,20000);assert.equal(r.review,null);
});
await test('no eligible entry is retained in candidate notebook',()=>{const r=run([]);assert.equal(r.status,'NO_ENTRY');assert(r.candidateLessons.some(l=>l.code==='NO_ENTRY'));assert.equal(r.account.cashLedgerCents,100000);});
for(const field of ['entryFeeCents','exitFeeCents','exitSlippageCents'])await test('unknown cost blocks entry: '+field,()=>{const p=plan();p[field]=null;const r=run([frame(10)],p);assert.equal(r.status,'NO_ENTRY');assert(blocked(r).includes('COSTS_UNKNOWN'));});
for(const [name,change,code] of [
  ['stale quote',q=>q.updatedAt=at(-51),'STALE_AT_RECEIPT'],
  ['future quote by one nanosecond',q=>q.updatedAt=at(10).replace('.000Z','.000000001Z'),'SOURCE_AFTER_RECEIPT'],
  ['unknown quote time',q=>q.updatedAt=null,'SOURCE_CLOCK_MISSING'],
  ['old underlying',q=>q.underlyingAt=at(-51),'UNDERLYING_UNALIGNED'],
  ['crossed bid',q=>q.bidCents=201,'PRICE_OR_TICK_INVALID'],
  ['unknown size',q=>q.askSize=null,'SIZE_UNKNOWN'],
  ['zero ask size',q=>q.askSize=0,'ENTRY_SIZE_INSUFFICIENT'],
  ['zero bid size',q=>q.bidSize=0,'ENTRY_SIZE_INSUFFICIENT'],
  ['unsupported multiplier',q=>q.multiplier=10,'CONTRACT_UNSUPPORTED'],
  ['identity change',q=>q.strike='401','CONTRACT_IDENTITY_CHANGED'],
  ['spread',q=>q.bidCents=180,'ENTRY_SPREAD_EXCEEDED'],
  ['limit',q=>{q.bidCents=200;q.askCents=201;},'ENTRY_LIMIT_NOT_MET'],
])await test(name+' cannot become a fill',()=>{const f=frame(10);change(f.quotes[0]);const r=run([f]);assert.equal(r.status,'NO_ENTRY');assert(blocked(r).includes(code),JSON.stringify(r));});
await test('cash and owner allocation are enforced without increasing quantity',()=>{
  const p=plan();p.settings.settledCashCents=19000;assert.equal(run([frame(10)],p).status,'NO_ENTRY');p.settings.settledCashCents=100000;p.quantity=3;const r=run([frame(10)],p);assert.equal(r.status,'NO_ENTRY');assert(blocked(r).includes('ALLOCATION_BUDGET_EXCEEDED'));
});
await test('repeated updates cannot exit and source regressions cannot repair a gap',()=>{
  const f=frame(15);f.quotes[0].updatedAt=at(10);const h=frame(18);h.quotes[0].updatedAt=at(9);const r=run([frame(10),f,h]);assert.equal(r.fills.length,1);assert(blocked(r).includes('REPEATED_SOURCE_UPDATE'));assert(blocked(r).includes('SOURCE_CLOCK_REGRESSION'));
});
await test('contradictory source updates and ambiguous same-time books are blocked',()=>{const f=frame(15,285,286);f.quotes[0].updatedAt=at(10);const r=run([frame(10),f]);assert.equal(r.fills.length,1);assert(blocked(r).includes('CONFLICTING_SOURCE_UPDATE'));f.quotes[0].receivedAt=at(10);const simultaneous=run([frame(10),f]);assert.equal(simultaneous.fills.length,0);assert(blocked(simultaneous).includes('AMBIGUOUS_RECEIPT'));});
await test('stop remains latched after missing liquidity and later rebound',()=>{const f=frame(30,150,151);f.quotes[0].bidSize=0;const r=run([frame(10),f,frame(40)]);assert.equal(r.fills[1].reason,'STOP');assert.equal(r.fills[1].priceCents,198);assert(r.review.candidateLessons.some(l=>l.code==='EXIT_LIQUIDITY_DELAYED'));});
await test('future recorded sources are not known at the assessment cutoff',()=>{const f=frame(30,285,286);f.recordedAt=at(101);assert.equal(run([frame(10),f]).status,'OPEN_UNRESOLVED');});
await test('retrospective decisions remain retrospective and future source data cannot backdate entry',()=>{const p=plan();p.createdAt=at(50);const r=run([frame(10),frame(30,285,286)],p);assert.equal(r.timing,'RETROSPECTIVE_DECLARATION');assert.equal(r.status,'CLOSED_MODELED');const f=frame(10);f.quotes[0].updatedAt=at(1);assert(blocked(run([f])).includes('SOURCE_PRECEDES_DECISION'));});
await test('selection mutation, duplicate frame, mixed origins and future declaration fail',()=>{const p=plan();p.contract.askCents=201;assert.throws(()=>run([],p),/SELECTION_LINKAGE/);assert.throws(()=>run([frame(10),frame(10)]),/DUPLICATE_FRAME/);const f=frame(10);f.origin='HOST_MARKET_TOOL_RESPONSES';assert.throws(()=>run([f]),/FRAME/);p.contract=q(0);p.createdAt=at(101);assert.throws(()=>run([],p),/ASSESSMENT/);});
await test('unknown-cost preview is valid but invalid windows and old policy are rejected',()=>{const invalid=plan();invalid.contract.expiry='2026-02-30';assert.throws(()=>validateSnapshotPlan(invalid),/CLOCK/);invalid.contract.expiry='2026-09-25';invalid.contract.strike='400.001';assert.throws(()=>validateSnapshotPlan(invalid),/CONTRACT_STRIKE/);const p=plan();p.settings.tradeBudget.version='OWNER_TRADE_BUDGET_V1';assert.throws(()=>validateSnapshotPlan(p),/POLICY/);p.settings=settings();p.entryDeadlineAt=p.timeExitAt;assert.throws(()=>validateSnapshotPlan(p),/WINDOW/);});
await test('source freshness at receipt stays distinct from current staleness',()=>{const r=assessSnapshotQuote(q(10),at(100));assert(r.usableSnapshot);assert(r.staleNow);assert.equal(r.sourceAgeAtReceiptNs,'0');});
await test('five-cent exit tick rounds down and counts the additional actual loss',()=>{const r=run([frame(10),frame(30,310,315)]);assert.equal(r.fills[1].priceCents,305);assert.equal(r.account.netPnlCents,10450);});
await test('zero executable bid cannot be converted into a zero-price fill',()=>{const r=run([frame(10),frame(30,0,1)]);assert.equal(r.status,'OPEN_UNRESOLVED');assert(blocked(r).includes('EXIT_PRICE_UNAVAILABLE'));});
await test('source nanoseconds survive while unsupported receipt precision is explicit',()=>{const f=frame(10);f.quotes[0].updatedAt=at(9).replace('.000Z','.999999999Z');assert.equal(run([f]).fills[0].sourceAt,f.quotes[0].updatedAt);f.quotes[0].receivedAt=at(10).replace('.000Z','.000000001Z');f.recordedAt=f.capturedAt=at(11);assert.throws(()=>run([f]),/RECEIPT_PRECISION_UNSUPPORTED/);});

async function rawCapture(n,bid='1.99',ask='2.00'){
  let seq=10;const instruments=new Map();const raw=await collectGuidanceMarket({clock:async()=>at(n),call:async(tool,request)=>{
    if(tool==='get_equity_quotes')return {data:{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'400.00',venue_last_trade_time:at(n),last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}))}};
    if(tool==='get_option_chains')return {data:{chains:[{id:uid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,late_close_state:'enabled',expiration_dates:['2026-09-25']}]}};
    if(tool==='get_option_instruments'){const symbol=request.chain_id===uid(1)?'GLD':'IBIT',list=['call','put'].map(type=>({id:uid(seq++),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:'2026-09-25',type,strike_price:'400',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}));list.forEach(i=>instruments.set(i.id,i));return {data:{instruments:list,next:null}};}
    if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:bid,ask_price:ask,bid_size:20,ask_size:20,delta:instruments.get(id).type==='call'?'0.5':'-0.5',updated_at:at(n)}}))}};
    throw Error('UNEXPECTED_TOOL');
  }});raw.origin='SYNTHETIC_FIXTURE';return raw;
}
async function saveCapture(root,n,bid,ask){const input=await rawCapture(n,bid,ask),report=normalizeGuidanceCapture(input),r={version:'OPTIONS_GUIDANCE_RECORD_V1',kind:'captures',recordedAt:at(n),input,report,inputFingerprint:paperFingerprint(input),reportFingerprint:paperFingerprint(report)},path=frame(n).path;mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),JSON.stringify(r,null,2)+'\n');return path;}
const request=()=>{const {version,createdAt,contract,settings,...rest}=plan();return {...rest,contractId:contract.id,settingsFingerprint:paperFingerprint(settings)};};
async function seed(root){saveGuidanceSettings(root,settings());await saveCapture(root,0);}
await test('source byte copy rejects tampering and preserves exact raw metadata',()=>temp(async root=>{await seed(root);const sources=snapshotSources(root),mapped=mapSnapshotSource(sources[0]);assert.equal(mapped.quotes[0].aboveTickCents,5);assert.equal(mapped.sha256,createHash('sha256').update(sources[0].utf8).digest('hex'));sources[0].utf8+=' ';assert.throws(()=>mapSnapshotSource(sources[0]),/SOURCE_INTEGRITY/);}));
await test('preview settings cannot silently change before registration',()=>temp(async root=>{await seed(root);previewSnapshotPaper(root,request(),at(1));saveGuidanceSettings(root,{...settings(),stopLossBps:1000});assert.throws(()=>registerSnapshotPaper(root,request(),at(1)),/SETTINGS_CHANGED/);}));
await test('full temporary lifecycle saves, reviews and recovers without original source files',()=>temp(async root=>{
  await seed(root);const before=readFileSync(resolve(root,frame(0).path));const registered=registerSnapshotPaper(root,request(),at(1));assert(registerSnapshotPaper(root,request(),at(2)).alreadyRecorded);assert.throws(()=>registerSnapshotPaper(root,{...request(),quantity:2},at(2)),/REQUEST_CONFLICT/);
  await saveCapture(root,10);await saveCapture(root,30,'2.85','2.86');const saved=saveSnapshotPaperReport(root,'synthetic-case',at(100));assert.equal(saved.status,'CLOSED_MODELED');assert.equal(verifySnapshotPaper(root,saved.path).status,'VERIFIED');assert.deepEqual(readFileSync(resolve(root,frame(0).path)),before);
  await temp(other=>{const dest=resolve(other,saved.path);mkdirSync(dirname(dest),{recursive:true});cpSync(resolve(root,saved.path),dest);assert.equal(verifySnapshotPaper(other,saved.path).status,'VERIFIED');const record=JSON.parse(readFileSync(dest,'utf8'));record.report.account.cashLedgerCents++;writeFileSync(dest,JSON.stringify(record));assert.throws(()=>verifySnapshotPaper(other,saved.path),/INTEGRITY/);const {fingerprint,...payload}=record;record.fingerprint=paperFingerprint(payload);writeFileSync(dest,JSON.stringify(record));assert.throws(()=>verifySnapshotPaper(other,saved.path),/RECOMPUTE/);});
  assert.equal(verifySnapshotPaper(root,registered.path).status,'VERIFIED');const desk=snapshotPaperView(root,at(100));assert.equal(desk.cases[0].current.review.outcome,'WIN');assert.equal(desk.cases[0].snapshots.length,1);assert(!JSON.stringify(desk).includes('executionAllowed":true'));
}));
await test('local API requires session and exposes paper workflow without source or order calls',()=>temp(async root=>{
  await seed(root);const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at(1)});try{
    const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.snapshotPaper.state,'AVAILABLE');
    const send=(body,session=state.session)=>fetch(app.url+'/api/snapshot-paper',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':session},body:JSON.stringify(body)});
    assert.equal((await send({action:'PREVIEW',request:request()},'bad')).status,403);
    const preview=await send({action:'PREVIEW',request:request()});assert.equal(preview.status,200);assert.equal((await preview.json()).status,'NO_ENTRY');
    assert.equal((await send({action:'REGISTER',request:request()})).status,200);assert.equal((await send({action:'SAVE_REPORT',id:'synthetic-case'})).status,200);assert.equal((await send({action:'ORDER',request:request()})).status,409);
    assert.equal((await fetch(app.url+'/snapshot-paper.js')).status,200);
  }finally{await app.close();}
}));
await test('frontend keeps unknown costs, labels open gates and escapes source text',()=>{
  const d={id:'test-plan',contractId:uid(10),selectionPath:frame(0).path,decisionAt:at(2).slice(0,19),entryDeadlineAt:at(20).slice(0,19),timeExitAt:at(90).slice(0,19),quantity:'1',entryLimit:'2',entryFee:'',exitFee:'',slippage:'',maxSpread:'.1'};
  d.maxSpread='0.10';assert.equal(snapshotRequest(d).entryFeeCents,null);assert(snapshotResult(run([])).includes('Assumption-only model'));
  const html=snapshotPaperPanel({state:'AVAILABLE',data:{sourceGaps:['<unsafe>'],latest:null,cases:[]}});assert(html.includes('Qualified quotes: Open'));assert(html.includes('&lt;unsafe&gt;'));assert(!html.includes('<unsafe>'));
});

// V2 acceptance: V1 above remains an independent compatibility suite.
const chain=(time=at(0),state='enabled')=>({chainId:uid(1),lateCloseState:state,receivedAt:time});
const frame2=(n,bid=199,ask=200)=>{const f=frame(n,bid,ask);f.quotes[0].chainSession=chain(at(n));return f;};
const plan2=()=>({...plan(),version:'OPTIONS_SNAPSHOT_PAPER_PLAN_V2',contract:frame2(0).quotes[0],feeBasis:'ROBINHOOD_REVIEWED_20260910',entryFeeCents:null,exitFeeCents:null});
const run2=(frames,p=plan2(),end=100)=>replaySnapshotPaper(p,[frame2(0),...frames],at(end));
const request2=()=>({...request(),modelVersion:'V2',feeBasis:'ROBINHOOD_REVIEWED_20260910',entryFeeCents:null,exitFeeCents:null});
await test('V2 paper waiting states do not report a future window as a failed entry',()=>{
  const waiting=run2([],plan2(),1);assert.equal(waiting.paperStage,'AWAITING_WINDOW');assert(!waiting.candidateLessons.some(l=>l.code==='NO_ENTRY'));
  assert.equal(run2([],plan2(),10).paperStage,'AWAITING_ELIGIBLE_QUOTE');assert.equal(run2([]).paperStage,'ENTRY_WINDOW_ENDED');
  const p=plan2();p.exitSlippageCents=null;assert.equal(run2([],p,1).paperStage,'WAITING_FOR_COST_ASSUMPTIONS');
});
await test('V2 reviewed fees and complete win reconcile actual modeled sale fees once',()=>{
  const r=run2([frame2(10),frame2(30,285,286)]);assert.equal(r.paperStage,'CLOSED_MODELED');assert.equal(r.fills[0].feeCents,4);assert.equal(r.fills[1].feeCents,5);assert.equal(r.account.netPnlCents,8391);assert.equal(r.review.outcome,'WIN');assert.equal(r.account.plannedRiskCents,4109);assert.equal(r.executionQualification,'NOT_ESTABLISHED');assert.equal(r.actualTrades,0);
  assert.equal(r.account.cashLedgerCents,100000-r.fills[0].premiumCents-4+r.fills[1].premiumCents-5);
});
await test('V2 sale fees vary with proceeds and losses beyond R enter the notebook',()=>{
  const r=run2([frame2(10),frame2(80,100,101)]);assert.equal(r.account.netPnlCents,-10109);assert(r.review.candidateLessons.some(l=>l.code==='LOSS_EXCEEDED_PLANNED_R'));
  const p=plan2();p.quantity=10;p.entryLimitCents=49;p.contract=frame2(0).quotes[0];
  const e=snapshotEntryEconomics(p,{...p.contract,bidCents:48,askCents:49});assert.equal(e.entryFeeCents,40);assert(e.exitFeeReserveCents>=44);
});
await test('V2 exit SEC rounding follows sale proceeds rather than entry fees',()=>{
  const p=plan2();p.quantity=3;p.entryLimitCents=160;const r=run2([frame2(10,159,160),frame2(30,230,231)],p);
  assert.equal(r.status,'CLOSED_MODELED');assert.equal(r.fills[0].feeCents,12);assert.equal(r.fills[1].feeCents,14);assert.equal(r.account.netPnlCents,20674);
});
await test('V2 manual fee input stays unknown, and mixed fee bases are rejected',()=>{
  const p=plan2();p.feeBasis='DECLARED_FEES';assert.equal(run2([frame2(10)],p).fills.length,0);p.entryFeeCents=0;p.exitFeeCents=0;assert.equal(run2([frame2(10)],p).fills.length,1);
  p.feeBasis='ROBINHOOD_REVIEWED_20260910';assert.throws(()=>validateSnapshotPlan(p),/FEE_BASIS/);p.entryFeeCents=p.exitFeeCents=null;p.feeBasis='NEW_RATE';assert.throws(()=>validateSnapshotPlan(p),/FEE_BASIS/);
});
await test('V2 stop remains latched across an invalid post-time-exit snapshot and rebound',()=>{
  const stop=frame2(30,150,151);stop.quotes[0].bidSize=0;const invalid=frame2(91);invalid.quotes[0].askSize=null;
  const r=run2([frame2(10),stop,invalid,frame2(95)]);assert.equal(r.fills[1].reason,'STOP');assert(r.quoteGapObserved);
});
for(const symbol of ['GLD','IBIT'])await test('V2 '+symbol+' late close admits source-linked 16:14 quotes and excludes 16:15',()=>{
  const quote=frame2(10).quotes[0];quote.symbol=symbol;quote.receivedAt=quote.updatedAt=quote.underlyingAt='2026-09-08T20:14:59.000Z';
  assert(assessSnapshotQuote(quote,'2026-09-08T20:14:59.000Z',true).usableSnapshot);
  assert(!assessSnapshotQuote(quote,'2026-09-08T20:14:59.000Z').usableSnapshot);
  quote.receivedAt=quote.updatedAt=quote.underlyingAt='2026-09-08T20:15:00.000Z';assert(!assessSnapshotQuote(quote,quote.receivedAt,true).usableSnapshot);
});
await test('V2 late-close complete modeled lifecycle uses unaltered source timestamps',()=>{
  const shift=s=>new Date(Date.parse(s)+(6*60+10)*60000).toISOString();const f=n=>{const x=frame2(n);x.recordedAt=shift(x.recordedAt);x.capturedAt=shift(x.capturedAt);const q=x.quotes[0];q.receivedAt=shift(q.receivedAt);q.updatedAt=shift(q.updatedAt);q.underlyingAt=shift(q.underlyingAt);q.chainSession.receivedAt=shift(q.chainSession.receivedAt);return x;};
  const p=plan2();p.contract=f(0).quotes[0];for(const k of ['createdAt','decisionAt','entryDeadlineAt','timeExitAt'])p[k]=shift(p[k]);
  const r=replaySnapshotPaper(p,[f(0),f(10),f(90)],shift(at(100)));assert.equal(r.status,'CLOSED_MODELED');assert.equal(r.fills[1].reason,'TIME_EXIT');assert.equal(r.marketSession.closeLocal,'16:15');assert.equal(r.fills[0].sourceAt,'2026-09-08T20:10:10.000Z');
});
await test('V2 missing late-close flag stays conservative and has no inferred eligibility',()=>{
  const quote=frame2(10).quotes[0];quote.chainSession={chainId:null,lateCloseState:'unknown',receivedAt:null};quote.receivedAt=quote.updatedAt=quote.underlyingAt='2026-09-08T20:10:00.000Z';
  assert(!assessSnapshotQuote(quote,quote.receivedAt,true).usableSnapshot);assert.equal(paperSession(quote.receivedAt,quote.chainSession).closeLocal,'16:00');
  quote.chainSession.lateCloseState='enabled';assert.throws(()=>assessSnapshotQuote(quote,quote.receivedAt,true),/CHAIN_SESSION/);
});
await test('V2 early close and DST boundaries follow the reviewed calendar',()=>{
  assert(paperSession('2026-11-27T18:14:59.000Z',chain()).isOpen);assert(!paperSession('2026-11-27T18:15:00.000Z',chain()).isOpen);
  assert(!paperSession('2026-11-27T18:00:00.000Z',chain(at(0),'disabled')).isOpen);
  assert.equal(paperSession('2026-12-24T17:00:00.000Z',chain()).closeLocal,'13:15');
  assert(paperSession('2026-07-02T19:00:00.000Z',chain()).isOpen);
  assert(paperSession('2026-11-02T14:30:00.000Z',chain()).isOpen);assert(!paperSession('2026-11-02T13:30:00.000Z',chain()).isOpen);
});
await test('V2 holidays, weekends, unknown years and expiration days cannot become plans',()=>{
  for(const date of ['2026-07-03','2026-09-07','2026-09-12','2027-09-08']){const p=plan2();p.contract.expiry='2027-09-25';for(const k of ['decisionAt','entryDeadlineAt','timeExitAt'])p[k]=p[k].replace('2026-09-08',date);assert.throws(()=>validateSnapshotPlan(p),/SESSION_WINDOW/);}
  const p=plan2();p.contract.expiry='2026-09-08';assert.throws(()=>validateSnapshotPlan(p),/SESSION_WINDOW/);
});
await test('V2 premarket source or underlying cannot pass just because receipt is after open',()=>{
  const quote=frame2(10).quotes[0];quote.receivedAt='2026-09-08T13:30:10.000Z';quote.chainSession.receivedAt=quote.receivedAt;quote.updatedAt=quote.underlyingAt='2026-09-08T13:29:59.000Z';
  const r=assessSnapshotQuote(quote,quote.receivedAt,true);assert(r.blockers.includes('SOURCE_OUTSIDE_MODEL_SESSION'));assert(r.blockers.includes('UNDERLYING_OUTSIDE_MODEL_SESSION'));
});
await test('V2 quote and underlying freshness cannot be waived by session eligibility',()=>{
  const quote=frame2(10).quotes[0];quote.receivedAt='2026-09-08T20:14:00.000Z';const r=assessSnapshotQuote(quote,quote.receivedAt,true);assert(r.blockers.includes('STALE_AT_RECEIPT'));assert(r.blockers.includes('UNDERLYING_UNALIGNED'));
});
await test('V2 raw chain flags are linked by exact chain and retained in copied-source recovery',()=>temp(async root=>{
  await seed(root);const src=snapshotSources(root)[0],v1=mapSnapshotSource(src),v2=mapSnapshotSource(src,true);assert(!('chainSession' in v1.quotes[0]));assert.equal(v2.quotes[0].chainSession.lateCloseState,'enabled');assert.equal(v2.quotes[0].chainSession.chainId,uid(1));
  const reg=registerSnapshotPaper(root,request2(),at(1));assert(registerSnapshotPaper(root,request2(),at(2)).alreadyRecorded);await saveCapture(root,10);await saveCapture(root,30,'2.85','2.86');const saved=saveSnapshotPaperReport(root,'synthetic-case',at(100));assert.equal(saved.status,'CLOSED_MODELED');
  const r=JSON.parse(readFileSync(resolve(root,saved.path),'utf8'));assert.equal(r.report.version,'OPTIONS_SNAPSHOT_PAPER_REPORT_V2');assert.equal(r.report.account.netPnlCents,8391);
  assert.equal(verifySnapshotPaper(root,reg.path).status,'VERIFIED');await temp(other=>{const dest=resolve(other,saved.path);mkdirSync(dirname(dest),{recursive:true});cpSync(resolve(root,saved.path),dest);assert.equal(verifySnapshotPaper(other,saved.path).status,'VERIFIED');});
  assert.equal(snapshotPaperView(root,at(100)).cases[0].current.paperStage,'CLOSED_MODELED');
}));
await test('V2 local API preview and freeze preserve explicit model and fee choice',()=>temp(async root=>{
  await seed(root);const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at(1)});try{const state=await(await fetch(app.url+'/api/state')).json();const send=body=>fetch(app.url+'/api/snapshot-paper',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':state.session},body:JSON.stringify(body)});
  const preview=await send({action:'PREVIEW',request:request2()});assert.equal(preview.status,200);assert.equal((await preview.json()).paperStage,'AWAITING_WINDOW');assert.equal((await send({action:'REGISTER',request:request2()})).status,200);
  assert.equal((await send({action:'PREVIEW',request:{...request2(),feeBasis:'UNKNOWN'}})).status,409);
  }finally{await app.close();}
}));
await test('browser API retains its server token across two paper previews',()=>temp(async root=>{
  await seed(root);const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at(1)}),oldFetch=globalThis.fetch,oldLocation=globalThis.location;
  globalThis.location=new URL(app.url);globalThis.fetch=(path,options={})=>oldFetch(new URL(path,app.url),{...options,headers:{...options.headers,Origin:app.url}});
  try{await browserRequest('/api/state');const first=await browserRequest('/api/snapshot-paper',{action:'PREVIEW',request:request2()});assert.equal(first.marketSession.closeLocal,'16:15');assert(snapshotResult(first).includes('16:15 New York'));const second=await browserRequest('/api/snapshot-paper',{action:'PREVIEW',request:request2()});assert.equal(second.paperStage,'AWAITING_WINDOW');}
  finally{globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;await app.close();}
}));
await test('V2 form binds fee choice without converting blank slippage to zero',()=>{
  const d={modelVersion:'V2',feeBasis:'ROBINHOOD_REVIEWED_20260910',id:'test-plan',contractId:uid(10),selectionPath:frame(0).path,decisionAt:at(2).slice(0,19),entryDeadlineAt:at(20).slice(0,19),timeExitAt:at(90).slice(0,19),quantity:'1',entryLimit:'2',entryFee:'',exitFee:'',slippage:'',maxSpread:'0.10'};
  assert.equal(snapshotRequest(d).exitSlippageCents,null);assert.equal(snapshotRequest(d).feeBasis,d.feeBasis);d.entryFee='0';assert.throws(()=>snapshotRequest(d),/manual fees/);
  const html=snapshotPaperPanel({state:'AVAILABLE',data:{sourceGaps:[],latest:null,cases:[]}});assert(html.includes('PRACTICAL PAPER WORKFLOW'));assert(html.includes('Strict execution qualification (separate)'));assert(html.includes('does not run continuous quote polling'));assert(snapshotResult(run2([],plan2(),1)).includes('Awaiting Window'));
});

async function enrolled(root){await seed(root);registerSnapshotPaper(root,request2(),at(1));return enrollPaperObservation(root,'synthetic-case','PIPELINE_REHEARSAL_NOT_SIGNAL',at(1));}
function rewriteCapture(root,path,change){const r=JSON.parse(readFileSync(resolve(root,path),'utf8'));change(r.input);r.report=normalizeGuidanceCapture(r.input);r.inputFingerprint=paperFingerprint(r.input);r.reportFingerprint=paperFingerprint(r.report);writeFileSync(resolve(root,path),JSON.stringify(r));}
await test('observation enrollment is prospective, immutable, idempotent and synthetic stays local',()=>temp(async root=>{
  const e=await enrolled(root),bytes=readFileSync(resolve(root,e.path));assert(enrollPaperObservation(root,'synthetic-case','PIPELINE_REHEARSAL_NOT_SIGNAL',at(3)).alreadyRecorded);
  assert.throws(()=>enrollPaperObservation(root,'synthetic-case','OWNER_PAPER_RESEARCH',at(1)),/CONFLICT/);
  assert.deepEqual(readFileSync(resolve(root,e.path)),bytes);const v=paperObservationView(root,null,at(1));assert.equal(v.rows[0].state,'AWAITING_WINDOW');assert.equal(v.rows[0].tracking,'SYNTHETIC_NOT_HOST_TRACKED');assert.equal(v.trackedContracts.length,0);
  assert.equal((await runGuidanceCommand(['--host-source'],{workspaceRoot:root,now:()=>at(1)})).trackedContracts,0);
}));
await test('late enrollment, old V1 and unknown plans cannot silently become monitored',()=>temp(async root=>{
  await seed(root);registerSnapshotPaper(root,request2(),at(1));assert.throws(()=>enrollPaperObservation(root,'synthetic-case',undefined,at(2)),/PROSPECTIVE_ONLY/);assert.throws(()=>enrollPaperObservation(root,'missing-case',undefined,at(1)),/PLAN_MISSING/);
  registerSnapshotPaper(root,{...request(),id:'legacy-case'},at(1));assert.throws(()=>enrollPaperObservation(root,'legacy-case',undefined,at(1)),/PROSPECTIVE_ONLY/);
}));
await test('cancellation stops observations without mutating the plan or hiding modeled exposure',()=>temp(async root=>{
  await enrolled(root);const file='data/runtime/options-snapshot-paper/plans/synthetic-case.json',before=readFileSync(resolve(root,file));await saveCapture(root,10);observePaperPlans(root,frame(10).path,at(11));
  const cancel=cancelPaperObservation(root,'synthetic-case',at(12));assert(cancelPaperObservation(root,'synthetic-case',at(13)).alreadyRecorded);assert.equal(verifySnapshotPaper(root,file).status,'VERIFIED');assert.deepEqual(readFileSync(resolve(root,file)),before);
  await saveCapture(root,30,'2.85','2.86');assert.equal(observePaperPlans(root,frame(30).path,at(31)).results.length,0);const v=paperObservationView(root,null,at(31));assert.equal(v.rows[0].state,'CANCELLED');assert.equal(v.rows[0].automaticReports,1);assert(cancel.path.endsWith('/cancelled/synthetic-case.json'));
}));
await test('six-ID priority deduplicates event identities and reports capacity or identity conflicts',()=>{
  const ids=Array.from({length:6},(_,n)=>({...q(0),id:uid(n+1)})),identity=c=>Object.fromEntries(['id','symbol','expiry','type','strike','multiplier'].map(k=>[k,c[k]]));
  const v=combinePaperTracking(ids.map(identity),[{planId:'shared',contract:ids[0]},{planId:'full',contract:q(0)},{planId:'conflict',contract:{...ids[1],strike:'401'}}]);
  assert.equal(v.trackedContracts.length,6);assert.deepEqual(v.rows.map(r=>r.status),['SHARED_EXISTING_ID','CAPACITY_WAIT','IDENTITY_CONFLICT']);assert.deepEqual(v.trackedContracts,ids.map(identity));assert.throws(()=>combinePaperTracking([ids[0],ids[0]],[]),/LIMIT/);
});
await test('overlapping enrollment is bounded without silently dropping the seventh plan',()=>temp(async root=>{
  await seed(root);for(let n=0;n<7;n++){const id='enrolled-'+n;registerSnapshotPaper(root,{...request2(),id},at(1));if(n<6)enrollPaperObservation(root,id,undefined,at(1));else assert.throws(()=>enrollPaperObservation(root,id,undefined,at(1)),/LIMIT/);}
  cancelPaperObservation(root,'enrolled-0',at(1));enrollPaperObservation(root,'enrolled-6',undefined,at(1));assert.equal(paperObservationView(root,null,at(1)).rows.length,7);
}));
await test('capture-driven entry, target and candidate review survive retry and isolated recovery',()=>temp(async root=>{
  await enrolled(root);await saveCapture(root,10);const first=observePaperPlans(root,frame(10).path,at(11)).results[0];assert.equal(first.status,'OPEN_UNRESOLVED');
  assert(observePaperPlans(root,frame(10).path,at(12)).results[0].alreadyRecorded);await saveCapture(root,30,'2.85','2.86');const closed=observePaperPlans(root,frame(30).path,at(31)).results[0];assert.equal(closed.status,'CLOSED_MODELED');assert.equal(observePaperPlans(root,frame(30).path,at(32)).results.length,0);
  const d=snapshotPaperView(root,at(32)),r=d.cases[0].snapshots.at(-1);assert.equal(r.report.review.outcome,'WIN');assert.equal(r.report.account.netPnlCents,8391);assert.equal(paperObservationView(root,d).rows[0].state,'CLOSED_MODELED');assert.equal(r.observation.kind,'CAPTURE');
  await temp(other=>{const dest=resolve(other,closed.path);mkdirSync(dirname(dest),{recursive:true});cpSync(resolve(root,closed.path),dest);assert.equal(verifySnapshotPaper(other,closed.path).status,'VERIFIED');});
}));
await test('late local retries cannot add a later winning quote to an earlier report',()=>temp(async root=>{
  await enrolled(root);await saveCapture(root,10);await saveCapture(root,30,'2.85','2.86');const r=saveSnapshotObservation(root,'synthetic-case',frame(10).path,at(100));assert.equal(r.status,'OPEN_UNRESOLVED');
  const saved=JSON.parse(readFileSync(resolve(root,r.path),'utf8'));assert.equal(saved.sources.length,2);assert.equal(saved.observation.cutoffAt,at(10));assert.equal(saved.recordedAt,at(100));assert(saveSnapshotObservation(root,'synthetic-case',frame(10).path,at(101)).alreadyRecorded);
  assert.throws(()=>saveSnapshotObservation(root,'synthetic-case',frame(30).path,at(20)),/CUTOFF/);
}));
await test('missing requested contract is copied as evidence and never receives a fill',()=>temp(async root=>{
  await enrolled(root);const path=await saveCapture(root,10);rewriteCapture(root,path,raw=>{for(const r of raw.receipts)if(r.tool==='get_option_quotes')r.response.data.results=r.response.data.results.filter(x=>x.quote.instrument_id!==uid(10));});
  const v=observePaperPlans(root,path,at(11));assert.equal(v.results[0].status,'NO_ENTRY');const saved=JSON.parse(readFileSync(resolve(root,v.results[0].path),'utf8'));assert(saved.sources.some(s=>s.path===path));assert(mapSnapshotSource(saved.sources.find(s=>s.path===path)).missingQuoteIds.includes(uid(10)));assert.equal(saved.report.fills.length,0);
}));
await test('window finalization records no-entry once and does not invent an exit for open exposure',()=>temp(async root=>{
  await enrolled(root);const end=snapshotObservationEnd(plan2());assert.equal(end,'2026-09-08T20:20:00.000Z');const after='2026-09-08T20:21:00.000Z';
  assert.equal(observePaperPlans(root,null,at(100)).results.length,0);const no=observePaperPlans(root,null,after).results[0];assert.equal(no.paperStage,'ENTRY_WINDOW_ENDED');assert.equal(observePaperPlans(root,null,after).results.length,0);assert.equal(paperObservationView(root,null,after).rows[0].state,'FINALIZED');
  await temp(async other=>{await enrolled(other);await saveCapture(other,10);const r=observePaperPlans(other,null,after).results[0];assert.equal(r.status,'OPEN_UNRESOLVED');const saved=JSON.parse(readFileSync(resolve(other,r.path),'utf8'));assert.equal(saved.report.fills.length,1);assert.equal(saved.report.account.netPnlCents,null);assert.equal(saved.observation.kind,'WINDOW_END');assert.equal(verifySnapshotPaper(other,r.path).status,'VERIFIED');});
}));
await test('automatic report trigger and cutoff tampering fails even with a new outer fingerprint',()=>temp(async root=>{
  await enrolled(root);await saveCapture(root,10);const r=saveSnapshotObservation(root,'synthetic-case',frame(10).path,at(11)),path=resolve(root,r.path),original=readFileSync(path,'utf8');
  for(const change of [r=>r.observation.cutoffAt=at(9),r=>r.observation.path=frame(0).path,r=>r.recordedAt=at(9)]){const {fingerprint,...p}=JSON.parse(original);change(p);writeFileSync(path,JSON.stringify({...p,fingerprint:paperFingerprint(p)}));assert.throws(()=>verifySnapshotPaper(root,r.path),/OBSERVATION/);}writeFileSync(path,original);
}));
await test('paper recovery failure preserves primary capture and existing Host source availability',()=>temp(async root=>{
  await enrolled(root);const folder=resolve(root,'data/runtime/options-snapshot-paper/observations/enrolled');writeFileSync(resolve(folder,'broken.json'),'{}');
  const input='raw-input.json';writeFileSync(resolve(root,input),JSON.stringify(await rawCapture(10)));
  const r=await runGuidanceCommand(['--record',input],{workspaceRoot:root});assert(r.paperObservations.error);assert.equal(verifyGuidanceRecord(root,r.path).status,'VERIFIED');
  const source=await runGuidanceCommand(['--host-source'],{workspaceRoot:root});assert(source.paperTracking.error);assert.equal(typeof new Function('return ('+source.source+')')(),'function');
}));
await test('local API enrollment and cancellation preserve scope and expose English controls',()=>temp(async root=>{
  await seed(root);registerSnapshotPaper(root,request2(),at(1));const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at(1)});try{
    const state=await(await fetch(app.url+'/api/state')).json(),send=body=>fetch(app.url+'/api/snapshot-paper',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':state.session},body:JSON.stringify(body)});
    assert(snapshotPaperPanel(state.snapshotPaper).includes('Enroll paper observation'));assert.equal((await send({action:'ENROLL',id:'synthetic-case',extra:true})).status,409);assert.equal((await send({action:'ENROLL',id:'synthetic-case'})).status,200);
    const next=await(await fetch(app.url+'/api/state')).json(),html=snapshotPaperPanel(next.snapshotPaper);assert(html.includes('Frozen entry window'));assert(html.includes('net target: 2 R'));assert(html.includes('Cancel paper observation'));assert(html.includes('No automatic report yet'));assert(!html.includes('data-paper-enroll='));
    assert.equal((await send({action:'CANCEL',id:'synthetic-case'})).status,200);assert.equal(paperObservationView(root,null,at(1)).rows[0].state,'CANCELLED');
  }finally{await app.close();}
}));
await test('a Host-origin fixture enrolls in bounded tracking and drops after its window',()=>temp(async root=>{
  await seed(root);rewriteCapture(root,frame(0).path,raw=>raw.origin='HOST_MARKET_TOOL_RESPONSES');registerSnapshotPaper(root,request2(),at(1));enrollPaperObservation(root,'synthetic-case',undefined,at(1));
  const v=await runGuidanceCommand(['--host-source'],{workspaceRoot:root,now:()=>at(1)});assert.equal(v.trackedContracts,1);assert.equal(v.paperTracking[0].tracking,'INCLUDED');assert(v.source.includes(uid(10)));
  const ended=await runGuidanceCommand(['--host-source'],{workspaceRoot:root,now:()=> '2026-09-08T20:21:00.000Z'});assert.equal(ended.trackedContracts,0);assert.equal(ended.paperTracking[0].state,'FINALIZATION_PENDING');
}));
await test('finalization ignores late-recorded backfill and future triggers are rejected',()=>temp(async root=>{
  await enrolled(root);const path=await saveCapture(root,10),r=JSON.parse(readFileSync(resolve(root,path),'utf8'));r.recordedAt='2026-09-08T20:21:00.000Z';writeFileSync(resolve(root,path),JSON.stringify(r));
  assert.throws(()=>observePaperPlans(root,path,at(100)),/FUTURE_CAPTURE/);const pass=await runGuidanceCommand(['--observe-paper'],{workspaceRoot:root,now:()=> '2026-09-08T20:22:00.000Z'});assert.equal(pass.results[0].status,'NO_ENTRY');const saved=JSON.parse(readFileSync(resolve(root,pass.results[0].path),'utf8'));assert.equal(saved.sources.length,1);
}));
await test('one exhausted report catalog cannot prevent another paper plan from saving',()=>temp(async root=>{
  await enrolled(root);registerSnapshotPaper(root,{...request2(),id:'second-case'},at(1));enrollPaperObservation(root,'second-case',undefined,at(1));
  const first=saveSnapshotPaperReport(root,'synthetic-case',at(1)),dir=dirname(resolve(root,first.path));for(let n=1;n<100;n++)cpSync(resolve(root,first.path),resolve(dir,'copy-'+n+'.json'));
  await saveCapture(root,10);const pass=observePaperPlans(root,frame(10).path,at(11));assert.equal(pass.results.find(r=>r.planId==='synthetic-case').error,'SNAPSHOT_PAPER_CATALOG');assert.equal(pass.results.find(r=>r.planId==='second-case').status,'OPEN_UNRESOLVED');
}));
await test('local service finalizes an expired no-entry before a failed public refresh',()=>temp(async root=>{
  const e=await enrolled(root),before=readFileSync(resolve(root,e.path)),atEnd='2026-09-08T20:21:00.000Z';let finish;const wait=new Promise(r=>finish=r);
  const service=startPublicContextService({workspaceRoot:root,issue:false,now:()=>atEnd,execute:async()=>{await wait;throw Error('PUBLIC_FAILURE');}});
  try{
    const s=service.paperStatus();assert.equal(s.status,'OK');assert.equal(s.results[0].status,'NO_ENTRY');const path=s.results[0].path,bytes=readFileSync(resolve(root,path));assert.equal(verifySnapshotPaper(root,path).status,'VERIFIED');
    const again=runLocalPaperFinalization({workspaceRoot:root,now:()=>atEnd});assert.deepEqual(again.results,[]);assert(readFileSync(resolve(root,path)).equals(bytes));assert(readFileSync(resolve(root,e.path)).equals(before));
    const d=snapshotPaperView(root,atEnd),view=paperObservationView(root,d),review=view.rows[0].lastAutomaticReport.processReview;
    assert.equal(view.rows[0].state,'FINALIZED');assert.equal(review.inWindowQuoteCount,0);assert.equal(review.netPnlCents,null);assert(review.explanation.includes('not a losing trade'));assert.equal(review.approvedKnowledge,false);
    const html=snapshotPaperPanel({state:'AVAILABLE',data:{...d,observations:view}},{},s);assert(html.includes('Saved observation review'));assert(html.includes('data-disclosure-key="paper-plan-synthetic-case"'));assert(html.includes('Local paper finalization'));assert(html.includes('No requested-contract quote'));
  }finally{service.stop();finish();await new Promise(r=>setTimeout(r,20));}
}));
await test('local finalization preserves unknown exit and open premium exposure',()=>temp(async root=>{
  await enrolled(root);await saveCapture(root,10);const atEnd='2026-09-08T20:21:00.000Z',pass=runLocalPaperFinalization({workspaceRoot:root,now:()=>atEnd});assert.equal(pass.results[0].status,'OPEN_UNRESOLVED');
  const review=paperObservationView(root,null,atEnd).rows[0].lastAutomaticReport.processReview;assert.equal(review.modeledFills,1);assert.equal(review.netPnlCents,null);assert.equal(review.openPremiumExposureCents,20000);assert.equal(review.inWindowQuoteCount,1);assert(review.explanation.includes('exposure is retained'));
}));
await test('local recovery skips unexpired and cancelled plans',()=>temp(async root=>{
  await enrolled(root);assert.deepEqual(runLocalPaperFinalization({workspaceRoot:root,now:()=>at(5)}).results,[]);cancelPaperObservation(root,'synthetic-case',at(6));assert.deepEqual(runLocalPaperFinalization({workspaceRoot:root,now:()=> '2026-09-08T20:21:00.000Z'}).results,[]);
}));
await test('saved process review counts blockers within the original entry window only',()=>{
  const p=plan2(),r=run2([frame2(10,190,250),frame2(40,190,250)],p,100),before=paperFingerprint(r),review=savedPaperProcessReview(p,r);
  assert.equal(review.inWindowQuoteCount,1);assert.equal(review.blockerCounts.find(b=>b.code==='ENTRY_LIMIT_NOT_MET').count,1);assert(!review.blockerCounts.some(b=>b.code==='ENTRY_WINDOW_MISSED'));assert.equal(paperFingerprint(r),before);
  assert(savedPaperProcessReview(p,run2([],p,5)).explanation.includes('has not ended'));
});
await test('completed saved process projections retain model origin and exact net PnL',()=>{
  const p=plan2(),r=run2([frame2(10),frame2(30,285,286)],p,100),review=savedPaperProcessReview(p,r);assert.equal(review.modeledFills,2);assert.equal(review.netPnlCents,r.account.netPnlCents);assert.equal(review.openPremiumExposureCents,0);assert(review.explanation.includes('not verified brokerage'));assert.equal(review.causalStatus,'NOT_ESTABLISHED');
});
await test('service and saved review panels escape failures and show missing checks honestly',()=>{
  const html=localPaperServicePanel({enabled:true,status:'FAILED',checkedAt:null,error:'<script>bad</script>',results:[]});assert(html.includes('Unknown'));assert(!html.includes('<script>'));assert(html.includes('recovery needs attention'));assert(localPaperServicePanel({enabled:false,status:'OK',checkedAt:null}).includes('Disabled'));
  const review=savedPaperProcessReview(plan2(),run2([],plan2(),100));review.nextCheck='<script>bad</script>';assert(!savedProcessReview({processReview:review,trigger:{cutoffAt:at(100)},recordedAt:at(100)}).includes('<script>'));
});
const eventFixture=()=>({title:'Producer Price Index',source:'BLS',startDate:'2026-09-08',endDate:'2026-09-08',scheduledAt:at(600)});
async function seedEvent(root,events=[eventFixture()],change=()=>{}){
  await seed(root);const i=guidanceView(root,{loadedAt:at(0)}).input;i.calendarAvailable=true;i.events=events;change(i);
  const report=assessDailyGuidance(i),record={version:'OPTIONS_GUIDANCE_RECORD_V1',kind:'reports',recordedAt:at(0),input:i,report,inputFingerprint:paperFingerprint(i),reportFingerprint:paperFingerprint(report)};
  const reportPath='data/runtime/options-daily-guidance/reports/2026-09-08/fixture.json';mkdirSync(dirname(resolve(root,reportPath)),{recursive:true});writeFileSync(resolve(root,reportPath),JSON.stringify(record,null,2)+'\n');
  return {...request2(),eventPlan:{reportPath,eventKey:paperEventKey(events[0]),phase:'PRE_EVENT',hypothesis:'Synthetic event expectation',entryCondition:'Owner must confirm price reaction; prose is untested.',invalidation:'Owner must review a reversal; prose is untested.'}};
}
await test('event-linked preview keeps original blockers, unknown costs and no execution',()=>temp(async root=>{const req=await seedEvent(root);req.exitSlippageCents=null;const r=previewSnapshotPaper(root,req,at(1));assert.equal(r.paperStage,'WAITING_FOR_COST_ASSUMPTIONS');assert.equal(r.eventPlan.phase,'PRE_EVENT');assert.equal(r.eventPlan.hypothesisValidation,'NOT_TESTED');assert.equal(r.eventPlan.proseConditionsEnforced,false);assert.equal(r.eventPlan.guidance.disposition,'NO_TRADE');assert.equal(r.eventPlan.guidance.origin,'SYNTHETIC_FIXTURE');assert(r.eventPlan.guidance.blockers.includes('MAJOR_EVENT_WAIT'));assert.equal(r.plan.settings.tradeBudget.version,'OWNER_ALLOCATION_ONLY_V2');assert.equal(r.executionAllowed,false);}));
await test('PRE event time exit must be strictly before the scheduled event',()=>temp(async root=>{const req=await seedEvent(root);req.timeExitAt=at(600);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/PRE_EVENT_EXIT/);req.timeExitAt=at(599);assert.equal(previewSnapshotPaper(root,req,at(1)).eventPlan.phase,'PRE_EVENT');}));
await test('POST event entry must exceed the existing thirty-minute boundary',()=>temp(async root=>{const req=await seedEvent(root);req.eventPlan.phase='POST_EVENT';req.decisionAt=at(2400);req.entryDeadlineAt=at(2430);req.timeExitAt=at(2500);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/POST_EVENT_STABILIZATION/);req.decisionAt=at(2401);assert.equal(previewSnapshotPaper(root,req,at(1)).eventPlan.phase,'POST_EVENT');}));
await test('date-only FOMC permits earlier-day PRE but cannot invent POST time',()=>temp(async root=>{const req=await seedEvent(root,[{title:'FOMC meeting dates',source:'FOMC',startDate:'2026-09-09',endDate:'2026-09-10',scheduledAt:null}]);assert.equal(previewSnapshotPaper(root,req,at(1)).eventPlan.event.scheduledAt,null);req.eventPlan.phase='POST_EVENT';assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/EVENT_TIME_UNKNOWN/);req.eventPlan.phase='PRE_EVENT';req.decisionAt='2026-09-09T14:00:00.000Z';req.entryDeadlineAt='2026-09-09T14:01:00.000Z';req.timeExitAt='2026-09-09T14:02:00.000Z';assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/PRE_EVENT_EXIT/);}));
await test('another timed or date-only major event inside holding cannot be hidden',()=>temp(async root=>{for(const other of [{...eventFixture(),title:'Consumer Price Index',scheduledAt:at(60)},{title:'FOMC meeting dates',source:'FOMC',startDate:'2026-09-08',endDate:'2026-09-09',scheduledAt:null}]){const req=await seedEvent(root,[eventFixture(),other]);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/OTHER_MAJOR_EVENT_IN_HOLD/);}}));
await test('missing, duplicate and unqualified calendar evidence fails attachment',()=>temp(async root=>{let req=await seedEvent(root);req.eventPlan.eventKey='unknown';assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/EVENT_EVIDENCE/);req=await seedEvent(root,[eventFixture(),eventFixture()]);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/EVENT_EVIDENCE/);req=await seedEvent(root,[eventFixture()],i=>i.calendarAvailable=false);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/EVENT_EVIDENCE/);}));
await test('event times must match copied calendar dates',()=>temp(async root=>{const req=await seedEvent(root,[{...eventFixture(),scheduledAt:'2026-09-09T14:00:00.000Z'}]);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/EVENT_TIME_DATE/);}));
await test('linked events require a prospective V2 registration and bounded declarations',()=>temp(async root=>{const req=await seedEvent(root);assert.throws(()=>previewSnapshotPaper(root,req,at(2)),/PROSPECTIVE_CLOCK/);assert.throws(()=>previewSnapshotPaper(root,{...request(),eventPlan:req.eventPlan},at(1)),/REQUEST_FIELDS/);req.eventPlan.hypothesis=' ';assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/TEXT/);req.eventPlan.hypothesis='x'.repeat(801);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/TEXT/);}));
await test('copied guidance must bind identical contract, capture, settings and prior clocks',()=>temp(async root=>{for(const [change,code]of [[i=>i.quotes[0].askCents++,'CONTRACT_OR_SETTINGS_LINKAGE'],[i=>i.captureAt=at(-1),'EVENT_CAPTURE_LINKAGE'],[i=>i.settings.stopLossBps=1500,'CONTRACT_OR_SETTINGS_LINKAGE']]){const req=await seedEvent(root,[eventFixture()],change);assert.throws(()=>previewSnapshotPaper(root,req,at(1)),new RegExp(code));}const req=await seedEvent(root);const path=resolve(root,req.eventPlan.reportPath),record=JSON.parse(readFileSync(path,'utf8'));record.recordedAt=at(2);writeFileSync(path,JSON.stringify(record));assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/PROSPECTIVE_CLOCK/);}));
await test('corrupted issued output cannot be copied as verified event evidence',()=>temp(async root=>{const req=await seedEvent(root),path=resolve(root,req.eventPlan.reportPath),record=JSON.parse(readFileSync(path,'utf8'));record.report.executionAllowed=true;writeFileSync(path,JSON.stringify(record));assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/GUIDANCE_INTEGRITY/);record.reportFingerprint=paperFingerprint(record.report);writeFileSync(path,JSON.stringify(record));assert.throws(()=>previewSnapshotPaper(root,req,at(1)),/GUIDANCE_RECOMPUTE/);}));
await test('linked synthetic lifecycle freezes context, remains untested and recovers without stores',()=>temp(async root=>{
  const req=await seedEvent(root),original=readFileSync(resolve(root,req.eventPlan.reportPath)),registered=registerSnapshotPaper(root,req,at(1));assert(registerSnapshotPaper(root,req,at(5)).alreadyRecorded);assert.throws(()=>registerSnapshotPaper(root,{...req,eventPlan:{...req.eventPlan,hypothesis:'Changed'}},at(5)),/REQUEST_CONFLICT/);
  const registration=JSON.parse(readFileSync(resolve(root,registered.path),'utf8'));assert.equal(registration.version,'OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2');assert.equal(registration.plan.version,'OPTIONS_SNAPSHOT_PAPER_PLAN_V2');assert.equal(registration.eventContext.guidance.utf8,original.toString());
  await saveCapture(root,10);await saveCapture(root,30,'2.85','2.86');const saved=saveSnapshotPaperReport(root,'synthetic-case',at(100)),output=JSON.parse(readFileSync(resolve(root,saved.path),'utf8'));assert.equal(saved.status,'CLOSED_MODELED');assert.equal(output.report.fills.length,2);assert.equal(output.report.eventPlan.hypothesisValidation,'NOT_TESTED');assert.equal(output.report.eventPlan.proseConditionsEnforced,false);assert(output.report.candidateLessons.some(l=>l.code==='EVENT_HYPOTHESIS_NOT_TESTED'&&l.approvedKnowledge===false));assert(output.report.account.netPnlCents>0);assert.deepEqual(readFileSync(resolve(root,req.eventPlan.reportPath)),original);
  await temp(other=>{const dest=resolve(other,saved.path);mkdirSync(dirname(dest),{recursive:true});cpSync(resolve(root,saved.path),dest);assert.equal(verifySnapshotPaper(other,saved.path).status,'VERIFIED');const bad=JSON.parse(readFileSync(dest,'utf8'));bad.report.eventPlan.hypothesisValidation='PROVEN';const {fingerprint,...body}=bad;bad.fingerprint=paperFingerprint(body);writeFileSync(dest,JSON.stringify(bad));assert.throws(()=>verifySnapshotPaper(other,saved.path),/RECOMPUTE/);});
  const current=snapshotPaperView(root,at(100));assert.equal(current.cases[0].current.eventPlan.phase,'PRE_EVENT');assert.equal(current.eventPlanning.state,'AVAILABLE');assert(current.eventPlanning.data.events[0].key===req.eventPlan.eventKey);
}));
await test('automatic copied-source reports retain event context and original cutoff',()=>temp(async root=>{const req=await seedEvent(root);registerSnapshotPaper(root,req,at(1));await saveCapture(root,10);const result=saveSnapshotObservation(root,req.id,frame(10).path,at(11)),r=JSON.parse(readFileSync(resolve(root,result.path),'utf8'));assert.equal(r.observation.cutoffAt,at(10));assert.equal(r.report.eventPlan.hypothesisValidation,'NOT_TESTED');assert.equal(verifySnapshotPaper(root,result.path).status,'VERIFIED');}));
await test('event form is opt-in, preserves unknown fees, and result text is escaped',()=>temp(async root=>{const req=await seedEvent(root),r=previewSnapshotPaper(root,req,at(1));r.eventPlan.hypothesis='<script>bad</script>';const html=paperEventPanel(r.eventPlan);assert(!html.includes('<script>'));assert(html.includes('&lt;script'));assert(html.includes('NOT TESTED'));const d={modelVersion:'V2',feeBasis:'DECLARED_FEES',id:'fixture-plan',contractId:uid(10),selectionPath:frame(0).path,decisionAt:at(2).slice(0,19),entryDeadlineAt:at(20).slice(0,19),timeExitAt:at(90).slice(0,19),quantity:'1',entryLimit:'2',entryFee:'',exitFee:'',slippage:'',maxSpread:'0.10'};assert(!Object.hasOwn(snapshotRequest(d),'eventPlan'));assert.throws(()=>snapshotRequest({...d,eventAttachment:'INCLUDE'}),/Choose a saved event/);Object.assign(d,{eventAttachment:'INCLUDE',eventReportPath:req.eventPlan.reportPath,eventKey:req.eventPlan.eventKey,eventPhase:'PRE_EVENT',hypothesis:'A',entryCondition:'B',invalidation:'C'});const a=snapshotRequest(d);assert.equal(a.entryFeeCents,null);assert.equal(a.exitSlippageCents,null);d.invalidation='Changed';assert.notDeepEqual(a,snapshotRequest(d));const ui={},page=snapshotPaperPanel({state:'AVAILABLE',data:snapshotPaperView(root,at(1))},ui);assert(page.includes('Attach the event hypothesis'));assert(page.includes('Time exit (UTC)'));assert.equal(ui.snapshotEventChoices.reportPath,req.eventPlan.reportPath);}));
await test('paper draft edits clear a preview even when the named ID control shadows form.id',()=>{
  const app=readFileSync(new URL('../apps/options-workbench/app.js',import.meta.url),'utf8');
  const code=app.slice(app.indexOf('function updateDraft(el){'),app.indexOf('function prepareContract(row){'));
  for(const name of ['invalidation','entryLimit','eventPhase']){
    const values={id:'preserved-plan',invalidation:'Revised invalidation',entryLimit:'1.99',eventPhase:'POST_EVENT'};
    const form={id:{name:'id'},getAttribute:key=>key==='id'?'snapshot-paper-form':null};
    const ui={snapshotPreview:{old:true},journalMode:'register'},dirty=new Set(),panel={innerHTML:'Old preview'},button={disabled:false},drafts={register:{}};
    runInNewContext(code+'\nupdateDraft(el);',{el:{name,value:values[name],closest:()=>form},ui,dirty,drafts,FormData:class{constructor(f){assert.equal(f,form);return Object.entries(values);}},$:selector=>selector==='#snapshot-paper-preview'?panel:selector==='#freeze-snapshot-paper'?button:null,snapshotResult});
    assert.equal(ui.snapshotDraft.id,'preserved-plan');assert.equal(ui.snapshotDraft[name],values[name]);assert.equal(ui.snapshotPreview,null);assert.equal(button.disabled,true);assert.equal(panel.innerHTML,snapshotResult(null));assert(dirty.has('snapshot-paper'));assert.deepEqual(drafts.register,{});
  }
});
console.log(`Options snapshot paper tests passed: ${passed}/${passed}.`);
