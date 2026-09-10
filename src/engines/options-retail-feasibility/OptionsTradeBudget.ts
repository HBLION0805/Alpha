import type { OptionsTradeBudget } from "../../contracts/OptionsTradeBudget";
import { evaluateOptionsRetailFeasibility } from "./OptionsRetailFeasibilityEngine";

export function validateTradeBudget(value: unknown): OptionsTradeBudget {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("GUIDANCE_TRADE_BUDGET");
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(k => typeof k !== "string" || !fields[k]?.enumerable || !("value" in fields[k]!)) || Object.keys(value).sort().join() !== "maxCents,minCents,version") throw Error("GUIDANCE_TRADE_BUDGET");
  const v = value as OptionsTradeBudget;
  if (!["OWNER_TRADE_BUDGET_V1", "OWNER_ALLOCATION_ONLY_V2"].includes(v.version) || !Number.isSafeInteger(v.minCents) || !Number.isSafeInteger(v.maxCents) || v.minCents < (legacyRiskCapsRemoved(v)?10000:1) || v.maxCents < v.minCents || v.maxCents > 100000000) throw Error("GUIDANCE_TRADE_BUDGET");
  return {version:v.version,minCents:v.minCents,maxCents:v.maxCents};
}
export function legacyRiskCapsRemoved(budget?: OptionsTradeBudget): boolean {
  return budget?.version === "OWNER_ALLOCATION_ONLY_V2";
}
function freeze<T>(value:T):T {
  if(value && typeof value === "object") {for(const v of Object.values(value))freeze(v);Object.freeze(value);}
  return value;
}

/** Versioned owner policy. Legacy inputs reconstruct the original independent caps. */
export function evaluateOptionsPlanningFeasibility(input: unknown) {
  if(!input || typeof input !== "object" || !Object.hasOwn(input,"tradeBudget")) return evaluateOptionsRetailFeasibility(input);
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).some(k=>typeof k!=="string"||!descriptors[k]?.enumerable||!("value" in descriptors[k]!))) return evaluateOptionsRetailFeasibility(input);
  const {tradeBudget:raw,...baseInput}=input as Record<string,unknown>;
  const budget=validateTradeBudget(raw),base=evaluateOptionsRetailFeasibility(baseInput);
  if(!base.scenario || !base.economics) return base;
  const economics={...base.economics,normalAllocationBudgetCents:budget.maxCents,requestedAllocationBudgetCents:budget.maxCents,applicableAllocationBudgetCents:budget.maxCents,
    legacyAllocationBudgetCents:base.economics.applicableAllocationBudgetCents,minimumAllocationBudgetCents:budget.minCents};
  const blockers:{code:string;message:string}[]=base.blockers.filter(b=>b.code!=="ALLOCATION_BUDGET_EXCEEDED");
  if((economics.capitalRequiredCents??economics.premiumCents)>budget.maxCents)blockers.push({code:"ALLOCATION_BUDGET_EXCEEDED",message:"Premium plus the declared fee reserve exceeds the owner-declared per-trade maximum."});
  if(economics.capitalRequiredCents!==null&&economics.capitalRequiredCents<budget.minCents)blockers.push({code:"ALLOCATION_BELOW_MINIMUM",message:"Premium plus the declared fee reserve is below the owner-declared selection range. No additional contracts are assumed."});
  if(legacyRiskCapsRemoved(budget)) {
    const currentBlockers=blockers.filter(b=>!["PLANNED_RISK_BUDGET_EXCEEDED","LEGACY_MAX_LOSS_LIMIT_EXCEEDED","UNCALIBRATED_WIN_RATE"].includes(b.code));
    if((economics.capitalRequiredCents??economics.premiumCents)>base.scenario.currentEquityCents)currentBlockers.push({code:"ACCOUNT_EQUITY_EXCEEDED",message:"Premium plus declared fees exceeds declared total equity."});
    return freeze({...base,schemaVersion:"4.0" as const,scenario:{...base.scenario,tradeBudget:budget},
      economics:{...economics,plannedRiskBudgetBps:null,plannedRiskBudgetCents:null,legacyNormalMaxLossCents:null,legacyEventMaxLossCents:null,legacyAllocationBudgetCents:null},
      blockers:currentBlockers,status:currentBlockers.length?"NO_TRADE" as const:"ECONOMICALLY_FEASIBLE_SCENARIO" as const,
      allocationPolicy:budget,legacyLossCapsEnforced:false,disclosures:[...base.disclosures.filter((_,i)=>![2,10].includes(i)),
        "The owner removed the legacy planned-loss, full-premium and probability-based allocation caps. The declared capital range, cash/equity and calculation checks still apply. No quantity or holding-period increase is inferred.",
        "Planned loss and full-premium exposure remain visible without a loss ceiling. Stops do not guarantee the maximum loss; missing costs remain unknown."]});
  }
  return freeze({...base,schemaVersion:"3.0" as const,scenario:{...base.scenario,tradeBudget:budget},economics,blockers,
    status:blockers.length?"NO_TRADE" as const:"ECONOMICALLY_FEASIBLE_SCENARIO" as const,
    allocationPolicy:budget,disclosures:[...base.disclosures,"The owner-declared capital range replaces the allocation ceiling only. The 0.5% planned-loss, $25 full-premium stress and declared settled-cash checks remain independent. A lower selection bound never requires additional spending."]});
}
