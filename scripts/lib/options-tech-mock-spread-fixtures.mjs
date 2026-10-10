import {mockLifecycleFixture} from './options-tech-mock-fixtures.mjs';
export function mockSpreadFixture(structure='CDS',symbol='AAPL'){
 const single=mockLifecycleFixture(symbol),r=single.input.research;r.fundamental.direction=r.news.direction=structure==='CDS'?'UP':'DOWN';
 const base=single.input.selectionQuote,type=structure==='CDS'?'call':'put';
 const contracts=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',symbol,expiry:'2026-10-16',type,strike:structure==='CDS'?'340.00':'345.00',multiplier:100,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:'tradable'},
 {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',symbol,expiry:'2026-10-16',type,strike:structure==='CDS'?'345.00':'340.00',multiplier:100,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:'tradable'}];
 const input={version:'TECH_MOCK_DEBIT_SPREAD_V1',mode:'MOCK',executionModel:'ATOMIC_TWO_LEG_ASSUMPTION',candidate:{id:'mock-spread',symbol,origin:'SYNTHETIC_FIXTURE'},research:r,structure,decisionAt:single.input.evidence.decisionAt,entryDeadlineAt:single.input.evidence.entryDeadlineAt,timeExitAt:single.input.evidence.timeExitAt,quantity:1,
  legs:contracts.map((contract,i)=>({role:i===0?'LONG':'SHORT',quantity:1,contract,entryFeeCents:5,exitFeeCents:5,exitSlippageCents:1})),entryDebitLimitCents:105,maxLegSpreadCents:10,
  account:{mode:'MOCK',id:'MOCK',currency:'USD',provider:'SYNTHETIC_TEST_ONLY',permission:'PASS',products:[structure],dataEntitlement:'PASS',settledCashCents:20000,reservedCashCents:0,maximumLossCents:11000,tradeBudgetMaxCents:11000,reviewedAt:r.asOf,validThrough:'2026-10-09T15:00:00.000Z'}};
 const event=(id,time,longBid=200,longAsk=202,shortBid=100,shortAsk=102)=>{const at='2026-10-09T'+time+'.000Z';return {id,origin:'SYNTHETIC_FIXTURE',quote:{receivedAt:at,source:'SYNTHETIC_TEST_ONLY',executionState:'ATOMIC_QUOTE_PAIR',action:'OBSERVE',legs:contracts.map((c,i)=>({...structuredClone(base),...c,bidCents:i===0?longBid:shortBid,askCents:i===0?longAsk:shortAsk,updatedAt:at,receivedAt:at,underlyingAt:at}))}};};
 return {input,event,entry:event('mock-entry','14:16:41'),exit:event('mock-exit','14:23:30',190,192,93,95)};
}
