import type { OptionsTradeBudget } from "../../contracts/OptionsTradeBudget";
import { evaluateOptionsRetailFeasibility } from "./OptionsRetailFeasibilityEngine";

export function validateTradeBudget(value: unknown): OptionsTradeBudget {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("GUIDANCE_TRADE_BUDGET");
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(k => typeof k !== "string" || !fields[k]?.enumerable || !("value" in fields[k]!)) || Object.keys(value).sort().join() !== "maxCents,minCents,version") throw Error("GUIDANCE_TRADE_BUDGET");
  const v = value as OptionsTradeBudget;
  if (v.version !== "OWNER_TRADE_BUDGET_V1" || !Number.isSafeInteger(v.minCents) || !Number.isSafeInteger(v.maxCents) || v.minCents < 1 || v.maxCents < v.minCents || v.maxCents > 100000000) throw Error("GUIDANCE_TRADE_BUDGET");
  return {version:v.version,minCents:v.minCents,maxCents:v.maxCents};
}
function freeze<T>(value:T):T {
  if(value && typeof value === "object") {for(const v of Object.values(value))freeze(v);Object.freeze(value);}
  return value;
}

/** Only replaces the declared allocation comparison. Every independent v2 risk check remains. */
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
  return freeze({...base,schemaVersion:"3.0" as const,scenario:{...base.scenario,tradeBudget:budget},economics,blockers,
    status:blockers.length?"NO_TRADE" as const:"ECONOMICALLY_FEASIBLE_SCENARIO" as const,
    allocationPolicy:budget,disclosures:[...base.disclosures,"The owner-declared capital range replaces the allocation ceiling only. The 0.5% planned-loss, $25 full-premium stress and declared settled-cash checks remain independent. A lower selection bound never requires additional spending."]});
}
