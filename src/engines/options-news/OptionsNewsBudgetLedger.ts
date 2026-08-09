import { NewsBudgetState, type NewsBudgetPolicy, type NewsBudgetReservation, type NewsBudgetSnapshot } from "../../contracts/OptionsNewsOperations";

export const OPTIONS_NEWS_BUDGET_POLICY: NewsBudgetPolicy = { policyVersion: "news-options-combined-budget:1.0", currency: "USD", softLimitMinorUnits: 8000, hardLimitMinorUnits: 10000, monthlyBoundary: "UTC" };

export class OptionsNewsBudgetLedger {
  private readonly reservations = new Map<string, NewsBudgetReservation>();
  public constructor(private readonly policy: NewsBudgetPolicy = OPTIONS_NEWS_BUDGET_POLICY) {}
  public reserve(reservationId: string, providerId: string, atUtc: string, estimateMinorUnits: number | null): NewsBudgetReservation {
    const month = utcMonth(atUtc); const existing = this.reservations.get(reservationId); if (existing !== undefined) { if (existing.providerId === providerId && existing.monthUtc === month && existing.estimatedMinorUnits === estimateMinorUnits) return structuredClone(existing); throw new Error("BUDGET_IDEMPOTENCY_CONFLICT"); }
    if (estimateMinorUnits === null) throw new Error(NewsBudgetState.BlockedCostUnknown);
    if (!Number.isSafeInteger(estimateMinorUnits) || estimateMinorUnits < 0) throw new Error("INVALID_COST_ESTIMATE");
    const snapshot = this.snapshot(atUtc);
    if (snapshot.state === NewsBudgetState.BlockedBudget) throw new Error(NewsBudgetState.BlockedBudget);
    if (snapshot.committedMinorUnits + snapshot.reservedMinorUnits + estimateMinorUnits > this.policy.hardLimitMinorUnits) throw new Error(NewsBudgetState.BlockedBudget);
    const value: NewsBudgetReservation = { reservationId, providerId, monthUtc: month, estimatedMinorUnits: estimateMinorUnits, state: "RESERVED", actualMinorUnits: null }; this.reservations.set(reservationId, value); return structuredClone(value);
  }
  public reconcile(reservationId: string, actualMinorUnits: number): NewsBudgetReservation { const existing = this.required(reservationId); if (!Number.isSafeInteger(actualMinorUnits) || actualMinorUnits < 0) throw new Error("INVALID_ACTUAL_COST"); if (existing.state === "RECONCILED") { if (existing.actualMinorUnits === actualMinorUnits) return structuredClone(existing); throw new Error("BUDGET_SETTLEMENT_CONFLICT"); } if (existing.state !== "RESERVED") throw new Error("INVALID_BUDGET_TRANSITION"); const value = { ...existing, state: "RECONCILED" as const, actualMinorUnits }; this.reservations.set(reservationId, value); return structuredClone(value); }
  public release(reservationId: string): NewsBudgetReservation { const existing = this.required(reservationId); if (existing.state === "RELEASED") return structuredClone(existing); if (existing.state !== "RESERVED") throw new Error("INVALID_BUDGET_TRANSITION"); const value = { ...existing, state: "RELEASED" as const, actualMinorUnits: 0 }; this.reservations.set(reservationId, value); return structuredClone(value); }
  public snapshot(atUtc: string): NewsBudgetSnapshot { const month = utcMonth(atUtc); const values = [...this.reservations.values()].filter((v) => v.monthUtc === month); const committed = values.filter((v) => v.state === "RECONCILED").reduce((sum,v) => sum + (v.actualMinorUnits ?? 0),0); const reserved = values.filter((v) => v.state === "RESERVED").reduce((sum,v) => sum + v.estimatedMinorUnits,0); const total = committed + reserved; return { monthUtc: month, committedMinorUnits: committed, reservedMinorUnits: reserved, state: total >= this.policy.hardLimitMinorUnits ? NewsBudgetState.BlockedBudget : total >= this.policy.softLimitMinorUnits ? NewsBudgetState.Warning : NewsBudgetState.Normal }; }
  private required(id: string): NewsBudgetReservation { const value = this.reservations.get(id); if (value === undefined) throw new Error("UNKNOWN_RESERVATION"); return value; }
}

const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function utcMonth(atUtc: string): string { if (!CANONICAL_UTC.test(atUtc)) throw new Error("INVALID_UTC_TIMESTAMP"); const parsed = new Date(atUtc); if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== atUtc) throw new Error("INVALID_UTC_TIMESTAMP"); return atUtc.slice(0,7); }
