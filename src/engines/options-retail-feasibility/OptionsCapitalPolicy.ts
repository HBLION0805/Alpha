import type { GuidanceSettings } from "../../contracts/OptionsDailyGuidance";
import { validateGuidanceSettings } from "../options-daily-guidance/OptionsDailyGuidance";
import { legacyRiskCapsRemoved } from "./OptionsTradeBudget";
import { optionsRetailRiskLimits } from "./OptionsRetailFeasibilityEngine";

function freeze<T>(value:T):T {
  if(value && typeof value==="object"){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;
}
function settingsInput(value:unknown):GuidanceSettings {
  if(!value || typeof value!=="object" || ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error("WORKBENCH_CAPITAL_POLICY_INPUT");
  const fields=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(value).some(k=>typeof k!=="string"||!fields[k]?.enumerable||!("value" in fields[k]!)))throw Error("WORKBENCH_CAPITAL_POLICY_INPUT");
  return validateGuidanceSettings(value as GuidanceSettings);
}

/** Necessary capital inequalities only. Does not select a contract or change a policy. */
export function assessOptionsCapitalPolicy(value:unknown) {
  const settings=settingsInput(value),removed=legacyRiskCapsRemoved(settings.tradeBudget),legacy=optionsRetailRiskLimits(settings.currentEquityCents);
  const limits=removed?{plannedRiskBudgetBps:null,plannedRiskBudgetCents:null,fullPremiumStressCapCents:null}:legacy;
  const minimum=settings.tradeBudget?.minCents??null;
  const maximum=settings.tradeBudget?.maxCents??Number(BigInt(settings.currentEquityCents)*500n/10000n);
  const fees=BigInt(settings.roundTripFeesCents??0),slippage=BigInt(settings.slippageReserveCents??0),rate=BigInt(settings.stopLossBps);
  const unknownCosts=[...(settings.roundTripFeesCents===null?["ROUND_TRIP_FEES"]:[]),...(settings.slippageReserveCents===null?["EXIT_SLIPPAGE"]:[])];
  const riskRoom=BigInt(legacy.plannedRiskBudgetCents)-fees-slippage;
  // floor(premium * rate / 10000) <= riskRoom, with capital = premium + fees.
  const plannedCapitalUpperBound=removed?null:riskRoom<0n?0:Number(fees+((riskRoom+1n)*10000n-1n)/rate);
  const standardCapitalLowerBound=Number(fees)+100; // One 100-share contract, at least one cent/share; no quote is invented.
  const lowerBound=Math.max(minimum??0,standardCapitalLowerBound);
  const upperBound=removed?Math.min(maximum,settings.settledCashCents,settings.currentEquityCents):Math.min(maximum,settings.settledCashCents,legacy.fullPremiumStressCapCents,plannedCapitalUpperBound!);
  const conflicts:{code:string;requiredCents:number;limitCents:number;message:string}[]=[];
  if(minimum!==null)for(const [code,limit,message] of [
    ["MINIMUM_EXCEEDS_STRESS",limits.fullPremiumStressCapCents,"The minimum all-in allocation exceeds the independent full-premium stress cap."],
    ["MINIMUM_EXCEEDS_CASH",settings.settledCashCents,"The minimum all-in allocation exceeds declared settled cash."],
    ["MINIMUM_EXCEEDS_PLANNED_LOSS_BOUND",plannedCapitalUpperBound,"Even the necessary cost-aware planned-loss bound is below the minimum allocation."],
  ] as const)if(limit!==null&&minimum>limit)conflicts.push({code,requiredCents:minimum,limitCents:limit,message});
  if(removed&&minimum!==null&&minimum>settings.currentEquityCents)conflicts.push({code:"MINIMUM_EXCEEDS_EQUITY",requiredCents:minimum,limitCents:settings.currentEquityCents,message:"The minimum allocation exceeds declared total equity."});
  if(standardCapitalLowerBound>upperBound)conflicts.push({code:"STANDARD_CONTRACT_LOWER_BOUND_EXCEEDS_CAPACITY",requiredCents:standardCapitalLowerBound,limitCents:upperBound,message:"Even one standard contract's minimum cent-denominated premium plus known fees exceeds the necessary capacity bound."});
  const sampleMinimum=minimum??standardCapitalLowerBound;
  const levels=[...new Set([sampleMinimum,Math.floor((sampleMinimum+maximum)/2),maximum])].sort((a,b)=>a-b);
  const rows=levels.map(capitalCents=>{
    const premium=BigInt(capitalCents)-fees,valid=premium>=100n;
    const lowerRisk=valid?Number(premium*rate/10000n+fees+slippage):null;
    return {capitalCents,premiumCents:settings.roundTripFeesCents!==null&&valid?Number(premium):null,
      plannedLossCents:unknownCosts.length===0?lowerRisk:null,plannedLossLowerBoundCents:lowerRisk,
      fullPremiumStressCents:capitalCents,
      plannedLossExceedsCap:removed||lowerRisk===null?null:lowerRisk>legacy.plannedRiskBudgetCents,
      stressExceedsCap:removed?null:capitalCents>legacy.fullPremiumStressCapCents,
      ...(removed?{equityExceeded:capitalCents>settings.currentEquityCents}:{}),
      cashExceeded:capitalCents>settings.settledCashCents,
      standardContractPossibleByCents:settings.roundTripFeesCents===null?null:valid&&premium%100n===0n,
      inputIssue:valid?null:"CAPITAL_DOES_NOT_COVER_KNOWN_FEES_AND_MINIMUM_PREMIUM"};
  });
  return freeze({version:removed?"OPTIONS_CAPITAL_POLICY_V2" as const:"OPTIONS_CAPITAL_POLICY_V1" as const,settings,limits,
    ...(removed?{legacyLossCapsEnforced:false}:{}),
    allocation:{minimumCents:minimum,maximumCents:maximum,basis:minimum===null?"LEGACY_FIVE_PERCENT_CEILING":"OWNER_DECLARED_RANGE"},
    status:lowerBound>upperBound?"CONFLICTING_CONSTRAINTS" as const:"NO_PROVEN_CAPITAL_CONFLICT" as const,
    constraints:{standardCapitalLowerBoundCents:standardCapitalLowerBound,plannedCapitalUpperBoundCents:plannedCapitalUpperBound,
      necessaryLowerBoundCents:lowerBound,necessaryUpperBoundCents:upperBound,unknownCosts},conflicts,rows,
    executionAllowed:false,winProbability:null,policyChanged:false,
    limitations:["This preflight uses saved or previewed declarations, not verified account balances, prices or fills.",
      "Capital is premium plus the round-trip fee reserve. Full-premium stress excludes exercise-related stock exposure.",
      "An unknown nonnegative cost contributes zero only to a separately labeled necessary bound; exact costs and planned loss remain unknown.",
      "Bounds use the retail engine's integer-cent floor. A nonempty interval does not establish an available whole contract, acceptable spread, stop execution, portfolio capacity or a trade.",
      "A planned premium stop does not replace full-premium exposure or guarantee a fill. These comparisons never change a risk limit."]});
}
