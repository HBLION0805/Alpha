import {mockSpreadFixture} from './options-tech-mock-spread-fixtures.mjs';
import {mockTechSpreadQuoteFixture,collectMockTechSpreadFixture} from './options-tech-spread-quote-fixtures.mjs';
import {spreadPlanHash} from './options-tech-spread-plan-binding.mjs';
export async function mockSpreadPlanFixture(structure='BULL_CALL_DEBIT'){
 const f=mockTechSpreadQuoteFixture(structure);f.data[4].data.results[1].quote.updated_at=f.data[4].data.results[0].quote.updated_at;
 const batch=await collectMockTechSpreadFixture(f),research=mockSpreadFixture(structure==='BULL_CALL_DEBIT'?'CDS':'PDS').input.research;research.researchPlan.id='mock-bound-research';
 const contracts=f.selection.legs.map(l=>({id:l.id,symbol:f.selection.symbol,expiry:f.selection.expiry,type:f.selection.type,strike:l.strike,multiplier:100,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:'tradable'}));
 const bodies={RESEARCH:research,COST_MODEL:{id:'mock-fixed-costs',version:'MOCK_FIXED_PER_LEG_COST_V1',legs:contracts.map(c=>({id:c.id,entryFeeCents:5,exitFeeCents:5,exitSlippageCents:1}))},CONTRACT:{contracts},
  DATA_ENTITLEMENT:{provider:'ROBINHOOD_OFFICIAL_MCP',symbols:['AAPL'],realtimeOptions:true,localRetention:true},PRODUCT_PERMISSION:{accountId:'MOCK',enabled:true,symbols:['AAPL'],products:[structure]},
  ACCOUNT_FUNDS:{accountId:'MOCK',currency:'USD',settledCashCents:20000,reservedCashCents:1000,unsettledCashCents:700},RISK_LIMITS:{accountId:'MOCK',tradeBudgetMaxCents:11000,maximumLossCents:11000}};
 const record=(kind,p)=>{const rawJson=JSON.stringify(p),at=kind==='RESEARCH'||kind==='STRATEGY_REQUEST'?'2026-10-09T14:16:00.000Z':'2026-10-09T14:15:00.000Z';return {kind,origin:'SYNTHETIC_FIXTURE',source:'EXPLICIT_MOCK_ASSUMPTION',reviewedBy:'MOCK_TEST_ONLY',observedAt:at,receivedAt:at,reviewedAt:at,validThrough:'2026-10-09T16:00:00.000Z',verdict:'PASS',rawJson,sha256:spreadPlanHash(rawJson)};};
 const records=Object.entries(bodies).map(([k,p])=>record(k,p)),find=k=>records.find(r=>r.kind===k).sha256;
 const request={id:'mock-bound-plan',accountId:'MOCK',researchId:research.researchPlan.id,researchSha256:find('RESEARCH'),selectionSha256:spreadPlanHash(f.selection),costModelSha256:find('COST_MODEL'),contractEvidenceSha256:find('CONTRACT'),accountEvidenceHashes:Object.fromEntries(['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(k=>[k,find(k)])),
  parentIds:['mock-owner-request'],structure,executionModel:'ATOMIC_TWO_LEG_ASSUMPTION',quantity:1,decisionAt:'2026-10-09T15:29:59.000Z',entryDeadlineAt:'2026-10-09T15:31:59.000Z',timeExitAt:'2026-10-09T15:36:59.000Z',budgetCents:11000,maximumLossCents:11000,entryDebitLimitCents:105,maxLegSpreadCents:10,
  conditions:{entry:'Explicit synthetic trial condition before quote',exit:'Existing same-day time exit or explicit MOCK close',invalidation:'Explicit synthetic counterevidence; manual close only'}};
 records.unshift(record('STRATEGY_REQUEST',request));
 const input={version:'TECH_SPREAD_PLAN_INPUT_V1',mode:'MOCK_CONTROL',at:batch.preflight.at,records,originals:[batch.original]};
 // Independent later fictional batch; original quote clocks are never rewritten by the adapter.
 const exitFixture=mockTechSpreadQuoteFixture(structure);exitFixture.selection.batchId='mock-independent-exit-batch';exitFixture.data[4].data.results[1].quote.updated_at=exitFixture.data[4].data.results[0].quote.updated_at;
 exitFixture.data[4].data.results[0].quote.bid_price='1.90';exitFixture.data[4].data.results[0].quote.ask_price='1.92';exitFixture.data[4].data.results[1].quote.bid_price='0.93';exitFixture.data[4].data.results[1].quote.ask_price='0.95';
 const exit=await collectMockTechSpreadFixture(exitFixture);const raw=JSON.stringify(exit.record).replaceAll('T15:30:','T15:37:');const parsed=JSON.parse(raw);parsed.captureSha256=spreadPlanHash(parsed.capture);const rawJson=JSON.stringify(parsed);
 return {input,batch,exitOriginal:{id:'mock-later-original',rawJson,sha256:spreadPlanHash(rawJson)},exitAt:'2026-10-09T15:37:12.000Z'};
}

/** Explicit TEST_FIXTURE transport; synthetic origins are never relabeled as real. */
export async function paperSpreadPlanFixture(structure='BULL_CALL_DEBIT'){
 const f=await mockSpreadPlanFixture(structure),batch=await collectMockTechSpreadFixture(mockTechSpreadQuoteFixture(structure));
 f.input.version='TECH_SPREAD_PLAN_INPUT_V2';f.input.mode='REAL_QUOTE_PAPER';f.input.evidenceContext='TEST_FIXTURE';f.input.originals=[batch.original];f.batch=batch;
 const edit=(kind,fn)=>{const r=f.input.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p);r.rawJson=JSON.stringify(p);r.sha256=spreadPlanHash(r.rawJson);};
 for(const r of f.input.records)r.source='TEST_FIXTURE_NOT_REAL_EVIDENCE';
 edit('RESEARCH',p=>p.researchPlan.id='paper-fixture-research');
 edit('COST_MODEL',p=>{p.id='paper-fixture-costs';p.version='PAPER_FIXED_PER_LEG_COST_V1';});
 for(const kind of ['ACCOUNT_FUNDS','PRODUCT_PERMISSION','RISK_LIMITS'])edit(kind,p=>p.accountId='paper-fixture-account');
 edit('STRATEGY_REQUEST',p=>{p.id='paper-fixture-plan';p.accountId='paper-fixture-account';p.researchId='paper-fixture-research';p.executionModel='TWO_LEG_BID_ASK_PAPER_ASSUMPTION';p.maxSourceSkewMs=1000;p.selectionSha256=spreadPlanHash(batch.intent.selection);p.parentIds=['paper-fixture-owner-request'];
  const hash=k=>f.input.records.find(r=>r.kind===k).sha256;p.researchSha256=hash('RESEARCH');p.costModelSha256=hash('COST_MODEL');p.contractEvidenceSha256=hash('CONTRACT');for(const k of Object.keys(p.accountEvidenceHashes))p.accountEvidenceHashes[k]=hash(k);
 });
 const raw=JSON.parse(f.exitOriginal.rawJson);raw.capture.receipts[4].response.structuredContent.data.results[1].quote.updated_at='2026-10-09T15:37:09.600000001Z';
 raw.captureSha256=spreadPlanHash(raw.capture);f.exitOriginal.rawJson=JSON.stringify(raw);f.exitOriginal.sha256=spreadPlanHash(f.exitOriginal.rawJson);
 return f;
}

/** Simulated account plus explicitly fictional market fixtures, never relabeled real. */
export async function simulatedAccountSpreadFixture(structure='BULL_CALL_DEBIT'){
 const f=await paperSpreadPlanFixture(structure),accountId='paper-sim-fixture-account';f.input.evidenceContext='TEST_FIXTURE_SIMULATED_ACCOUNT';
 const edit=(kind,fn)=>{const r=f.input.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p);r.rawJson=JSON.stringify(p);r.sha256=spreadPlanHash(r.rawJson);};
 for(const kind of ['COST_MODEL','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS']){const r=f.input.records.find(r=>r.kind===kind);r.origin='SIMULATED_ACCOUNT_ASSUMPTION';r.source='EXPLICIT_LOCAL_SIMULATION_NOT_BROKER_EVIDENCE';}
 edit('ACCOUNT_FUNDS',p=>Object.assign(p,{accountId,basis:'ISOLATED_SIMULATED_CAPITAL_V1',initialCapitalCents:100000,settledCashCents:100000,reservedCashCents:0,unsettledCashCents:0,additionalDepositsCents:0,borrowingCents:0,initialPositions:[]}));
 edit('PRODUCT_PERMISSION',p=>Object.assign(p,{accountId,basis:'SIMULATED_PRODUCTS_ONLY',brokerQualification:'UNKNOWN'}));
 edit('RISK_LIMITS',p=>Object.assign(p,{accountId,basis:'THIS_ENGINEERING_RUN_ONLY',tradeBudgetMaxCents:100000,maximumLossCents:100000}));
 edit('COST_MODEL',p=>{p.basis='EXPLICIT_SIMULATION_COST_ASSUMPTION';p.actualBrokerFees='UNKNOWN';for(const l of p.legs)Object.assign(l,{entryFeeCents:65,exitFeeCents:65,exitSlippageCents:5});});
 edit('STRATEGY_REQUEST',p=>{p.accountId=accountId;p.budgetCents=100000;p.maximumLossCents=100000;const hash=k=>f.input.records.find(r=>r.kind===k).sha256;p.costModelSha256=hash('COST_MODEL');for(const k of Object.keys(p.accountEvidenceHashes))p.accountEvidenceHashes[k]=hash(k);});
 return f;
}
