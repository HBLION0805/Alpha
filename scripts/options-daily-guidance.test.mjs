import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,relative,isAbsolute} from "node:path";
import {assessDailyGuidance,defaultGuidanceSettings} from "../src/engines/options-daily-guidance/OptionsDailyGuidance.ts";
import {collectGuidanceMarket,routeDailyGuidance} from "./lib/options-guidance-host.mjs";
import {normalizeGuidanceCapture,recordGuidanceMarket,saveGuidanceSettings,guidanceView,publishGuidance,verifyGuidanceRecord,claimGuidanceSlot,recordAnalystNote} from "./lib/options-guidance-io.mjs";
import {guidancePage} from "../apps/options-workbench/guidance.js";
import {startOptionsWorkbench} from "./options-workbench.mjs";
const at="2026-09-08T14:00:00.000Z",uuid=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0"),copy=v=>structuredClone(v);
let passed=0;async function test(name,fn){await fn();passed++;console.log("PASS "+name);}
const input=()=>({version:"OPTIONS_DAILY_GUIDANCE_INPUT_V1",at,captureAt:at,captureOrigin:"HOST_MARKET_TOOL_RESPONSES",captureComplete:true,
  quotes:["GLD","IBIT"].map((symbol,i)=>({id:uuid(i+1),symbol,expiry:"2026-09-25",type:"call",strike:"105",multiplier:100,bidCents:19,askCents:20,tickCents:1,bidSize:20,askSize:20,delta:0.5,updatedAt:at,receivedAt:at})),
  equities:["GLD","IBIT"].map(symbol=>({symbol,price:"110",sourceAt:at,close:{date:"2026-09-04",price:"108"}})),
  closeHistory:["GLD","IBIT"].flatMap(symbol=>["2026-08-31","2026-09-01","2026-09-02","2026-09-03","2026-09-04"].map((date,i)=>({symbol,date,price:String([100,101,103,105,108][i])}))),
  events:[],calendarAvailable:true,headlinesAvailable:true,sourceHealth:[],headlines:[],context:{treasury:null,btc:null},
  settings:{...defaultGuidanceSettings(),roundTripFeesCents:10,slippageReserveCents:20},
  analyst:{assessedAt:at,assets:["GLD","IBIT"].map(symbol=>({symbol,bias:"BULLISH",summary:"Fixture only",sources:[{url:"https://www.bls.gov/",retrievedAt:at}]}))}});
