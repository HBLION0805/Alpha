import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {assessTechSpreadPreflight} from './options-tech-spread-preflight.mjs';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {replayMockSpread,startMockSpread} from './options-tech-mock-spread.mjs';
import {SPREAD_PLAN_RECORD_KINDS,spreadPlanHash,boundSpreadPlanHash,mockSpreadEventFromOriginal} from './options-tech-spread-plan-binding.mjs';
const int=(v,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=100000000;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const code=e=>/^[A-Z_]+$/.test(e?.message)?e.message:'INPUT_INVALID';
const check=(v,c)=>{if(!v)throw Error(c);};
const extrema=(records,key,maximum)=>records.reduce((a,r)=>snapshotNs(r[key])>snapshotNs(a[key])===maximum?r:a)[key];

/** Preview only: reuse source preflight and the existing pure MOCK entry model. */
export function previewTechSpreadPlan(input){
 const out={version:'TECH_SPREAD_PLAN_PREVIEW_V1',mode:input?.mode??'UNKNOWN',status:'BLOCKED',checks:[],evidenceState:Object.fromEntries(SPREAD_PLAN_RECORD_KINDS.map(k=>[k,'UNKNOWN'])),
  realAccountConfirmation:{permission:'UNKNOWN',funds:'UNKNOWN',entitlement:'UNKNOWN'},plan:null,entryEvent:null,economics:null,preflight:null,
  productionPaperAdmissionAllowed:false,executionAllowed:false,actualTrades:0,planCreatesFills:false,realAcceptance:'NOT_TESTED'};
 const gate=(c,ok,detail=null)=>out.checks.push({code:c,status:ok?'PASS':'BLOCKED',detail});
 try{
  check(input?.version==='TECH_SPREAD_PLAN_INPUT_V1'&&['MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY'].includes(input.mode),'INPUT_SCOPE');
  const now=snapshotNs(input.at);check(Array.isArray(input.records)&&input.records.length<=8,'RECORD_BOUND');
  const byKind=new Map();for(const r of input.records){check(SPREAD_PLAN_RECORD_KINDS.includes(r.kind)&&!byKind.has(r.kind),'RECORD_KIND_OR_DUPLICATE');byKind.set(r.kind,r);}
  const requestRecord=byKind.get('STRATEGY_REQUEST');check(requestRecord,'STRATEGY_REQUEST_MISSING');
  const first=readTechEvidenceRecords({inputs:[requestRecord],kinds:['STRATEGY_REQUEST'],now,decision:now,validThrough:now});check(!first.blockers.length,'STRATEGY_REQUEST_CLOCK');
  const request=first.payloads.get('STRATEGY_REQUEST'),decision=snapshotNs(request.decisionAt),end=snapshotNs(request.timeExitAt);
  const payloads=new Map();
  for(const kind of SPREAD_PLAN_RECORD_KINDS){
   const r=byKind.get(kind);if(!r){gate(kind+'_MISSING',false);continue;}
   try{const v=readTechEvidenceRecords({inputs:[r],kinds:[kind],now,decision,validThrough:end});const correctOrigin=(r.origin==='SYNTHETIC_FIXTURE')===(input.mode==='MOCK_CONTROL');
    const okay=!v.blockers.length&&correctOrigin;gate(kind+'_RECORD',okay,v.blockers);out.evidenceState[kind]=okay?(input.mode==='MOCK_CONTROL'?'EXPLICIT_MOCK_ASSUMPTION':'ATTRIBUTED_NOT_AUTHENTICATED'):'BLOCKED';if(okay)payloads.set(kind,v.payloads.get(kind));
   }catch(e){gate(kind+'_RECORD',false,code(e));out.evidenceState[kind]='BLOCKED';}
  }
  gate('REAL_INPUT_HAS_NO_LIFECYCLE_AUTHORITY',input.mode==='MOCK_CONTROL');
  check(Array.isArray(input.originals)&&input.originals.length===1,'ONE_COMPLETE_BATCH_REQUIRED');
  const original=input.originals[0],raw=parseChainSurveyJson(original.rawJson),selection=raw.intent?.selection;
  check(selection?.version==='TECH_DEBIT_SPREAD_SELECTION_V1','V2_BATCH_REQUIRED');
  const sourceLegs=selection.legs.map(l=>({originalId:original.id,direction:l.direction,quantity:request.quantity,contract:{id:l.id,symbol:selection.symbol,expiry:selection.expiry,type:selection.type,strike:l.strike,multiplier:100}}));
  out.preflight=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:input.mode,at:input.at,decisionAt:request.decisionAt,originals:[original],legs:sourceLegs});
  gate('QUALIFIED_BATCH_EVIDENCE',out.preflight.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY');
  gate('EXISTING_MOCK_EXACT_SYNCHRONY',out.preflight.quotePair.sourceClockDifferenceNs==='0');
  gate('PRIOR_REQUEST_BOUND_TO_SELECTION',request.selectionSha256===spreadPlanHash(selection)&&request.structure===selection.structure&&decision<snapshotNs(raw.capture.startedAt));
  if(out.checks.some(c=>c.status==='BLOCKED'))return out;
  const research=payloads.get('RESEARCH'),cost=payloads.get('COST_MODEL'),contracts=payloads.get('CONTRACT'),permission=payloads.get('PRODUCT_PERMISSION'),funds=payloads.get('ACCOUNT_FUNDS'),risk=payloads.get('RISK_LIMITS'),entitlement=payloads.get('DATA_ENTITLEMENT');
  gate('RESEARCH_REQUEST_ID_AND_HASH',request.researchId===research.researchPlan?.id&&request.researchSha256===byKind.get('RESEARCH').sha256&&research.symbol===selection.symbol);
  gate('SUPPORTED_PLAN_REQUEST',/^mock-[a-z0-9-]{1,60}$/.test(request.id)&&request.accountId==='MOCK'&&request.quantity===1&&request.executionModel==='ATOMIC_TWO_LEG_ASSUMPTION'&&Array.isArray(request.parentIds)&&request.parentIds.length<=12&&request.parentIds.every(text));
  gate('EXPLICIT_CONDITIONS',request.conditions&&['entry','exit','invalidation'].every(k=>text(request.conditions[k])));
  gate('CONTRACT_EVIDENCE',Array.isArray(contracts.contracts)&&contracts.contracts.length===2&&sourceLegs.every(l=>{const c=contracts.contracts.find(c=>c.id===l.contract.id);return c&&Object.entries(l.contract).every(([k,v])=>c[k]===v)&&c.deliverable==='STANDARD_100_SHARES_USD'&&c.exerciseStyle==='AMERICAN'&&c.tradability==='tradable';}));
  gate('VERSIONED_COST_MODEL',cost.version==='MOCK_FIXED_PER_LEG_COST_V1'&&text(cost.id)&&Array.isArray(cost.legs)&&cost.legs.length===2&&sourceLegs.every(l=>{const c=cost.legs.find(c=>c.id===l.contract.id);return c&&['entryFeeCents','exitFeeCents','exitSlippageCents'].every(k=>int(c[k]));}));
  gate('REQUEST_EVIDENCE_HASHES',request.costModelSha256===byKind.get('COST_MODEL').sha256&&request.contractEvidenceSha256===byKind.get('CONTRACT').sha256&&['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].every(k=>request.accountEvidenceHashes?.[k]===byKind.get(k).sha256));
  gate('MOCK_SPREAD_PERMISSION',permission.accountId==='MOCK'&&permission.enabled===true&&Array.isArray(permission.products)&&permission.products.includes(request.structure)&&Array.isArray(permission.symbols)&&permission.symbols.includes(selection.symbol));
  gate('MOCK_DATA_ENTITLEMENT',entitlement.provider==='ROBINHOOD_OFFICIAL_MCP'&&entitlement.realtimeOptions===true&&entitlement.localRetention===true&&Array.isArray(entitlement.symbols)&&entitlement.symbols.includes(selection.symbol));
  gate('SETTLED_RESERVED_AND_UNSETTLED_FUNDS',funds.accountId==='MOCK'&&funds.currency==='USD'&&['settledCashCents','reservedCashCents','unsettledCashCents'].every(k=>int(funds[k]))&&funds.reservedCashCents<=funds.settledCashCents);
  gate('REQUEST_BUDGET_WITHIN_DOCUMENTED_LIMITS',risk.accountId==='MOCK'&&[request.budgetCents,request.maximumLossCents,risk.tradeBudgetMaxCents,risk.maximumLossCents].every(v=>int(v,1))&&request.budgetCents<=risk.tradeBudgetMaxCents&&request.maximumLossCents<=risk.maximumLossCents);
  if(out.checks.some(c=>c.status==='BLOCKED'))return out;
  const accountRecords=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(k=>byKind.get(k)),structure=request.structure==='BULL_CALL_DEBIT'?'CDS':'PDS';
  const plan={version:'TECH_MOCK_DEBIT_SPREAD_V2',mode:'MOCK',executionModel:request.executionModel,candidate:{id:request.id,symbol:selection.symbol,origin:'SYNTHETIC_FIXTURE'},research,structure,
   decisionAt:request.decisionAt,entryDeadlineAt:request.entryDeadlineAt,timeExitAt:request.timeExitAt,quantity:request.quantity,
   legs:sourceLegs.map(l=>{const c=cost.legs.find(c=>c.id===l.contract.id);return {role:l.direction,quantity:request.quantity,contract:contracts.contracts.find(c=>c.id===l.contract.id),entryFeeCents:c.entryFeeCents,exitFeeCents:c.exitFeeCents,exitSlippageCents:c.exitSlippageCents};}),
   entryDebitLimitCents:request.entryDebitLimitCents,maxLegSpreadCents:request.maxLegSpreadCents,
   account:{mode:'MOCK',id:'MOCK',currency:'USD',provider:'SYNTHETIC_TEST_ONLY',permission:'PASS',products:[structure],dataEntitlement:'PASS',settledCashCents:funds.settledCashCents,reservedCashCents:funds.reservedCashCents,unsettledCashCents:funds.unsettledCashCents,maximumLossCents:request.maximumLossCents,tradeBudgetMaxCents:request.budgetCents,reviewedAt:extrema(accountRecords,'reviewedAt',true),validThrough:extrema(accountRecords,'validThrough',false)}};
  plan.provenance={version:'TECH_SPREAD_PLAN_BINDING_V1',origin:'SYNTHETIC_FIXTURE',planSha256:spreadPlanHash(plan),requestId:request.id,researchId:request.researchId,researchSha256:byKind.get('RESEARCH').sha256,batchId:selection.batchId,preflightAt:input.at,
   parentIds:[...new Set([...request.parentIds,request.id,request.researchId,selection.batchId,cost.id,'MOCK'])],original:{rawJson:original.rawJson,sha256:original.sha256},records:input.records,
   costModel:{id:cost.id,version:cost.version,source:byKind.get('COST_MODEL').source,sha256:byKind.get('COST_MODEL').sha256},
   maximumLossBasis:'TERMINAL_VERTICAL_PAYOFF_PLUS_FIXED_COST_RESERVE_NOT_EARLY_CLOSE_OR_ASSIGNMENT_BOUND',conditions:{...request.conditions,evaluation:'MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'},
   actions:plan.legs.map(l=>({contractId:l.contract.id,quantity:l.quantity,open:l.role==='LONG'?'BUY_TO_OPEN':'SELL_TO_OPEN',close:l.role==='LONG'?'SELL_TO_CLOSE':'BUY_TO_CLOSE'}))};
  plan.provenance.planSha256=boundSpreadPlanHash(plan);
  check(Buffer.byteLength(JSON.stringify(plan))<1500000,'PLAN_RECORD_BOUND');
  const event=mockSpreadEventFromOriginal({plan,original,id:'mock-plan-entry',at:input.at});
  // Reuse the existing pure engine for a hypothetical entry check. No journal/fill is written.
  const probe=replayMockSpread(plan,[event],input.at);gate('EXISTING_MOCK_ENTRY_MODEL',probe.status==='OPEN_UNRESOLVED',{frozenBlockers:probe.frozenBlockers,diagnostics:probe.diagnostics});
  if(probe.status!=='OPEN_UNRESOLVED')return out;
  out.status='MOCK_PLAN_READY';out.plan=plan;out.entryEvent=event;out.economics={basis:'PURE_HYPOTHETICAL_ENTRY_CHECK_NOT_A_FILL',availableSettledCashCents:funds.settledCashCents-funds.reservedCashCents,initialUnsettledCashCents:funds.unsettledCashCents,unsettledUsableForEntry:false,terminalRisk:probe.terminalRisk,maximumLossIsTerminalModelOnly:true};return out;
 }catch(e){gate(code(e),false);return out;}
}
export function startTechSpreadPlan({root,runId,input}){const preview=previewTechSpreadPlan(input);if(preview.status!=='MOCK_PLAN_READY')return preview;const started=startMockSpread({root,runId,input:preview.plan});return {...preview,started,entryAutomaticallyAppended:false};}
