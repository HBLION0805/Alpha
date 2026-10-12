import {assessCourseFramework,courseDirectionFromFacets} from '../../apps/options-workbench/course-framework.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {SPREAD_PLAN_RECORD_KINDS,spreadPlanHash,spreadPaperEvidencePolicy,spreadRecordOriginAllowed,SIMULATED_SPREAD_RECORD_KINDS} from './options-tech-spread-plan-binding.mjs';
import {previewTechSpreadPlan} from './options-tech-spread-plan.mjs';
import {techStatusCodes} from './options-tech-status-codes.mjs';
import {assistantInputPolicy} from './options-tech-assistant-fact-policy.mjs';

// Field inventory / drafting guidance only. Admission remains owned by the existing plan engine.
const sources={
 STRATEGY_REQUEST:'用户明确保存的请求：选定结构、合约选择指纹、原研究引用、条件、时间和既有预算；不能按已发生报价补写决策。',
 RESEARCH:'明确已有研究原件及原登记时钟、来源和研究 ID；研究方向及试探/确认条件保持原文，未知仍未知。',
 CONTRACT:'两条精确合约的供应商/合约规范原件；报价响应缺失的交割单位、行权方式不能推定。',
 COST_MODEL:'有日期、版本和来源的费用资料及用户明确的逐腿退出滑点假设；未知费用不能填零。',
 DATA_ENTITLEMENT:'适用于当前资料使用者的行情授权及本地留存依据；连通成功不能证明实时数据权益。',
 PRODUCT_PERMISSION:'用户提供的对应账户产品权限材料，经明确归属审核；使用本地 paper 别名，不提交凭据或原账户号。',
 ACCOUNT_FUNDS:'可归属的结算现金、已预留及未结算金额材料；买入力和余额不能自动视为可用结算现金。',
 RISK_LIMITS:'用户已明确的单笔预算和最大损失限制及有效期；不新增比例或自动改变风险设置。',
};
const accountKinds=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
const requestFields=['id','accountId','researchId','researchSha256','selectionSha256','costModelSha256','contractEvidenceSha256','parentIds','structure','executionModel','quantity','decisionAt','entryDeadlineAt','timeExitAt','budgetCents','maximumLossCents','entryDebitLimitCents','maxLegSpreadCents','maxSourceSkewMs','conditions.entry','conditions.exit','conditions.invalidation',...accountKinds.map(k=>'accountEvidenceHashes.'+k)];
const contractFields=['id','symbol','expiry','type','strike','multiplier','deliverable','exerciseStyle','tradability'];
const fields={STRATEGY_REQUEST:requestFields,
 RESEARCH:['symbol','asOf','holdingFrom','holdingThrough','fundamental.direction','fundamental.status','news.direction','news.status','researchPlan.id','researchPlan.registeredAt','researchPlan.sourceIds','researchPlan.hypothesis','researchPlan.triggerCondition','researchPlan.invalidationCondition','researchPlan.exitCondition'],
 CONTRACT:[0,1].flatMap(i=>contractFields.map(f=>`contracts.${i}.${f}`)),
 COST_MODEL:['id','version',...[0,1].flatMap(i=>['id','entryFeeCents','exitFeeCents','exitSlippageCents'].map(f=>`legs.${i}.${f}`))],
 DATA_ENTITLEMENT:['provider','symbols','realtimeOptions','localRetention'],PRODUCT_PERMISSION:['accountId','enabled','symbols','products'],
 ACCOUNT_FUNDS:['accountId','currency','settledCashCents','reservedCashCents','unsettledCashCents'],RISK_LIMITS:['accountId','tradeBudgetMaxCents','maximumLossCents']};
const envelopeFields=['origin','source','reviewedBy','observedAt','receivedAt','reviewedAt','validThrough','verdict','rawJson','sha256'];
const get=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const present=v=>v!==null&&v!==undefined&&(typeof v!=='string'||(v.trim()!==''&&v.trim()!=='UNKNOWN'))&&(!Array.isArray(v)||v.length>0);
const set=(o,path,value)=>{const ks=path.split('.');let at=o;for(const k of ks.slice(0,-1))at=at[k]??={};at[ks.at(-1)]=value;};
const object=o=>o&&typeof o==='object'&&!Array.isArray(o);
const code=s=>techStatusCodes.has(s)?s:'INPUT_INVALID';
// Display projection only: malformed nested content is never echoed as a draft value.
const numericFields=new Set(['quantity','budgetCents','maximumLossCents','entryDebitLimitCents','maxLegSpreadCents','maxSourceSkewMs']);
const draftValue=(field,value)=>!present(value)?null:field==='parentIds'?(Array.isArray(value)&&value.length<=12&&value.every(v=>typeof v==='string'&&v.length<=2000)?[...value]:null):numericFields.has(field)?(typeof value==='number'&&Number.isFinite(value)?value:null):(typeof value==='string'&&value.length<=2000?value:null);

