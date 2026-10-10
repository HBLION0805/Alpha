import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {guidanceLocal} from '../../src/engines/options-daily-guidance/OptionsGuidanceClock.ts';

export const ENGINEERING_TIMING_VERSION='REAL_DATA_PAPER_EXIT_RESERVE_V1';
// A finite planning allowance per serial attempt, not an execution-time guarantee.
export const CAPTURE_EXECUTION_ALLOWANCE_MS=60000;
const stamp=v=>{const n=Date.parse(v);if(typeof v!=='string'||!Number.isFinite(n))throw Error('REAL_DATA_PAPER_BRIDGE_CLOCK');return n;};
const iso=n=>new Date(n).toISOString();
export function engineeringObservationPolicy(preparedAt,chain){
  const t0=stamp(preparedAt),session=paperSession(preparedAt,chain),local=guidanceLocal(preparedAt);
  const sessionClose= Math.floor(t0/60000)*60000+(session.closeMinute-local.minute)*60000;
  const targetsAt=[45,105,210,470].map(s=>iso(t0+s*1000));
  let complete=t0;
  for(const target of targetsAt)complete=Math.max(complete,stamp(target))+CAPTURE_EXECUTION_ALLOWANCE_MS;
  return {version:ENGINEERING_TIMING_VERSION,preparedAt,targetsAt,finalExitSampleAt:targetsAt.at(-1),
    executionAllowanceMs:CAPTURE_EXECUTION_ALLOWANCE_MS,projectedCompletionAt:iso(complete),
    sessionCloseAt:iso(sessionClose),lateCloseApplied:session.lateCloseApplied,
    sufficient:session.isOpen&&complete<sessionClose,executionTimeGuaranteed:false};
}
export function engineeringEntryTimeGate(plan,at){
  // New identities only; historical plans and reports retain their original semantics.
  if(!plan.id.startsWith('eng-paper-v2-'))return {allowed:true,blockers:[]};
  const now=stamp(at),policy=engineeringObservationPolicy(plan.createdAt,plan.contract.chainSession);
  const completion=Math.max(stamp(policy.finalExitSampleAt),now)+policy.executionAllowanceMs;
  const blockers=[];
  if(now<stamp(plan.createdAt))blockers.push('ENTRY_CLOCK_PRECEDES_PREPARATION');
  if(now>stamp(plan.entryDeadlineAt))blockers.push('ENTRY_PROCESSING_WINDOW_MISSED');
  if(!policy.sufficient||completion>=stamp(policy.sessionCloseAt))blockers.push('INSUFFICIENT_EXIT_SAMPLING_TIME');
  return {allowed:blockers.length===0,blockers,observationPolicy:policy,assessedAt:at};
}
