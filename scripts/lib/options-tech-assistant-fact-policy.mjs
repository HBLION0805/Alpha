import {ASSISTANT_FACT_POLICY,assistantFactScope,validateResearchFactSources} from '../../src/engines/options-three-facet/OptionsResearchFacts.ts';
export {ASSISTANT_FACT_POLICY};
const check=(ok,c)=>{if(!ok)throw Error('ASSISTANT_FACT_'+c);};
export const assistantOrigin=(r)=>r?.kind==='RESEARCH'?r.origin==='ASSISTANT_RESEARCH':r?.kind==='STRATEGY_REQUEST'&&r.origin==='SYSTEM_PAPER_REQUEST';
export function assistantInputPolicy(input){
 if(input?.version!=='TECH_SPREAD_PLAN_INPUT_V3')return false;
 check(input.mode==='REAL_QUOTE_PAPER'&&['SIMULATED_ACCOUNT_REAL_MARKET_DATA','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(input.evidenceContext)&&input.researchPolicy===ASSISTANT_FACT_POLICY,'INPUT_SCOPE');
 return true;
}
export function validateAssistantPayload(kind,p,context){
 if(kind==='RESEARCH'){
  validateResearchFactSources(p);check(p.factSources.context===context,'CONTEXT');
 }else if(kind==='STRATEGY_REQUEST'){
  check(p.researchPolicy===ASSISTANT_FACT_POLICY&&assistantFactScope(context,p.accountId)&&p.quantity===1&&['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'].includes(p.structure),'REQUEST_SCOPE');
  check([p.budgetCents,p.maximumLossCents].every(n=>Number.isSafeInteger(n)&&n>0&&n<=100000),'REQUEST_BUDGET');
 }else check(false,'KIND');
}
export function validateAssistantRecordSet(records,context){
 const requestRecord=records.find(r=>r.kind==='STRATEGY_REQUEST'),researchRecord=records.find(r=>r.kind==='RESEARCH');
 check(assistantOrigin(requestRecord)&&assistantOrigin(researchRecord),'ORIGINS');
 const request=JSON.parse(requestRecord.rawJson),research=JSON.parse(researchRecord.rawJson);
 validateAssistantPayload('STRATEGY_REQUEST',request,context);validateAssistantPayload('RESEARCH',research,context);
 check(request.accountId===research.factSources.accountId,'ACCOUNT_BINDING');
 return {request,research};
}
