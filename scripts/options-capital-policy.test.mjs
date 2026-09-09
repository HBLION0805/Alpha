import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {assessOptionsCapitalPolicy as assess} from '../src/engines/options-retail-feasibility/OptionsCapitalPolicy.ts';
import {optionsRetailRiskLimits,evaluateOptionsRetailFeasibility} from '../src/engines/options-retail-feasibility/OptionsRetailFeasibilityEngine.ts';
import {defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {capitalPolicyPanel,policySettingsFromFields,capitalPolicyMatches} from '../apps/options-workbench/capital-policy.js';
import {saveGuidanceSettings} from './lib/options-guidance-io.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {request as browserRequest} from '../apps/options-workbench/api.js';
const base=()=>({...defaultGuidanceSettings(),tradeBudget:{version:'OWNER_TRADE_BUDGET_V1',minCents:10000,maxCents:50000}});
const codes=r=>r.conflicts.map(x=>x.code);
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-capital-test-'));try{await fn(root);}finally{const p=realpathSync(root),r=relative(realpathSync(tmpdir()),p);if(isAbsolute(r)||r.startsWith('..')||!r.startsWith('alpha-capital-test-'))throw Error('UNSAFE_CLEANUP');rmSync(p,{recursive:true,force:true});}}

await test('current allocation conflicts independently of quotes and unknown costs',()=>{
  const r=assess(base());assert.equal(r.status,'CONFLICTING_CONSTRAINTS');assert.deepEqual(codes(r),['MINIMUM_EXCEEDS_STRESS','MINIMUM_EXCEEDS_PLANNED_LOSS_BOUND']);assert.equal(r.constraints.necessaryUpperBoundCents,2500);assert.equal(r.limits.plannedRiskBudgetCents,500);assert.equal(r.limits.fullPremiumStressCapCents,2500);
});
await test('unknown exact losses remain null beside separately labeled lower bounds',()=>{const r=assess(base());assert.deepEqual(r.rows.map(x=>x.capitalCents),[10000,30000,50000]);assert.deepEqual(r.rows.map(x=>x.plannedLossCents),[null,null,null]);assert.deepEqual(r.rows.map(x=>x.plannedLossLowerBoundCents),[2000,6000,10000]);assert(r.rows.every(x=>x.premiumCents===null&&x.standardContractPossibleByCents===null));assert.deepEqual(r.constraints.unknownCosts,['ROUND_TRIP_FEES','EXIT_SLIPPAGE']);});
await test('fee reserve is subtracted from capital and counted once in planned loss',()=>{const r=assess({...base(),roundTripFeesCents:100,slippageReserveCents:200});assert.equal(r.rows[0].premiumCents,9900);assert.equal(r.rows[0].plannedLossCents,2280);assert.equal(r.rows[0].fullPremiumStressCents,10000);assert.equal(r.constraints.plannedCapitalUpperBoundCents,1104);});
await test('unknown exit reserve preserves known fees without producing exact risk',()=>{const r=assess({...base(),roundTripFeesCents:100});assert.equal(r.rows[0].plannedLossLowerBoundCents,2080);assert.equal(r.rows[0].plannedLossCents,null);assert.equal(r.rows[0].premiumCents,9900);assert.deepEqual(r.constraints.unknownCosts,['EXIT_SLIPPAGE']);});
await test('unknown fees preserve a known exit reserve in the lower bound',()=>{const r=assess({...base(),slippageReserveCents:200});assert.equal(r.rows[0].plannedLossLowerBoundCents,2200);assert.equal(r.rows[0].plannedLossCents,null);assert.equal(r.rows[0].premiumCents,null);});
await test('explicit zero-cost declarations remain distinct from unknown',()=>{const r=assess({...base(),roundTripFeesCents:0,slippageReserveCents:0});assert.equal(r.rows[0].plannedLossCents,2000);assert.deepEqual(r.constraints.unknownCosts,[]);assert.equal(r.rows[0].standardContractPossibleByCents,true);});
await test('planned-capital bound preserves the original floor at the next cent',()=>{
  for(const stopLossBps of [1000,1500,2000,2500])for(const fee of [0,1,99,100,499]){
    const r=assess({...base(),stopLossBps,roundTripFeesCents:fee,slippageReserveCents:0}),a=r.constraints.plannedCapitalUpperBoundCents;
    const risk=x=>Math.floor((x-fee)*stopLossBps/10000)+fee;
    assert(risk(a)<=r.limits.plannedRiskBudgetCents);assert(risk(a+1)>r.limits.plannedRiskBudgetCents);
  }
});
await test('cent-exact lower bound agrees with original economics for standard contracts',()=>{
  for(const ask of [1,10,25,100,300,500])for(const fee of [0,1,10,100])for(const slip of [0,1,100])for(const stop of [1000,1500,2000,2500]){
    const capital=ask*100+fee,r=assess({...base(),roundTripFeesCents:fee,slippageReserveCents:slip,stopLossBps:stop,tradeBudget:{...base().tradeBudget,minCents:capital,maxCents:capital}});
    const old=evaluateOptionsRetailFeasibility({symbol:'IBIT',strategy:'LONG_CALL',currentEquityCents:100000,settledCashCents:100000,quantity:1,contractMultiplier:100,bidPerShareCents:ask,askPerShareCents:ask,minimumPriceTickCents:1,roundTripFeesCents:fee,slippageReserveCents:slip,mode:'NORMAL',stopLossBps:stop,rewardMultipleMilliR:2000});
    assert.equal(r.rows[0].plannedLossCents,old.economics.plannedStopCents);assert.equal(r.rows[0].fullPremiumStressCents,old.economics.stressLossCents);assert.equal(r.limits.plannedRiskBudgetCents,old.economics.plannedRiskBudgetCents);
  }
});
await test('legacy ceiling has no invented allocation floor or trade permission',()=>{const r=assess(defaultGuidanceSettings());assert.equal(r.allocation.minimumCents,null);assert.equal(r.allocation.maximumCents,5000);assert.equal(r.status,'NO_PROVEN_CAPITAL_CONFLICT');assert.equal(r.executionAllowed,false);assert.equal(r.winProbability,null);assert.equal(r.policyChanged,false);});
await test('exact stress boundary is allowed by capital inequalities only',()=>{const r=assess({...base(),roundTripFeesCents:0,slippageReserveCents:0,tradeBudget:{...base().tradeBudget,minCents:2500,maxCents:2500}});assert.equal(r.status,'NO_PROVEN_CAPITAL_CONFLICT');assert.equal(r.rows.length,1);assert.equal(r.rows[0].plannedLossCents,500);assert.equal(r.executionAllowed,false);const above=assess({...base(),tradeBudget:{...base().tradeBudget,minCents:2501,maxCents:2501}});assert(codes(above).includes('MINIMUM_EXCEEDS_STRESS'));});
await test('cash remains an independent capital constraint',()=>{const r=assess({...base(),settledCashCents:99});assert(codes(r).includes('MINIMUM_EXCEEDS_CASH'));assert(codes(r).includes('STANDARD_CONTRACT_LOWER_BOUND_EXCEEDS_CAPACITY'));assert.equal(r.constraints.necessaryUpperBoundCents,99);});
await test('costs exhausting planned risk cannot fabricate a positive allowance',()=>{const r=assess({...base(),roundTripFeesCents:501,slippageReserveCents:0});assert.equal(r.constraints.plannedCapitalUpperBoundCents,0);assert.equal(r.status,'CONFLICTING_CONSTRAINTS');});
await test('cost reserve exceeding an illustrated capital is unavailable, not negative premium',()=>{const r=assess({...base(),roundTripFeesCents:15000,slippageReserveCents:0});assert.equal(r.rows[0].premiumCents,null);assert.equal(r.rows[0].plannedLossCents,null);assert.equal(r.rows[0].plannedLossLowerBoundCents,null);assert(r.rows[0].inputIssue);});
await test('fractional whole-contract capital does not become a selected contract',()=>{const r=assess({...base(),roundTripFeesCents:1,slippageReserveCents:0});assert.equal(r.rows[0].standardContractPossibleByCents,false);assert.equal(r.executionAllowed,false);});
await test('equity changes planned limit but does not silently scale fixed stress',()=>{const r=assess({...base(),currentEquityCents:1000000});assert.equal(r.limits.plannedRiskBudgetCents,5000);assert.equal(r.limits.fullPremiumStressCapCents,2500);assert(codes(r).includes('MINIMUM_EXCEEDS_STRESS'));});
await test('input and original policy values remain immutable',()=>{const input=base(),before=JSON.stringify(input),r=assess(input);assert.equal(JSON.stringify(input),before);assert(!Object.isFrozen(input));assert(Object.isFrozen(r.rows[0]));assert(Object.isFrozen(r.settings.tradeBudget));});
for(const [name,value] of [['null',null],['array',[]],['extra',{...base(),fullPremiumStressCapCents:50000}],['fractional',{...base(),currentEquityCents:100.1}],['negative fees',{...base(),roundTripFeesCents:-1}],['range order',{...base(),tradeBudget:{...base().tradeBudget,minCents:50001}}],['unsupported stop',{...base(),stopLossBps:999}],['unsafe',{...base(),settledCashCents:Number.MAX_SAFE_INTEGER}]])await test('reject invalid declaration '+name,()=>assert.throws(()=>assess(value)));
await test('root and nested accessors are rejected without invoking them',()=>{let touched=false;const root={...base()};Object.defineProperty(root,'currentEquityCents',{get(){touched=true;return 1;},enumerable:true});assert.throws(()=>assess(root));const nested=base();Object.defineProperty(nested.tradeBudget,'minCents',{get(){touched=true;return 1;},enumerable:true});assert.throws(()=>assess(nested));assert.equal(touched,false);});
await test('shared limits reject invalid equity and use integer cents',()=>{assert.equal(optionsRetailRiskLimits(199).plannedRiskBudgetCents,0);assert.equal(optionsRetailRiskLimits(200).plannedRiskBudgetCents,1);for(const v of [0,-1,0.5,NaN,Infinity,'1000'])assert.throws(()=>optionsRetailRiskLimits(v));});
const fields=()=>({currentEquityCents:'1000',settledCashCents:'1000',roundTripFeesCents:'',slippageReserveCents:'',stopLossBps:'2000',rewardMultipleMilliR:'2000',budgetMin:'100',budgetMax:'500'});
await test('form preview parses the same settings and preserves blanks',()=>{assert.deepEqual(policySettingsFromFields(fields()),base());assert.throws(()=>policySettingsFromFields({...fields(),budgetMax:''}));assert.equal(policySettingsFromFields({...fields(),roundTripFeesCents:'0'}).roundTripFeesCents,0);});
await test('preview signature changes for every material field',()=>{assert(capitalPolicyMatches(base(),structuredClone(base())));for(const key of ['currentEquityCents','settledCashCents','stopLossBps','rewardMultipleMilliR'])assert(!capitalPolicyMatches(base(),{...base(),[key]:123}));for(const key of ['roundTripFeesCents','slippageReserveCents'])assert(!capitalPolicyMatches(base(),{...base(),[key]:0}));assert(!capitalPolicyMatches(base(),{...base(),tradeBudget:{...base().tradeBudget,minCents:5000}}));});
await test('frontend distinguishes saved constraints, unsaved preview and unknown risk',()=>{const r=assess(base()),html=capitalPolicyPanel(r);for(const t of ['Saved Daily guidance assumptions','No trade can meet','Unknown; at least $20.00','Full-premium stress','Fees: Unknown'])assert(html.includes(t),t);assert(capitalPolicyPanel(r,{preview:true}).includes('Unsaved capital preflight'));assert(!capitalPolicyPanel(r,{compact:true}).includes('<table>'));assert(!html.includes('type="submit"'));assert(capitalPolicyPanel(null).includes('unavailable'));});
await test('a nonempty arithmetic interval never displays a trade approval',()=>{const html=capitalPolicyPanel(assess(defaultGuidanceSettings()));assert(html.includes('all contract and trading checks still apply'));assert(!html.includes('trade-ready'));});
await test('protected preflight endpoint and saved projection perform no writes',()=>temp(async root=>{
  const saved=saveGuidanceSettings(root,base()),bytes=readFileSync(resolve(root,saved)),app=await startOptionsWorkbench({workspaceRoot:root,port:0});
  try{const before=readdirSync(root,{recursive:true}),state=await(await fetch(app.url+'/api/state')).json(),headers={'Content-Type':'application/json',Origin:app.url,'X-Alpha-Session':state.session};
    assert.deepEqual(state.capitalPolicy.data,assess(base()));assert.equal((await fetch(app.url+'/api/capital-policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base())})).status,403);
    const draft={...base(),stopLossBps:1000},r=await fetch(app.url+'/api/capital-policy',{method:'POST',headers,body:JSON.stringify(draft)});assert.equal(r.status,200);assert.deepEqual(await r.json(),assess(draft));
    assert.equal((await fetch(app.url+'/api/capital-policy',{method:'POST',headers,body:'{}'})).status,409);assert.equal((await fetch(app.url+'/api/capital-policy')).status,404);
    const asset=await fetch(app.url+'/capital-policy.js');assert.equal(asset.status,200);assert(asset.headers.get('content-security-policy'));
    assert.deepEqual(readdirSync(root,{recursive:true}),before);assert(readFileSync(resolve(root,saved)).equals(bytes));assert.deepEqual((await(await fetch(app.url+'/api/state')).json()).capitalPolicy.data.settings,base());
  }finally{await app.close();}
}));
await test('browser request allowlist reaches protected preview without granting external routes',()=>temp(async root=>{
  const app=await startOptionsWorkbench({workspaceRoot:root,port:0}),originalFetch=globalThis.fetch,originalLocation=globalThis.location;
  try{globalThis.location={origin:app.url};globalThis.fetch=(path,options)=>originalFetch(new URL(path,app.url),{...options,headers:{...options.headers,...(options.method==='POST'?{Origin:app.url}:{})}});
    await browserRequest('/api/state');const result=await browserRequest('/api/capital-policy',base());assert.deepEqual(result,assess(base()));
    await assert.rejects(browserRequest('https://example.com/api/capital-policy',base()),/Unsupported local request/);assert.deepEqual(readdirSync(root),[]);
  }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;await app.close();}
}));
console.log(passed+'/'+passed+' tests passed.');
