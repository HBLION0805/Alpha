import type { EventEntryContext, ThesisPlanContext } from '../../contracts/OptionsTradeThesis';
import type { GuidanceEvent } from '../../contracts/OptionsDailyGuidance';
import { thesisPlanIssues, validateTradeThesis } from '../options-manual-ledger/OptionsTradeThesis';
import { readinessClock } from '../options-readiness/OptionsReadinessEngine';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

const clock=(v:unknown):number=>{try{readinessClock(v);return Date.parse(v);}catch{return NaN;}};
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const positive=(v:unknown)=>typeof v==='string'&&/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(v)&&Number(v)>0;
export const EVENT_ENTRY_RISK = ['Pre-event event-risk plan','Holding through scheduled release','Gap risk accepted under original plan','No stop execution is possible while the option market is closed'];

/** Entry-only completeness, not semantic authentication or a change to independent exits. */
export function preEventConfigurationIssues(ctx: ThesisPlanContext, at: string): string[] {
  const t=ctx.plan.invalidation,e=t?.eventEntry;if(!t||!e||e.phase!=='PRE_EVENT')return [];
  const issues:string[]=[],need=(ok:unknown,code:string)=>{if(!ok)issues.push(code);},c=t.conditions.find(c=>c.id===e.conditionId&&c.kind!=='PRICE');
  need(t.holdThroughEvent==='YES','HOLD_THROUGH_EVENT_NOT_CONFIRMED');
  need(c&&text(c.eventKey)&&Number.isFinite(clock(c.releaseAt))&&text(c.source),'EVENT_IDENTITY_TIME_SOURCE_MISSING');
  need(text(e.calendarSource)&&Number.isFinite(clock(e.calendarVerifiedAt))&&clock(e.calendarVerifiedAt)<=clock(at)&&clock(e.calendarVerifiedAt)<clock(c?.releaseAt),'EVENT_CALENDAR_VERIFICATION_MISSING');
  need(clock(at)<clock(c?.releaseAt),'PRE_EVENT_RECORDED_AFTER_RELEASE');
  need(text(ctx.plan.thesis),'CORE_THESIS_REQUIRED');
  need(['AVAILABLE','UNAVAILABLE'].includes(e.expectationStatus)&&text(e.expectationBasis),'EXPECTATION_BASIS_MISSING');
  need(text(e.differenceBasis),'DIFFERENTIATED_BASIS_UNKNOWN');
  need(text(e.supportingScenario)&&text(e.neutralScenario)&&text(e.reverseScenario)&&text(e.counterexample),'EVENT_SCENARIOS_INCOMPLETE');
  need(c&&(c.kind==='EVENT_NUMERIC'?text(c.threshold)&&text(c.metric)&&text(c.unit)&&text(c.period)&&text(c.releaseVersion):text(c.invalidation)),'FACT_INVALIDATION_MISSING');
  need(positive(ctx.plan.stopPremiumUsd),'INDEPENDENT_STOP_NOT_DEFINED');
  need(positive(ctx.plan.targetNetProfitUsd),'INDEPENDENT_TARGET_NOT_DEFINED');
  need(Number.isFinite(clock(ctx.plan.timeExitAt)),'MAX_EXIT_NOT_DEFINED');
  need(clock(ctx.plan.timeExitAt)>clock(c?.releaseAt),'EVENT_HOLD_EXIT_CONFLICT');
  need(clock(ctx.plan.entryDeadlineAt)<clock(c?.releaseAt),'PRE_EVENT_ENTRY_DEADLINE_INVALID');
  need(e.gapRiskAccepted&&e.closedMarketRiskAccepted,'EVENT_RISK_NOT_CONFIRMED');
  need(text(t.manualFallback)&&text(e.reviewer),'MONITORING_CONTINGENCY_MISSING');
  return [...new Set(issues)];
}

