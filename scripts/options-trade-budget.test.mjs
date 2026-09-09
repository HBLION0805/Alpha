import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {evaluateOptionsRetailFeasibility as legacy} from '../src/engines/options-retail-feasibility/OptionsRetailFeasibilityEngine.ts';
import {evaluateOptionsPlanningFeasibility as evaluate,validateTradeBudget} from '../src/engines/options-retail-feasibility/OptionsTradeBudget.ts';
import {assessDailyGuidance,defaultGuidanceSettings,validateGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {assessCandidateChecks} from '../src/engines/options-daily-guidance/OptionsCandidateChecks.ts';
import {saveCandidateChecks,readCandidateChecks} from './lib/options-candidate-checks-io.mjs';
import {saveGuidanceSettings,guidanceSettings} from './lib/options-guidance-io.mjs';
import {plannerDefaults,plannerBudgetDraft,buildScenario,tradeBudgetFromFields,plannerForm} from '../apps/options-workbench/forms.js';
import {filterCandidateChecks,candidateChecksPanel} from '../apps/options-workbench/candidate-checks.js';
import {guidancePage} from '../apps/options-workbench/guidance.js';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';

const budget=()=>({version:'OWNER_TRADE_BUDGET_V1',minCents:10000,maxCents:50000});
const base=()=>({symbol:'IBIT',strategy:'LONG_CALL',currentEquityCents:100000,settledCashCents:100000,quantity:1,contractMultiplier:100,bidPerShareCents:199,askPerShareCents:200,minimumPriceTickCents:1,roundTripFeesCents:0,slippageReserveCents:0,mode:'NORMAL',stopLossBps:2000,rewardMultipleMilliR:2000});
const calc=(changes={})=>evaluate({...base(),tradeBudget:budget(),...changes});
const codes=r=>r.blockers.map(b=>b.code);
const at='2026-09-08T14:00:00.000Z';
function guidance(custom=true){return {version:'OPTIONS_DAILY_GUIDANCE_INPUT_V1',at,captureAt:at,captureOrigin:'HOST_MARKET_TOOL_RESPONSES',captureComplete:true,
  quotes:[82,120,725].map((askCents,i)=>({id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),symbol:'IBIT',expiry:'2026-09-25',type:'call',strike:'44',multiplier:100,bidCents:askCents-1,askCents,tickCents:1,bidSize:3,askSize:3,delta:0.5,updatedAt:at,receivedAt:at})),
  equities:[{symbol:'IBIT',price:'44',sourceAt:at,close:null}],closeHistory:[],events:[],calendarAvailable:true,headlinesAvailable:true,sourceHealth:[],headlines:[],context:{treasury:null,btc:null},settings:{...defaultGuidanceSettings(),...(custom?{tradeBudget:budget()}:{}),roundTripFeesCents:0,slippageReserveCents:0}};}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-budget-test-'));try{await fn(root);}finally{const p=realpathSync(root),r=relative(realpathSync(tmpdir()),p);if(isAbsolute(r)||r.startsWith('..')||!r.startsWith('alpha-budget-test-'))throw Error('UNSAFE_CLEANUP');rmSync(p,{recursive:true,force:true});}}

