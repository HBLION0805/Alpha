import {esc,words,timestamp} from './model.js';

const price=v=>v===null||v===undefined?'—':'$'+Number(v).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
function candlePlot(series) {
  const plotted=series.slots.filter(s=>s.source&&s.status!=='INTERPOLATED');
  if(!plotted.length)return '<div class="candle-empty">No source candles to plot. Missing and interpolated intervals remain gaps.</div>';
  const min=Math.min(...plotted.map(s=>Number(s.source.low_price))),max=Math.max(...plotted.map(s=>Number(s.source.high_price)));
  const padding=Math.max((max-min)*0.08,0.005),lo=min-padding,hi=max+padding;
  const y=v=>130-(Number(v)-lo)/(hi-lo)*108,step=480/series.slots.length;
  const candles=series.slots.map((s,i)=>{
    const x=54+(i+0.5)*step,b=s.source;
    if(!b||s.status==='INTERPOLATED')return `<line class="candle-gap" x1="${x}" x2="${x}" y1="135" y2="141"><title>${esc(timestamp(s.beginsAt)+' · '+words(s.status))}</title></line>`;
    const unknown=s.status==='INTERPOLATION_UNKNOWN',cls=unknown?'candle-unknown':Number(b.close_price)>=Number(b.open_price)?'candle-up':'candle-down';
    return `<g class="${cls}"><title>${esc(timestamp(s.beginsAt)+' · '+words(s.status)+' · O '+b.open_price+' H '+b.high_price+' L '+b.low_price+' C '+b.close_price)}</title><line x1="${x}" x2="${x}" y1="${y(b.high_price)}" y2="${y(b.low_price)}"/><rect x="${x-step*0.28}" y="${Math.min(y(b.open_price),y(b.close_price))}" width="${step*0.56}" height="${Math.max(1,Math.abs(y(b.open_price)-y(b.close_price)))}"/></g>`;
  }).join('');
  return `<svg class="candle-plot" viewBox="0 0 550 154" role="img" aria-label="${esc(series.symbol+' '+series.type+' source OHLC, gray candles have unknown interpolation status. Full data in the table below.')}"><text x="2" y="25">${esc(price(max))}</text><text x="2" y="132">${esc(price(min))}</text>${candles}</svg>`;
}
export function candleSeriesCard(r) {
  const complete=r.status==='COMPLETE_DECLARED_OHLC',c=r.counts;
  const ret=r.windowReturnBps===null?'Unavailable':(Number(r.windowReturnBps.numerator)/Number(r.windowReturnBps.denominator)/100).toFixed(2)+'%';
  return `<article class="event-phase candle-series"><div class="status-line"><h3>${esc(r.symbol+' · '+r.expiry+' · '+Number(r.strike)+' '+r.type.toUpperCase())}</h3><span class="tag ${complete?'green':'amber'}">${complete?'Declared OHLC complete':'Provenance incomplete'}</span></div>
    <p class="hint">${esc(timestamp(r.startAt))} → ${esc(timestamp(r.endAt))} (end excluded) · ${esc(words(r.interval))}</p>
    <p class="candle-counts"><strong>${c.declaredNoninterpolated}</strong> explicitly noninterpolated · <strong>${c.unknown}</strong> unknown · <strong>${c.interpolated}</strong> interpolated · <strong>${c.missing}</strong> missing</p>
    ${candlePlot(r)}<p class="hint">Gray: raw source prices, interpolation unspecified. Colored: source explicitly declares noninterpolated. Ticks: excluded gaps. No connecting line across gaps.</p>
    <dl class="event-clocks"><dt>Complete-window price change</dt><dd>${esc(ret)}</dd><dt>Longest declared run</dt><dd>${r.longestDeclaredRun} bars</dd><dt>Source response received</dt><dd>${esc(timestamp(r.receivedAt))}</dd><dt>Saved locally</dt><dd>${esc(timestamp(r.recordedAt))}</dd></dl>
    ${r.blockers.length?'<ul class="blocker-list">'+r.blockers.map(b=>'<li>'+esc(words(b))+'</li>').join('')+'</ul>':''}
    <details><summary>All ${r.expectedSlotCount??0} interval slots and raw source prices</summary><div class="table-scroll"><table><thead><tr><th>New York</th><th>Evidence</th><th>Open</th><th>High</th><th>Low</th><th>Close</th></tr></thead><tbody>${r.slots.map(s=>'<tr><td>'+esc(timestamp(s.beginsAt))+'</td><td>'+esc(words(s.status))+'</td>'+['open_price','high_price','low_price','close_price'].map(k=>'<td>'+esc(s.source?.[k]??'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div></details></article>`;
}
export function barQualityPanel(component,loadedAt) {
  if(!component||component.state!=='AVAILABLE')return '<section class="card section-space"><h2>Option candle evidence</h2><p>Candle evidence is unavailable: '+esc(component?.error??'Not loaded')+'</p></section>';
  const desk=component.data,r=desk.latest;
  if(!r)return '<section class="card section-space"><h2>Option candle evidence</h2><p>No saved market-origin historical capture. Synthetic candles are excluded from this desk.</p></section>';
  const age=Math.max(0,Math.floor((Date.parse(loadedAt)-Math.max(...r.series.map(s=>Date.parse(s.receivedAt))))/60000));
  return `<section class="card section-space"><div class="card-head"><div><p class="eyebrow">SAVED OPTION HISTORY</p><h2>Option candle evidence</h2></div><span class="tag amber">${age} min since receipt</span></div>
    <p>These are option prices. ETF candle trends and VWAP are unavailable here. Missing interpolation flags stay unknown, even when prices change.</p>
    <div class="grid-equal">${r.series.map(candleSeriesCard).join('')}</div>
    <p class="hint">OHLC does not establish executable bid/ask prices, stop/target order, event causality or a trade signal. Exchange holidays and early closes remain unqualified. These retrospective histories do not fill prospective study windows.</p>
    <details><summary>Capture provenance and earlier records</summary><p class="hint">Latest saved historical capture: ${esc(r.captureId)}. ${desk.syntheticCaptures} synthetic captures excluded. Reopening this page reads local records; it does not refresh Robinhood.</p><pre>${esc(JSON.stringify({path:r.path,artifactSha256:r.artifactSha256,sourceSha256:r.sourceSha256,declaredOrigin:r.declaredOrigin,captures:desk.captures},null,2))}</pre></details></section>`;
}
