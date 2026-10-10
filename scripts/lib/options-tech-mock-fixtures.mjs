// Entirely fictional inputs for isolated engineering tests. Never market evidence.
import {createHash} from 'node:crypto';
import {fixture} from './options-three-facet-fixtures.mjs';
const stamp=s=>'2026-10-09T'+s+'.000Z';
function research(){
  const r=JSON.parse(JSON.stringify(fixture()).replaceAll('2026-10-08','2026-10-09').replaceAll('2026-10-09T14:17','2026-10-10T14:17'));
  r.symbol='AAPL';delete r.technical;r.asOf=stamp('14:16:00');r.holdingFrom=stamp('14:17:00');
  r.researchPlan={id:'SYNTHETIC_ONLY',registeredAt:r.asOf,sourceIds:['NEWS'],hypothesis:'Synthetic forward direction',triggerCondition:'Synthetic conditional future event',invalidationCondition:'Synthetic counterevidence',exitCondition:'Synthetic later review'};
  return r;
}
function request(){
 const r=research(),decision=stamp('14:16:30'),source=stamp('14:16:40'),receipt=stamp('14:16:41');
 const contract={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',symbol:'AAPL',expiry:'2026-10-16',type:'call',strike:'340.00',multiplier:100,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:'tradable'};
 const quote={...contract,bidCents:100,askCents:102,tickCents:1,bidSize:10,askSize:10,updatedAt:source,receivedAt:receipt,underlyingPriceUsd:'333.1234',underlyingAt:stamp('14:16:39'),underlyingPriceCents:null,aboveTickCents:5,belowTickCents:1,cutoffCents:300,chainSession:{chainId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',lateCloseState:'disabled',receivedAt:stamp('14:15:01')}};
 const payloads={CONTRACT:contract,QUOTE:quote,DATA_ENTITLEMENT:{provider:'SYNTHETIC_TEST_ONLY',symbols:['AAPL'],realtimeOptions:true,localRetention:true},PRODUCT_PERMISSION:{accountId:'SYNTHETIC',enabled:true,symbols:['AAPL'],products:['LONG_CALL']},ACCOUNT_FUNDS:{accountId:'SYNTHETIC',currency:'USD',settledCashCents:20000,reservedCashCents:0},RISK_LIMITS:{accountId:'SYNTHETIC',tradeBudgetMaxCents:11000,maximumLossCents:11000}};
 const records=Object.entries(payloads).map(([kind,p])=>{const rawJson=JSON.stringify(p);return {kind,origin:'SYNTHETIC_FIXTURE',source:'SYNTHETIC_TEST_ONLY',reviewedBy:'synthetic tester',observedAt:kind==='QUOTE'?source:stamp('14:15:00'),receivedAt:kind==='QUOTE'?receipt:stamp('14:15:01'),reviewedAt:kind==='QUOTE'?stamp('14:16:42'):stamp('14:16:00'),validThrough:stamp('15:00:00'),verdict:'PASS',rawJson,sha256:createHash('sha256').update(rawJson).digest('hex')};});
 return {research:r,at:stamp('14:16:50'),evidence:{version:'TECH_PAPER_EVIDENCE_V1',symbol:'AAPL',accountId:'SYNTHETIC',quantity:1,decisionAt:decision,entryDeadlineAt:stamp('14:18:30'),timeExitAt:stamp('14:23:30'),costsFrozenAt:stamp('14:16:00'),entryFeeCents:5,exitFeeCents:5,exitSlippageCents:1,entryLimitCents:105,maxSpreadCents:10,records}};
}

export function mockLifecycleFixture(symbol='AAPL') {
 const req=request();const e=req.evidence;e.accountId='MOCK';e.symbol=symbol;req.research.symbol=symbol;
 for(const rec of e.records){const p=JSON.parse(rec.rawJson);if(p.accountId)p.accountId='MOCK';if(p.symbol)p.symbol=symbol;if(p.symbols)p.symbols=[symbol];rec.rawJson=JSON.stringify(p);rec.sha256=createHash('sha256').update(rec.rawJson).digest('hex');}
 const entry=JSON.parse(e.records.find(x=>x.kind==='QUOTE').rawJson);
 e.records=e.records.filter(x=>x.kind!=='QUOTE');
 const selection=structuredClone(entry);selection.updatedAt=stamp('14:15:58');selection.receivedAt=stamp('14:15:59');selection.underlyingAt=stamp('14:15:58');
 const input={version:'TECH_MOCK_LIFECYCLE_V1',mode:'MOCK',path:'TRIAL_REHEARSAL',candidate:{id:'mock-candidate',symbol,origin:'SYNTHETIC_FIXTURE'},research:req.research,evidence:e,selectionQuote:selection,settings:{currentEquityCents:20000,settledCashCents:20000,roundTripFeesCents:10,slippageReserveCents:100,stopLossBps:2000,rewardMultipleMilliR:2000,tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:11000}}};
 const event=(id,time,bid=100,ask=102)=>({id,origin:'SYNTHETIC_FIXTURE',quote:{...structuredClone(entry),bidCents:bid,askCents:ask,updatedAt:stamp(time),receivedAt:stamp(time),underlyingAt:stamp(time)}});
 return {input,entry:event('mock-entry','14:16:41'),exit:event('mock-exit','14:23:30'),event};
}
