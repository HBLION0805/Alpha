import {createHash} from 'node:crypto';
import {assessTechSpreadPreflight} from './options-tech-spread-preflight.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {ASSISTANT_FACT_POLICY,assistantOrigin,validateAssistantRecordSet} from './options-tech-assistant-fact-policy.mjs';
export const SPREAD_PLAN_RECORD_KINDS=['STRATEGY_REQUEST','RESEARCH','COST_MODEL','CONTRACT','DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
export const spreadPlanHash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const boundSpreadPlanHash=p=>{const {planSha256,...provenance}=p.provenance;return spreadPlanHash({...p,provenance});};
const check=(v,c)=>{if(!v)throw Error('SPREAD_PLAN_'+c);};
export function spreadPaperEvidencePolicy(context){
 check(['TEST_FIXTURE','ATTRIBUTED_REAL_EVIDENCE','SIMULATED_ACCOUNT_REAL_MARKET_DATA','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(context),'PAPER_EVIDENCE_CONTEXT');
 const fixture=['TEST_FIXTURE','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(context),simulatedAccount=['SIMULATED_ACCOUNT_REAL_MARKET_DATA','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(context);
 return {fixture,simulatedAccount,origin:fixture?'SYNTHETIC_FIXTURE':'HOST_MARKET_TOOL_RESPONSES',preflightMode:fixture?'MOCK_CONTROL':'REAL_SAVED_SOURCE_REPLAY',quoteSource:fixture?'TEST_FIXTURE':'ROBINHOOD_OFFICIAL_MCP'};
}
export const SIMULATED_SPREAD_RECORD_KINDS=['COST_MODEL','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
export const spreadRecordOriginAllowed=(policy,r)=>policy.assistantResearch&&['RESEARCH','STRATEGY_REQUEST'].includes(r?.kind)?assistantOrigin(r):policy.simulatedAccount&&SIMULATED_SPREAD_RECORD_KINDS.includes(r?.kind)?r.origin==='SIMULATED_ACCOUNT_ASSUMPTION':policy.fixture?r?.origin==='SYNTHETIC_FIXTURE':['OWNER_DOCUMENT','PROVIDER_DOCUMENT'].includes(r?.origin);
/** This engineering account scope is bounded at $1,000; it is not an Owner-wide risk rule. */
export function validateSimulatedSpreadAccount(v,request){
 const funds=v.get('ACCOUNT_FUNDS'),risk=v.get('RISK_LIMITS'),permission=v.get('PRODUCT_PERMISSION'),cost=v.get('COST_MODEL');
 const money=n=>Number.isSafeInteger(n)&&n>0&&n<=100000;
 check(/^paper-sim-[a-z0-9-]{1,50}$/.test(request.accountId)&&[funds,risk,permission].every(p=>p?.accountId===request.accountId),'SIMULATED_ACCOUNT_ID');
 check(funds.basis==='ISOLATED_SIMULATED_CAPITAL_V1'&&money(funds.initialCapitalCents)&&funds.settledCashCents===funds.initialCapitalCents&&funds.reservedCashCents===0&&funds.unsettledCashCents===0&&funds.additionalDepositsCents===0&&funds.borrowingCents===0&&Array.isArray(funds.initialPositions)&&funds.initialPositions.length===0,'SIMULATED_INITIAL_CAPITAL');
 check(permission.basis==='SIMULATED_PRODUCTS_ONLY'&&permission.brokerQualification==='UNKNOWN'&&permission.enabled===true&&Array.isArray(permission.products)&&permission.products.length>0&&permission.products.every(p=>['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'].includes(p)),'SIMULATED_PRODUCT_SCOPE');
 check(risk.basis==='THIS_ENGINEERING_RUN_ONLY'&&[risk.tradeBudgetMaxCents,risk.maximumLossCents,request.budgetCents,request.maximumLossCents].every(n=>money(n)&&n<=funds.initialCapitalCents),'SIMULATED_BUDGET_CAP');
 check(cost.basis==='EXPLICIT_SIMULATION_COST_ASSUMPTION'&&cost.actualBrokerFees==='UNKNOWN','SIMULATED_COST_BASIS');
}
export function validateMockSpreadPlanBinding(p){
 const b=p.provenance,paper=p.version==='TECH_QUOTE_PAPER_DEBIT_SPREAD_V1',policy=paper?spreadPaperEvidencePolicy(p.evidenceContext):{fixture:true,origin:'SYNTHETIC_FIXTURE',preflightMode:'MOCK_CONTROL'},accountId=paper?p.account.id:'MOCK';
 const assistant=b?.version==='TECH_SPREAD_PLAN_BINDING_V2';
 if(assistant){check(paper&&policy.simulatedAccount&&b.researchPolicy===ASSISTANT_FACT_POLICY,'ASSISTANT_SCOPE');policy.assistantResearch=true;}
 check((assistant||b?.version==='TECH_SPREAD_PLAN_BINDING_V1')&&b.origin===policy.origin&&b.planSha256===boundSpreadPlanHash(p)&&(!paper||b.evidenceContext===p.evidenceContext),'BODY_BINDING');
 check(b.requestId===p.candidate.id&&b.researchId===p.research.researchPlan.id,'RESEARCH_BINDING');
 check(Array.isArray(b.records)&&b.records.length===8&&b.records.every(r=>spreadRecordOriginAllowed(policy,r)&&spreadPlanHash(r.rawJson)===r.sha256),'EVIDENCE_BINDING');
 check(b.original?.sha256===spreadPlanHash(b.original?.rawJson)&&Array.isArray(b.parentIds)&&b.parentIds.includes(b.requestId)&&b.parentIds.includes(b.researchId)&&b.parentIds.includes(b.batchId),'PARENT_BINDING');
 check(b.conditions?.evaluation==='MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'&&['entry','exit','invalidation'].every(k=>typeof b.conditions[k]==='string'&&b.conditions[k].trim()),'CONDITIONS');
 const validated=readTechEvidenceRecords({inputs:b.records,kinds:SPREAD_PLAN_RECORD_KINDS,now:snapshotNs(b.preflightAt),decision:snapshotNs(p.decisionAt),validThrough:snapshotNs(p.timeExitAt),simulatedAccount:policy.simulatedAccount,assistantContext:assistant?p.evidenceContext:null});check(!validated.blockers.length,'EVIDENCE_CLOCKS');
 if(assistant)validateAssistantRecordSet(b.records,p.evidenceContext);
 const v=validated.payloads,request=v.get('STRATEGY_REQUEST'),research=v.get('RESEARCH'),cost=v.get('COST_MODEL'),contracts=v.get('CONTRACT'),permission=v.get('PRODUCT_PERMISSION'),funds=v.get('ACCOUNT_FUNDS'),risk=v.get('RISK_LIMITS'),entitlement=v.get('DATA_ENTITLEMENT');
 if(policy.simulatedAccount)validateSimulatedSpreadAccount(v,request);
 check(JSON.stringify(research)===JSON.stringify(p.research)&&b.researchSha256===validated.records.get('RESEARCH').sha256&&request.researchSha256===b.researchSha256&&request.researchId===b.researchId,'RESEARCH_CONTENT');
 check(request.id===b.requestId&&request.accountId===accountId&&request.executionModel===p.executionModel&&request.quantity===p.quantity&&request.structure===(p.structure==='CDS'?'BULL_CALL_DEBIT':'BEAR_PUT_DEBIT')&&['decisionAt','entryDeadlineAt','timeExitAt','entryDebitLimitCents','maxLegSpreadCents',...(paper?['maxSourceSkewMs']:[])].every(k=>request[k]===p[k]),'REQUEST_CONTENT');
 check(JSON.stringify(b.conditions)===JSON.stringify({...request.conditions,evaluation:'MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'}),'CONDITION_BINDING');
 check(Array.isArray(contracts.contracts)&&contracts.contracts.length===2&&Array.isArray(cost.legs)&&cost.legs.length===2&&cost.version===(paper?'PAPER_FIXED_PER_LEG_COST_V1':'MOCK_FIXED_PER_LEG_COST_V1')&&b.costModel.id===cost.id&&b.costModel.version===cost.version&&b.costModel.source===validated.records.get('COST_MODEL').source,'CONTRACT_COST_BINDING');
 check(request.costModelSha256===validated.records.get('COST_MODEL').sha256&&request.contractEvidenceSha256===validated.records.get('CONTRACT').sha256&&['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].every(k=>request.accountEvidenceHashes?.[k]===validated.records.get(k).sha256),'REQUEST_EVIDENCE_HASHES');
 for(const l of p.legs){check(JSON.stringify(l.contract)===JSON.stringify(contracts.contracts.find(c=>c.id===l.contract.id)),'CONTRACT_CONTENT');const c=cost.legs.find(c=>c.id===l.contract.id);check(c&&['entryFeeCents','exitFeeCents','exitSlippageCents'].every(k=>c[k]===l[k]),'COST_CONTENT');}
 check(permission.accountId===accountId&&permission.enabled===true&&Array.isArray(permission.products)&&permission.products.includes(request.structure)&&Array.isArray(permission.symbols)&&permission.symbols.includes(p.candidate.symbol)&&entitlement.provider==='ROBINHOOD_OFFICIAL_MCP'&&entitlement.realtimeOptions===true&&entitlement.localRetention===true&&Array.isArray(entitlement.symbols)&&entitlement.symbols.includes(p.candidate.symbol),'MOCK_PERMISSION_BINDING');
 check(funds.accountId===accountId&&funds.currency==='USD'&&['settledCashCents','reservedCashCents','unsettledCashCents'].every(k=>funds[k]===p.account[k])&&risk.accountId===accountId&&request.budgetCents===p.account.tradeBudgetMaxCents&&request.maximumLossCents===p.account.maximumLossCents&&request.budgetCents<=risk.tradeBudgetMaxCents&&request.maximumLossCents<=risk.maximumLossCents,'FUNDS_RISK_BINDING');
 const r=parseChainSurveyJson(b.original.rawJson);check(request.selectionSha256===spreadPlanHash(r.intent.selection)&&b.batchId===r.capture.batchId&&snapshotNs(p.decisionAt)<snapshotNs(r.capture.startedAt)&&(!paper||(snapshotNs(p.decisionAt)<snapshotNs(r.intent.requestedAt)&&p.maxSourceSkewMs===r.intent.selection.maxSourceSkewMs)),'SELECTION_BINDING');
 check(JSON.stringify(b.parentIds)===JSON.stringify([...new Set([...request.parentIds,request.id,request.researchId,b.batchId,cost.id,accountId])])&&b.costModel.sha256===validated.records.get('COST_MODEL').sha256&&b.maximumLossBasis==='TERMINAL_VERTICAL_PAYOFF_PLUS_FIXED_COST_RESERVE_NOT_EARLY_CLOSE_OR_ASSIGNMENT_BOUND','LINEAGE_BASIS');
 const accountRecords=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(k=>validated.records.get(k));
 const extreme=(key,max)=>accountRecords.reduce((a,r)=>(snapshotNs(r[key])>snapshotNs(a[key]))===max?r:a)[key];
 check(p.account.reviewedAt===extreme('reviewedAt',true)&&p.account.validThrough===extreme('validThrough',false),'ACCOUNT_CLOCK_BINDING');
 check(JSON.stringify(b.actions)===JSON.stringify(p.legs.map(l=>({contractId:l.contract.id,quantity:l.quantity,open:l.role==='LONG'?'BUY_TO_OPEN':'SELL_TO_OPEN',close:l.role==='LONG'?'SELL_TO_CLOSE':'BUY_TO_CLOSE'}))),'ACTION_BINDING');
 const reviewed=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:policy.preflightMode,at:b.preflightAt,decisionAt:p.decisionAt,originals:[{...b.original,id:'bound-original'}],legs:p.legs.map(l=>({originalId:'bound-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(reviewed.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY'&&(paper?reviewed.quotePair.maxSourceSkewMs===p.maxSourceSkewMs:reviewed.quotePair.sourceClockDifferenceNs==='0'),'ORIGINAL_PREFLIGHT_BINDING');
}
/** Map a bound saved batch with its declared evidence context; never retime or merge legs. */
export function mockSpreadEventFromOriginal({plan,original,id,at,action='OBSERVE'}){
 const paper=plan?.version==='TECH_QUOTE_PAPER_DEBIT_SPREAD_V1',policy=paper?spreadPaperEvidencePolicy(plan.evidenceContext):{preflightMode:'MOCK_CONTROL',origin:'SYNTHETIC_FIXTURE',quoteSource:'SYNTHETIC_TEST_ONLY'};
 check(paper||plan?.version==='TECH_MOCK_DEBIT_SPREAD_V2','BOUND_PLAN_REQUIRED');validateMockSpreadPlanBinding(plan);
 const preflight=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:policy.preflightMode,at,decisionAt:plan.decisionAt,originals:[{...original,id:'event-original'}],
  legs:plan.legs.map(l=>({originalId:'event-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(preflight.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY','BATCH_NOT_COHERENT');
 check(paper?preflight.quotePair.maxSourceSkewMs===plan.maxSourceSkewMs:preflight.quotePair.sourceClockDifferenceNs==='0','FROZEN_SOURCE_SYNCHRONY_POLICY');
 const legs=plan.legs.map(l=>{const q=preflight.legs.find(q=>q.snapshot.id===l.contract.id).snapshot;return {...q,...l.contract};});
 const quote={receivedAt:legs[0].receivedAt,source:policy.quoteSource,executionState:paper?'COHERENT_BATCH_PAPER_ASSUMPTION':'ATOMIC_QUOTE_PAIR',action,legs};
 const event={version:paper?'TECH_QUOTE_PAPER_SPREAD_BATCH_EVENT_V1':'TECH_MOCK_SPREAD_BATCH_EVENT_V1',id,origin:policy.origin,quote,
  provenance:{version:'TECH_SPREAD_EVENT_BINDING_V1',...(paper?{evidenceContext:plan.evidenceContext,decisionAt:plan.decisionAt,maxSourceSkewMs:plan.maxSourceSkewMs}:{}),parentPlanSha256:plan.provenance.planSha256,batchId:preflight.quotePair.batchId,original:{rawJson:original.rawJson,sha256:original.sha256},quoteSha256:spreadPlanHash(quote)}};
 validateMockSpreadEventBinding(event,plan,at);return event;
}
export function spreadEventAvailableAt(e){return ['TECH_MOCK_SPREAD_BATCH_EVENT_V1','TECH_QUOTE_PAPER_SPREAD_BATCH_EVENT_V1'].includes(e?.version)?parseChainSurveyJson(e.provenance.original.rawJson).recordedAt:e.quote.receivedAt;}
export function validateMockSpreadEventBinding(e,plan=null,asOf=null){
 check(plan?.provenance&&Array.isArray(plan.legs),'EVENT_PLAN_CONTEXT_REQUIRED');
 check(e.provenance?.parentPlanSha256===plan.provenance.planSha256,'EVENT_PARENT_PLAN');
 const b=e.provenance,paper=e.version==='TECH_QUOTE_PAPER_SPREAD_BATCH_EVENT_V1',policy=paper?spreadPaperEvidencePolicy(b?.evidenceContext):{preflightMode:'MOCK_CONTROL',origin:'SYNTHETIC_FIXTURE'};
 check((paper||e.version==='TECH_MOCK_SPREAD_BATCH_EVENT_V1')&&e.origin===policy.origin&&b?.version==='TECH_SPREAD_EVENT_BINDING_V1'&&/^[a-f0-9]{64}$/.test(b.parentPlanSha256)&&b.quoteSha256===spreadPlanHash(e.quote),'EVENT_BINDING');
 if(paper&&plan)check(plan.version==='TECH_QUOTE_PAPER_DEBIT_SPREAD_V1'&&b.evidenceContext===plan.evidenceContext&&b.decisionAt===plan.decisionAt&&b.maxSourceSkewMs===plan.maxSourceSkewMs,'EVENT_PLAN_POLICY');
 check(typeof b.original?.rawJson==='string'&&Buffer.byteLength(b.original.rawJson)<1e6&&b.original.sha256===spreadPlanHash(b.original.rawJson),'EVENT_ORIGINAL_HASH');
 const r=parseChainSurveyJson(b.original.rawJson);
 // A quote receipt is earlier than publication of its complete original. Replay
 // must never observe an original before recordedAt, even after hash recomputation.
 check(!asOf||snapshotNs(r.recordedAt)<=snapshotNs(asOf),'EVENT_ORIGINAL_NOT_YET_VISIBLE');
 const selection=r.intent?.selection;
 const legs=plan.legs;
 check(Array.isArray(legs)&&legs.length===2,'EVENT_LEGS');
 if(paper)check(Number.isSafeInteger(b.maxSourceSkewMs)&&b.maxSourceSkewMs>=0&&b.maxSourceSkewMs<=60000&&selection?.maxSourceSkewMs===b.maxSourceSkewMs&&snapshotNs(b.decisionAt)<snapshotNs(r.intent.requestedAt),'EVENT_FROZEN_POLICY');
 const n=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:policy.preflightMode,at:r.recordedAt,decisionAt:plan.decisionAt,
  originals:[{...b.original,id:'event-original'}],legs:legs.map(l=>({originalId:'event-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(n.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY'&&n.quotePair.batchId===b.batchId&&(paper?n.quotePair.maxSourceSkewMs===b.maxSourceSkewMs:n.quotePair.sourceClockDifferenceNs==='0'),'EVENT_SOURCE_PAIR');
 check(e.quote.legs.length===2&&new Set(e.quote.legs.map(l=>l.id)).size===2,'EVENT_LEGS');
 for(const x of n.legs){const l=e.quote.legs.find(l=>l.id===x.snapshot.id);check(l&&Object.entries(x.snapshot).every(([k,v])=>JSON.stringify(l[k])===JSON.stringify(v))&&e.quote.receivedAt===x.snapshot.receivedAt,'SOURCE_FIELDS_CHANGED');}
}
