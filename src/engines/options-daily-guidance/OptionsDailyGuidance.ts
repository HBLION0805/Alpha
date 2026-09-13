import type { GuidanceInput, GuidanceQuote, GuidanceSettings, GuidanceSymbol, GuidanceScenario } from "../../contracts/OptionsDailyGuidance";
import { legacyRiskCapsRemoved, evaluateOptionsPlanningFeasibility, validateTradeBudget } from "../options-retail-feasibility/OptionsTradeBudget";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";
import { guidanceLocal } from "./OptionsGuidanceClock";
import { paperSession, PAPER_SESSION_CALENDAR } from "../options-robinhood-data/RobinhoodPaperSession";
import { isGuidanceMajorEvent } from "./OptionsGuidanceSchedule";
export { guidanceLocal } from "./OptionsGuidanceClock";

const DAY = 86400000;
const fail = (code: string): never => { throw Error("GUIDANCE_" + code); };
const positive = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const date = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && new Date(v + "T00:00:00Z").toISOString().slice(0,10) === v;
const numeric = (v: string | null) => v !== null && /^\d{1,8}(?:\.\d{1,6})?$/.test(v) && Number(v) > 0 ? Number(v) : null;
const age = (at: string, source: string | null) => source === null ? Infinity : Date.parse(at) - Date.parse(source);
export function validateGuidanceSettings(value: GuidanceSettings): GuidanceSettings {
  if (!value || Object.keys(value).sort().join() !== ["currentEquityCents","settledCashCents","roundTripFeesCents","slippageReserveCents","stopLossBps","rewardMultipleMilliR",...(Object.hasOwn(value,"tradeBudget")?["tradeBudget"]:[])].sort().join()) fail("SETTINGS_FIELDS");
  for (const k of ["currentEquityCents","settledCashCents","roundTripFeesCents","slippageReserveCents"] as const) {
    const v=value[k]; if ((k==="roundTripFeesCents" || k==="slippageReserveCents") && v===null) continue;
    if (typeof v!=="number" || !Number.isSafeInteger(v) || v<0 || v>100000000) fail("SETTINGS_MONEY");
  }
  if (!positive(value.currentEquityCents) || !Number.isInteger(value.stopLossBps) || value.stopLossBps<1000 || value.stopLossBps>2500 || ![1500,2000].includes(value.rewardMultipleMilliR)) fail("SETTINGS_POLICY");
  return {...value,...(Object.hasOwn(value,"tradeBudget")?{tradeBudget:validateTradeBudget(value.tradeBudget)}:{})};
}
export const defaultGuidanceSettings = (): GuidanceSettings => ({currentEquityCents:100000,settledCashCents:100000,roundTripFeesCents:null,slippageReserveCents:null,stopLossBps:2000,rewardMultipleMilliR:2000});

