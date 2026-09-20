import type { TradeThesis, ThesisCondition, ThesisOwnerEvidence, ThesisMarketEvidence, ThesisDraft, ThesisPlanContext } from '../../contracts/OptionsTradeThesis';
import { manualUsdUnits } from './OptionsManualLedger';
import { snapshotNs } from '../options-robinhood-data/RobinhoodSnapshotPaper';
import { paperSession } from '../options-robinhood-data/RobinhoodPaperSession';
import { guidanceLocal } from '../options-daily-guidance/OptionsGuidanceClock';
import { validateEtfBars, etfMicroUsd, etfBarsFresh, ETF_BAR_INTERVAL_MS } from '../options-daily-guidance/OptionsEtfSetup';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';
import { POSITION_QUOTE_MAX_AGE_NS } from './OptionsPositionWatch';

const fail = (s: string): never => { throw Error('MANUAL_THESIS_' + s); };
const stamp = (s: string) => { try { return snapshotNs(s); } catch { return fail('CLOCK'); } };
function exact(v: any, fields: string) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== fields.split(',').sort().join()) fail('FIELDS');
}
function strings(v: Record<string, any>, max = 1500) {
  for (const x of Object.values(v)) if (typeof x !== 'string' || x.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x)) fail('TEXT');
}
export function validateTradeThesis(t: TradeThesis): TradeThesis {
  exact(t,'version,template,decisionId,tradeDate,realizationStartAt,realizationEndAt,nextCheckAt,holdThroughEvent,manualFallback,conditions'+(Object.hasOwn(t,'eventEntry')?',eventEntry':'')+(Object.hasOwn(t,'expectationSnapshot')?',expectationSnapshot':'')+(Object.hasOwn(t,'scenarioSet')?',scenarioSet':''));
  const {conditions,eventEntry,expectationSnapshot,scenarioSet,...rest}=t; strings(rest);
  if(Object.hasOwn(t,'scenarioSet')){
    exact(scenarioSet,'path,fingerprint,savedAt');strings(scenarioSet!);
    if(!/^data\/runtime\/options-macro-comparisons\/source-scenario-[a-z0-9][a-z0-9-]{2,79}\.json$/.test(scenarioSet!.path)||!/^sha256:[0-9a-f]{64}$/.test(scenarioSet!.fingerprint))fail('SCENARIO_REFERENCE');
    stamp(scenarioSet!.savedAt);
  }
  if(Object.hasOwn(t,'expectationSnapshot')){
    exact(expectationSnapshot,'path,fingerprint,frozenAt');strings(expectationSnapshot!);
    if(!/^data\/runtime\/options-macro-comparisons\/source-expectation-[a-z0-9][a-z0-9-]{2,79}\.json$/.test(expectationSnapshot!.path)||!/^sha256:[0-9a-f]{64}$/.test(expectationSnapshot!.fingerprint))fail('EXPECTATION_REFERENCE');
    stamp(expectationSnapshot!.frozenAt);
  }
  if(Object.hasOwn(t,'eventEntry')){
    exact(eventEntry,'phase,conditionId,calendarVerifiedAt,calendarSource,expectationStatus,expectationBasis,differenceBasis,supportingScenario,neutralScenario,reverseScenario,counterexample,reviewer,gapRiskAccepted,closedMarketRiskAccepted');
    const {gapRiskAccepted,closedMarketRiskAccepted,...text}=eventEntry!;strings(text);
    if(!['','PRE_EVENT','POST_EVENT'].includes(eventEntry!.phase)||!['','AVAILABLE','UNAVAILABLE'].includes(eventEntry!.expectationStatus)||typeof gapRiskAccepted!=='boolean'||typeof closedMarketRiskAccepted!=='boolean')fail('EVENT_ENTRY');
  }
  if(t.version!=='OPTIONS_TRADE_THESIS_V1'||!['CUSTOM','CLOSE_ENTRY_OPEN_REVIEW'].includes(t.template)||!['YES','NO','NOT_APPLICABLE',''].includes(t.holdThroughEvent))fail('VERSION');
  if(!Array.isArray(conditions)||conditions.length>8||new Set(conditions.map(c=>c.id)).size!==conditions.length)fail('CONDITIONS');
  for(const c of conditions){
    exact(c,'id,kind,basis,checkAt,missingAction,target,comparator,threshold,warningThreshold,confirmation,confirmationMinutes,confirmationCount,bufferUsd,eventKey,metric,period,unit,releaseVersion,releaseAt,expectationRef,expectationValue,source,invalidation'); strings(c);
    if(!/^[a-z][a-z0-9-]{0,39}$/.test(c.id)||!['PRICE','EVENT_NUMERIC','OWNER_CONFIRMED'].includes(c.kind))fail('CONDITION_ID');
  }
  return t;
}
export function validateThesisDraft(d: ThesisDraft) {
  exact(d,'fields,thesis');validateTradeThesis(d.thesis);
  const allowed='tradeId,symbol,optionType,expiry,strikeUsd,includePlan,declaredAt,maxContracts,maxEntryDebitUsd,plannedRiskUsd,targetNetProfitUsd,stopPremiumUsd,entryDeadlineAt,timeExitAt,thesis,includeActivity,studyId,studyFingerprint,candidateId'.split(',');
  if(!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields)||Object.keys(d.fields).some(k=>!allowed.includes(k)))fail('DRAFT');
  for(const [k,v]of Object.entries(d.fields))if(k==='includePlan'||k==='includeActivity'?typeof v!=='boolean':typeof v!=='string'||v.length>1500)fail('DRAFT');
}
const decimal = (s: string) => { if(!/^-?(0|[1-9]\d{0,7})(\.\d{1,6})?$/.test(s))return fail('NUMBER');return s.startsWith('-')?-manualUsdUnits(s.slice(1)):manualUsdUnits(s); };
const compare = (value: bigint, op: string, threshold: bigint) => op==='AT_OR_BELOW'?value<=threshold:value>=threshold;
const optionalClock=(s:string)=>{try{return stamp(s);}catch{return null;}};
export function thesisPlanIssues(ctx: ThesisPlanContext, confirmedAt: string): string[] {
  const t=ctx.plan.invalidation;if(!t)return ['NOT_CONFIGURED'];validateTradeThesis(t);const issues:string[]=[];
  const require=(ok:unknown,code:string)=>{if(!ok)issues.push(code);};
  require(ctx.plan.thesis.trim(),'CORE_THESIS_REQUIRED'); require(t.manualFallback.trim(),'MANUAL_FALLBACK_REQUIRED');
  require(t.holdThroughEvent,'EVENT_EXPOSURE_REQUIRED');require(t.conditions.length,'INVALIDATION_CONDITION_REQUIRED');
  const dates=[t.realizationStartAt,t.realizationEndAt,t.nextCheckAt,ctx.plan.timeExitAt??'',ctx.plan.entryDeadlineAt??''];
  const clocks=dates.map(optionalClock),now=stamp(confirmedAt);
  require(clocks.every(c=>c!==null),'PLAN_TIMES_REQUIRED');
  if(clocks.every(c=>c!==null)){
    const [start,end,check,exit,entry]=clocks as bigint[];
    require(start!>=now&&end!>=start!&&end!<=exit!&&check!>=now&&check!<=exit!&&entry!>now&&entry!<exit!,'PLAN_TIME_ORDER');
    for(const [i,value]of dates.entries()){
      // Realization may be an overnight release; actionable checks/exit/entry use reviewed sessions.
      if(i<2)continue;
      require(paperSession(value,undefined).isOpen,'ACTION_TIME_CLOSED_OR_UNREVIEWED');
    }
    require(guidanceLocal(ctx.plan.entryDeadlineAt!).date===t.tradeDate,'TRADE_DATE_MISMATCH');
    require(guidanceLocal(ctx.plan.timeExitAt!).date<=ctx.contract.expiry,'EXIT_AFTER_EXPIRY');
  }
  for(const c of t.conditions){
    const prefix=c.id+':';require(c.basis.trim()&&c.missingAction.trim(),prefix+'BASIS_AND_MISSING_ACTION_REQUIRED');
    const check=optionalClock(c.checkAt);require(check!==null&&check>=now&&(!clocks[3]||check<=clocks[3]),prefix+'CHECK_TIME_REQUIRED');
    if(c.kind==='PRICE'){
      require(['ETF','OPTION_BID'].includes(c.target),prefix+'PRICE_TARGET_REQUIRED');require(['TOUCH','CLOSE'].includes(c.confirmation),prefix+'CONFIRMATION_REQUIRED');
      if(c.confirmation==='CLOSE')require(c.target==='ETF'&&c.confirmationMinutes==='5'&&/^[1-9]$/.test(c.confirmationCount),prefix+'SUPPORTED_CLOSE_CONFIRMATION_REQUIRED');
      if(check!==null)require(paperSession(c.checkAt,undefined).isOpen,prefix+'PRICE_CHECK_SESSION');
    }
    if(c.kind!=='OWNER_CONFIRMED'){
      require(['AT_OR_BELOW','AT_OR_ABOVE'].includes(c.comparator),prefix+'COMPARATOR_REQUIRED');
      try{decimal(c.threshold);if(c.kind==='PRICE')etfMicroUsd(c.threshold);if(c.warningThreshold)decimal(c.warningThreshold);if(c.bufferUsd)manualUsdUnits(c.bufferUsd);}catch{issues.push(prefix+'NUMERIC_THRESHOLD_REQUIRED');}
    }
    if(c.kind==='EVENT_NUMERIC'){
      require(c.eventKey.trim()&&c.metric.trim()&&c.period.trim()&&c.unit.trim()&&c.releaseVersion.trim()&&c.expectationRef.trim()&&c.source.trim(),prefix+'EVENT_IDENTITY_EXPECTATION_SOURCE_REQUIRED');
      const release=optionalClock(c.releaseAt);require(release!==null&&release>now&&check!==null&&check>=release,prefix+'PRE_RELEASE_CONFIRMATION_REQUIRED');
      try{decimal(c.expectationValue);}catch{issues.push(prefix+'EXPECTATION_VALUE_REQUIRED');}
      if(release!==null&&clocks[3]&&t.holdThroughEvent==='NO')require(clocks[3]<release,prefix+'NO_EVENT_HOLD_CONTRADICTS_EXIT');
    }
    if(c.kind==='OWNER_CONFIRMED')require(c.invalidation.trim()&&c.source.trim(),prefix+'MANUAL_INVALIDATION_AND_SOURCE_REQUIRED');
  }
  return [...new Set(issues)];
}
export function validateThesisOwnerEvidence(e: ThesisOwnerEvidence, at: string) {
  exact(e,'conditionId,source,sourceAt,receivedAt,savedAt,confirmation,eventKey,metric,period,unit,releaseVersion,value,judgment,explanation,comparisonRef');strings(e);
  if(e.confirmation!=='OWNER_CONFIRMED'||!e.source.trim()||!e.explanation.trim()||!['SUPPORTED','WARNING','INVALIDATED',''].includes(e.judgment))fail('OWNER_CONFIRMATION');
  if(stamp(e.sourceAt)>stamp(e.receivedAt)||stamp(e.receivedAt)>stamp(e.savedAt)||stamp(e.savedAt)>stamp(at))fail('EVIDENCE_CLOCK_ORDER');
  if(e.value)decimal(e.value);
}

