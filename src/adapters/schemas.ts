/** Adapter: zod (MIT) — the only file that imports it. Schemas for every external input; failures read "provide X". */
import { z } from "zod";

export function issues(schema: z.ZodType, data: unknown): string[] {
  const r = schema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.length ? `provide ${i.path.join(".")}` : "invalid input"} (${i.message})`);
}
export function parseInput<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new Error(`${label}: ${issues(schema, data).slice(0, 5).join("; ")}`);
  return r.data;
}

const num = z.number().finite();
const nnum = z.coerce.number().nullable().optional().transform((x) => (x == null || !Number.isFinite(x) ? null : x));
const date = z.string().regex(/^\d{4}-\d\d-\d\d/, "YYYY-MM-DD");

export const ContractSchema = z.looseObject({
  expiration: date, strike: z.coerce.number().positive(), type: z.enum(["call", "put"]),
  bid: nnum, ask: nnum, mark: nnum, iv: nnum, delta: nnum, gamma: nnum, theta: nnum, vega: nnum,
  openInterest: nnum, volume: nnum,
});
export const ChainSchema = z.looseObject({ symbol: z.string().min(1), underlyingPrice: num.positive(), asOf: z.string().min(1), contracts: z.array(ContractSchema) });

const EarningsRow = z.looseObject({ symbol: z.string(), report: z.looseObject({ date: z.string(), timing: z.string().nullish() }).nullish(), date: z.string().nullish(), timing: z.string().nullish() });
export const EarningsSchema = z.union([z.array(EarningsRow), z.looseObject({ data: z.looseObject({ results: z.array(EarningsRow) }) }), z.looseObject({ results: z.array(EarningsRow) })])
  .transform((j): z.infer<typeof EarningsRow>[] => (Array.isArray(j) ? j : ((j as { data?: { results: z.infer<typeof EarningsRow>[] } }).data?.results ?? (j as { results: z.infer<typeof EarningsRow>[] }).results)));

export const WatchlistSchema = z.union([z.array(z.string().min(1)), z.looseObject({ symbols: z.array(z.string().min(1)) })]).transform((j) => (Array.isArray(j) ? j : j.symbols).map((s) => s.toUpperCase()));

export const CalendarFileSchema = z.looseObject({ events: z.array(z.looseObject({ kind: z.string(), title: z.string(), date, timeEt: z.string().regex(/^\d\d:\d\d$/), source: z.string() })) });

const Leg = z.looseObject({ type: z.enum(["call", "put", "stock"]), strike: num, qty: num.refine((q) => q !== 0, "qty must be non-zero"), premium: num.nonnegative(), expiration: date.optional() });
export const ProposalSchema = z.looseObject({
  symbol: z.string().min(1), strategy: z.string().min(1), asOf: z.string().min(1),
  underlyingPrice: z.union([num, z.record(z.string(), num)]), thesisHorizonDays: num.positive(),
  legs: z.array(Leg).min(1), capital: num.positive(), buyingPower: num.nonnegative(),
});

/** Structural part of the journal (期权课 D.3). Course-specific rules with their citations stay in journal.ts. */
export const JournalCoreSchema = z.looseObject({
  id: z.string().min(1), openedAt: z.string().min(1), symbol: z.string().min(1), strategy: z.string().min(1),
  view: z.looseObject({ direction: z.string(), volatility: z.string() }),
  greeks: z.looseObject({ delta: num, gamma: num, theta: num, vega: num }),
  structureRationale: z.string().min(1), maxLoss: num, invalidation: z.string().min(1), exitRules: z.array(z.string()),
  ivRank: num.nullable(),
});
