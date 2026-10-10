import {createHash} from 'node:crypto';
import {assessTechSpreadPreflight} from './options-tech-spread-preflight.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
export const SPREAD_PLAN_RECORD_KINDS=['STRATEGY_REQUEST','RESEARCH','COST_MODEL','CONTRACT','DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
export const spreadPlanHash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const boundSpreadPlanHash=p=>{const {planSha256,...provenance}=p.provenance;return spreadPlanHash({...p,provenance});};
const check=(v,c)=>{if(!v)throw Error('SPREAD_PLAN_'+c);};
export function validateMockSpreadPlanBinding(p){
 const b=p.provenance;
 check(b?.version==='TECH_SPREAD_PLAN_BINDING_V1'&&b.origin==='SYNTHETIC_FIXTURE'&&b.planSha256===boundSpreadPlanHash(p),'BODY_BINDING');
 check(b.requestId===p.candidate.id&&b.researchId===p.research.researchPlan.id,'RESEARCH_BINDING');
 check(Array.isArray(b.records)&&b.records.length===8&&b.records.every(r=>r.origin==='SYNTHETIC_FIXTURE'&&spreadPlanHash(r.rawJson)===r.sha256),'EVIDENCE_BINDING');
 check(b.original?.sha256===spreadPlanHash(b.original?.rawJson)&&Array.isArray(b.parentIds)&&b.parentIds.includes(b.requestId)&&b.parentIds.includes(b.researchId)&&b.parentIds.includes(b.batchId),'PARENT_BINDING');
 check(b.conditions?.evaluation==='MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'&&['entry','exit','invalidation'].every(k=>typeof b.conditions[k]==='string'&&b.conditions[k].trim()),'CONDITIONS');
 const validated=readTechEvidenceRecords({inputs:b.records,kinds:SPREAD_PLAN_RECORD_KINDS,now:snapshotNs(b.preflightAt),decision:snapshotNs(p.decisionAt),validThrough:snapshotNs(p.timeExitAt)});check(!validated.blockers.length,'EVIDENCE_CLOCKS');
 const v=validated.payloads,request=v.get('STRATEGY_REQUEST'),research=v.get('RESEARCH'),cost=v.get('COST_MODEL'),contracts=v.get('CONTRACT'),permission=v.get('PRODUCT_PERMISSION'),funds=v.get('ACCOUNT_FUNDS'),risk=v.get('RISK_LIMITS'),entitlement=v.get('DATA_ENTITLEMENT');
 check(JSON.stringify(research)===JSON.stringify(p.research)&&b.researchSha256===validated.records.get('RESEARCH').sha256&&request.researchSha256===b.researchSha256&&request.researchId===b.researchId,'RESEARCH_CONTENT');
 check(request.id===b.requestId&&request.accountId==='MOCK'&&request.executionModel===p.executionModel&&request.quantity===p.quantity&&request.structure===(p.structure==='CDS'?'BULL_CALL_DEBIT':'BEAR_PUT_DEBIT')&&['decisionAt','entryDeadlineAt','timeExitAt','entryDebitLimitCents','maxLegSpreadCents'].every(k=>request[k]===p[k]),'REQUEST_CONTENT');
 check(JSON.stringify(b.conditions)===JSON.stringify({...request.conditions,evaluation:'MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'}),'CONDITION_BINDING');
 check(Array.isArray(contracts.contracts)&&contracts.contracts.length===2&&Array.isArray(cost.legs)&&cost.legs.length===2&&cost.version==='MOCK_FIXED_PER_LEG_COST_V1'&&b.costModel.id===cost.id&&b.costModel.version===cost.version&&b.costModel.source===validated.records.get('COST_MODEL').source,'CONTRACT_COST_BINDING');
 check(request.costModelSha256===validated.records.get('COST_MODEL').sha256&&request.contractEvidenceSha256===validated.records.get('CONTRACT').sha256&&['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].every(k=>request.accountEvidenceHashes?.[k]===validated.records.get(k).sha256),'REQUEST_EVIDENCE_HASHES');
 for(const l of p.legs){check(JSON.stringify(l.contract)===JSON.stringify(contracts.contracts.find(c=>c.id===l.contract.id)),'CONTRACT_CONTENT');const c=cost.legs.find(c=>c.id===l.contract.id);check(c&&['entryFeeCents','exitFeeCents','exitSlippageCents'].every(k=>c[k]===l[k]),'COST_CONTENT');}
 check(permission.accountId==='MOCK'&&permission.enabled===true&&Array.isArray(permission.products)&&permission.products.includes(request.structure)&&Array.isArray(permission.symbols)&&permission.symbols.includes(p.candidate.symbol)&&entitlement.provider==='ROBINHOOD_OFFICIAL_MCP'&&entitlement.realtimeOptions===true&&entitlement.localRetention===true&&Array.isArray(entitlement.symbols)&&entitlement.symbols.includes(p.candidate.symbol),'MOCK_PERMISSION_BINDING');
 check(funds.accountId==='MOCK'&&funds.currency==='USD'&&['settledCashCents','reservedCashCents','unsettledCashCents'].every(k=>funds[k]===p.account[k])&&risk.accountId==='MOCK'&&request.budgetCents===p.account.tradeBudgetMaxCents&&request.maximumLossCents===p.account.maximumLossCents&&request.budgetCents<=risk.tradeBudgetMaxCents&&request.maximumLossCents<=risk.maximumLossCents,'FUNDS_RISK_BINDING');
 const r=parseChainSurveyJson(b.original.rawJson);check(request.selectionSha256===spreadPlanHash(r.intent.selection)&&b.batchId===r.capture.batchId&&snapshotNs(p.decisionAt)<snapshotNs(r.capture.startedAt),'SELECTION_BINDING');
 check(JSON.stringify(b.parentIds)===JSON.stringify([...new Set([...request.parentIds,request.id,request.researchId,b.batchId,cost.id,'MOCK'])])&&b.costModel.sha256===validated.records.get('COST_MODEL').sha256&&b.maximumLossBasis==='TERMINAL_VERTICAL_PAYOFF_PLUS_FIXED_COST_RESERVE_NOT_EARLY_CLOSE_OR_ASSIGNMENT_BOUND','LINEAGE_BASIS');
 const accountRecords=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(k=>validated.records.get(k));
 const extreme=(key,max)=>accountRecords.reduce((a,r)=>(snapshotNs(r[key])>snapshotNs(a[key]))===max?r:a)[key];
 check(p.account.reviewedAt===extreme('reviewedAt',true)&&p.account.validThrough===extreme('validThrough',false),'ACCOUNT_CLOCK_BINDING');
 check(JSON.stringify(b.actions)===JSON.stringify(p.legs.map(l=>({contractId:l.contract.id,quantity:l.quantity,open:l.role==='LONG'?'BUY_TO_OPEN':'SELL_TO_OPEN',close:l.role==='LONG'?'SELL_TO_CLOSE':'BUY_TO_CLOSE'}))),'ACTION_BINDING');
 const reviewed=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:'MOCK_CONTROL',at:b.preflightAt,decisionAt:p.decisionAt,originals:[{...b.original,id:'bound-original'}],legs:p.legs.map(l=>({originalId:'bound-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(reviewed.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY'&&reviewed.quotePair.sourceClockDifferenceNs==='0','ORIGINAL_PREFLIGHT_BINDING');
}
/** Map an explicitly synthetic saved batch; never retime or merge source legs. */
export function mockSpreadEventFromOriginal({plan,original,id,at,action='OBSERVE'}){
 check(plan?.version==='TECH_MOCK_DEBIT_SPREAD_V2','BOUND_PLAN_REQUIRED');validateMockSpreadPlanBinding(plan);
 const preflight=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:'MOCK_CONTROL',at,decisionAt:plan.decisionAt,originals:[{...original,id:'event-original'}],
  legs:plan.legs.map(l=>({originalId:'event-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(preflight.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY','BATCH_NOT_COHERENT');
 check(preflight.quotePair.sourceClockDifferenceNs==='0','EXISTING_MOCK_REQUIRES_EXACT_SOURCE_SYNCHRONY');
 const legs=plan.legs.map(l=>{const q=preflight.legs.find(q=>q.snapshot.id===l.contract.id).snapshot;return {...q,...l.contract};});
 const quote={receivedAt:legs[0].receivedAt,source:'SYNTHETIC_TEST_ONLY',executionState:'ATOMIC_QUOTE_PAIR',action,legs};
 const event={version:'TECH_MOCK_SPREAD_BATCH_EVENT_V1',id,origin:'SYNTHETIC_FIXTURE',quote,
  provenance:{version:'TECH_SPREAD_EVENT_BINDING_V1',parentPlanSha256:plan.provenance.planSha256,batchId:preflight.quotePair.batchId,original:{rawJson:original.rawJson,sha256:original.sha256},quoteSha256:spreadPlanHash(quote)}};
 validateMockSpreadEventBinding(event,plan,at);return event;
}
export function spreadEventAvailableAt(e){return e?.version==='TECH_MOCK_SPREAD_BATCH_EVENT_V1'?parseChainSurveyJson(e.provenance.original.rawJson).recordedAt:e.quote.receivedAt;}
export function validateMockSpreadEventBinding(e,plan=null,asOf=null){
 check(plan?.provenance&&Array.isArray(plan.legs),'EVENT_PLAN_CONTEXT_REQUIRED');
 check(e.provenance?.parentPlanSha256===plan.provenance.planSha256,'EVENT_PARENT_PLAN');
 const b=e.provenance;check(e.version==='TECH_MOCK_SPREAD_BATCH_EVENT_V1'&&e.origin==='SYNTHETIC_FIXTURE'&&b?.version==='TECH_SPREAD_EVENT_BINDING_V1'&&/^[a-f0-9]{64}$/.test(b.parentPlanSha256)&&b.quoteSha256===spreadPlanHash(e.quote),'EVENT_BINDING');
 check(typeof b.original?.rawJson==='string'&&Buffer.byteLength(b.original.rawJson)<1e6&&b.original.sha256===spreadPlanHash(b.original.rawJson),'EVENT_ORIGINAL_HASH');
 const r=parseChainSurveyJson(b.original.rawJson);
 // A quote receipt is earlier than publication of its complete original. Replay
 // must never observe an original before recordedAt, even after hash recomputation.
 check(!asOf||snapshotNs(r.recordedAt)<=snapshotNs(asOf),'EVENT_ORIGINAL_NOT_YET_VISIBLE');
 const selection=r.intent?.selection;
 const legs=plan.legs;
 check(Array.isArray(legs)&&legs.length===2,'EVENT_LEGS');
 const n=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:'MOCK_CONTROL',at:r.recordedAt,decisionAt:plan.decisionAt,
  originals:[{...b.original,id:'event-original'}],legs:legs.map(l=>({originalId:'event-original',direction:l.role,quantity:l.quantity,contract:l.contract}))});
 check(n.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY'&&n.quotePair.batchId===b.batchId&&n.quotePair.sourceClockDifferenceNs==='0','EVENT_SOURCE_PAIR');
 check(e.quote.legs.length===2&&new Set(e.quote.legs.map(l=>l.id)).size===2,'EVENT_LEGS');
 for(const x of n.legs){const l=e.quote.legs.find(l=>l.id===x.snapshot.id);check(l&&Object.entries(x.snapshot).every(([k,v])=>JSON.stringify(l[k])===JSON.stringify(v))&&e.quote.receivedAt===x.snapshot.receivedAt,'SOURCE_FIELDS_CHANGED');}
}