type Check={id:string;status:'SUPPORTED'|'WARNING'|'INVALIDATED'|'UNKNOWN'|'PENDING';reason:string;sourceAt:string|null;receivedAt:string|null;reference:string|null;provenance:string};
// The base row is calculated by Position watch. This extension never substitutes a quote or financial model.
export function assessTradeThesis(ctx: ThesisPlanContext, watch: any, at: string, evidence: ThesisOwnerEvidence[], market: ThesisMarketEvidence, priorTriggers: string[] = []) {
  const now=stamp(at),t=ctx.plan.invalidation;
  const expectedOrigin=watch.origin==='SYNTHETIC_FIXTURE'?'SYNTHETIC_FIXTURE':'HOST_MARKET_TOOL_RESPONSES';
  const row=(c:ThesisCondition,status:Check['status'],reason:string,sourceAt:string|null=null,receivedAt:string|null=null,reference:string|null=null,provenance='SAVED_EVIDENCE'):Check=>({id:c.id,status,reason,sourceAt,receivedAt,reference,provenance});
  const issues=t?thesisPlanIssues(ctx,ctx.registeredAt):['NOT_CONFIGURED'];
  const prospective=ctx.openedAt===null||stamp(ctx.registeredAt)<stamp(ctx.openedAt);
  const checks:Check[]=(t?.conditions??[]).map(c=>{
    if(issues.some(i=>i.startsWith(c.id+':')))return row(c,'UNKNOWN','Condition configuration incomplete');
    if(now<stamp(c.checkAt))return row(c,'PENDING','Declared check time has not arrived');
    if(c.kind==='PRICE'){
      const threshold=decimal(c.threshold),buffer=c.bufferUsd?manualUsdUnits(c.bufferUsd):0n;
      const boundary=c.comparator==='AT_OR_BELOW'?threshold-buffer:threshold+buffer;
      let value:bigint|null=null,sourceAt:string|null=null,receivedAt:string|null=null,reference:string|null=null;
      if(c.confirmation==='CLOSE'){
        const interval=BigInt(ETF_BAR_INTERVAL_MS)*1000000n,check=stamp(c.checkAt);
        const firstEnd=((check+interval-1n)/interval+1n)*interval;
        if(now<firstEnd+BigInt(Number(c.confirmationCount)-1)*interval)return row(c,'PENDING','Required completed confirmation bars are not due yet');
        const b=market.bars;
        if(!b||!b.value||!b.qualified||b.conflicted||b.value.symbol!==ctx.contract.symbol||stamp(b.recordedAt)>now)return row(c,'UNKNOWN','Qualified, conflict-free completed ETF bars unavailable');
        if(b.origin!==expectedOrigin)return row(c,'UNKNOWN','Bar origin mismatch');
        try{validateEtfBars(b.value,at);}catch{return row(c,'UNKNOWN','Existing ETF bar validator rejected evidence');}
        const bars=b.value.bars.filter(x=>stamp(x.start)>=stamp(c.checkAt)&&stamp(x.end)<=now).slice(-Number(c.confirmationCount));
        if(bars.length!==Number(c.confirmationCount)||!etfBarsFresh(bars,at))return row(c,'UNKNOWN','Confirmation bars missing or stale under existing five-minute rule');
        const hit=bars.every(x=>compare(etfMicroUsd(x.close),c.comparator,boundary));
        return row(c,hit?'INVALIDATED':'SUPPORTED',hit?'Declared consecutive ETF closes crossed boundary':'Completed closes do not meet invalidation',bars.at(-1)!.end,b.value.receivedAt,b.path);
      }
      if(c.target==='OPTION_BID'){
        if(!watch.usableQuote)return row(c,'UNKNOWN','Current matching option bid is unusable');
        value=BigInt(watch.quote.bidCents)*10000n;sourceAt=watch.quote.sourceAt;receivedAt=watch.quote.receivedAt;reference=watch.source?.path??null;
      }else{
        const p=market.price;
        if(!p||p.symbol!==ctx.contract.symbol||!p.price||!p.sourceAt||!p.receivedAt||stamp(p.recordedAt)>now||stamp(p.sourceAt)>stamp(p.receivedAt)||stamp(p.receivedAt)>now||now-stamp(p.sourceAt)>POSITION_QUOTE_MAX_AGE_NS||!paperSession(at,undefined).isOpen||!paperSession(p.sourceAt,undefined).isOpen||!paperSession(p.receivedAt,undefined).isOpen||p.origin!==expectedOrigin)return row(c,'UNKNOWN','Current ETF price/receipt/session evidence unusable');
        value=etfMicroUsd(p.price);sourceAt=p.sourceAt;receivedAt=p.receivedAt;reference=p.path;
      }
      if(!sourceAt||stamp(sourceAt)<stamp(c.checkAt)||ctx.openedAt&&stamp(sourceAt)<stamp(ctx.openedAt))return row(c,'UNKNOWN','Price predates this check or reported entry');
      return row(c,compare(value!,c.comparator,boundary)?'INVALIDATED':c.warningThreshold&&compare(value!,c.comparator,decimal(c.warningThreshold))?'WARNING':'SUPPORTED','Compared saved matching price with original boundary',sourceAt,receivedAt,reference);
    }
    const candidates=evidence.filter(e=>e.conditionId===c.id&&stamp(e.savedAt)<=now&&stamp(e.receivedAt)<=now&&stamp(e.sourceAt)<=now).sort((a,b)=>stamp(a.savedAt)<stamp(b.savedAt)?1:-1);
    const e=candidates[0];if(!e)return row(c,'UNKNOWN',c.missingAction||'Owner verification with source required');
    validateThesisOwnerEvidence(e,at);
    if(stamp(e.sourceAt)<stamp(c.checkAt)&&c.kind==='OWNER_CONFIRMED')return row(c,'UNKNOWN','Owner evidence predates declared check');
    if(candidates.some(x=>x.savedAt===e.savedAt&&paperFingerprint(x)!==paperFingerprint(e)))return row(c,'UNKNOWN','Conflicting confirmations at the same recorded time');
    if(c.kind==='OWNER_CONFIRMED')return row(c,e.judgment||'UNKNOWN','Owner-confirmed: '+e.explanation,e.sourceAt,e.receivedAt,e.source,'OWNER_CONFIRMED_NOT_MACHINE_VERIFIED');
    if(['eventKey','metric','period','unit','releaseVersion','source'].some(k=>(e as any)[k]!== (c as any)[k])||stamp(e.sourceAt)<stamp(c.releaseAt)||stamp(ctx.registeredAt)>=stamp(c.releaseAt))return row(c,'UNKNOWN','Release identity, source, unit, vintage or prospective expectation mismatch',e.sourceAt,e.receivedAt,e.source,'OWNER_CONFIRMED');
    if(candidates.some(x=>x.releaseVersion===e.releaseVersion&&x.eventKey===e.eventKey&&x.metric===e.metric&&x.period===e.period&&x.unit===e.unit&&x.value!==e.value))return row(c,'UNKNOWN','Conflicting values for the same release vintage; original records retained');
    if(!e.value)return row(c,'UNKNOWN','Structured actual value missing');
    const value=decimal(e.value);
    return row(c,compare(value,c.comparator,decimal(c.threshold))?'INVALIDATED':c.warningThreshold&&compare(value,c.comparator,decimal(c.warningThreshold))?'WARNING':'SUPPORTED','Exact numeric comparison of Owner-confirmed release; expectation frozen '+ctx.registeredAt,e.sourceAt,e.receivedAt,e.comparisonRef||e.source,'OWNER_CONFIRMED_NOT_MACHINE_VERIFIED');
  });
  const thesisStatus=!t||!prospective?'UNKNOWN':checks.some(c=>c.status==='INVALIDATED')?'INVALIDATED':checks.some(c=>c.status==='WARNING')?'WARNING':issues.length||!checks.length||checks.some(c=>c.status==='UNKNOWN'||c.status==='PENDING')?'UNKNOWN':'SUPPORTED';
  const triggered=[...new Set([...priorTriggers,...watch.attentionReasons,...(prospective?checks.filter(c=>c.status==='INVALIDATED').map(c=>'THESIS_INVALIDATED:'+c.id):[])])];
  const unknownExits=Object.entries(watch.checks).some(([k,v])=>k!=='expiry'&&(String(v).startsWith('UNKNOWN')||k!=='stop'&&v==='NOT_DECLARED'));
  const realizationCheck=!t||!optionalClock(t.realizationEndAt)?'NOT_CONFIGURED':now>stamp(t.realizationEndAt)?'REALIZATION_DEADLINE_PASSED_REVIEW_REQUIRED':now<stamp(t.realizationStartAt)?'PENDING':'WITHIN_DECLARED_WINDOW';
  const action=triggered.length?'EXIT_CONDITION_TRIGGERED':thesisStatus==='SUPPORTED'&&!issues.length&&!unknownExits&&watch.checks.time==='NOT_DUE'&&realizationCheck!=='REALIZATION_DEADLINE_PASSED_REVIEW_REQUIRED'?'HOLD_UNDER_ORIGINAL_PLAN':'MANUAL_VERIFICATION_REQUIRED';
  return {version:'OPTIONS_TRADE_THESIS_ASSESSMENT_V1',assessedAt:at,planFingerprint:paperFingerprint(ctx.plan),thesisStatus,action,checks,triggered,issues,
    preEntryTiming:prospective?'LOCALLY_RECORDED_BEFORE_REPORTED_ENTRY_OR_NO_ENTRY':'RETROSPECTIVE_NOT_PRE_ENTRY',
    nextCheckAt:t?.nextCheckAt??null,realizationCheck,latestExitAt:ctx.plan.timeExitAt,tradeDate:t?.tradeDate??null,expiry:ctx.contract.expiry,
    coverage:'On-demand saved evidence only. No automatic opening monitoring or continuous exit coverage.',marketGaps:market.gaps.filter(g=>g.includes('BAR')?t?.conditions.some(c=>c.kind==='PRICE'&&c.confirmation==='CLOSE'):t?.conditions.some(c=>c.kind==='PRICE'&&c.target==='ETF')),
    executionAllowed:false,actualExitConfirmed:false};
}

export function validatePositionReview(r:any,at:string) {
  exact(r,'version,context,watch,assessedAt,evidence,market,priorTriggers,result,note,reportedAction,correctionOf,submissionFingerprint');
  if(r.version!=='OPTIONS_POSITION_REVIEW_V1'||stamp(r.assessedAt)>stamp(at)||!['NO_ACTION_REPORTED','OWNER_REPORTS_ACTION'].includes(r.reportedAction)||typeof r.note!=='string'||r.note.length>1500||typeof r.correctionOf!=='string')fail('REVIEW');
  if(!Array.isArray(r.evidence)||r.evidence.length>24||!Array.isArray(r.priorTriggers)||r.priorTriggers.length>40)fail('REVIEW_BOUND');
  if(typeof r.submissionFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(r.submissionFingerprint)||r.correctionOf&&!r.note.trim())fail('REVIEW_CORRECTION_NOTE');
  for(const e of r.evidence)validateThesisOwnerEvidence(e,r.assessedAt);
  if(paperFingerprint(assessTradeThesis(r.context,r.watch,r.assessedAt,r.evidence,r.market,r.priorTriggers))!==paperFingerprint(r.result))fail('REVIEW_RECOMPUTATION');
}
