import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {assessTechSpreadPreflight} from './options-tech-spread-preflight.mjs';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {replayMockSpread,startMockSpread} from './options-tech-mock-spread.mjs';
import {SPREAD_PLAN_RECORD_KINDS,spreadPlanHash,boundSpreadPlanHash,mockSpreadEventFromOriginal,spreadPaperEvidencePolicy,spreadRecordOriginAllowed,validateSimulatedSpreadAccount,SIMULATED_SPREAD_RECORD_KINDS} from './options-tech-spread-plan-binding.mjs';
import {ASSISTANT_FACT_POLICY,assistantInputPolicy,validateAssistantRecordSet} from './options-tech-assistant-fact-policy.mjs';
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
  const paper=input?.mode==='REAL_QUOTE_PAPER';
  const assistant=assistantInputPolicy(input);
  check(paper?(assistant||input.version==='TECH_SPREAD_PLAN_INPUT_V2'):input?.version==='TECH_SPREAD_PLAN_INPUT_V1'&&['MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY'].includes(input.mode),'INPUT_SCOPE');
  const policy=paper?spreadPaperEvidencePolicy(input.evidenceContext):{fixture:input.mode==='MOCK_CONTROL',preflightMode:input.mode,origin:'SYNTHETIC_FIXTURE'};
  if(assistant){policy.assistantResearch=true;out.researchPolicy=ASSISTANT_FACT_POLICY;}
  if(paper){out.evidenceContext=input.evidenceContext;out.testFixtureOnly=policy.fixture;out.accountEvidenceAuthentication='NOT_ESTABLISHED_BY_DOCUMENT_HASH';if(policy.simulatedAccount)out.accountBasis='SIMULATED_ACCOUNT_NOT_BROKER_QUALIFICATION';}
  const now=snapshotNs(input.at);check(Array.isArray(input.records)&&input.records.length<=8,'RECORD_BOUND');
  const byKind=new Map();for(const r of input.records){check(SPREAD_PLAN_RECORD_KINDS.includes(r.kind)&&!byKind.has(r.kind),'RECORD_KIND_OR_DUPLICATE');byKind.set(r.kind,r);}
  const requestRecord=byKind.get('STRATEGY_REQUEST');check(requestRecord,'STRATEGY_REQUEST_MISSING');
  const first=readTechEvidenceRecords({inputs:[requestRecord],kinds:['STRATEGY_REQUEST'],now,decision:now,validThrough:now,simulatedAccount:assistant,assistantContext:assistant?input.evidenceContext:null});check(!first.blockers.length,'STRATEGY_REQUEST_CLOCK');
  const request=first.payloads.get('STRATEGY_REQUEST'),decision=snapshotNs(request.decisionAt),end=snapshotNs(request.timeExitAt),accountId=paper?request.accountId:'MOCK';
  const payloads=new Map();
  for(const kind of SPREAD_PLAN_RECORD_KINDS){
   const r=byKind.get(kind);if(!r){gate(kind+'_MISSING',false);continue;}
   try{const v=readTechEvidenceRecords({inputs:[r],kinds:[kind],now,decision,validThrough:end,simulatedAccount:policy.simulatedAccount,assistantContext:assistant?input.evidenceContext:null});const correctOrigin=spreadRecordOriginAllowed(policy,r);
    const okay=!v.blockers.length&&correctOrigin;gate(kind+'_RECORD',okay,v.blockers);out.evidenceState[kind]=okay?(assistant&&['RESEARCH','STRATEGY_REQUEST'].includes(kind)?r.origin:policy.simulatedAccount&&SIMULATED_SPREAD_RECORD_KINDS.includes(kind)?'SIMULATED_ACCOUNT_ASSUMPTION':policy.fixture?(paper?'TEST_FIXTURE':'EXPLICIT_MOCK_ASSUMPTION'):'ATTRIBUTED_NOT_AUTHENTICATED'):'BLOCKED';if(okay)payloads.set(kind,v.payloads.get(kind));
   }catch(e){gate(kind+'_RECORD',false,code(e));out.evidenceState[kind]='BLOCKED';}
  }
  gate(paper?'ISOLATED_PAPER_SCOPE':'REAL_INPUT_HAS_NO_LIFECYCLE_AUTHORITY',paper||input.mode==='MOCK_CONTROL');
  check(Array.isArray(input.originals)&&input.originals.length===1,'ONE_COMPLETE_BATCH_REQUIRED');
  const original=input.originals[0],raw=parseChainSurveyJson(original.rawJson),selection=raw.intent?.selection;
  check(selection?.version==='TECH_DEBIT_SPREAD_SELECTION_V1','V2_BATCH_REQUIRED');
  const sourceLegs=selection.legs.map(l=>({originalId:original.id,direction:l.direction,quantity:request.quantity,contract:{id:l.id,symbol:selection.symbol,expiry:selection.expiry,type:selection.type,strike:l.strike,multiplier:100}}));
  out.preflight=assessTechSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:policy.preflightMode,at:input.at,decisionAt:request.decisionAt,originals:[original],legs:sourceLegs});
  gate('QUALIFIED_BATCH_EVIDENCE',out.preflight.quotePair.status==='COHERENT_BATCH_EVIDENCE_ONLY');
  gate(paper?'PREDECLARED_SOURCE_SKEW':'EXISTING_MOCK_EXACT_SYNCHRONY',paper?Number.isSafeInteger(request.maxSourceSkewMs)&&request.maxSourceSkewMs>=0&&request.maxSourceSkewMs<=60000&&request.maxSourceSkewMs===selection.maxSourceSkewMs:out.preflight.quotePair.sourceClockDifferenceNs==='0');
  gate('PRIOR_REQUEST_BOUND_TO_SELECTION',request.selectionSha256===spreadPlanHash(selection)&&request.structure===selection.structure&&decision<snapshotNs(raw.capture.startedAt)&&(!paper||decision<snapshotNs(raw.intent.requestedAt)));
  if(out.checks.some(c=>c.status==='BLOCKED'))return out;
  if(assistant)validateAssistantRecordSet(input.records,input.evidenceContext);
  const research=payloads.get('RESEARCH'),cost=payloads.get('COST_MODEL'),contracts=payloads.get('CONTRACT'),permission=payloads.get('PRODUCT_PERMISSION'),funds=payloads.get('ACCOUNT_FUNDS'),risk=payloads.get('RISK_LIMITS'),entitlement=payloads.get('DATA_ENTITLEMENT');
  if(policy.simulatedAccount)validateSimulatedSpreadAccount(payloads,request);
  gate('RESEARCH_REQUEST_ID_AND_HASH',request.researchId===research.researchPlan?.id&&request.researchSha256===byKind.get('RESEARCH').sha256&&research.symbol===selection.symbol);
  gate('SUPPORTED_PLAN_REQUEST',(paper?/^paper-[a-z0-9-]{1,60}$/:/^mock-[a-z0-9-]{1,60}$/).test(request.id)&&(paper?/^paper-[a-z0-9-]{1,60}$/.test(accountId):request.accountId==='MOCK')&&request.quantity===1&&request.executionModel===(paper?'TWO_LEG_BID_ASK_PAPER_ASSUMPTION':'ATOMIC_TWO_LEG_ASSUMPTION')&&Array.isArray(request.parentIds)&&request.parentIds.length<=12&&request.parentIds.every(text));
  gate('EXPLICIT_CONDITIONS',request.conditions&&['entry','exit','invalidation'].every(k=>text(request.conditions[k])));
  gate('CONTRACT_EVIDENCE',Array.isArray(contracts.contracts)&&contracts.contracts.length===2&&sourceLegs.every(l=>{const c=contracts.contracts.find(c=>c.id===l.contract.id);return c&&Object.entries(l.contract).every(([k,v])=>c[k]===v)&&c.deliverable==='STANDARD_100_SHARES_USD'&&c.exerciseStyle==='AMERICAN'&&c.tradability==='tradable';}));
  gate('VERSIONED_COST_MODEL',cost.version===(paper?'PAPER_FIXED_PER_LEG_COST_V1':'MOCK_FIXED_PER_LEG_COST_V1')&&text(cost.id)&&Array.isArray(cost.legs)&&cost.legs.length===2&&sourceLegs.every(l=>{const c=cost.legs.find(c=>c.id===l.contract.id);return c&&['entryFeeCents','exitFeeCents','exitSlippageCents'].every(k=>int(c[k]));}));
  gate('REQUEST_EVIDENCE_HASHES',request.costModelSha256===byKind.get('COST_MODEL').sha256&&request.contractEvidenceSha256===byKind.get('CONTRACT').sha256&&['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].every(k=>request.accountEvidenceHashes?.[k]===byKind.get(k).sha256));
  gate(paper?'PAPER_SPREAD_PERMISSION':'MOCK_SPREAD_PERMISSION',permission.accountId===accountId&&permission.enabled===true&&Array.isArray(permission.products)&&permission.products.includes(request.structure)&&Array.isArray(permission.symbols)&&permission.symbols.includes(selection.symbol));
  gate(paper?'PAPER_DATA_ENTITLEMENT':'MOCK_DATA_ENTITLEMENT',entitlement.provider==='ROBINHOOD_OFFICIAL_MCP'&&entitlement.realtimeOptions===true&&entitlement.localRetention===true&&Array.isArray(entitlement.symbols)&&entitlement.symbols.includes(selection.symbol));
  gate('SETTLED_RESERVED_AND_UNSETTLED_FUNDS',funds.accountId===accountId&&funds.currency==='USD'&&['settledCashCents','reservedCashCents','unsettledCashCents'].every(k=>int(funds[k]))&&funds.reservedCashCents<=funds.settledCashCents);
  gate('REQUEST_BUDGET_WITHIN_DOCUMENTED_LIMITS',risk.accountId===accountId&&[request.budgetCents,request.maximumLossCents,risk.tradeBudgetMaxCents,risk.maximumLossCents].every(v=>int(v,1))&&request.budgetCents<=risk.tradeBudgetMaxCents&&request.maximumLossCents<=risk.maximumLossCents);
  if(out.checks.some(c=>c.status==='BLOCKED'))return out;
  const accountRecords=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(k=>byKind.get(k)),structure=request.structure==='BULL_CALL_DEBIT'?'CDS':'PDS';
  const plan={version:paper?'TECH_QUOTE_PAPER_DEBIT_SPREAD_V1':'TECH_MOCK_DEBIT_SPREAD_V2',mode:paper?'REAL_QUOTE_PAPER':'MOCK',...(paper?{evidenceContext:input.evidenceContext,maxSourceSkewMs:request.maxSourceSkewMs}:{}),executionModel:request.executionModel,candidate:{id:request.id,symbol:selection.symbol,origin:policy.origin},research,structure,
   decisionAt:request.decisionAt,entryDeadlineAt:request.entryDeadlineAt,timeExitAt:request.timeExitAt,quantity:request.quantity,
   legs:sourceLegs.map(l=>{const c=cost.legs.find(c=>c.id===l.contract.id);return {role:l.direction,quantity:request.quantity,contract:contracts.contracts.find(c=>c.id===l.contract.id),entryFeeCents:c.entryFeeCents,exitFeeCents:c.exitFeeCents,exitSlippageCents:c.exitSlippageCents};}),
   entryDebitLimitCents:request.entryDebitLimitCents,maxLegSpreadCents:request.maxLegSpreadCents,
   account:{mode:policy.simulatedAccount?'SIMULATED_ACCOUNT':paper?'PAPER':'MOCK',id:accountId,currency:'USD',provider:policy.simulatedAccount?'LOCAL_SIMULATION_ASSUMPTIONS':paper?(policy.fixture?'TEST_FIXTURE':'ATTRIBUTED_DOCUMENTS'):'SYNTHETIC_TEST_ONLY',permission:policy.simulatedAccount?'SIMULATED_PRODUCTS_ONLY':paper?'DOCUMENT_EVIDENCE_PASSED':'PASS',products:[structure],dataEntitlement:paper?'DOCUMENT_EVIDENCE_PASSED':'PASS',settledCashCents:funds.settledCashCents,reservedCashCents:funds.reservedCashCents,unsettledCashCents:funds.unsettledCashCents,maximumLossCents:request.maximumLossCents,tradeBudgetMaxCents:request.budgetCents,reviewedAt:extrema(accountRecords,'reviewedAt',true),validThrough:extrema(accountRecords,'validThrough',false)}};
  plan.provenance={version:assistant?'TECH_SPREAD_PLAN_BINDING_V2':'TECH_SPREAD_PLAN_BINDING_V1',...(assistant?{researchPolicy:ASSISTANT_FACT_POLICY}:{}),origin:policy.origin,...(paper?{evidenceContext:input.evidenceContext}:{}),planSha256:spreadPlanHash(plan),requestId:request.id,researchId:request.researchId,researchSha256:byKind.get('RESEARCH').sha256,batchId:selection.batchId,preflightAt:input.at,
   parentIds:[...new Set([...request.parentIds,request.id,request.researchId,selection.batchId,cost.id,accountId])],original:{rawJson:original.rawJson,sha256:original.sha256},records:input.records,
   costModel:{id:cost.id,version:cost.version,source:byKind.get('COST_MODEL').source,sha256:byKind.get('COST_MODEL').sha256},
   maximumLossBasis:'TERMINAL_VERTICAL_PAYOFF_PLUS_FIXED_COST_RESERVE_NOT_EARLY_CLOSE_OR_ASSIGNMENT_BOUND',conditions:{...request.conditions,evaluation:'MANUAL_CONDITIONS_AND_EXISTING_TIME_EXIT_ONLY'},
   actions:plan.legs.map(l=>({contractId:l.contract.id,quantity:l.quantity,open:l.role==='LONG'?'BUY_TO_OPEN':'SELL_TO_OPEN',close:l.role==='LONG'?'SELL_TO_CLOSE':'BUY_TO_CLOSE'}))};
  plan.provenance.planSha256=boundSpreadPlanHash(plan);
  check(Buffer.byteLength(JSON.stringify(plan))<1500000,'PLAN_RECORD_BOUND');
  const event=mockSpreadEventFromOriginal({plan,original,id:paper?'paper-plan-entry':'mock-plan-entry',at:input.at});
  // Reuse the existing pure engine for a hypothetical entry check. No journal/fill is written.
  const probe=replayMockSpread(plan,[event],input.at);gate(paper?'EXISTING_PAPER_ENTRY_MODEL':'EXISTING_MOCK_ENTRY_MODEL',probe.status==='OPEN_UNRESOLVED',{frozenBlockers:probe.frozenBlockers,diagnostics:probe.diagnostics});
  if(probe.status!=='OPEN_UNRESOLVED')return out;
  out.status=paper?'REAL_QUOTE_PAPER_PLAN_READY':'MOCK_PLAN_READY';out.plan=plan;out.entryEvent=event;out.economics={basis:'PURE_HYPOTHETICAL_ENTRY_CHECK_NOT_A_FILL',availableSettledCashCents:funds.settledCashCents-funds.reservedCashCents,initialUnsettledCashCents:funds.unsettledCashCents,unsettledUsableForEntry:false,terminalRisk:probe.terminalRisk,maximumLossIsTerminalModelOnly:true};return out;
 }catch(e){gate(code(e),false);return out;}
}
export function startTechSpreadPlan({root,runId,input}){const preview=previewTechSpreadPlan(input);if(!['MOCK_PLAN_READY','REAL_QUOTE_PAPER_PLAN_READY'].includes(preview.status))return preview;const started=startMockSpread({root,runId,input:preview.plan});return {...preview,started,entryAutomaticallyAppended:false};}
