/** Simulation capital: the user chose $5,000 (2026-10-15), per-trade cap = confidence tier 0.5–2% of live paper equity (src/options/confidence.ts), 2%/day of equity. ALPHA_CAPITAL overrides it. Live money later scales proportionally. */
export const DEFAULT_CAPITAL = 5000;
export function defaultCapital(env = process.env): number {
  const n = Number(env.ALPHA_CAPITAL);
  return env.ALPHA_CAPITAL && Number.isFinite(n) && n > 0 ? n : DEFAULT_CAPITAL;
}