export function prepareTechSpreadInput(input){
 const inputDigest=spreadPlanHash(input??null),rows=Array.isArray(input?.records)&&input.records.length<=8?input.records:[],payloads=new Map(),records=new Map(),diagnostics=[];
 let policy=null;try{policy=input?.mode==='MOCK_CONTROL'?{fixture:true}:input?.mode==='REAL_QUOTE_PAPER'?spreadPaperEvidencePolicy(input.evidenceContext):null;}catch{}
 try{if(assistantInputPolicy(input)){policy??={};policy.assistantResearch=true;}}catch{policy=null;}
 const fixture=policy?.fixture??null;
 for(const kind of SPREAD_PLAN_RECORD_KINDS){
  const matches=rows.filter(r=>r?.kind===kind),r=matches.length===1?matches[0]:null;let body=null,integrity='UNKNOWN';
  if(r){
   try{if(typeof r.rawJson!=='string'||r.rawJson.length>(policy?.assistantResearch&&kind==='RESEARCH'?262144:65536)||spreadPlanHash(r.rawJson)!==r.sha256)throw Error();body=parseChainSurveyJson(r.rawJson);if(!object(body))throw Error();integrity='LOCAL_BYTES_MATCH_NOT_AUTHENTICATION';}catch{integrity='INVALID_BYTES_OR_JSON';}
  }
  const originApplicable=policy?spreadRecordOriginAllowed(policy,r):false;
  const extra=policy?.simulatedAccount?({ACCOUNT_FUNDS:['basis','initialCapitalCents','additionalDepositsCents','borrowingCents','initialPositions'],PRODUCT_PERMISSION:['basis','brokerQualification'],RISK_LIMITS:['basis'],COST_MODEL:['basis','actualBrokerFees']}[kind]??[]):[];
  const paths=[...fields[kind].filter(f=>f!=='maxSourceSkewMs'||input?.mode==='REAL_QUOTE_PAPER'),...extra];
  const supplied=f=>['initialPositions','brokerQualification','actualBrokerFees'].includes(f)&&policy?.simulatedAccount?(f==='initialPositions'?Array.isArray(get(body,f)):typeof get(body,f)==='string'&&get(body,f).length>0):present(get(body,f));
  const missing=[...envelopeFields.filter(f=>!present(r?.[f])).map(f=>'envelope.'+f),...paths.filter(f=>!supplied(f)).map(f=>'payload.'+f)];
  diagnostics.push({kind,sourceGuidance:policy?.simulatedAccount&&SIMULATED_SPREAD_RECORD_KINDS.includes(kind)?'本轮独立模拟账户的事前模型假设；不需要真实账户截图，不证明券商资格。费用标为假设，资金及预算不超过本轮虚拟本金。':sources[kind],state:matches.length>1?'DUPLICATE_KIND':!r?'MISSING':missing.length?'PARTIAL_UNKNOWN':'FIELDS_SUPPLIED_UNVALIDATED',
   missingFields:missing,localIntegrity:integrity,originContext:originApplicable?'DECLARED_CONTEXT_ONLY':'UNKNOWN_OR_INAPPLICABLE',
   providedFields:paths.filter(supplied),qualification:'NOT_GRANTED_BY_FIELD_PRESENCE'});
  // Draft bindings use only unique, byte-matching records with an explicit applicable source.
  if(body&&integrity==='LOCAL_BYTES_MATCH_NOT_AUTHENTICATION'&&originApplicable&&typeof r.source==='string'&&r.source.trim()){payloads.set(kind,body);records.set(kind,r);}
 }
 const existing=payloads.get('STRATEGY_REQUEST'),requestDraft={},draftWarnings=[],bindingProposals=[];
 for(const field of requestFields.filter(f=>f!=='maxSourceSkewMs'||input?.mode==='REAL_QUOTE_PAPER')){
  const value=get(existing,field),projected=draftValue(field,value);set(requestDraft,field,projected);
  if(present(value)&&projected===null)draftWarnings.push('MALFORMED_DRAFT_FIELD:'+field);
 }
 if(present(requestDraft.accountId)&&!(input?.mode==='MOCK_CONTROL'?requestDraft.accountId==='MOCK':typeof requestDraft.accountId==='string'&&/^paper-[a-z0-9-]{1,60}$/.test(requestDraft.accountId))){requestDraft.accountId=null;draftWarnings.push('ACCOUNT_ALIAS_NOT_DISPLAYED_USE_EXPLICIT_LOCAL_PAPER_ALIAS');}
 const propose=(field,value,kind)=>{
  value=draftValue(field,value);if(!present(value))return;const current=get(requestDraft,field),original=get(existing,field),conflict=present(original)&&JSON.stringify(original)!==JSON.stringify(value);
  bindingProposals.push({field,sourceKind:kind,sourceSha256:records.get(kind).sha256,status:conflict?'CONFLICT_RETAINED':present(current)?'EXISTING_BINDING_MATCHES':'COPIED_TO_UNFROZEN_DRAFT'});
  if(!present(original))set(requestDraft,field,structuredClone(value));
 };
 if(payloads.has('RESEARCH')){propose('researchId',payloads.get('RESEARCH').researchPlan?.id,'RESEARCH');propose('researchSha256',records.get('RESEARCH').sha256,'RESEARCH');}
 for(const [kind,field]of [['COST_MODEL','costModelSha256'],['CONTRACT','contractEvidenceSha256'],...accountKinds.map(k=>[k,'accountEvidenceHashes.'+k])])if(records.has(kind))propose(field,records.get(kind).sha256,kind);
 // No selection, direction, account alias, dates, approval, conditions or risk defaults are inferred.
 // The original input, not the draft, is evaluated by the existing authoritative engine.
 const preview=previewTechSpreadPlan(input);
 const research=payloads.get('RESEARCH'),request=payloads.get('STRATEGY_REQUEST');
 const courseAssessment=assessCourseFramework({structure:request?.structure,direction:courseDirectionFromFacets(research?.fundamental?.direction,research?.news?.direction),
 thesisRef:research?.researchPlan?.hypothesis,realizationFrom:research?.holdingFrom,realizationThrough:research?.holdingThrough,
 timeExitAt:request?.timeExitAt,entry:request?.conditions?.entry,invalidation:request?.conditions?.invalidation,priceExit:request?.conditions?.exit});
 return {view:'EXISTING_SPREAD_INPUT_PREPARATION',status:draftWarnings.length||bindingProposals.some(p=>p.status==='CONFLICT_RETAINED')||diagnostics.some(d=>d.state!=='FIELDS_SUPPLIED_UNVALIDATED'||d.localIntegrity!=='LOCAL_BYTES_MATCH_NOT_AUTHENTICATION'||d.originContext!=='DECLARED_CONTEXT_ONLY')?'PARTIAL_UNKNOWN':'FIELDS_SUPPLIED_UNVALIDATED',
  courseAssessment, inputDigest,mode:['MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY','REAL_QUOTE_PAPER'].includes(input?.mode)?input.mode:'UNKNOWN',
  evidenceContext:policy?.simulatedAccount?input.evidenceContext:fixture===true?(input?.mode==='REAL_QUOTE_PAPER'?'TEST_FIXTURE':'MOCK'):fixture===false?'ATTRIBUTED_REAL_EVIDENCE':'UNKNOWN',diagnostics,
  requestDraft,draftWarnings,bindingProposals,draftAuthority:'UNFROZEN_BODY_ONLY_NOT_AN_EVIDENCE_ENVELOPE',
  inventoryScope:'Field presence only, not exhaustive semantic validation. Original research/source/technical, clock, binding and account gates remain in the original engine.',
  selectionGuidance:'selectionSha256 必须来自决策前明确保存的合约选择；不从后来行情倒造。需要决策后的完整两腿报价原件才能继续原计划预览。',
  enginePreview:{status:preview.status,checks:preview.checks.map(c=>({code:code(c.code),status:c.status})),realAccountConfirmation:preview.realAccountConfirmation},
  model:'TWO_LEG_BID_ASK_PAPER_ASSUMPTION is a model, not atomic execution or broker account authentication; existing MOCK remains isolated.',
  accountAuthentication:'NOT_ESTABLISHED_BY_DOCUMENT_HASH',sourceCalls:0,fileSystemWrites:0,planSaved:false,requestEnvelopeCreated:false,executionAllowed:false,productionPaperAdmissionAllowed:false,actualTrades:0,realAcceptance:'NOT_TESTED'};
}
