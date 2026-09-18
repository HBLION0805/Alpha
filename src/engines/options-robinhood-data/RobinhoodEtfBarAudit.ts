import { assessRobinhoodEtfBars } from './RobinhoodEtfBars';
import { etfMicroUsd } from '../options-daily-guidance/OptionsEtfSetup';
import type { EtfResearchBar } from '../../contracts/OptionsEtfSetup';

function fail(code: string): never { throw Error('ETF_AUDIT_' + code); }
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('OBJECT');
  return v as Record<string, unknown>;
}
function exact(v: Record<string, unknown>, keys: string) {
  if (Object.keys(v).sort().join() !== keys.split(',').sort().join()) fail('FIELDS');
}
function clock(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)) return fail('CLOCK');
  const n = Date.parse(v);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,19) !== v.slice(0,19)) return fail('CLOCK');
  return new Date(n).toISOString();
}
const usd = (n: bigint) => `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
const fields = ['open','high','low','close','volume'] as const;
type Values = Pick<EtfResearchBar, typeof fields[number]>;
type Difference = { field: typeof fields[number]; fiveMinute: string | number; minuteAggregate: string | number };

/** Descriptive same-provider consistency audit; unknown flags never become validated bars. */
export function compareRobinhoodEtfBars(value: unknown, assessedAt: string) {
  const input = object(value); exact(input, 'fiveMinuteCapture,minuteCapture');
  const at = clock(assessedAt);
  const coarse = assessRobinhoodEtfBars(input.fiveMinuteCapture, at);
  const five = object(input.fiveMinuteCapture), fiveRequest = object(five.request);
  const fine = object(input.minuteCapture); exact(fine, 'tool,request,requestedAt,receivedAt,response');
  if (fine.tool !== 'get_equity_historicals') fail('TOOL');
  const request = object(fine.request); exact(request, 'symbols,start_time,end_time,interval,bounds,adjustment_type');
  if (request.interval !== 'minute' || request.bounds !== 'regular' || request.adjustment_type !== 'none') fail('REQUEST_SCOPE');
  const symbols = coarse.assets.map(a=>a.symbol);
  if (!Array.isArray(request.symbols) || request.symbols.length !== symbols.length || new Set(request.symbols).size !== symbols.length || request.symbols.some(s=>!symbols.includes(s as 'GLD'|'IBIT'))) fail('SYMBOLS');
  const start = clock(request.start_time), end = clock(request.end_time);
  if (start !== clock(fiveRequest.start_time) || end !== clock(fiveRequest.end_time)) fail('WINDOW_MISMATCH');
  const requestedAt = clock(fine.requestedAt), receivedAt = clock(fine.receivedAt);
  if (requestedAt > receivedAt || receivedAt > at) fail('RECEIPT_CLOCK');
  const response = object(fine.response);
  if (response.isError === true) fail('TOOL_ERROR');
  const data = object(object(response.structuredContent).data);
  if (data.results !== null && !Array.isArray(data.results)) fail('RESULTS');
  const results = (data.results ?? []) as unknown[];
  const missing = data.not_found ?? [];
  if (!Array.isArray(missing) || new Set(missing).size !== missing.length || missing.some(s=>!symbols.includes(s))) fail('NOT_FOUND');
  const bySymbol = new Map<string, Record<string, unknown>>();
  for (const raw of results) {
    const r = object(raw), symbol = r.symbol;
    if (typeof symbol !== 'string' || !symbols.includes(symbol as 'GLD'|'IBIT') || bySymbol.has(symbol) || missing.includes(symbol)) fail('IDENTITY');
    bySymbol.set(symbol,r);
  }
  const startMs = Date.parse(start), expectedMinutes = (Date.parse(end)-startMs)/60000;
  const assets = coarse.assets.map(a=>{
    const r = bySymbol.get(a.symbol), issues: string[] = [];
    if (!r) issues.push(missing.includes(a.symbol)?'MINUTE_SYMBOL_NOT_FOUND':'MINUTE_RESULT_OMITTED');
    if (r && (r.interval !== 'minute' || r.bounds !== 'regular')) issues.push('MINUTE_RESPONSE_SCOPE_MISMATCH');
    if (r && r.bars !== null && !Array.isArray(r.bars)) fail('BARS');
    const rawBars = (r?.bars ?? []) as unknown[];
    if (rawBars.length > 1000) fail('BAR_LIMIT');
    if (rawBars.length !== expectedMinutes) issues.push('MINUTE_BAR_COUNT_MISMATCH');
    let unknownFlags = 0, interpolatedBars = 0;
    const minutes: Array<Values | null> = rawBars.map((raw,i)=>{
      try {
        const b = object(raw), begin = clock(b.begins_at);
        if (Date.parse(begin) !== startMs+i*60000) issues.push('MINUTE_GRID_OR_ORDER_MISMATCH');
        if (Date.parse(begin)+60000 > Date.parse(requestedAt)) issues.push('MINUTE_NOT_COMPLETE_AT_REQUEST');
        if (b.session !== 'reg') issues.push('MINUTE_SESSION_UNKNOWN_OR_NONREGULAR');
        if (b.interpolated === undefined) unknownFlags++;
        else if (typeof b.interpolated !== 'boolean') issues.push('MINUTE_INTERPOLATION_FLAG_INVALID');
        else if (b.interpolated) { interpolatedBars++; issues.push('MINUTE_INTERPOLATED_BAR'); }
        const [o,h,l,c] = [b.open_price,b.high_price,b.low_price,b.close_price].map(p=>etfMicroUsd(p as string));
        if (h!<l! || o!<l! || o!>h! || c!<l! || c!>h!) issues.push('MINUTE_INVALID_OHLC');
        if (typeof b.volume !== 'number' || !Number.isSafeInteger(b.volume) || b.volume<0 || b.volume>1e9) fail('VOLUME');
        return {open:b.open_price as string,high:b.high_price as string,low:b.low_price as string,close:b.close_price as string,volume:b.volume};
      } catch { issues.push('MINUTE_INVALID_BAR'); return null; }
    });
    const structuralBlockers = [...new Set([...a.blockers.filter(b=>b!=='INTERPOLATION_UNKNOWN').map(b=>'FIVE_'+b),...issues])];
    const rows = Array.from({length:a.expectedBars},(_,i)=>{
      const bar = a.rows[i]?.bar ?? null;
      const fiveMinute: Values | null = bar ? {open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume} : null;
      const group = minutes.slice(i*5,i*5+5);
      let minuteAggregate: Values | null = null;
      const differences: Difference[] = [];
      if (!structuralBlockers.length && bar && group.length===5 && group.every((b): b is Values=>b!==null)) {
        minuteAggregate = {open:group[0]!.open,close:group[4]!.close,
          high:usd(group.reduce((n,b)=>etfMicroUsd(b.high)>n?etfMicroUsd(b.high):n,etfMicroUsd(group[0]!.high))),
          low:usd(group.reduce((n,b)=>etfMicroUsd(b.low)<n?etfMicroUsd(b.low):n,etfMicroUsd(group[0]!.low))),
          volume:group.reduce((n,b)=>n+b.volume,0)};
        for (const field of fields) {
          const equal = field==='volume' ? bar.volume===minuteAggregate.volume : etfMicroUsd(bar[field])===etfMicroUsd(minuteAggregate[field]);
          if (!equal) differences.push({field,fiveMinute:bar[field],minuteAggregate:minuteAggregate[field]});
        }
      }
      return {start:new Date(startMs+i*300000).toISOString(),status:minuteAggregate?(differences.length?'DIFFERENT':'MATCH'):'NOT_COMPARABLE',fiveMinute,minuteAggregate,differences};
    });
    const comparable = rows.filter(r=>r.minuteAggregate!==null).length, different = rows.filter(r=>r.status==='DIFFERENT').length;
    const qualityBlockers = [...structuralBlockers];
    if (a.unknownInterpolation || unknownFlags) qualityBlockers.push('INTERPOLATION_UNKNOWN');
    if (different) qualityBlockers.push('CROSS_INTERVAL_DISAGREEMENT');
    return {symbol:a.symbol,status:structuralBlockers.length?'NOT_COMPARABLE':different?'DISAGREEMENT_OBSERVED':'NUMERICALLY_CONSISTENT_UNQUALIFIED',
      expectedFiveMinuteBars:a.expectedBars,returnedFiveMinuteBars:a.returnedBars,expectedMinuteBars:expectedMinutes,returnedMinuteBars:rawBars.length,
      comparable,matching:comparable-different,different,notComparable:rows.length-comparable,
      differingFields:rows.reduce((n,r)=>n+r.differences.length,0),unknownFiveMinuteFlags:a.unknownInterpolation,unknownMinuteFlags:unknownFlags,interpolatedMinuteBars:interpolatedBars,
      structuralBlockers,qualityBlockers,rows,sourceQualified:false,canConfirmTrend:false};
  });
  return {version:'OPTIONS_ETF_SOURCE_AUDIT_V1',assessedAt:at,windowStart:start,windowEnd:end,
    fiveMinuteClock:{requestedAt:coarse.requestedAt,receivedAt:coarse.receivedAt},minuteClock:{requestedAt,receivedAt},assets,
    meaning:'Same-provider observations at different receipt times. Agreement is not independent corroboration; differences do not identify their cause.',
    omittedFlagSemantics:'UNSPECIFIED_IN_OBSERVED_OFFICIAL_SCHEMA',sourceQualified:false,executionAllowed:false,changesCanonicalGuidance:false,
    nextAction:'Obtain a documented explanation of omitted flags and cross-interval discrepancies, or use another qualified ETF bar source. No automatic retries or promotion.',
    supportQuestions:[
      'For get_equity_historicals, does an omitted interpolated field explicitly mean false, or unknown? Please provide a documented guarantee.',
      `For raw regular-session bars on ${start.slice(0,10)}, why do ${assets.reduce((n,a)=>n+a.different,0)} five-minute bars differ from aggregates of the matching one-minute bars? Compare timestamps, OHLC, share volume and both receipt clocks.`,
      'Do the two intervals use different trade conditions, revisions, volume definitions or finalization rules? Which documented dataset should be used for consistent ETF trend research?'
    ]};
}
