import { BarInterval } from "./CanonicalBar";
import type { MarketRegimePolicy } from "./MarketRegime";

export const OPTIONS_CONTEXT_INTERVALS = Object.freeze([
  BarInterval.OneDay, BarInterval.OneHour, BarInterval.FifteenMinutes, BarInterval.FiveMinutes,
] as const);
export type OptionsContextInterval = typeof OPTIONS_CONTEXT_INTERVALS[number];
export interface OptionsCandlePolicy {
  readonly schemaVersion: "1.0";
  readonly policyId: string;
  readonly version: string;
  readonly sessionType: "REGULAR";
  readonly gridVersion: "REGULAR_OPEN_FULL_WINDOWS_V1";
  readonly pairVersion: "SESSION_LOCAL_INTRADAY_V1";
  readonly annualizationVersion: "REGULAR_SESSION_FIXED_PERIODS_V1";
  readonly periodsPerYear: Readonly<Record<OptionsContextInterval, number>>;
  readonly atrWindowN: number;
  readonly rvReturnWindowN: number;
  readonly volumeSessionWindowN: number;
  readonly lowRelativeVolumeBps: number;
  readonly highRelativeVolumeBps: number;
  readonly maxAgeSeconds: Readonly<Record<OptionsContextInterval, number>>;
  readonly maxBarsPerSeries: number;
  readonly regimePolicy: MarketRegimePolicy;
}