const first=i=>assessDailyGuidance(i).assets[0].candidates[0];
await test("fresh qualified scenario retains original exact economics and no execution",()=>{const r=assessDailyGuidance(input()),c=r.assets[0].candidates[0];assert.equal(c.disposition,"CONDITIONAL_RESEARCH");assert.equal(c.plan.netRiskCents,430);assert.equal(c.plan.netTargetCents,870);assert.equal(c.plan.stopTriggerCents,16);assert.equal(c.plan.targetExitCents,29);assert.equal(r.winProbability,null);assert.equal(r.executionAllowed,false);});
for(const [name,change,blocker] of [
 ["unknown fees",i=>i.settings.roundTripFeesCents=null,"COSTS_UNKNOWN"],
 ["unknown slippage",i=>i.settings.slippageReserveCents=null,"COSTS_UNKNOWN"],
 ["budget",i=>i.quotes[0].askCents=200,"ALLOCATION_BUDGET_EXCEEDED"],
 ["stress cap",i=>{i.quotes[0].bidCents=29;i.quotes[0].askCents=30;},"LEGACY_MAX_LOSS_LIMIT_EXCEEDED"],
 ["old quote",i=>i.quotes[0].updatedAt="2026-09-04T20:14:59.000Z","OPTION_QUOTE_NOT_FRESH"],
 ["future quote",i=>i.quotes[0].updatedAt="2026-09-08T14:00:01.000Z","OPTION_QUOTE_NOT_FRESH"],
 ["unknown quote time",i=>i.quotes[0].updatedAt=null,"OPTION_QUOTE_NOT_FRESH"],
 ["crossed spread",i=>i.quotes[0].bidCents=21,"SPREAD_OR_PRICE_UNSUITABLE"],
 ["wide spread",i=>i.quotes[0].bidCents=10,"SPREAD_OR_PRICE_UNSUITABLE"],
 ["missing size",i=>i.quotes[0].bidSize=null,"QUOTE_SIZE_UNKNOWN_OR_ZERO"],
 ["zero size",i=>i.quotes[0].askSize=0,"QUOTE_SIZE_UNKNOWN_OR_ZERO"],
 ["lottery delta",i=>i.quotes[0].delta=0.05,"DELTA_OUTSIDE_RESEARCH_RANGE"],
 ["wrong signed delta",i=>i.quotes[0].delta=-0.5,"DELTA_OUTSIDE_RESEARCH_RANGE"],
 ["missing delta",i=>i.quotes[0].delta=null,"DELTA_OUTSIDE_RESEARCH_RANGE"],
 ["expired",i=>i.quotes[0].expiry="2026-09-04","CONTRACT_OUTSIDE_POLICY"],
 ["near expiry",i=>i.quotes[0].expiry="2026-09-11","CONTRACT_OUTSIDE_POLICY"],
 ["adjusted contract",i=>i.quotes[0].multiplier=10,"CONTRACT_OUTSIDE_POLICY"],
 ["source partial",i=>i.captureComplete=false,"MARKET_CAPTURE_PARTIAL"],
 ["synthetic origin",i=>i.captureOrigin="SYNTHETIC_FIXTURE","UNVERIFIED_OR_SYNTHETIC_CAPTURE"],
 ["calendar unavailable",i=>i.calendarAvailable=false,"CALENDAR_COVERAGE_UNAVAILABLE"],
 ["news transport unavailable",i=>i.headlinesAvailable=false,"HEADLINE_REFRESH_UNAVAILABLE"],
 ["underlying old",i=>i.equities[0].sourceAt="2026-09-04T20:00:00Z","UNDERLYING_PRICE_NOT_FRESH"],
 ["too little history",i=>i.closeHistory=i.closeHistory.slice(0,3),"DIRECTION_NOT_CONFIRMED"],
 ["same-date history conflict",i=>i.closeHistory.push({symbol:"GLD",date:"2026-09-04",price:"106"}),"DIRECTION_NOT_CONFIRMED"],
 ["news conflicts with trend",i=>i.analyst.assets[0].bias="BEARISH","NEWS_AND_TREND_NOT_ALIGNED"],
 ["news uncertain",i=>i.analyst.assets[0].bias="MIXED","NEWS_AND_TREND_NOT_ALIGNED"],
 ["news review missing",i=>i.analyst=null,"ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD"],
 ["source-free opinion",i=>i.analyst.assets[0].sources=[],"ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD"]
])await test(name+" cannot qualify",()=>{const i=input();change(i);assert(first(i).blockers.includes(blocker),JSON.stringify(first(i).blockers));assert.equal(first(i).disposition,"NO_TRADE");});
await test("declining daily closes reverse descriptive direction, not win probability",()=>{const i=input();i.closeHistory=i.closeHistory.map(c=>({...c,price:String(210-Number(c.price))}));assert.equal(assessDailyGuidance(i).assets[0].trend.direction,"DOWN");});
await test("flat series remains RANGE",()=>{const i=input();i.closeHistory=i.closeHistory.map(c=>({...c,price:"100"}));assert.equal(assessDailyGuidance(i).assets[0].trend.direction,"RANGE");});
await test("duplicate same-price receipts cannot create five sessions",()=>{const i=input();i.closeHistory=Array(10).fill({symbol:"GLD",date:"2026-09-04",price:"108"});assert.equal(assessDailyGuidance(i).assets[0].trend.direction,"INSUFFICIENT_HISTORY");});
await test("future closes cannot confirm a historical trend",()=>{const i=input();i.closeHistory=i.closeHistory.map(c=>({...c,date:"2026-09-09"}));assert.equal(assessDailyGuidance(i).assets[0].trend.direction,"INSUFFICIENT_HISTORY");});
const event=(scheduledAt)=>({title:"Consumer Price Index",source:"BLS",startDate:"2026-09-08",endDate:"2026-09-08",scheduledAt});
for(const [t,gated] of [["2026-09-09T14:00:00.000Z",true],["2026-09-09T14:00:01.000Z",false],["2026-09-08T13:30:00.000Z",true],["2026-09-08T13:29:59.000Z",false]])await test("timed event boundary "+t,()=>{const i=input();i.events=[event(t)];assert.equal(assessDailyGuidance(i).events[0].gated,gated);});
await test("FOMC date-only events gate through final date",()=>{const i=input();i.events=[{title:"FOMC meeting",source:"FOMC",startDate:"2026-09-09",endDate:"2026-09-10",scheduledAt:null}];assert(assessDailyGuidance(i).events[0].gated);});
await test("weekend cannot produce a current entry",()=>{const i=input();i.at="2026-09-12T14:00:00.000Z";assert(first(i).blockers.includes("OUTSIDE_REGULAR_SESSION"));});
await test("duplicate option identities fail",()=>{const i=input();i.quotes[1].id=i.quotes[0].id;assert.throws(()=>assessDailyGuidance(i),/DUPLICATE/);});
await test("invalid risk settings cannot expand the normal allocation",()=>{const i=input();i.settings.mode="CONDITIONAL";assert.throws(()=>assessDailyGuidance(i),/SETTINGS_FIELDS/);});
function mock() {
  const instruments=new Map();let seq=10;const calls=[];
  return {calls,async call(tool,request) {
    calls.push({tool,request});
    if(tool==="get_equity_quotes")return {data:{results:["GLD","IBIT"].map(symbol=>({quote:{symbol,last_trade_price:"105",venue_last_trade_time:at,last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null},close:{symbol,date:"2026-09-04",price:"108",interpolated:false,source:"sip-list-exchange-close"}}))}};
    if(tool==="get_option_chains")return {data:{chains:[{id:uuid(request.underlying_symbol==="GLD"?1:2),symbol:request.underlying_symbol,expiration_dates:["2026-09-25","2026-10-02","2026-10-16"]}]}};
    if(tool==="get_option_instruments"){const symbol=request.chain_id===uuid(1)?"GLD":"IBIT";const list=request.expiration_dates.split(",").flatMap(expiry=>["call","put"].map(type=>({id:uuid(seq++),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:expiry,type,strike_price:"105",state:"active",tradability:"tradable",underlying_type:"equity",trade_value_multiplier:"100",min_ticks:{above_tick:"0.05",below_tick:"0.01",cutoff_price:"3.00"}})));list.forEach(i=>instruments.set(i.id,i));return {data:{instruments:list,next:null}};}
    if(tool==="get_option_quotes")return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:"0.19",ask_price:"0.20",bid_size:20,ask_size:20,delta:instruments.get(id).type==="call"?"0.5":"-0.5",updated_at:at}}))}};
    throw Error("Tool not allowed");
  }};
}
const fixture=async()=>{const m=mock();return collectGuidanceMarket({call:m.call.bind(m),clock:async()=>at});};
await test("Host selects existing IDs and batches bounded market-only calls",async()=>{const m=mock(),r=await collectGuidanceMarket({call:m.call.bind(m),clock:async()=>at});assert.equal(r.selectedIds.length,12);assert.equal(r.calls,6);assert.equal(r.failures.length,0);assert.equal(normalizeGuidanceCapture(r).complete,true);assert(m.calls.every(c=>["get_option_chains","get_equity_quotes","get_option_instruments","get_option_quotes"].includes(c.tool)));});
await test("Host failures are sanitized and cannot claim complete coverage",async()=>{const r=await collectGuidanceMarket({call:async()=>{throw Error("PRIVATE_DETAIL_MUST_NOT_ESCAPE");},clock:async()=>at});assert(!JSON.stringify(r).includes("PRIVATE_DETAIL"));assert.equal(normalizeGuidanceCapture(r).complete,false);});
await test("Host deadline prevents later source calls",async()=>{const m=mock();let n=0;const r=await collectGuidanceMarket({call:m.call.bind(m),clock:async()=>n++? "2026-09-08T14:04:00.000Z":at});assert.equal(r.calls,0);assert(r.failures.some(f=>f.code==="COLLECTION_BOUND_REACHED"));});
await test("capture rejects an unrelated source tool",async()=>{const r=await fixture();r.receipts[0].tool="get_account";assert.throws(()=>normalizeGuidanceCapture(r),/TOOL_NOT_ALLOWED/);});
await test("capture rejects quote identity substitution",async()=>{const r=await fixture();r.receipts.at(-1).response.data.results[0].quote.instrument_id=uuid(999);assert.throws(()=>normalizeGuidanceCapture(r),/QUOTE_IDENTITY/);});
await test("sub-cent premiums cannot silently round into the budget",async()=>{const r=await fixture();r.receipts.at(-1).response.data.results[0].quote.ask_price="0.201";assert.equal(normalizeGuidanceCapture(r).quotes[0].askCents,null);});
await test("interpolated official close is not a trend observation",async()=>{const r=await fixture();r.receipts[0].response.data.results[0].close.interpolated=true;assert.equal(normalizeGuidanceCapture(r).equities[0].close,null);});
await test("daily router retains 09:00 context and 16:20 close",()=>{assert(routeDailyGuidance("2026-09-08T13:00:00Z").dailyContext);assert(routeDailyGuidance("2026-09-08T20:20:00Z").closeCapture);assert(routeDailyGuidance("2026-09-16T20:20:00Z").restoreAfterClose);assert(routeDailyGuidance("2026-09-08T13:50:00Z").marketCapture);});
await test("hourly news continues on weekends; market capture does not",()=>{const r=routeDailyGuidance("2026-09-12T13:20:00Z");assert(r.refreshNews);assert.equal(routeDailyGuidance("2026-09-12T13:50:00Z").marketCapture,false);});
await test("daily close expires without cancelling ongoing guidance",()=>{const r=routeDailyGuidance("2026-09-17T20:20:00Z");assert.equal(r.closeCapture,false);assert(r.refreshNews);assert(r.pastCloseWindow);});
async function temp(fn) {const root=mkdtempSync(join(tmpdir(),"alpha-guidance-test-"));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith("..")||!rel.startsWith("alpha-guidance-test-"))throw Error("UNSAFE_TEST_CLEANUP");rmSync(full,{recursive:true,force:true});}}
const state=()=>({loadedAt:new Date().toISOString(),headlines:{data:null},calendar:{data:null}});
await test("empty stores give an explicit current WATCH and no invented history",()=>temp(root=>{const r=guidanceView(root,state());assert.equal(r.current.assets[0].disposition,"WATCH");assert.equal(r.history.length,0);assert.equal(r.current.settings.roundTripFeesCents,null);}));
await test("exclusive report saves recover and expose tampering",()=>temp(root=>{const path=publishGuidance(root,state());assert.equal(verifyGuidanceRecord(root,path).status,"VERIFIED");const data=JSON.parse(readFileSync(join(root,path),"utf8"));data.report.executionAllowed=true;writeFileSync(join(root,path),JSON.stringify(data));assert.throws(()=>verifyGuidanceRecord(root,path),/INTEGRITY/);}));
await test("settings are independent append-only declarations",()=>temp(root=>{const first=saveGuidanceSettings(root,defaultGuidanceSettings()),second=saveGuidanceSettings(root,{...defaultGuidanceSettings(),roundTripFeesCents:10});assert.notEqual(first,second);assert.equal(verifyGuidanceRecord(root,first).status,"VERIFIED");assert.equal(guidanceView(root,state()).current.settings.roundTripFeesCents,10);}));
await test("same scheduled slot cannot be claimed twice",()=>temp(root=>{assert(claimGuidanceSlot(root,"2026-09-08-0950").claimed);assert.equal(claimGuidanceSlot(root,"2026-09-08-0950").claimed,false);assert.throws(()=>claimGuidanceSlot(root,"../../escape"),/SLOT/);}));
await test("renderer escapes analyst text and preserves cost drafts",()=>{const i=input(),r=assessDailyGuidance(i),html=guidancePage({loadedAt:at,guidance:{state:"AVAILABLE",data:{current:r,history:[],interpretation:{assessedAt:at,assets:[{symbol:"GLD",bias:"MIXED",summary:'<img src=x onerror=alert(1)>',supporting:[],opposing:[],invalidation:"Wait",eventPlan:"Wait",sources:[]}]}}}},{guidanceSettingsDraft:{roundTripFeesCents:"1.23"}});assert(!html.includes("<img"));assert(html.includes("&lt;img"));assert(html.includes('value="1.23"'));assert(html.includes("Stop trigger"));assert(!html.includes('data-order'));});
await test("protected settings endpoint never accepts cross-origin mutations",()=>temp(async root=>{const app=await startOptionsWorkbench({workspaceRoot:root,port:0});try{const r=await fetch(app.url+"/api/guidance-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(defaultGuidanceSettings())});assert.equal(r.status,403);const data=await(await fetch(app.url+"/api/state")).json();const saved=await fetch(app.url+"/api/guidance-settings",{method:"POST",headers:{"Content-Type":"application/json",Origin:app.url,"X-Alpha-Session":data.session},body:JSON.stringify(defaultGuidanceSettings())});assert.equal(saved.status,200);assert.equal((await saved.json()).executionAllowed,false);}finally{await app.close();}}));
await test("delayed close remains eligible until the original 18:00 boundary",()=>{assert(routeDailyGuidance("2026-09-08T21:20:00Z").closeCapture);assert.equal(routeDailyGuidance("2026-09-08T22:00:00Z").closeCapture,false);});
await test("missed final close restores on the same evening",()=>{assert(routeDailyGuidance("2026-09-16T22:00:00Z").pastCloseWindow);});
await test("ongoing phase cannot rerun or restore the bounded close job",()=>{const r=routeDailyGuidance("2026-09-16T21:20:00Z",{ongoing:true});assert.equal(r.closeCapture,false);assert.equal(r.restoreAfterClose,false);assert.equal(r.pastCloseWindow,false);assert(r.refreshNews);});
await test("Host schedule has exactly the intended 28 daily wakes",()=>{const fields=JSON.parse(readFileSync(new URL("../docs/OPTIONS_DAILY_GUIDANCE_HOST_V1.json",import.meta.url),"utf8"));const rule=fields.transitionalFields.rrule;const positions=rule.match(/BYSETPOS=([0-9,]+)/)[1].split(",").map(Number);const all=Array.from({length:24},(_,hour)=>[0,20,50].map(minute=>String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0"))).flat();const actual=positions.map(p=>all[p-1]);assert.equal(new Set(actual).size,28);for(let h=0;h<24;h++)assert(actual.includes(String(h).padStart(2,"0")+":20"));for(const t of ["09:00","09:50","12:50","15:50"])assert(actual.includes(t));assert(fields.ongoingFields.prompt.includes("--route-ongoing"));});
await test("a quote beyond its receipt-second bound is rejected",async()=>{const r=await fixture();r.receipts.at(-1).response.data.results[0].quote.updated_at="2026-09-08T14:00:01.000Z";assert.throws(()=>normalizeGuidanceCapture(r),/QUOTE_FUTURE_RECEIPT/);});
await test("missing quote identities survive capture recovery and current guidance",()=>temp(async root=>{let r=await fixture();r=JSON.parse(JSON.stringify(r).replaceAll(at,"2026-09-07T14:00:00.000Z"));r.origin="SYNTHETIC_FIXTURE";r.receipts.at(-1).response.data.results[0].quote=null;writeFileSync(join(root,"market-input.json"),JSON.stringify(r));const path=recordGuidanceMarket(root,"market-input.json");assert.equal(verifyGuidanceRecord(root,path).status,"VERIFIED");const v=guidanceView(root,state()),all=v.current.assets.flatMap(a=>a.candidates);assert.equal(all.length,12);assert.equal(all.filter(c=>c.contract.askCents===null).length,1);assert(v.current.assets.every(a=>a.disposition==="WATCH"));}));
await test("exact trend threshold does not round equality into an uptrend",()=>{const i=input();i.closeHistory=i.closeHistory.map((c,n)=>({...c,price:String([995,996,1002,1003,1004][n%5])}));assert.equal(assessDailyGuidance(i).assets[0].trend.direction,"RANGE");});
await test("issued views cannot claim a future assessment clock",()=>temp(root=>{assert.throws(()=>publishGuidance(root,{...state(),loadedAt:new Date(Date.now()+86400000).toISOString()}),/FUTURE_ISSUED_ASSESSMENT/);}));
const v2=()=>({...input(),version:'OPTIONS_DAILY_GUIDANCE_INPUT_V2'});
function moveClock(i,clock){i.at=clock;i.captureAt=clock;i.quotes.forEach(q=>{q.updatedAt=clock;q.receivedAt=clock;});i.equities.forEach(e=>e.sourceAt=clock);if(i.analyst)i.analyst.assessedAt=clock;return i;}
await test('V2 preserves conditional research on an eligible ordinary session',()=>{const r=assessDailyGuidance(v2());assert.equal(r.version,'OPTIONS_DAILY_GUIDANCE_V4');assert(r.marketSession.isOpen);assert.equal(r.assets[0].candidates[0].disposition,'CONDITIONAL_RESEARCH');assert.equal(r.marketSession.lateCloseApplied,false);});
await test('V1 keeps its historical weekday behavior on Labor Day while V2 closes',()=>{const i=moveClock(input(),'2026-09-07T14:00:00.000Z');const old=assessDailyGuidance(i);assert.equal(old.assets[0].candidates[0].disposition,'CONDITIONAL_RESEARCH');assert(!Object.hasOwn(old,'marketSession'));i.version='OPTIONS_DAILY_GUIDANCE_INPUT_V2';const r=assessDailyGuidance(i);assert(r.marketSession.holiday);assert(r.assets[0].blockers.includes('OUTSIDE_REGULAR_SESSION'));});
await test('V2 removes a holiday close without changing V1 history',()=>{const i=input();i.closeHistory=i.closeHistory.map(c=>c.date==='2026-08-31'?{...c,date:'2026-09-07'}:c);assert.equal(assessDailyGuidance(i).assets[0].trend.closes.length,5);i.version='OPTIONS_DAILY_GUIDANCE_INPUT_V2';assert.equal(assessDailyGuidance(i).assets[0].trend.closes.length,4);});
await test('early-close boundary is 13:00 New York without option late-close inference',()=>{const i=moveClock(v2(),'2026-11-27T17:59:59.000Z');i.quotes.forEach(q=>q.expiry='2026-12-18');assert(assessDailyGuidance(i).marketSession.isOpen);moveClock(i,'2026-11-27T18:00:00.000Z');const r=assessDailyGuidance(i);assert.equal(r.marketSession.closeLocal,'13:00');assert.equal(r.marketSession.isOpen,false);assert(r.assets[0].blockers.includes('OUTSIDE_REGULAR_SESSION'));});
await test('summer and winter regular session boundaries use New York time',()=>{for(const [open,close]of [['2026-09-08T13:30:00.000Z','2026-09-08T20:00:00.000Z'],['2026-12-01T14:30:00.000Z','2026-12-01T21:00:00.000Z']]){const i=moveClock(v2(),open);i.quotes.forEach(q=>q.expiry=open.slice(0,7)==='2026-12'?'2026-12-18':'2026-09-25');assert(assessDailyGuidance(i).marketSession.isOpen);moveClock(i,close);assert.equal(assessDailyGuidance(i).marketSession.isOpen,false);}});
await test('unreviewed future calendar year blocks rather than assuming an open day',()=>{const i=moveClock(v2(),'2027-01-05T15:00:00.000Z');i.quotes.forEach(q=>q.expiry='2027-01-29');const r=assessDailyGuidance(i);assert.equal(r.marketSession.knownYear,false);assert(r.assets[0].blockers.includes('SESSION_CALENDAR_YEAR_UNREVIEWED'));});
await test('V2 requires attributed analysis even when the field was omitted',()=>{const i=v2();delete i.analyst;assert(assessDailyGuidance(i).assets[0].blockers.includes('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'));i.version='OPTIONS_DAILY_GUIDANCE_INPUT_V1';assert(!assessDailyGuidance(i).assets[0].blockers.includes('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'));});
await test('newer capture cannot reuse a previous analyst assessment in V2',()=>{const i=v2();i.analyst.assessedAt='2026-09-08T13:59:00.000Z';assert(assessDailyGuidance(i).assets[0].blockers.includes('MARKET_EVIDENCE_NEWER_THAN_ANALYSIS'));i.analyst.assessedAt=at;assert(!assessDailyGuidance(i).assets[0].blockers.includes('MARKET_EVIDENCE_NEWER_THAN_ANALYSIS'));});
await test('current storage and frontend expose the reviewed session policy',()=>temp(root=>{const v=guidanceView(root,{loadedAt:'2026-09-07T14:00:00.000Z'});assert.equal(v.input.version,'OPTIONS_DAILY_GUIDANCE_INPUT_V2');const html=guidancePage({loadedAt:v.input.at,guidance:{data:v}});assert(html.includes('Regular-session guidance: closed'));assert(html.includes('Closed day'));}));
console.log(passed+"/"+passed+" tests passed.");
