import type { EtfResearchBar, EtfResearchBars } from '../../contracts/OptionsEtfSetup';
import { etfMicroUsd, validateEtfBars } from '../options-daily-guidance/OptionsEtfSetup';
import { paperSession } from './RobinhoodPaperSession';
import { guidanceLocal } from '../options-daily-guidance/OptionsGuidanceClock';

function fail(code: string): never { throw Error('ETF_SOURCE_' + code); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('OBJECT');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string) {
  if (Object.keys(value).sort().join() !== keys.split(',').sort().join()) fail('FIELDS');
}
function stamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return fail('CLOCK');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0,19) !== value.slice(0,19)) return fail('CLOCK');
  return new Date(parsed).toISOString();
}
function price(value: unknown): string {
  if (typeof value !== 'string') return fail('PRICE');
  try { etfMicroUsd(value); } catch { return fail('PRICE'); }
  return value;
}
function shareVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1e9) return fail('VOLUME');
  return value;
}
const priceString = (v: bigint) => `${v / 1000000n}.${(v % 1000000n).toString().padStart(6,'0')}`;

/** Maps the observed official tool contract. Missing interpolation flags never become false. */
export function assessRobinhoodEtfBars(input: unknown, assessedAt: string) {
  const capture=object(input); exact(capture,'tool,request,requestedAt,receivedAt,response');
  if (capture.tool !== 'get_equity_historicals') fail('TOOL');
  const at=stamp(assessedAt), requestedAt=stamp(capture.requestedAt), receivedAt=stamp(capture.receivedAt);
  if (requestedAt>receivedAt || receivedAt>at) fail('RECEIPT_CLOCK');
  const request=object(capture.request); exact(request,'symbols,start_time,end_time,interval,bounds,adjustment_type');
  if (request.interval!=='5minute' || request.bounds!=='regular' || request.adjustment_type!=='none') fail('REQUEST_SCOPE');
  if (!Array.isArray(request.symbols) || !request.symbols.length || request.symbols.length>2 || request.symbols.some(s=>s!=='GLD'&&s!=='IBIT') || new Set(request.symbols).size!==request.symbols.length) fail('SYMBOLS');
  const symbols=request.symbols as Array<'GLD'|'IBIT'>;
  const start=stamp(request.start_time), end=stamp(request.end_time), startMs=Date.parse(start), endMs=Date.parse(end);
  const session=paperSession(start,undefined);
  if (!session.isOpen || startMs%300000 || endMs%300000 || endMs<=startMs || endMs-startMs>86400000 ||
      guidanceLocal(new Date(endMs-1).toISOString()).date!==session.date || guidanceLocal(new Date(endMs-1).toISOString()).minute>=session.closeMinute) fail('REQUEST_WINDOW');
  const response=object(capture.response);
  if (response.isError===true) fail('TOOL_ERROR');
  const data=object(object(response.structuredContent).data);
  if (data.results!==null && !Array.isArray(data.results)) fail('RESULTS');
  const results=(data.results??[]) as unknown[];
  if (results.length>symbols.length) fail('IDENTITY');
  const missing=data.not_found??[];
  if (!Array.isArray(missing) || missing.some(s=>!symbols.includes(s)) || new Set(missing).size!==missing.length) fail('NOT_FOUND');
  const bySymbol=new Map<string,Record<string,unknown>>();
  for (const raw of results) {
    const result=object(raw), symbol=result.symbol;
    if (typeof symbol!=='string' || !symbols.includes(symbol as 'GLD'|'IBIT') || bySymbol.has(symbol) || missing.includes(symbol)) fail('IDENTITY');
    bySymbol.set(symbol,result);
  }
  const assets=symbols.map(symbol=>{
    const result=bySymbol.get(symbol), blockers:string[]=[], rows:Array<{bar:EtfResearchBar|null;sourceStart:string|null;issues:string[]}>=[];
    if (!result) blockers.push(missing.includes(symbol)?'SYMBOL_NOT_FOUND':'RESULT_OMITTED');
    if (result && (result.interval!=='5minute'||result.bounds!=='regular')) blockers.push('RESPONSE_SCOPE_MISMATCH');
    if (result && result.bars!==null && !Array.isArray(result.bars)) fail('BARS');
    const rawBars=(result?.bars??[]) as unknown[];
    if(rawBars.length>1000) fail('BAR_LIMIT');
    if(result&&!rawBars.length)blockers.push('EMPTY_BARS');
    const expected=(endMs-startMs)/300000;
    if(rawBars.length!==expected)blockers.push('BAR_COUNT_MISMATCH');
    for (const [index,raw] of rawBars.entries()) {
      const issues:string[]=[]; let bar:EtfResearchBar|null=null,sourceStart:string|null=null;
      try {
        const b=object(raw); sourceStart=typeof b.begins_at==='string'?b.begins_at:null;
        const begin=stamp(b.begins_at), beginMs=Date.parse(begin), finish=new Date(beginMs+300000).toISOString();
        if(beginMs!==startMs+index*300000 || beginMs<startMs || Date.parse(finish)>endMs)issues.push('GRID_OR_ORDER_MISMATCH');
        if(b.session!=='reg')issues.push('SESSION_UNKNOWN_OR_NONREGULAR');
        if(b.interpolated!==undefined && typeof b.interpolated!=='boolean')issues.push('INTERPOLATION_FLAG_INVALID');
        const interpolated=typeof b.interpolated==='boolean'?b.interpolated:null;
        if(interpolated===null)issues.push('INTERPOLATION_UNKNOWN');
        if(interpolated===true)issues.push('INTERPOLATED_BAR');
        const open=price(b.open_price),high=price(b.high_price),low=price(b.low_price),close=price(b.close_price),volume=shareVolume(b.volume);
        const [o,h,l,c]=[open,high,low,close].map(etfMicroUsd);
        if(h!<l!||o!<l!||o!>h!||c!<l!||c!>h!)issues.push('INVALID_OHLC');
        if(interpolated===true&&volume!==0)issues.push('INTERPOLATED_VOLUME_CONFLICT');
        const complete=finish<=requestedAt;
        if(!complete)issues.push('BAR_NOT_COMPLETE_AT_REQUEST');
        bar={start:begin,end:finish,open,high,low,close,volume,complete,interpolated};
      } catch(e) {issues.push(e instanceof Error&&/^ETF_SOURCE_[A-Z_]+$/.test(e.message)?e.message:'INVALID_BAR');}
      rows.push({bar,sourceStart,issues});
    }
    blockers.push(...rows.flatMap(r=>r.issues));
    const unique=[...new Set(blockers)];
    const bars=rows.flatMap(r=>r.bar?[r.bar]:[]);
    const envelope:EtfResearchBars={version:'OPTIONS_ETF_BARS_V1',symbol,intervalMinutes:5,currency:'USD',session:'REGULAR',adjustment:'RAW',volumeUnit:'SHARES',source:'Robinhood get_equity_historicals: captured request/response',receivedAt,windowStart:start,windowEnd:end,bars};
    let normalized:EtfResearchBars|null=null;
    if(!unique.length){validateEtfBars(envelope,at);normalized=envelope;}
    // Unknown flags do not erase received prices, but exclude them from qualified calculations.
    const descriptiveOnly=unique.every(v=>v==='INTERPOLATION_UNKNOWN');
    let observations=null;
    if(bars.length && descriptiveOnly){
      const first=bars[0]!,last=bars.at(-1)!,open=etfMicroUsd(first.open),close=etfMicroUsd(last.close);
      const high=bars.reduce((v,b)=>etfMicroUsd(b.high)>v?etfMicroUsd(b.high):v,open),low=bars.reduce((v,b)=>etfMicroUsd(b.low)<v?etfMicroUsd(b.low):v,open);
      observations={firstBarOpen:first.open,lastBarClose:last.close,high:priceString(high),low:priceString(low),volume:bars.reduce((v,b)=>v+b.volume,0),
        openToLastCloseBps:Number((close-open)*10000n/open),direction:close>open?'UP':close<open?'DOWN':'UNCHANGED',
        officialDailyClose:false,meaning:'Returned window only. Open-to-last-bar-close change; not a qualified trend or official daily close.'};
    }
    return {symbol,status:normalized?'LOCALLY_VALIDATED_UNQUALIFIED_EXPORT':'QUALITY_BLOCKED',requestedAt,receivedAt,windowStart:start,windowEnd:end,
      expectedBars:expected,returnedBars:rawBars.length,normalizedBars:bars.length,unknownInterpolation:rows.filter(r=>r.bar?.interpolated===null).length,
      interpolatedBars:rows.filter(r=>r.bar?.interpolated===true).length,blockers:unique,rows,observations,normalized,
      provenance:'COPIED_HOST_RESPONSE_NOT_INDEPENDENTLY_AUTHENTICATED',sourceQualified:false,setupInputAutomaticallyInstalled:false};
  });
  return {version:'OPTIONS_ROBINHOOD_ETF_BARS_REPORT_V1',assessedAt:at,requestedAt,receivedAt,assets,
    completionMeaning:'Elapsed bar window at request; upstream finality is not independently certified.',executionAllowed:false,changesCanonicalGuidance:false};
}
