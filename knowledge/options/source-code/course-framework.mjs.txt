import {COURSE_CATALOG_VERSION,COURSE_SOURCES} from './course-catalog.mjs';
export {COURSE_CATALOG_VERSION,COURSE_SOURCES};
export const COURSE_FRAMEWORK_VERSION='OPTIONS_COURSE_FRAMEWORK_V1';
// A research vocabulary, not a strategy registration or execution capability.
const definitions=[
 ['LONG_CALL','买入看涨','BULLISH',7],['LONG_PUT','买入看跌','BEARISH',7],
 ['BULL_CALL_DEBIT','看涨借记价差','BULLISH',7],['BEAR_PUT_DEBIT','看跌借记价差','BEARISH',7],
 ['LEAPS_CALL','长期看涨','BULLISH',7],['COVERED_CALL','备兑看涨','BULLISH',8],['CASH_SECURED_PUT','现金担保卖沽','BULLISH',8],
 ['BULL_PUT_CREDIT','看跌信用价差','BULLISH',8],['BEAR_CALL_CREDIT','看涨信用价差','BEARISH',8],
 ['LONG_STRADDLE','买入跨式','LARGE_MOVE',9],['LONG_STRANGLE','买入宽跨式','LARGE_MOVE',9],
 ['IRON_CONDOR','铁鹰','RANGE',9],['IRON_FLY','铁蝶','RANGE',9],['BUTTERFLY','蝶式','RANGE',9],
 ['REVERSE_IRON_CONDOR','反向铁鹰','LARGE_MOVE',9],['CALENDAR','日历价差','TERM_STRUCTURE',9],
 ['PROTECTIVE_PUT','保护性看跌','HEDGE',11],['COLLAR','领口','HEDGE',11],['VIX_CALL','VIX看涨','HEDGE',11],
];
const math=new Set(['LONG_CALL','LONG_PUT','BULL_CALL_DEBIT','BEAR_PUT_DEBIT','BULL_PUT_CREDIT','BEAR_CALL_CREDIT','LONG_STRADDLE','LONG_STRANGLE']);
export const COURSE_STRATEGIES=Object.freeze(definitions.map(([id,label,direction,chapter])=>Object.freeze({id,label,direction,chapter,
 knowledge:'CATALOGED',math:math.has(id)?'EXISTING_GLD_IBIT_TERMINAL_MATH':'NOT_IMPLEMENTED',
 workflow:['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'].includes(id)?'EXISTING_TECH_TWO_LEG_DEBIT_WORKFLOW':['LONG_CALL','LONG_PUT'].includes(id)?'EXISTING_GLD_IBIT_SINGLE_LEG_WORKFLOW':'NOT_IMPLEMENTED',
 paper:'SEPARATE_ORIGINAL_ADMISSION_REQUIRED',realValidation:'NOT_ESTABLISHED_BY_CATALOG'})));
const present=v=>typeof v==='string'&&v.trim()!==''&&!['UNKNOWN','NOT_ASSESSED'].includes(v.trim());
const clock=v=>{if(typeof v!=='string')return false;const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.exec(v);if(!m||!Number.isFinite(Date.parse(v)))return false;const [y,mo,d,h,mi,se]=m.slice(1).map(Number);const dt=new Date(Date.UTC(y,mo-1,d));return y>=1000&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d&&h<24&&mi<60&&se<60;};
const directions=new Set(['BULLISH','BEARISH','RANGE','LARGE_MOVE','HEDGE','TERM_STRUCTURE']);
const rule=(id,chapters,missing,counterexample,mismatch=false)=>({id,version:COURSE_FRAMEWORK_VERSION,
 status:mismatch?'RESEARCH_MISMATCH':missing.length?'INSUFFICIENT_EVIDENCE':'DECLARED_INPUTS_PRESENT_NOT_VERIFIED',missing,counterexample,
 sources:chapters.map(n=>COURSE_SOURCES.find(s=>s.id==='CH'+String(n).padStart(2,'0')).url)});
/** Pure, conservative field/consistency checks. No source reader, account check,
 * price model, policy mutation, original gate override or inference from prose. */
