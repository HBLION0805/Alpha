import type { GuidanceInput } from "../../contracts/OptionsDailyGuidance";
import { assessDailyGuidance, guidanceLocal } from "./OptionsDailyGuidance";
import { paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";

const MICRO = 1000000n;
function micro(value: string | null): bigint | null {
  if (value === null || !/^\d{1,8}(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const n = BigInt(whole!) * MICRO + BigInt(fraction.padEnd(6, "0"));
  return n > 0n ? n : null;
}
function decimal(value: bigint | null): string | null {
  if (value === null) return null;
  const n = value < 0n ? -value : value;
  return (value < 0n ? "-" : "") + (n / MICRO).toString() + "." + (n % MICRO).toString().padStart(6, "0");
}
function percent(value: bigint | null, base: bigint | null): string | null {
  if (value === null || base === null) return null;
  const magnitude = value < 0n ? -value : value;
  const hundredths = (magnitude * 10000n + base / 2n) / base;
  return (value < 0n && hundredths !== 0n ? "-" : "") + (hundredths / 100n).toString() + "." + (hundredths % 100n).toString().padStart(2, "0");
}
const validCents = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n > 0;
function freshness(at: string, source: string | null) {
  const elapsed = source === null ? NaN : Date.parse(at) - Date.parse(source);
  return !Number.isFinite(elapsed) ? "UNKNOWN" : elapsed < 0 ? "FUTURE" : elapsed > 120000 ? "STALE" : "FRESH";
}

/** Explanations never change the original engine's ranking, gates or saved output. */
export function explainDailyGuidance(input: GuidanceInput) {
  const report = assessDailyGuidance(input), today = guidanceLocal(input.at).date;
  const futureEvents = report.events.filter(e => e.major && e.endDate >= today &&
    (e.scheduledAt === null || Date.parse(e.scheduledAt) > Date.parse(input.at)));
  return {
    version: "OPTIONS_GUIDANCE_RATIONALE_V1", assessedAt: input.at,
    inputFingerprint: paperFingerprint(input), originalReportFingerprint: paperFingerprint(report),
    calendarCoverageAvailable: input.calendarAvailable,
    assets: report.assets.map(asset => {
      const equity = asset.equity, spot = micro(equity?.price ?? null);
      const sourceStatus = freshness(input.at, equity?.sourceAt ?? null);
      const note = input.analyst, analystAge = note ? Date.parse(input.at) - Date.parse(note.assessedAt) : NaN;
      const analyst = note?.assets.find(a => a.symbol === asset.symbol);
      const withinAnalystWindow = Boolean(analyst && analyst.sources.length > 0 && analystAge >= 0 && analystAge <= 86400000);
      const newerMarketEvidence = Boolean(note && input.captureAt && Date.parse(input.captureAt) > Date.parse(note.assessedAt));
      const currentAnalyst = withinAnalystWindow && !newerMarketEvidence;
      return {
        symbol: asset.symbol, disposition: asset.disposition, blockers: asset.blockers,
        reference: { priceUsd: equity?.price ?? null, sourceAt: equity?.sourceAt ?? null, freshness: sourceStatus },
        analystReview: { assessedAt: note?.assessedAt ?? null, newerMarketEvidence,
          status: !withinAnalystWindow ? "MISSING_OR_OLD" : newerMarketEvidence ? "NEWER_MARKET_EVIDENCE_NEEDS_REVIEW" : "WITHIN_EXISTING_TIME_WINDOW" },
        dimensions: [
          { id: "DIRECTION", status: ["UP", "DOWN"].includes(asset.trend.direction) ? "DESCRIPTIVE_ONLY" : "UNCONFIRMED",
            explanation: `${asset.trend.direction}: ${asset.trend.closes.length}/5 eligible official closes. ${currentAnalyst ? "Dated analyst bias: " + analyst!.bias + "." : withinAnalystWindow && newerMarketEvidence ? "The analyst note predates newer market evidence and needs reassessment." : "No current attributed analyst bias."} This does not estimate the probability of a profitable option.` },
          { id: "MAGNITUDE", status: "FORECAST_MISSING",
            explanation: "Expiry breakevens below quantify the move needed under a terminal payoff assumption. No expected ETF price range or pre-expiry target price has been established." },
          { id: "TIME", status: "TRADE_HORIZON_UNDECLARED",
            explanation: "The 14–45 DTE sampling range is a research filter. Expiry is not a planned exit date. Declare the expected move window and a time exit before freezing a paper or manual trade plan." },
          { id: "VOLATILITY", status: "UNASSESSED",
            explanation: "This guidance input has no qualified IV comparison, theta or vega analysis. A long option can lose value as time passes or implied volatility falls despite a correct direction. Delta is not a win probability." },
          { id: "PATH", status: "UNCONFIRMED",
            explanation: "Qualified ETF intraday OHLCV/VWAP and a prospective entry trigger are missing from this guidance input. Session closes do not establish a breakout, a pullback entry or an executable stop path." },
          { id: "RISK", status: input.settings.roundTripFeesCents === null || input.settings.slippageReserveCents === null ? "COSTS_UNKNOWN" : "DECLARED_SCENARIO",
            explanation: "Original allocation, premium stop, net-R economics and blockers are retained. A stop is an intended trigger; actual loss can reach the entire premium plus costs. Account balances and fills are not verified." }
        ],
        contracts: asset.candidates.map(candidate => {
          const q = candidate.contract, strike = micro(q.strike), standard = q.multiplier === 100;
          const premium = validCents(q.askCents) && standard ? BigInt(q.askCents) * 10000n : null;
          const intrinsic = spot !== null && strike !== null ? (q.type === "call" ? spot - strike : strike - spot) : null;
          const intrinsicFloor = intrinsic === null ? null : intrinsic > 0n ? intrinsic : 0n;
          const extrinsic = premium === null || intrinsicFloor === null ? null : premium - intrinsicFloor;
          const gross = strike === null || premium === null ? null : q.type === "call" ? strike + premium : strike - premium;
          const costs = input.settings.roundTripFeesCents === null || input.settings.slippageReserveCents === null ? null :
            BigInt(input.settings.roundTripFeesCents + input.settings.slippageReserveCents) * 100n;
          const reserved = gross === null || costs === null ? null : q.type === "call" ? gross + costs : gross - costs;
          const events = futureEvents.filter(e => e.startDate <= q.expiry).map(e => ({
            title: e.title, source: e.source, startDate: e.startDate, endDate: e.endDate, scheduledAt: e.scheduledAt,
            overlap: e.endDate > q.expiry ? "EXTENDS_BEYOND_EXPIRY" : e.endDate === q.expiry ? "EXPIRY_DAY_TIME_NOT_QUALIFIED" : "BEFORE_EXPIRY",
            timing: e.scheduledAt === null ? "DATE_ONLY_RELEASE_TIME_UNKNOWN" : "SCHEDULED_TIME"
          }));
          return {
            id: q.id, disposition: candidate.disposition, blockers: candidate.blockers,
            expiry: q.expiry, dte: candidate.dte, type: q.type, strikeUsd: q.strike,
            quoteAt: q.updatedAt, quoteFreshness: freshness(input.at, q.updatedAt),
            moneyness: intrinsic === null ? "UNKNOWN" : intrinsic > 0n ? "IN_THE_MONEY" : intrinsic < 0n ? "OUT_OF_THE_MONEY" : "AT_THE_MONEY",
            referenceIntrinsicPerShareUsd: decimal(intrinsicFloor), referenceExtrinsicPerShareUsd: decimal(extrinsic),
            referencePricesComparable: spot !== null && premium !== null && sourceStatus === "FRESH" && freshness(input.at, q.updatedAt) === "FRESH" &&
              equity?.sourceAt !== null && q.updatedAt !== null && Math.abs(Date.parse(equity!.sourceAt!) - Date.parse(q.updatedAt)) <= 120000,
            referenceAnomaly: extrinsic !== null && extrinsic < 0n ? "ASK_BELOW_REFERENCE_INTRINSIC_RECHECK_CLOCKS_AND_QUOTES" : null,
            terminal: {
              grossBreakEvenUsd: gross !== null && gross >= 0n ? decimal(gross) : null,
              grossState: gross === null ? "UNAVAILABLE" : gross < 0n ? "NO_NONNEGATIVE_BREAK_EVEN" : "AVAILABLE",
              reservedCostBreakEvenUsd: reserved !== null && reserved >= 0n ? decimal(reserved) : null,
              reservedCostState: gross === null ? "UNAVAILABLE" : costs === null ? "COSTS_UNKNOWN" : reserved! < 0n ? "NO_NONNEGATIVE_BREAK_EVEN" : "DECLARED_COST_RESERVE",
              grossMoveFromReferencePercent: gross !== null && gross >= 0n && spot !== null ? percent(gross - spot, spot) : null,
              interpretation: "Expiry payoff thresholds using the reference ask, not a price forecast, required pre-expiry move, profit target or exercise instruction. The reserve comparison reuses declared round-trip fees and slippage, not verified expiry costs."
            },
            expiryEvents: events, calendarCoverageAvailable: input.calendarAvailable,
            expiryReason: `${candidate.dte} calendar days to expiry. ${candidate.dte >= 14 && candidate.dte <= 45 ? "Within" : "Outside"} the existing 14–45 DTE filter. ${events.length} known major calendar event(s) overlap the remaining contract life; this does not select an optimal holding period.`,
            strikeReason: `${q.type.toUpperCase()} strike ${q.strike}; delta ${q.delta ?? "unknown"}. The existing research range is absolute delta 0.35–0.70. Candidate order remains feasibility then cash exposure, not expected return.`,
            plan: candidate.plan, expectedEtfPriceRange: null, preExpiryPriceForecast: null, timeExitAt: null,
            originalEconomics: candidate.feasibility.economics, executionAllowed: false
          };
        })
      };
    }),
    winProbability: null, executionAllowed: false, rankingChanged: false
  };
}
