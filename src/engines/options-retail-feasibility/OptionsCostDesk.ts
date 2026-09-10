import { legacyRiskCapsRemoved, evaluateOptionsPlanningFeasibility as evaluate } from "./OptionsTradeBudget";

export type CostFeeBasis = "DECLARED_FEES" | "REVIEWED_SCHEDULE_ASSUMPTION";
const PROFILE = Object.freeze({
  id: "ROBINHOOD_ETF_OPTION_COST_ASSUMPTION_20260909_V1",
  reviewedAt: "2026-09-09T02:25:50.000Z", feeScheduleVersion: "20260831-5886092-18771991",
  tradeDateApplicability: "UNVERIFIED", customerClassification: "ASSUMED_NONPROFESSIONAL",
  executionModel: "ONE_BUY_EXECUTION_AND_ONE_SELL_EXECUTION",
  sources: Object.freeze([
    "https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf",
    "https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/",
  ]),
});
function freeze<T>(v:T):T {
  if(v && typeof v === "object") {for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;
}
function cents(v:bigint):number {
  if(v<0n || v>BigInt(Number.MAX_SAFE_INTEGER))throw Error("WORKBENCH_COST_OVERFLOW");return Number(v);
}
function nearest(n:bigint,d:bigint):bigint {return n<d?0n:(n+d/2n)/d;}
/** Hypothetical execution under the reviewed snapshot; no trade-date or account claim. */
export function reviewedCostComponents(quantity:number,grossPremiumCents:number,side:"BUY"|"SELL") {
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100||!Number.isSafeInteger(grossPremiumCents)||grossPremiumCents<1||grossPremiumCents>1000000000||!["BUY","SELL"].includes(side))throw Error("WORKBENCH_COST_BOUNDS");
  const q=BigInt(quantity),gross=BigInt(grossPremiumCents),sell=side==="SELL";
  const orfOcc=4n*q,sec=sell?(206n*gross+9999999n)/10000000n:0n;
  // Quantity <= 100 keeps the TAF far below the published per-execution cap.
  const taf=sell?nearest(329n*q,1000n):0n,cat=nearest(3n*q,100n);
  return freeze({commissionCents:0,optionsRegulatoryAndOccCents:cents(orfOcc),secCents:cents(sec),
    tradingActivityCents:cents(taf),consolidatedAuditTrailCents:cents(cat),totalCents:cents(orfOcc+sec+taf+cat)});
}

/** Independent sensitivity projection; the original calculator and settings are untouched. */
export function assessOptionsCostDesk(input:unknown) {
  if(!input||typeof input!=="object"||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error("WORKBENCH_COST_INPUT");
  const d=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(input).some(k=>typeof k!=="string"||!d[k]?.enumerable||!("value" in d[k]!))||Object.keys(input).sort().join()!=="feeBasis,scenario")throw Error("WORKBENCH_COST_INPUT");
  const {scenario:raw,feeBasis}=input as {scenario:unknown;feeBasis:CostFeeBasis};
  if(!["DECLARED_FEES","REVIEWED_SCHEDULE_ASSUMPTION"].includes(feeBasis))throw Error("WORKBENCH_COST_INPUT");
  const original=evaluate(raw);
  if(!original.scenario||!original.economics)throw Error("WORKBENCH_COST_SCENARIO");
  const s=original.scenario,e=original.economics,removed=legacyRiskCapsRemoved("tradeBudget" in s?s.tradeBudget:undefined);
  if(s.quantity>100||e.premiumCents>100000000||s.slippageReserveCents!==null&&s.slippageReserveCents>100000000||s.roundTripFeesCents!==null&&s.roundTripFeesCents>100000000)throw Error("WORKBENCH_COST_BOUNDS");
  const rows=[0,1,2,5].map(ticks=>{
    const allowance=cents(BigInt(e.oneTickLossCents)*BigInt(ticks));
    let fees=s.roundTripFeesCents;
    const entry=feeBasis==="REVIEWED_SCHEDULE_ASSUMPTION"?reviewedCostComponents(s.quantity,e.premiumCents,"BUY"):null;
    if(entry)fees=entry.totalCents+reviewedCostComponents(s.quantity,e.premiumCents,"SELL").totalCents;
    for(let iteration=1;iteration<=32;iteration++) {
      const result=evaluate({...s,roundTripFeesCents:fees,slippageReserveCents:allowance});
      if(!result.economics)throw Error("WORKBENCH_COST_OVERFLOW");
      const target=result.economics.indicativeExitLimitPerShareCents;
      const exitGross=entry&&target!==null?cents(BigInt(target)*BigInt(s.quantity)*100n):null;
      const exit=exitGross!==null?reviewedCostComponents(s.quantity,Math.max(e.premiumCents,exitGross),"SELL"):null;
      const next=entry&&exit?entry.totalCents+exit.totalCents:fees;
      if(next!==fees){fees=next;continue;}
      const loss=result.economics.plannedStopCents;
      return {ticks,exitAllowanceCents:allowance,roundTripFeeReserveCents:fees,
        plannedRiskHeadroomCents:loss===null||result.economics.plannedRiskBudgetCents===null?null:result.economics.plannedRiskBudgetCents-loss,
        feeEvidence:entry?{entry,exit,exitGrossPremiumBasisCents:exitGross,iterations:iteration}:null,result};
    }
    throw Error("WORKBENCH_COST_CONVERGENCE");
  });
  return freeze({version:removed?"OPTIONS_COST_DESK_V2":"OPTIONS_COST_DESK_V1",feeBasis,profile:feeBasis==="REVIEWED_SCHEDULE_ASSUMPTION"?PROFILE:null,
    original,rows,executionAllowed:false,brokerFeesConfirmed:false,sourceQualified:false,
    winProbability:null,settingsChanged:false,limitations:[
      "Each row replaces the original exit allowance with a declared number of quote ticks. Zero is an assumption, not an expected fill.",
      "Entry assumes a fill at ask. The displayed spread is counted only in the original friction check; it is not added a second time to R.",
      "The schedule choice assumes nonprofessional status and one execution per side. Actual charges, fragmented fills and trade-date applicability are unverified; recheck the source before use.",
      "The fee reserve includes entry and target-exit fees once. Lower stop proceeds have no larger fee under this snapshot; losses beyond the allowance remain possible.",
      "Premium stops are continuous loss scenarios, not tick-rounded triggers, native stop orders or guaranteed execution prices. Targets use the declared quote tick, not verified order increments.",
      removed?"Legacy loss caps are not enforced. Allocation, declared cash/equity and target checks remain; full-premium exposure is still shown. No result qualifies a quote, trade or win rate.":"All independent allocation, cash, loss, stress and target limits remain. No result qualifies a quote, trade or win rate.",
    ]});
}