export function assessCourseFramework(input={}){
 const i=input??{},strategy=COURSE_STRATEGIES.find(s=>s.id===i.structure),checks=[];
 const need=(pairs)=>pairs.filter(([,ok])=>!ok).map(([name])=>name);
 checks.push(rule('DIRECTION_MAGNITUDE',[3,7,14],need([['DIRECTION',directions.has(i.direction)],['EXPECTED_MAGNITUDE',present(i.magnitude)],['THESIS_REFERENCE',present(i.thesisRef)]]),'方向符合仍可能因幅度不足、成本或时点错误而亏损。'));
 const validWindow=clock(i.realizationFrom)&&clock(i.realizationThrough)&&Date.parse(i.realizationThrough)>=Date.parse(i.realizationFrom);
 checks.push(rule('REALIZATION_AND_EXIT',[2,7,14],need([['REALIZATION_WINDOW',validWindow],['EXACT_CONTRACT_EXPIRY_REFERENCE',present(i.expiryRef)],['LATEST_EXIT',clock(i.timeExitAt)]]),'观点兑现晚于退出期限或到期，原方向判断不能补救合约损失。',validWindow&&clock(i.timeExitAt)&&Date.parse(i.timeExitAt)<Date.parse(i.realizationThrough)));
 checks.push(rule('VOLATILITY_CONTEXT',[5,6,10],need([['IV_HISTORY_REFERENCE',present(i.ivHistoryRef)],['COMPARABLE_REALIZED_VOLATILITY_REFERENCE',present(i.realizedVolRef)],['IV_CHANGE_HYPOTHESIS',present(i.ivHypothesis)],['COMPARABILITY_REVIEW',present(i.ivComparisonReview)]]),'单点IV、上涨观点、Delta或教材阈值都不能证明IV便宜；事件后IV下降仍可能造成损失。'));
 checks.push(rule('STRUCTURE_RATIONALE',[7,8,9,14],need([['EXPLICIT_STRUCTURE',!!strategy],['SELECTION_RATIONALE',present(i.rationale)],['ALTERNATIVE_OR_NO_TRADE',present(i.alternative)],['COUNTEREXAMPLE',present(i.counterexample)]]),'没有最优结构排名；卖方胜率、净收权利金或终值限亏不能替代成本、指派和路径风险。',!!strategy&&((strategy.direction==='BULLISH'&&i.direction==='BEARISH')||(strategy.direction==='BEARISH'&&i.direction==='BULLISH'))));
 checks.push(rule('ENTRY_AND_INDEPENDENT_EXITS',[10,13,14],need([['ENTRY_CONFIRMATION',present(i.entry)],['INVALIDATION',present(i.invalidation)],['PRICE_EXIT',present(i.priceExit)],['NEXT_CHECK',clock(i.nextCheckAt)],['INTERRUPTION_PLAN',present(i.fallback)],['EVENT_HOLDING_DECISION',present(i.eventDecision)]]),'反弹不清除已保存退出触发；提前试探、证据增强或20/30/50都不是自动加仓权限。'));
 checks.push(rule('RISK_AUTHORITY',[2,13],need([['OWNER_POLICY_VERSION_REFERENCE',present(i.ownerPolicyRef)],['FROZEN_PLAN_ASSUMPTIONS_REFERENCE',present(i.planAssumptionsRef)]]),'教材数字不是Owner规则。结算现金、费用、合约与权益是否合格，仍由原准入引擎逐项决定。'));
 checks.push(rule('PORTFOLIO_AND_HEDGE',[4,11,12],need([['COMPLETE_POSITIONS_REFERENCE',present(i.positionsRef)],['COMPARABLE_GREEKS_AND_UNITS_REFERENCE',present(i.greeksRef)]]),'缺全仓、单位或可比时钟时不能汇总风险或声称对冲完成；滚动是新决策，保留原亏损。'));
 return {version:COURSE_FRAMEWORK_VERSION,catalogVersion:COURSE_CATALOG_VERSION,scope:'DECLARED_RESEARCH_CHECKS_ONLY',
  status:checks.some(c=>c.status==='RESEARCH_MISMATCH')?'RESEARCH_MISMATCH':checks.some(c=>c.missing.length)?'INSUFFICIENT_EVIDENCE':'DECLARED_INPUTS_PRESENT_NOT_VERIFIED',
  strategy:strategy??null,checks,ivClassification:'UNKNOWN',aggregateGreeks:'UNKNOWN',
  authorities:{textbook:'EDUCATIONAL_EXAMPLES_ONLY',ownerPolicy:present(i.ownerPolicyRef)?'REFERENCE_SUPPLIED_NOT_AUTHENTICATED':'UNKNOWN',singlePlan:present(i.planAssumptionsRef)?'REFERENCE_SUPPLIED_NOT_AUTHENTICATED':'UNKNOWN'},
  admissionOverride:false,executionAllowed:false,paperAdmissionAllowed:false,sourceCalls:0,fileSystemWrites:0,fillsCreated:0,pnl:null,
  review:'Process, prediction and actual fills/P&L remain separate. No automated lesson approval or strategy change.'};
}
// Copies only explicit fields. No direction inferred from a call/put or headline.
export function courseInputFromPlan(fields={},thesis={},extra={}){
 return {...extra,thesisRef:fields.thesis||extra.thesisRef,realizationFrom:thesis.realizationStartAt||extra.realizationFrom,
 realizationThrough:thesis.realizationEndAt||extra.realizationThrough,timeExitAt:fields.timeExitAt||extra.timeExitAt,
 expiryRef:fields.expiry?`${fields.symbol??'UNKNOWN'} / ${fields.expiry} (declared; contract qualification separate)`:extra.expiryRef,
 invalidation:thesis.conditions?.map(c=>c.invalidation).filter(Boolean).join(' / ')||extra.invalidation,
 nextCheckAt:thesis.nextCheckAt||extra.nextCheckAt,fallback:thesis.manualFallback||extra.fallback,eventDecision:thesis.holdThroughEvent||extra.eventDecision};
}

export function courseDirectionFromFacets(fundamental,news){const map={UP:'BULLISH',DOWN:'BEARISH',BULLISH:'BULLISH',BEARISH:'BEARISH'};return fundamental===news?map[fundamental]:undefined;}
