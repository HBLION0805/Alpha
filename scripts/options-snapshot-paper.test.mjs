import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {snapshotNs,snapshotCents,assessSnapshotQuote,replaySnapshotPaper,validateSnapshotPlan} from '../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {collectGuidanceMarket} from './lib/options-guidance-host.mjs';
import {normalizeGuidanceCapture,saveGuidanceSettings} from './lib/options-guidance-io.mjs';
import {mapSnapshotSource,snapshotSources,previewSnapshotPaper,registerSnapshotPaper,saveSnapshotPaperReport,verifySnapshotPaper,snapshotPaperView} from './lib/options-snapshot-paper-io.mjs';
import {snapshotRequest,snapshotResult,snapshotPaperPanel} from '../apps/options-workbench/snapshot-paper.js';
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
    if(tool==='get_option_chains')return {data:{chains:[{id:uid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,expiration_dates:['2026-09-25']}]}};
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
console.log(`Options snapshot paper tests passed: ${passed}/${passed}.`);