function trend(input: GuidanceInput, symbol: GuidanceSymbol) {
  const today=guidanceLocal(input.at).date, seen=new Map<string,string>(), conflicts=new Set<string>();
  for (const c of input.closeHistory.filter(c=>c.symbol===symbol)) {
    if (!date(c.date) || numeric(c.price)===null || c.date>=today || [0,6].includes(new Date(c.date+"T12:00:00Z").getUTCDay())) continue;
    if(input.version==="OPTIONS_DAILY_GUIDANCE_INPUT_V2") {const session=paperSession(c.date+"T16:00:00.000Z",undefined);if(!session.knownYear||session.holiday)continue;}
    if (seen.has(c.date) && Number(seen.get(c.date))!==Number(c.price)) conflicts.add(c.date);
    seen.set(c.date,c.price);
  }
  const closes=[...seen].sort(([a],[b])=>a.localeCompare(b)).slice(-5).map(([date,price])=>({date,price}));
  const recent=closes.length===5 && Date.parse(today)-Date.parse(closes[0]!.date)<=12*DAY && Date.parse(today)-Date.parse(closes[4]!.date)<=4*DAY;
  if (!recent || closes.some(c=>conflicts.has(c.date))) return {direction:"INSUFFICIENT_HISTORY",closes,fastMean:null,slowMean:null,reason:"Need five recent distinct official session closes without conflicting prices.",calibrated:false};
  const values=closes.map(c=>{const [a,b=""]=c.price.split(".");return BigInt(a!)*1000000n+BigInt(b.padEnd(6,"0"));});
  const slowSum=values.reduce((n,v)=>n+v,0n),fastSum=values.slice(-3).reduce((n,v)=>n+v,0n),last=values[4]!;
  const up=fastSum*5000n>slowSum*3009n&&last*3n>fastSum,down=fastSum*5000n<slowSum*2991n&&last*3n<fastSum;
  return {direction:up?"UP":down?"DOWN":"RANGE",closes,fastMean:Number(fastSum)/3000000,slowMean:Number(slowSum)/5000000,reason:"Descriptive 3-versus-5-session comparison with 0.3% separation; month-scale trend and predictive edge are unverified.",calibrated:false};
}
export function assessDailyGuidance(input: GuidanceInput) {
  if (!input || !["OPTIONS_DAILY_GUIDANCE_INPUT_V1","OPTIONS_DAILY_GUIDANCE_INPUT_V2"].includes(input.version) || !Array.isArray(input.quotes) || input.quotes.length>36 || !Array.isArray(input.equities) || input.equities.length>2 || !Array.isArray(input.closeHistory) || input.closeHistory.length>600 || !Array.isArray(input.events) || input.events.length>100 || !Array.isArray(input.sourceHealth) || input.sourceHealth.length>10 || !Array.isArray(input.headlines) || input.headlines.length>20) fail("INPUT_SHAPE");
  const local=guidanceLocal(input.at),settings=validateGuidanceSettings(input.settings);
  if (input.captureAt!==null) {readinessClock(input.captureAt); if(age(input.at,input.captureAt)<0) fail("FUTURE_CAPTURE");}
  if (new Set(input.quotes.map(q=>q.id)).size!==input.quotes.length) fail("DUPLICATE_CONTRACT");
  if (new Set(input.equities.map(q=>q.symbol)).size!==input.equities.length) fail("DUPLICATE_EQUITY");
  for(const q of input.quotes) {
    if (!["GLD","IBIT"].includes(q.symbol) || !["call","put"].includes(q.type) || !/^[a-f0-9-]{36}$/.test(q.id) || !date(q.expiry) || numeric(q.strike)===null) fail("CONTRACT");
    readinessClock(q.receivedAt); if(age(input.at,q.receivedAt)<0) fail("FUTURE_RECEIPT");
  }
  const applicabilityV2=input.version==="OPTIONS_DAILY_GUIDANCE_INPUT_V2",marketSession=applicabilityV2?paperSession(input.at,undefined):null;
  const sessionWindow=marketSession?marketSession.isOpen:!["Sat","Sun"].includes(local.weekday??"") && local.minute>=570 && local.minute<960;
  const upcoming=input.events.map(e=>{
    if(!date(e.startDate)||!date(e.endDate)||e.endDate<e.startDate) fail("EVENT");
    if(e.scheduledAt!==null)readinessClock(e.scheduledAt);
    const major=isGuidanceMajorEvent(e);
    const dt=e.scheduledAt===null?null:Date.parse(e.scheduledAt)-Date.parse(input.at);
    const priorDay=new Date(Date.parse(e.startDate)-DAY).toISOString().slice(0,10);
    const gated=major && (dt===null ? local.date>=priorDay && local.date<=e.endDate : dt<=DAY && dt>=-30*60000);
    return {...e,major,gated,posture:gated?(dt!==null&&dt<0?"WAIT_FOR_POST_RELEASE_STABILIZATION":"WAIT_THROUGH_EVENT"):"MONITOR"};
  });
  const sourceBlockers:string[]=[];
  if(!input.captureAt)sourceBlockers.push("MARKET_CAPTURE_MISSING");
  if(!input.captureComplete)sourceBlockers.push("MARKET_CAPTURE_PARTIAL");
  if(!input.calendarAvailable)sourceBlockers.push("CALENDAR_COVERAGE_UNAVAILABLE");
  if(!input.headlinesAvailable)sourceBlockers.push("HEADLINE_REFRESH_UNAVAILABLE");
  if(input.captureOrigin!=="HOST_MARKET_TOOL_RESPONSES")sourceBlockers.push("UNVERIFIED_OR_SYNTHETIC_CAPTURE");
  if(!sessionWindow)sourceBlockers.push("OUTSIDE_REGULAR_SESSION");
  if(marketSession&&!marketSession.knownYear)sourceBlockers.push("SESSION_CALENDAR_YEAR_UNREVIEWED");
  if(upcoming.some(e=>e.gated))sourceBlockers.push("MAJOR_EVENT_WAIT");
  const assets=(["GLD","IBIT"] as const).map(symbol=>{
    const direction=trend(input,symbol),equity=input.equities.find(e=>e.symbol===symbol);
    const assetBlockers=[...sourceBlockers];
    if(!["UP","DOWN"].includes(direction.direction))assetBlockers.push("DIRECTION_NOT_CONFIRMED");
    if(applicabilityV2||Object.hasOwn(input,"analyst")) {
      const note=input.analyst,a=note?.assets.find(a=>a.symbol===symbol);
      if(applicabilityV2&&note&&input.captureAt&&Date.parse(note.assessedAt)<Date.parse(input.captureAt))assetBlockers.push("MARKET_EVIDENCE_NEWER_THAN_ANALYSIS");
      if(!note||!a||!a.sources.length||age(input.at,note.assessedAt)<0||age(input.at,note.assessedAt)>24*3600000)assetBlockers.push("ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD");
      else if(!["BULLISH","BEARISH"].includes(a.bias)||a.bias==="BULLISH"&&direction.direction!=="UP"||a.bias==="BEARISH"&&direction.direction!=="DOWN")assetBlockers.push("NEWS_AND_TREND_NOT_ALIGNED");
    }
    if(!equity||numeric(equity.price)===null||age(input.at,equity.sourceAt)<0||age(input.at,equity.sourceAt)>120000)assetBlockers.push("UNDERLYING_PRICE_NOT_FRESH");
    const candidates=input.quotes.filter(q=>q.symbol===symbol).map(q=>{
      const blockers=[...assetBlockers],dte=(Date.parse(q.expiry)-Date.parse(local.date))/DAY;
      const quoteAge=age(input.at,q.updatedAt);
      if(!Number.isFinite(quoteAge)||quoteAge<0||quoteAge>120000||!q.updatedAt||exchangeLocalDate(q.updatedAt,"America/New_York")!==local.date)blockers.push("OPTION_QUOTE_NOT_FRESH");
      if(q.multiplier!==100||dte<14||dte>45)blockers.push("CONTRACT_OUTSIDE_POLICY");
      if(!positive(q.bidSize)||!positive(q.askSize))blockers.push("QUOTE_SIZE_UNKNOWN_OR_ZERO");
      if(q.delta===null||!Number.isFinite(q.delta)||Math.abs(q.delta)<0.35||Math.abs(q.delta)>0.70||q.type==="call"&&q.delta<0||q.type==="put"&&q.delta>0)blockers.push("DELTA_OUTSIDE_RESEARCH_RANGE");
      if(q.bidCents===null||q.askCents===null||!positive(q.bidCents)||!positive(q.askCents)||q.bidCents>q.askCents||(q.askCents-q.bidCents)*10>q.askCents)blockers.push("SPREAD_OR_PRICE_UNSUITABLE");
      if(q.updatedAt&&equity?.sourceAt&&Math.abs(Date.parse(q.updatedAt)-Date.parse(equity.sourceAt))>120000)blockers.push("UNDERLYING_OPTION_CLOCK_MISMATCH");
      if(direction.direction==="UP"&&q.type!=="call"||direction.direction==="DOWN"&&q.type!=="put")blockers.push("OPPOSES_OBSERVED_TREND");
      const scenario: GuidanceScenario={...settings,symbol,strategy:q.type==="call"?"LONG_CALL":"LONG_PUT",quantity:1,contractMultiplier:100,bidPerShareCents:q.bidCents??-1,askPerShareCents:q.askCents??-1,minimumPriceTickCents:q.tickCents??-1,mode:"NORMAL"};
      const feasibility=evaluateOptionsPlanningFeasibility(scenario);
      blockers.push(...feasibility.blockers.map(b=>b.code));
      const ask=q.askCents,tick=q.tickCents;
      const stopTrigger=ask!==null&&tick!==null&&positive(tick)&&positive(ask)?Math.ceil(ask*(10000-settings.stopLossBps)/(10000*tick))*tick:null;
      return {contract:q,dte,quoteAgeSeconds:Number.isFinite(quoteAge)?Math.round(quoteAge/1000):null,disposition:blockers.length?"NO_TRADE":"CONDITIONAL_RESEARCH",blockers:[...new Set(blockers)],scenario,feasibility,
        plan:{entryLimitCents:ask,stopTriggerCents:stopTrigger,targetExitCents:feasibility.economics?.indicativeExitLimitPerShareCents??null,netRiskCents:feasibility.economics?.plannedStopCents??null,netTargetCents:feasibility.economics?.roundedNetProfitTargetCents??null,
          invalidation:"Reassess if the observed direction reverses, an event window starts, quotes become stale, or risk/cost assumptions change. Exit planning needs fresh bids; no stop fill is guaranteed.",
          timeExit:"Review each session; do not carry this research plan into expiry. A time exit must be declared before any manual trade.",automaticOrder:false}};
    });
    // Feasibility then lower declared cash exposure; this is not a profitability ranking.
    candidates.sort((a,b)=>Number(a.disposition==="NO_TRADE")-Number(b.disposition==="NO_TRADE")||(a.contract.askCents??Infinity)-(b.contract.askCents??Infinity)||a.contract.expiry.localeCompare(b.contract.expiry)||a.contract.id.localeCompare(b.contract.id));
    return {symbol,equity:equity??null,trend:direction,disposition:candidates.some(c=>c.disposition==="CONDITIONAL_RESEARCH")?"CONDITIONAL_RESEARCH":"WATCH",blockers:[...new Set(assetBlockers)],candidates};
  });
  return {...(marketSession?{marketSession,sessionPolicy:PAPER_SESSION_CALENDAR,analysisSequencing:"REVIEW_AT_OR_AFTER_LATEST_CAPTURE"}:{}),version:applicabilityV2?"OPTIONS_DAILY_GUIDANCE_V4":legacyRiskCapsRemoved(settings.tradeBudget)?"OPTIONS_DAILY_GUIDANCE_V3":settings.tradeBudget?"OPTIONS_DAILY_GUIDANCE_V2":"OPTIONS_DAILY_GUIDANCE_V1",assessedAt:input.at,marketCapturedAt:input.captureAt,assets,events:upcoming,sourceHealth:input.sourceHealth,headlines:input.headlines,context:input.context,settings,
    policy:legacyRiskCapsRemoved(settings.tradeBudget)?`Owner allocation policy V2: $${(settings.tradeBudget!.minCents/100).toFixed(2)}–$${(settings.tradeBudget!.maxCents/100).toFixed(2)} per trade including declared fees; total equity $${(settings.currentEquityCents/100).toFixed(2)}. Legacy planned-loss and full-premium caps are not enforced. Planned loss and full-premium exposure remain visible; stops are not guaranteed fills. Dated analyst notes and historical reports retain their original policies.`:settings.tradeBudget?`Owner-declared per-trade capital range $${(settings.tradeBudget.minCents/100).toFixed(2)}–$${(settings.tradeBudget.maxCents/100).toFixed(2)}, including the declared fee reserve. The independent 0.5% planned-loss and $25 full-premium stress caps remain. Cost declarations are scenarios, not verified brokerage fees.`:"Illustrative 20% premium-stop default, existing net 1.5R–2R economics and unchanged $50 allocation/$25 full-premium stress caps at $1,000. Cost declarations are scenarios, not verified brokerage fees.",
    coverage:"Six headline feeds and separate Treasury/BTC/calendar sources are not all 94 catalog indicators. A successful refresh does not mean new headlines. Scheduled snapshots are not continuous quotes.",
    ...(Object.hasOwn(input,"analyst")?{analyst:input.analyst??null}:{}),winProbability:null,executionAllowed:false,accountAccessed:false,rankingIsProfitForecast:false};
}
