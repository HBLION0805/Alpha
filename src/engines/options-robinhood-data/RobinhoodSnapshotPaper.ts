import type { GuidanceQuote, GuidanceSettings } from '../../contracts/OptionsDailyGuidance';
import { validateGuidanceSettings, guidanceLocal } from '../options-daily-guidance/OptionsDailyGuidance';
import { evaluateOptionsPlanningFeasibility } from '../options-retail-feasibility/OptionsTradeBudget';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';
import { reviewClosedOptionTrade } from '../options-trade-review/OptionsTradeReviewEngine';
import { reviewedCostComponents } from '../options-retail-feasibility/OptionsCostDesk';
import { paperSession, PAPER_SESSION_CALENDAR, type PaperChainSession } from './RobinhoodPaperSession';

const fail=(code:string):never=>{throw Error('SNAPSHOT_PAPER_'+code);};
const integer=(v:unknown,min=0,max=100000000):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export const SNAPSHOT_PROFILE='RH_SNAPSHOT_ASSUMPTIONS_V1';
export const PAPER_FEE_PROFILE=Object.freeze({id:'ROBINHOOD_REVIEWED_20260910',reviewedDate:'2026-09-10',source:'https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/',customerClassification:'ASSUMED_NONPROFESSIONAL',executionModel:'ONE_EXECUTION_PER_SIDE',actualFeesConfirmed:false,tradeDateApplicability:'UNVERIFIED'});
export const PAPER_V2_GAPS=Object.freeze([
  'Option refresh timestamps are available; independent side/size event clocks are not. This paper model uses the refresh clock.',
  'The reviewed calendar and saved chain flag model sessions; deliverable, exercise, halts and contract-specific restrictions remain unverified.',
  'Displayed quantities do not prove fills or the path between snapshots. Execution, entitlement and retention qualification remains separate.',
]);
export const SOURCE_GAPS=Object.freeze([
  'Independent option bid, ask and quantity observation clocks are not supplied by the reviewed MCP schema.',
  'Standard deliverable, exercise style and exact exchange session/holiday evidence remain unverified.',
  'MCP-specific execution semantics, entitlement and local retention terms remain unverified.',
  'Displayed quotes and quantities do not establish queue priority, an order fill or the unobserved stop path.',
]);
/** Exact UTC source clock. Date.parse is used only for the whole second. */
export function snapshotNs(value:unknown):bigint {
  if(typeof value!=='string')return fail('CLOCK');
  const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(value);
  if(!m)return fail('CLOCK');
  const ms=Date.parse(m[1]+'Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==m[1]+'.000Z')return fail('CLOCK');
  return BigInt(ms)*1000000n+BigInt((m[2]??'').padEnd(9,'0'));
}
export function snapshotCents(value:unknown):number|null {
  if(typeof value!=='string'||!/^\d{1,8}(?:\.\d{1,12})?$/.test(value))return null;
  const [a,b='']=value.split('.');if(/[1-9]/.test(b.slice(2)))return null;
  return Number(a)*100+Number(b.slice(0,2).padEnd(2,'0'));
}
export interface SnapshotQuote extends GuidanceQuote {
  underlyingPriceCents:number|null; underlyingAt:string|null;
  aboveTickCents:number|null; belowTickCents:number|null; cutoffCents:number|null;
  chainSession?:PaperChainSession;
}
export interface SnapshotFrame {
  path:string; sha256:string; recordedAt:string; capturedAt:string;
  origin:'HOST_MARKET_TOOL_RESPONSES'|'SYNTHETIC_FIXTURE'; quotes:SnapshotQuote[];
}
export interface SnapshotPlan {
  version:'OPTIONS_SNAPSHOT_PAPER_PLAN_V1'|'OPTIONS_SNAPSHOT_PAPER_PLAN_V2'; id:string; createdAt:string;
  contract:SnapshotQuote; selectionPath:string; decisionAt:string; entryDeadlineAt:string; timeExitAt:string;
  quantity:number; entryLimitCents:number; entryFeeCents:number|null; exitFeeCents:number|null;
  exitSlippageCents:number|null; maxSpreadCents:number; settings:GuidanceSettings;
  feeBasis?:'DECLARED_FEES'|'ROBINHOOD_REVIEWED_20260910';
}
const FIELDS=['version','id','createdAt','contract','selectionPath','decisionAt','entryDeadlineAt','timeExitAt','quantity','entryLimitCents','entryFeeCents','exitFeeCents','exitSlippageCents','maxSpreadCents','settings'];
export function validateSnapshotPlan(value:unknown):SnapshotPlan {
  const v2=!!value&&typeof value==='object'&&'version' in value&&value.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2';
  if(!value||typeof value!=='object'||Object.keys(value).sort().join()!==[...FIELDS,...(v2?['feeBasis']:[])].sort().join())fail('PLAN_FIELDS');
  const p=value as SnapshotPlan;
  if(!['OPTIONS_SNAPSHOT_PAPER_PLAN_V1','OPTIONS_SNAPSHOT_PAPER_PLAN_V2'].includes(p.version)||! /^[a-z0-9][a-z0-9-]{2,79}$/.test(p.id)||!p.contract||!['GLD','IBIT'].includes(p.contract.symbol)||!['call','put'].includes(p.contract.type)||typeof p.contract.id!=='string'||!p.selectionPath)fail('PLAN');
  if(v2){
    validateChainSession(p.contract);
    if(!['DECLARED_FEES','ROBINHOOD_REVIEWED_20260910'].includes(p.feeBasis!)||p.feeBasis!=='DECLARED_FEES'&&(p.entryFeeCents!==null||p.exitFeeCents!==null))fail('FEE_BASIS');
  }
  snapshotNs(p.contract.expiry+'T00:00:00Z');
  if(!integer(snapshotCents(p.contract.strike),1))fail('CONTRACT_STRIKE');
  const settings=validateGuidanceSettings(p.settings);
  if(settings.tradeBudget?.version!=='OWNER_ALLOCATION_ONLY_V2')fail('POLICY');
  snapshotNs(p.createdAt);const start=snapshotNs(p.decisionAt),deadline=snapshotNs(p.entryDeadlineAt),end=snapshotNs(p.timeExitAt);
  if(start>=deadline||deadline>=end||end-start>86400000000000n)fail('WINDOW');
  const first=guidanceLocal(new Date(Number(start/1000000n)).toISOString()),last=guidanceLocal(new Date(Number(end/1000000n)).toISOString());
  if(first.date!==last.date||p.contract.expiry<=first.date)fail('SESSION_WINDOW');
  if(v2?(!paperSession(p.decisionAt,p.contract.chainSession).isOpen||!paperSession(p.timeExitAt,p.contract.chainSession).isOpen):(first.minute<570||last.minute>=960||['Sat','Sun'].includes(first.weekday!)))fail('SESSION_WINDOW');
  if(!integer(p.quantity,1,10)||!integer(p.entryLimitCents,1,100000)||!integer(p.maxSpreadCents,1,10000)||[p.entryFeeCents,p.exitFeeCents,p.exitSlippageCents].some(v=>v!==null&&!integer(v,0,10000)))fail('PLAN_MONEY');
  return structuredClone({...p,settings});
}
const identity=(q:SnapshotQuote)=>[q.id,q.symbol,q.expiry,q.type,q.strike,q.multiplier].join('|');
const clockOrNull=(s:string|null)=>{try{return snapshotNs(s);}catch{return null;}};
const priceTick=(q:SnapshotQuote,price:number)=>q.cutoffCents===null?null:price>=q.cutoffCents?q.aboveTickCents:q.belowTickCents;
const aligned=(q:SnapshotQuote,price:number)=>{const tick=priceTick(q,price);return tick!==null&&tick>0&&price%tick===0;};
const floorTick=(q:SnapshotQuote,price:number)=>{const tick=priceTick(q,price);return tick!==null&&tick>0?Math.floor(price/tick)*tick:null;};
function validateChainSession(q:SnapshotQuote) {
  const s=q.chainSession;
  if(!s||Object.keys(s).sort().join()!=='chainId,lateCloseState,receivedAt'||!['enabled','disabled','unknown'].includes(s.lateCloseState)||s.chainId!==null&&(typeof s.chainId!=='string'||!s.chainId))return fail('CHAIN_SESSION');
  if(s.receivedAt!==null&&snapshotNs(s.receivedAt)>snapshotNs(q.receivedAt)||s.lateCloseState!=='unknown'&&(s.chainId===null||s.receivedAt===null))fail('CHAIN_SESSION');
}
export function assessSnapshotQuote(q:SnapshotQuote,asOf:string,v2=false) {
  const receipt=snapshotNs(q.receivedAt),source=clockOrNull(q.updatedAt),underlying=clockOrNull(q.underlyingAt),now=snapshotNs(asOf),blockers:string[]=[];
  if(source===null)blockers.push('SOURCE_CLOCK_MISSING');
  else if(source>receipt)blockers.push('SOURCE_AFTER_RECEIPT');
  else if(receipt-source>60000000000n)blockers.push('STALE_AT_RECEIPT');
  if(receipt>now)blockers.push('FUTURE_RECEIPT');
  if(underlying===null||!integer(q.underlyingPriceCents,1)||underlying>receipt||receipt-underlying>60000000000n)blockers.push('UNDERLYING_UNALIGNED');
  if(!integer(q.bidCents)||!integer(q.askCents,1)||q.bidCents>q.askCents||!aligned(q,q.bidCents)||!aligned(q,q.askCents))blockers.push('PRICE_OR_TICK_INVALID');
  if(!integer(q.bidSize)||!integer(q.askSize))blockers.push('SIZE_UNKNOWN');
  if(q.multiplier!==100)blockers.push('CONTRACT_UNSUPPORTED');
  const local=guidanceLocal(new Date(Number(receipt/1000000n)).toISOString());
  if(v2){
    validateChainSession(q);
    if(!paperSession(q.receivedAt,q.chainSession).isOpen||q.expiry<=local.date)blockers.push('OUTSIDE_MODEL_SESSION');
    if(source!==null&&!paperSession(new Date(Number(source/1000000n)).toISOString(),q.chainSession).isOpen)blockers.push('SOURCE_OUTSIDE_MODEL_SESSION');
    if(underlying!==null&&!paperSession(new Date(Number(underlying/1000000n)).toISOString(),q.chainSession).isOpen)blockers.push('UNDERLYING_OUTSIDE_MODEL_SESSION');
  }else if(['Sat','Sun'].includes(local.weekday!)||local.minute<570||local.minute>=960||q.expiry<=local.date)blockers.push('OUTSIDE_MODEL_SESSION');
  return {blockers,usableSnapshot:blockers.length===0,sourceAt:q.updatedAt,receivedAt:q.receivedAt,underlyingAt:q.underlyingAt,
    sourceAgeAtReceiptNs:source===null?null:(receipt-source).toString(),staleNow:source===null||now-source>60000000000n,...(v2?{session:paperSession(q.receivedAt,q.chainSession)}:{})};
}

/** Target fee reserve converges with net R. Actual exit fees use actual modeled proceeds. */
export function snapshotEntryEconomics(p:SnapshotPlan,q:SnapshotQuote,cash=p.settings.settledCashCents) {
  const reviewed=p.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'&&p.feeBasis==='ROBINHOOD_REVIEWED_20260910';
  const gross=q.askCents!*p.quantity*100;
  const entryFee=reviewed?reviewedCostComponents(p.quantity,gross,'BUY').totalCents:p.entryFeeCents;
  let exitFee=reviewed?reviewedCostComponents(p.quantity,gross,'SELL').totalCents:p.exitFeeCents;
  for(let i=0;i<32;i++){
    const result=evaluateOptionsPlanningFeasibility({symbol:q.symbol,strategy:q.type==='call'?'LONG_CALL':'LONG_PUT',currentEquityCents:p.settings.currentEquityCents,settledCashCents:cash,quantity:p.quantity,contractMultiplier:100,bidPerShareCents:q.bidCents,askPerShareCents:q.askCents,minimumPriceTickCents:priceTick(q,q.askCents!),roundTripFeesCents:entryFee===null||exitFee===null?null:entryFee+exitFee,slippageReserveCents:p.exitSlippageCents===null?null:p.exitSlippageCents*p.quantity*100,mode:'NORMAL',stopLossBps:p.settings.stopLossBps,rewardMultipleMilliR:p.settings.rewardMultipleMilliR,tradeBudget:p.settings.tradeBudget});
    const target=result.economics?.indicativeExitLimitPerShareCents;
    const tick=target==null?null:priceTick(q,target);
    const exitGross=target!=null&&tick!==null&&tick>0?Math.ceil(target/tick)*tick*p.quantity*100:gross;
    const next=reviewed?reviewedCostComponents(p.quantity,Math.max(gross,exitGross),'SELL').totalCents:exitFee;
    if(next===exitFee)return {result,entryFeeCents:entryFee,exitFeeReserveCents:exitFee};
    exitFee=next;
  }
  return fail('COST_CONVERGENCE');
}
type Fill={kind:'ENTRY'|'EXIT';sourcePath:string;sourceSha256:string;sourceAt:string;receivedAt:string;priceCents:number;quantity:number;premiumCents:number;feeCents:number;cashAfterCents:number;reason:string};
export function replaySnapshotPaper(plan:SnapshotPlan,frames:SnapshotFrame[],asOf:string) {
  const p=validateSnapshotPlan(plan),now=snapshotNs(asOf),decision=snapshotNs(p.decisionAt),deadline=snapshotNs(p.entryDeadlineAt),exitTime=snapshotNs(p.timeExitAt);
  const v2=p.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2',reviewed=v2&&p.feeBasis==='ROBINHOOD_REVIEWED_20260910';
  if(snapshotNs(p.createdAt)>now||!Array.isArray(frames)||frames.length>1000)fail('ASSESSMENT');
  const selection=frames.find(f=>f.path===p.selectionPath);
  if(!selection||snapshotNs(selection.recordedAt)>snapshotNs(p.createdAt)||!selection.quotes.some(q=>paperFingerprint(q)===paperFingerprint(p.contract)))fail('SELECTION_LINKAGE');
  const origin=selection!.origin;
  if(new Set(frames.map(f=>f.path)).size!==frames.length)fail('DUPLICATE_FRAME');
  const observations=frames.flatMap(f=>{
    const recorded=snapshotNs(f.recordedAt),captured=snapshotNs(f.capturedAt);
    if(recorded<captured||! /^[a-f0-9]{64}$/.test(f.sha256)||f.origin!==origin)fail('FRAME');
    if(recorded>now)return [];
    if(f.quotes.filter(q=>q.id===p.contract.id).length>1)fail('DUPLICATE_CONTRACT');
    return f.quotes.filter(q=>q.id===p.contract.id).map(q=>{
      if(snapshotNs(q.receivedAt)>captured)fail('FRAME_CLOCK');
      if(new Date(q.receivedAt).toISOString()!==q.receivedAt)fail('RECEIPT_PRECISION_UNSUPPORTED');return {f,q};
    });
  }).sort((a,b)=>{const x=snapshotNs(a.q.receivedAt),y=snapshotNs(b.q.receivedAt);return x<y?-1:x>y?1:a.f.path.localeCompare(b.f.path);});
  const receiptBooks=new Map<string,Set<string>>();
  for(const {q} of observations){
    const books=receiptBooks.get(q.receivedAt)??new Set<string>();
    books.add(paperFingerprint({identity:identity(q),sourceAt:q.updatedAt,bid:q.bidCents,ask:q.askCents,bidSize:q.bidSize,askSize:q.askSize}));receiptBooks.set(q.receivedAt,books);
  }
  const diagnostics:{sourcePath:string;sourceAt:string|null;receivedAt:string;codes:string[]}[]=[],fills:Fill[]=[];
  let cash=p.settings.settledCashCents,plannedRisk:number|null=null,entrySpread=0,target:number|null=null,stop:number|null=null,sourceHigh:bigint|null=null,sourcePayload='',lastSeen:bigint|null=null,gap=false,exitDelayed=false,pendingReason:string|null=null;
  const costKnown=(reviewed||p.entryFeeCents!==null&&p.exitFeeCents!==null)&&p.exitSlippageCents!==null;
  for(const {f,q} of observations){
    const received=snapshotNs(q.receivedAt),source=clockOrNull(q.updatedAt);
    if(received<=decision)continue;
    if(fills.length===2)break;
    const codes=[...assessSnapshotQuote(q,asOf,v2).blockers];
    if(receiptBooks.get(q.receivedAt)!.size>1)codes.push('AMBIGUOUS_RECEIPT');
    if(identity(q)!==identity(p.contract))codes.push('CONTRACT_IDENTITY_CHANGED');
    const payload=paperFingerprint({bid:q.bidCents,ask:q.askCents,bidSize:q.bidSize,askSize:q.askSize});
    if(source!==null){
      if(sourceHigh!==null&&source<sourceHigh)codes.push('SOURCE_CLOCK_REGRESSION');
      else if(source===sourceHigh)codes.push(payload===sourcePayload?'REPEATED_SOURCE_UPDATE':'CONFLICTING_SOURCE_UPDATE');
      else {sourceHigh=source;sourcePayload=payload;}
      if(source<=decision)codes.push('SOURCE_PRECEDES_DECISION');
    }
    if(lastSeen!==null&&received-lastSeen>60000000000n&&fills.length===1)gap=true;
    lastSeen=received;
    if(!costKnown)codes.push('COSTS_UNKNOWN');
    if(codes.length){diagnostics.push({sourcePath:f.path,sourceAt:q.updatedAt,receivedAt:q.receivedAt,codes});if(fills.length===1){gap=true;if(received>=exitTime&&(!v2||pendingReason===null))pendingReason='TIME_EXIT';}continue;}
    const bid=q.bidCents!,ask=q.askCents!,units=p.quantity*100;
    if(!fills.length){
      if(received>deadline)codes.push('ENTRY_WINDOW_MISSED');
      if(ask>p.entryLimitCents)codes.push('ENTRY_LIMIT_NOT_MET');
      if(ask-bid>p.maxSpreadCents)codes.push('ENTRY_SPREAD_EXCEEDED');
      if(q.askSize!<p.quantity||q.bidSize!<p.quantity)codes.push('ENTRY_SIZE_INSUFFICIENT');
      if(bid===0)codes.push('ENTRY_EXIT_BID_UNAVAILABLE');
      if(!aligned(q,p.entryLimitCents))codes.push('ENTRY_LIMIT_TICK_INVALID');
      const {result,entryFeeCents}=snapshotEntryEconomics(p,q,cash);
      codes.push(...result.blockers.map(b=>b.code));
      const indicative=result.economics?.indicativeExitLimitPerShareCents;
      if(indicative!=null){const tick=priceTick(q,indicative);if(tick===null||tick<=0)codes.push('TARGET_TICK_UNKNOWN');else if(Math.ceil(indicative/tick)*tick*100>ask*180)codes.push('TARGET_PREMIUM_CEILING');}
      if(!codes.length){
        plannedRisk=result.economics!.plannedStopCents;target=result.economics!.roundedNetProfitTargetCents;
        stop=Math.floor(ask*(10000-p.settings.stopLossBps)/10000);entrySpread=(ask-bid)*units;
        cash-=ask*units+entryFeeCents!;
        fills.push({kind:'ENTRY',sourcePath:f.path,sourceSha256:f.sha256,sourceAt:q.updatedAt!,receivedAt:q.receivedAt,priceCents:ask,quantity:p.quantity,premiumCents:ask*units,feeCents:entryFeeCents!,cashAfterCents:cash,reason:'LATER_ASK_ASSUMED'});
      }
    } else {
      if(source!<=snapshotNs(fills[0]!.sourceAt)||received<=snapshotNs(fills[0]!.receivedAt))codes.push('EXIT_NOT_LATER');
      const price=floorTick(q,Math.max(0,bid-p.exitSlippageCents!))??0;
      if(price===0)codes.push('EXIT_PRICE_UNAVAILABLE');
      const exitFeeCents=reviewed&&price>0?reviewedCostComponents(p.quantity,price*units,'SELL').totalCents:p.exitFeeCents!;
      const net=price*units-fills[0]!.premiumCents-fills[0]!.feeCents-exitFeeCents;
      // Latch a stop or time exit while liquidity is missing; a rebound cannot erase it.
      if(pendingReason===null){if(bid<=stop!)pendingReason='STOP';else if(received>=exitTime)pendingReason='TIME_EXIT';}
      const reason=pendingReason??(net>=target!?'TARGET':null);
      if(reason&&q.bidSize!<p.quantity){codes.push('EXIT_SIZE_INSUFFICIENT');exitDelayed=true;}
      if(reason&&!codes.length){cash+=price*units-exitFeeCents;fills.push({kind:'EXIT',sourcePath:f.path,sourceSha256:f.sha256,sourceAt:q.updatedAt!,receivedAt:q.receivedAt,priceCents:price,quantity:p.quantity,premiumCents:price*units,feeCents:exitFeeCents,cashAfterCents:cash,reason});}
    }
    diagnostics.push({sourcePath:f.path,sourceAt:q.updatedAt,receivedAt:q.receivedAt,codes});
  }
  if(fills.length===1&&lastSeen!==null&&now-lastSeen>60000000000n)gap=true;
  const status=fills.length===2?'CLOSED_MODELED':fills.length===1?'OPEN_UNRESOLVED':'NO_ENTRY';
  const netPnl=fills.length===2?cash-p.settings.settledCashCents:null;
  const review=fills.length===2?reviewClosedOptionTrade({tradeId:p.id,symbol:p.contract.symbol,strategyVersion:v2?'RH_SNAPSHOT_ASSUMPTIONS_V2':SNAPSHOT_PROFILE,setupKey:'snapshot-assumption-only',origin:origin==='SYNTHETIC_FIXTURE'?origin:'UNVERIFIED_IMPORT',planFingerprint:paperFingerprint(p),entryAt:new Date(fills[0]!.receivedAt).toISOString(),exitAt:new Date(fills[1]!.receivedAt).toISOString(),exitReason:fills[1]!.reason,entryPremiumCents:fills[0]!.premiumCents,exitProceedsCents:fills[1]!.premiumCents,feesCents:fills[0]!.feeCents+fills[1]!.feeCents,netPnlCents:netPnl,plannedRiskCents:plannedRisk,entrySpreadCents:entrySpread,exitLiquidityDelayed:exitDelayed,quoteGapObserved:gap,planViolations:[]}):null;
  const paperStage=status!=='NO_ENTRY'?status:!costKnown?'WAITING_FOR_COST_ASSUMPTIONS':now<=decision?'AWAITING_WINDOW':now<=deadline?'AWAITING_ELIGIBLE_QUOTE':'ENTRY_WINDOW_ENDED';
  const candidateLessons=[{code:'SOURCE_UNQUALIFIED',text:'Keep this snapshot model separate from qualified execution evidence.',approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'},...(!costKnown?[{code:'COSTS_UNKNOWN',text:'Declare entry fees, exit fees and slippage before a modeled entry; zero is an explicit assumption.',approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'}]:[]),...(status!=='CLOSED_MODELED'&&(!v2||status!=='NO_ENTRY'||paperStage==='ENTRY_WINDOW_ENDED')?[{code:status,text:status==='NO_ENTRY'?'No admissible later entry snapshot was observed. Do not manufacture a trade.':'The position remains unresolved. Do not substitute a last price or an assumed stop fill.',approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'}]:[]),...(gap?[{code:'QUOTE_GAP_OBSERVED',text:'The missing path may contain an earlier stop, target or worse exit. Review it before interpreting this result.',approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'}]:[])];
  return {version:v2?'OPTIONS_SNAPSHOT_PAPER_REPORT_V2':'OPTIONS_SNAPSHOT_PAPER_REPORT_V1',profile:v2?'RH_SNAPSHOT_ASSUMPTIONS_V2':SNAPSHOT_PROFILE,assessedAt:asOf,plan:p,origin,timing:snapshotNs(p.decisionAt)<snapshotNs(p.createdAt)?'RETROSPECTIVE_DECLARATION':'PROSPECTIVE_DECLARATION',status,
    sourceQualification:'NOT_QUALIFIED',sourceGaps:[...(v2?PAPER_V2_GAPS:SOURCE_GAPS)],gates:{quotes:'OPEN',adapter:'LOCAL_IMPLEMENTED_UNQUALIFIED',completeRealPriceLifecycle:'OPEN'},
    ...(v2?{paperStage,paperModelImplemented:true,executionQualification:'NOT_ESTABLISHED',marketSession:paperSession(p.decisionAt,p.contract.chainSession),calendar:PAPER_SESSION_CALENDAR,feeAssumption:reviewed?PAPER_FEE_PROFILE:{id:'DECLARED_FEES',actualFeesConfirmed:false},exitSlippageCents:p.exitSlippageCents}:{}),
    fills,diagnostics,account:{declaredInitialCashCents:p.settings.settledCashCents,cashLedgerCents:cash,saleProceedsUnsettledCents:fills[1]?fills[1].premiumCents-fills[1].feeCents:0,netPnlCents:netPnl,openPremiumExposureCents:fills.length===1?fills[0]!.premiumCents:0,plannedRiskCents:plannedRisk},review,candidateLessons,quoteGapObserved:gap,executionAllowed:false,actualTrades:0};
}