await test('legacy evaluation is byte equivalent without a budget declaration',()=>{for(const b of [base(),{...base(),roundTripFeesCents:null},{...base(),askPerShareCents:-1},null])assert.deepEqual(evaluate(b),legacy(b));});
await test('owner range replaces allocation only and preserves every independent amount',()=>{
  const b=base(),old=legacy(b),input={...b,tradeBudget:budget()},before=JSON.stringify(input),r=evaluate(input);
  assert.equal(JSON.stringify(input),before);assert.equal(r.schemaVersion,'3.0');assert.equal(r.economics.applicableAllocationBudgetCents,50000);assert.equal(r.economics.minimumAllocationBudgetCents,10000);assert.equal(r.economics.legacyAllocationBudgetCents,5000);
  for(const [k,v] of Object.entries(old.economics))if(!['normalAllocationBudgetCents','requestedAllocationBudgetCents','applicableAllocationBudgetCents'].includes(k))assert.deepEqual(r.economics[k],v,k);
  assert.deepEqual(codes(r),codes(old).filter(x=>x!=='ALLOCATION_BUDGET_EXCEEDED'));assert(codes(r).includes('PLANNED_RISK_BUDGET_EXCEEDED'));assert(codes(r).includes('LEGACY_MAX_LOSS_LIMIT_EXCEEDED'));assert.equal(r.status,'NO_TRADE');assert.equal(r.executionAllowed,false);assert(Object.isFrozen(r.scenario.tradeBudget));
});
for(const [ask,expected] of [[99,'ALLOCATION_BELOW_MINIMUM'],[100,null],[500,null],[501,'ALLOCATION_BUDGET_EXCEEDED']])await test('inclusive whole-position boundary '+ask,()=>{const r=calc({askPerShareCents:ask,bidPerShareCents:ask-1}),a=codes(r).filter(c=>c.startsWith('ALLOCATION_'));assert.deepEqual(a,expected?[expected]:[]);});
await test('fees may cross either range boundary and never disappear',()=>{
  assert(!codes(calc({askPerShareCents:99,bidPerShareCents:98,roundTripFeesCents:100})).includes('ALLOCATION_BELOW_MINIMUM'));
  assert(codes(calc({askPerShareCents:500,bidPerShareCents:499,roundTripFeesCents:1})).includes('ALLOCATION_BUDGET_EXCEEDED'));
});
await test('unknown fees cannot prove the minimum but premium proves a maximum breach',()=>{
  const low=calc({askPerShareCents:82,bidPerShareCents:81,roundTripFeesCents:null});assert(codes(low).includes('COSTS_UNKNOWN'));assert(!codes(low).includes('ALLOCATION_BELOW_MINIMUM'));assert.equal(low.economics.capitalRequiredCents,null);
  assert(codes(calc({askPerShareCents:501,bidPerShareCents:500,roundTripFeesCents:null})).includes('ALLOCATION_BUDGET_EXCEEDED'));
});
await test('quantities are explicit and a lower bound never buys extra contracts',()=>{
  const one=calc({askPerShareCents:82,bidPerShareCents:81}),two=calc({askPerShareCents:82,bidPerShareCents:81,quantity:2});assert.equal(one.scenario.quantity,1);assert(codes(one).includes('ALLOCATION_BELOW_MINIMUM'));assert.equal(two.economics.premiumCents,16400);assert(!codes(two).includes('ALLOCATION_BELOW_MINIMUM'));
});
await test('cash friction and probability blockers survive the allocation change',()=>{
  const r=calc({settledCashCents:10000,bidPerShareCents:100,mode:'CONDITIONAL',claimedWinProbabilityBps:9900});for(const code of ['SETTLED_CASH_INSUFFICIENT','STOP_BUDGET_NOT_EXECUTABLE','UNCALIBRATED_WIN_RATE'])assert(codes(r).includes(code));assert.equal(r.economics.applicableAllocationBudgetCents,50000);
});
for(const [name,value] of [['null',null],['array',[]],['missing max',{version:'OWNER_TRADE_BUDGET_V1',minCents:10000}],['wrong version',{...budget(),version:'unknown'}],['zero minimum',{...budget(),minCents:0}],['negative',{...budget(),minCents:-1}],['inverted',{...budget(),minCents:60000}],['fractional cent',{...budget(),minCents:10000.5}],['string',{...budget(),maxCents:'50000'}],['infinite',{...budget(),maxCents:Infinity}],['too large',{...budget(),maxCents:100000001}],['risk override',{...budget(),plannedRiskBudgetBps:1000}]])await test('reject invalid budget '+name,()=>assert.throws(()=>validateTradeBudget(value),/TRADE_BUDGET/));
await test('getters and hidden fields never become budget declarations',()=>{let called=false;const b={...budget()};Object.defineProperty(b,'minCents',{enumerable:true,get(){called=true;return 1;}});assert.throws(()=>validateTradeBudget(b));assert.equal(called,false);const x={...base()};Object.defineProperty(x,'tradeBudget',{enumerable:true,get(){called=true;return budget();}});assert(codes(evaluate(x)).includes('INVALID_INPUT'));assert.equal(called,false);});
await test('new guidance and candidate reports separate below within over without rewriting legacy',()=>{
  const old=guidance(false),before=paperFingerprint(assessDailyGuidance(old)),r=assessDailyGuidance(guidance()),c=assessCandidateChecks({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',guidance:guidance(),sourcePaths:[]});
  assert.equal(r.version,'OPTIONS_DAILY_GUIDANCE_V2');assert.equal(c.version,'OPTIONS_CANDIDATE_CHECKS_V2');assert.deepEqual([c.counts.premiumBelowBudget,c.counts.premiumWithinBudget,c.counts.premiumOverBudget],[1,1,1]);assert.equal(c.counts.conditionalResearch,0);
  for(const [filter,price] of [['below',82],['within',120],['over',725]])assert.equal(filterCandidateChecks(c.rows,{budget:filter})[0].contract.askCents,price);
  assert.equal(paperFingerprint(assessDailyGuidance(old)),before);assert(!Object.hasOwn(assessCandidateChecks({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',guidance:old,sourcePaths:[]}).counts,'premiumBelowBudget'));
});
await test('unknown fee minimum is explicit in candidate capital checks',()=>{const i=guidance();i.settings.roundTripFeesCents=null;const r=assessCandidateChecks({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',guidance:i,sourcePaths:[]});assert.equal(r.rows[0].budgetPosition,'BELOW');assert.equal(r.rows[0].checks.find(c=>c.id==='allocation').status,'UNKNOWN');assert.equal(r.rows[2].checks.find(c=>c.id==='allocation').status,'BLOCKED');});
await test('saved settings and both snapshot versions recover without rewriting old records',()=>temp(root=>{
  const prior=saveGuidanceSettings(root,defaultGuidanceSettings()),bytes=readFileSync(resolve(root,prior));
  const old=saveCandidateChecks(root,{input:guidance(false),sourcePaths:[]}),oldBytes=readFileSync(resolve(root,old.path));
  const next={...defaultGuidanceSettings(),tradeBudget:budget()};saveGuidanceSettings(root,next);assert.deepEqual(guidanceSettings(root),next);assert(readFileSync(resolve(root,prior)).equals(bytes));
  const newer=saveCandidateChecks(root,{input:guidance(),sourcePaths:[]});assert.equal(readCandidateChecks(root,newer.path).report.version,'OPTIONS_CANDIDATE_CHECKS_V2');assert.equal(readCandidateChecks(root,old.path).report.version,'OPTIONS_CANDIDATE_CHECKS_V1');assert(readFileSync(resolve(root,old.path)).equals(oldBytes));
}));
await test('planner inherits saved range preserves explicit edits and supports legacy blank pairs',()=>{
  const settings={tradeBudget:budget()},d={...plannerDefaults(),bid:'1.99',ask:'2.00'},draft=plannerBudgetDraft(d,settings);assert.deepEqual(buildScenario(draft).tradeBudget,budget());assert.equal(draft.budgetMin,'100.00');assert.equal(draft.budgetMax,'500.00');
  assert.equal(plannerBudgetDraft({...d,budgetMax:'400'},settings).budgetMax,'400');assert(!Object.hasOwn(buildScenario({...draft,budgetMin:'',budgetMax:''}),'tradeBudget'));assert.throws(()=>tradeBudgetFromFields({budgetMin:'100',budgetMax:''}),/both/);assert.throws(()=>tradeBudgetFromFields({budgetMin:'100.001',budgetMax:'500'}));assert(plannerForm(draft).includes('Per-trade maximum'));
});
await test('guidance and candidate frontend show the declared range and independent risk',()=>{
  const input=guidance(),current=assessDailyGuidance(input),checks=assessCandidateChecks({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',guidance:input,sourcePaths:[]}),c={data:{current:checks,history:[]}};
  const html=candidateChecksPanel(c,{candidateCheckFilter:{budget:'below'}});assert(html.includes('Showing 1 / 3'));assert(html.includes('$100.00–$500.00'));assert(html.includes('full-premium stress at $25'));assert(html.includes('1 below the range'));
  const page=guidancePage({loadedAt:at,guidance:{data:{current,history:[]}},candidateChecks:c});assert(page.includes('value="100.00"'));assert(page.includes('value="500.00"'));assert(page.includes('Per-trade allocation range'));
});
await test('protected settings save activates range and restarts without changing risk caps',()=>temp(async root=>{
  let app=await startOptionsWorkbench({workspaceRoot:root,port:0});try{
    const state=await(await fetch(app.url+'/api/state')).json(),headers={'Content-Type':'application/json',Origin:app.url,'X-Alpha-Session':state.session};
    const value={...defaultGuidanceSettings(),tradeBudget:budget()};assert.equal((await fetch(app.url+'/api/guidance-settings',{method:'POST',headers,body:JSON.stringify(value)})).status,200);
    const invalid={...value,tradeBudget:{...budget(),minCents:60000}};assert.equal((await fetch(app.url+'/api/guidance-settings',{method:'POST',headers,body:JSON.stringify(invalid)})).status,409);assert.deepEqual(guidanceSettings(root),value);
    const result=await(await fetch(app.url+'/api/evaluate',{method:'POST',headers,body:JSON.stringify({...base(),tradeBudget:budget()})})).json();assert.equal(result.economics.applicableAllocationBudgetCents,50000);assert.equal(result.economics.plannedRiskBudgetCents,500);assert.equal(result.economics.legacyNormalMaxLossCents,2500);
    await app.close();app=await startOptionsWorkbench({workspaceRoot:root,port:0});const recovered=await(await fetch(app.url+'/api/state')).json();assert.deepEqual(recovered.guidance.data.current.settings,value);assert.equal(recovered.guidance.data.current.settings.currentEquityCents,100000);assert.equal(recovered.executionAllowed,false);
  }finally{await app.close();}
}));
console.log(passed+'/'+passed+' tests passed.');
