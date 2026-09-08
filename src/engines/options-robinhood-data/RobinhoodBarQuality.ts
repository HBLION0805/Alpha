import { assessRobinhoodCapture } from "./RobinhoodCaptureEngine";

interface Bar {
  begins_at: string;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  session: string;
  interpolated?: boolean;
}
interface History {
  instrument_id: string;
  bars: Bar[];
}
interface Instrument {
  id: string;
  chain_symbol: "GLD" | "IBIT";
  expiration_date: string;
  strike_price: string;
  type: "call" | "put";
  trade_value_multiplier: string;
}
interface CaptureCall {
  tool: string;
  args: { instrument_ids: string[]; start_time: string; end_time: string; interval: string };
  data: { instruments?: Instrument[]; results?: History[]; not_found?: string[] };
  requestedAt: string;
  receivedAt: string;
}
export interface OptionCandleSlot {
  beginsAt: string;
  status: "DECLARED_NONINTERPOLATED" | "INTERPOLATED" | "INTERPOLATION_UNKNOWN" | "MISSING";
  source: Bar | null;
}
const micros = (v: string): bigint => {
  const [whole, fraction = ""] = v.split(".");
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
};
function local(ms: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute), weekday: p.weekday };
}
function supportedWindow(start: number, end: number, interval: number) {
  const a = local(start), b = local(end);
  return start % interval === 0 && end % interval === 0 && a.day === b.day
    && !["Sat", "Sun"].includes(a.weekday!) && a.minute >= 570 && b.minute <= 960;
}

/** OHLC provenance and coverage only. The original capture engine retains all authority. */
export function assessRobinhoodBarQuality(inputText: string, recordedAt: string) {
  const original = assessRobinhoodCapture(inputText, recordedAt);
  const calls = (JSON.parse(inputText) as { calls: CaptureCall[] }).calls;
  const instruments = new Map(calls.filter(c => c.tool === "get_option_instruments")
    .flatMap(c => c.data.instruments!.map(i => [i.id, i] as const)));
  const series = calls.flatMap((call, callIndex) => {
    if (call.tool !== "get_option_historicals") return [];
    const start = Date.parse(call.args.start_time), end = Date.parse(call.args.end_time);
    const interval = call.args.interval === "minute" ? 60000 : 300000;
    const supported = supportedWindow(start, end, interval);
    return call.args.instrument_ids.map(id => {
      const instrument = instruments.get(id)!, history = call.data.results!.find(h => h.instrument_id === id);
      if (history?.bars.some(b => /\.\d*[1-9]\d*(?:Z|[+-]\d\d:\d\d)$/.test(b.begins_at))) {
        throw new Error("BAR_QUALITY_SUBMILLISECOND_BOUNDARY");
      }
      const raw = new Map((history?.bars ?? []).map(b => [Date.parse(b.begins_at), b]));
      const slots: OptionCandleSlot[] = [];
      if (supported) for (let t = start; t < end; t += interval) {
        const b = raw.get(t);
        slots.push({ beginsAt: new Date(t).toISOString(), source: b ? { ...b } : null,
          status: !b ? "MISSING" : b.interpolated === true ? "INTERPOLATED"
            : b.interpolated === false ? "DECLARED_NONINTERPOLATED" : "INTERPOLATION_UNKNOWN" });
      }
      const count = (status: OptionCandleSlot["status"]) => slots.filter(s => s.status === status).length;
      const counts = { declaredNoninterpolated: count("DECLARED_NONINTERPOLATED"), interpolated: count("INTERPOLATED"),
        unknown: count("INTERPOLATION_UNKNOWN"), missing: count("MISSING") };
      let run = 0, longestDeclaredRun = 0;
      for (const s of slots) { run = s.status === "DECLARED_NONINTERPOLATED" ? run + 1 : 0; longestDeclaredRun = Math.max(run, longestDeclaredRun); }
      const standard = /^100(?:\.0{1,6})?$/.test(instrument.trade_value_multiplier);
      const complete = supported && slots.length > 0 && counts.declaredNoninterpolated === slots.length && standard;
      const first = slots[0]?.source, last = slots.at(-1)?.source;
      const windowReturnBps = complete && first && last ? {
        numerator: ((micros(last.close_price) - micros(first.open_price)) * 10000n).toString(),
        denominator: micros(first.open_price).toString(),
      } : null;
      const blockers = [
        ...(!supported ? ["REQUEST_OUTSIDE_SUPPORTED_SESSION_ENVELOPE"] : []),
        ...(!standard ? ["NONSTANDARD_MULTIPLIER"] : []),
        ...(!history ? [call.data.not_found?.includes(id) ? "CONTRACT_NOT_FOUND" : "HISTORY_RESPONSE_MISSING"] : []),
        ...(counts.missing ? ["MISSING_INTERVALS"] : []),
        ...(counts.interpolated ? ["INTERPOLATED_BARS_EXCLUDED"] : []),
        ...(counts.unknown ? ["INTERPOLATION_NOT_DECLARED"] : []),
      ];
      return { key: `${original.captureId}:${callIndex}:${id}`, instrumentId: id, symbol: instrument.chain_symbol,
        expiry: instrument.expiration_date, strike: instrument.strike_price, type: instrument.type,
        interval: call.args.interval, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(),
        requestedAt: call.requestedAt, receivedAt: call.receivedAt, recordedAt,
        status: complete ? "COMPLETE_DECLARED_OHLC" : supported ? "INCOMPLETE_PROVENANCE" : "UNSUPPORTED_WINDOW",
        returnedBarCount: raw.size, expectedSlotCount: supported ? slots.length : null, counts, longestDeclaredRun,
        windowReturnBps, slots, blockers, exchangeCalendarQualified: false, volumeAvailable: false,
        underlyingCandlesAvailable: false, stopTargetPathQualified: false, signalAllowed: false };
    });
  });
  return { version: "ROBINHOOD_BAR_QUALITY_V1", captureId: original.captureId, recordedAt,
    declaredOrigin: original.declaredOrigin, sourceSha256: original.sourceSha256, series,
    status: original.status, executionAllowed: false, winProbability: null, actualTrades: 0,
    limits: ["SOURCE_DECLARATIONS_NOT_INDEPENDENT_TRADE_VERIFICATION", "EXCHANGE_CALENDAR_UNVERIFIED",
      "OPTION_BARS_ARE_NOT_ETF_CANDLES", "NO_BAR_VOLUME_OR_VWAP", "NO_HISTORICAL_BID_ASK_SIZES",
      "NO_INTRABAR_STOP_TARGET_ORDER", "RETROSPECTIVE_HISTORY_IS_NOT_PROSPECTIVE_EVIDENCE"] };
}
