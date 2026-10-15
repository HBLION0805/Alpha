/** Simulation capital: the user chose $5,000 (2026-10-15), so 1%/trade = $50 and 2%/day = $100. ALPHA_CAPITAL overrides it. Live money later scales proportionally. */
export const DEFAULT_CAPITAL = 5000;
export function defaultCapital(env = process.env): number {
  const n = Number(env.ALPHA_CAPITAL);
  return env.ALPHA_CAPITAL && Number.isFinite(n) && n > 0 ? n : DEFAULT_CAPITAL;
}