export function assessEventEntry(ctx: EventEntryContext, at:string, calendarAvailable:boolean) {
  const t=ctx.plan.invalidation;if(t)validateTradeThesis(t);
  const e=t?.eventEntry,c=t?.conditions.find(c=>c.id===e?.conditionId)??t?.conditions.find(c=>c.kind!=='PRICE'&&c.eventKey&&c.releaseAt);
  // Legacy exposure can describe research intent, never grant a frozen-plan exemption.
  const researchPre=ctx.kind==='DRAFT'&&t?.holdThroughEvent==='YES'&&c&&t.tradeDate<c.releaseAt.slice(0,10);
  const phase=e?.phase||'',researchApproach=phase||(researchPre?'PRE_EVENT':'');
  const issues:string[]=[],need=(ok:unknown,code:string)=>{if(!ok)issues.push(code);};
  if(researchApproach==='PRE_EVENT'){
    need(phase==='PRE_EVENT','PRE_EVENT_MODE_NOT_CONFIRMED');need(ctx.kind==='FROZEN','PRE_EVENT_PLAN_INCOMPLETE');
    need(ctx.contract,'CONTRACT_NOT_SELECTED');
    need(Number.isInteger(ctx.plan.maxContracts)&&ctx.plan.maxContracts>0,'QUANTITY_NOT_DEFINED');
    need(positive(ctx.plan.maxEntryDebitUsd)&&positive(ctx.plan.plannedRiskUsd),'ENTRY_COST_RISK_NOT_DEFINED');
    if(phase==='PRE_EVENT')issues.push(...preEventConfigurationIssues({...ctx,contract:ctx.contract!},ctx.registeredAt));
    else issues.push('EXPECTATION_BASIS_MISSING','DIFFERENTIATED_BASIS_UNKNOWN','EVENT_RISK_NOT_CONFIRMED');
    if(!positive(ctx.plan.stopPremiumUsd))issues.push('INDEPENDENT_STOP_NOT_DEFINED');
    if(!positive(ctx.plan.targetNetProfitUsd))issues.push('INDEPENDENT_TARGET_NOT_DEFINED');
    if(!Number.isFinite(clock(ctx.plan.timeExitAt)))issues.push('MAX_EXIT_NOT_DEFINED');
    if(!text(t?.manualFallback)||!text(e?.reviewer))issues.push('MONITORING_CONTINGENCY_MISSING');
    if(ctx.contract)issues.push(...thesisPlanIssues({...ctx,contract:ctx.contract},ctx.registeredAt));
    need(ctx.kind!=='FROZEN'||ctx.version===paperFingerprint(ctx.plan),'PLAN_VERSION_MISMATCH');
    need(Number.isFinite(clock(ctx.registeredAt))&&clock(ctx.registeredAt)<=clock(at)&&clock(ctx.registeredAt)<clock(c?.releaseAt)&&(!ctx.openedAt||clock(ctx.registeredAt)<clock(ctx.openedAt)),'PRE_EVENT_NOT_SAVED_BEFORE_ENTRY_AND_RELEASE');
    need(!ctx.openedAt,'PLAN_ALREADY_ENTERED_USE_EXIT_CHECKS');
    const deadline=clock(ctx.plan.entryDeadlineAt),release=clock(c?.releaseAt);
    need(Number.isFinite(deadline),'ENTRY_DEADLINE_NOT_DEFINED');
    if(Number.isFinite(deadline)&&Number.isFinite(release))need(clock(at)<release&&clock(at)<=deadline,'PRE_EVENT_ENTRY_WINDOW_CLOSED');
    const matches=ctx.calendar.filter(x=>x.key===c?.eventKey);
    need(calendarAvailable&&matches.length===1,'EVENT_CALENDAR_UNAVAILABLE');
    const current=matches[0];
    need(current&&current.scheduledAt===c?.releaseAt,'EVENT_TIME_CHANGED_OR_UNKNOWN');
    need(current&&Number.isFinite(clock(current.receivedAt))&&clock(current.receivedAt)<=clock(at),'EVENT_CALENDAR_CLOCK_UNVERIFIED');
  }
  const blockers=[...new Set(issues)],eligible=phase==='PRE_EVENT'&&blockers.length===0;
  const event=ctx.calendar.find(x=>x.key===c?.eventKey)??null;
  return {phase,researchApproach,eligible,blockers,planKey:ctx.key,planVersion:ctx.version,kind:ctx.kind,event,
    explanation:phase==='POST_EVENT'?'MAJOR_EVENT_WAIT — this plan is configured for post-event confirmation.':researchApproach==='PRE_EVENT'?(eligible?'Frozen pre-event plan may continue candidate checks; event risk remains.':'Pre-event research may continue; required saved confirmations and plan completeness do not yet permit formal comparison.'):'MAJOR_EVENT_WAIT — default post-event waiting applies; no explicit pre-event authorization.',
    risks:eligible?EVENT_ENTRY_RISK:['Overnight and release-to-option-trading gaps remain exposed. A stop is not a guaranteed fill.'],
    nextCheckAt:t?.nextCheckAt??null,assessedAt:at,executionAllowed:false};
}
export function eventEntryMatches(event:GuidanceEvent,entry:ReturnType<typeof assessEventEntry>){
  return entry.event!==null&&event.title===entry.event.title&&event.source===entry.event.source&&event.scheduledAt===entry.event.scheduledAt;
}
