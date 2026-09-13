import {esc,words,dollars,timestamp,decimalText} from './model.js';
const amount=v=>v===null?'Unknown':dollars(v);
const metric=(r,key)=>r.metrics[key].value===null?words(r.metrics[key].status):decimalText(r.metrics[key].value);
const label=r=>[r.symbol??'Unknown ETF',r.expiry??'Unknown expiry',r.strike??'Unknown strike',r.type??'Unknown type'].join(' ');
export function contractSensitivity(r,context='candidate') {
  if(!r)return '';
  return '<details data-disclosure-key="sensitivity-'+esc(context+'-'+r.id)+'"><summary>Time and volatility sensitivity</summary>'+
    '<p><strong>'+esc(words(r.referenceStatus))+'</strong> · Source '+esc(timestamp(r.sourceAt))+' · Received '+esc(timestamp(r.receivedAt))+'</p>'+
    '<dl class="rationale-values">'+[['implied_volatility','IV (decimal)'],['delta','Delta / $1 ETF move'],['gamma','Gamma / $1 ETF move'],['theta','Theta / calendar day'],['vega','Vega / IV percentage point']].map(([key,title])=>'<div><dt>'+title+'</dt><dd>'+esc(metric(r,key))+'</dd></div>').join('')+'</dl>'+
    '<p class="hint">Reported model sensitivities per share; dollar changes below are for one 100-share long contract. IV 0.30 means 30%; 30% to 29% is a fall of one percentage point. Independent Greek timestamp: unknown.</p>'+
    r.scenarios.map(s=>'<section><h4>'+esc(s.label)+'</h4><p><strong>Local value change: '+amount(s.valueChangeUsd)+'</strong></p><p class="hint">Direction '+amount(s.components.deltaUsd)+' · Curvature '+amount(s.components.gammaUsd)+' · Time '+amount(s.components.timeUsd)+' · Volatility '+amount(s.components.volatilityUsd)+'</p>'+(s.blockers.length?'<p>'+esc(s.blockers.map(words).join(' · '))+'</p>':'')+'</section>').join('')+
    '<p class="hint">Frozen sensitivities, before costs. No future option price, fill or trade profit is estimated. These examples are unreliable for large moves and near expiry.</p></details>';
}
export function sensitivitiesPanel(component) {
  const d=component?.data;
  if(!d)return '<section class="card section-space"><h2>Time and volatility</h2><p>Saved option sensitivities unavailable: '+esc(component?.error??'No source view')+'.</p></section>';
  return '<section class="card section-space"><h2>Time and volatility</h2><p>A correct direction can still lose value when the move is slow or implied volatility falls. Compare the saved contract sensitivities below.</p>'+
    '<p><strong>'+d.coverage.allMetricsReported+' / '+d.coverage.selected+' selected contracts report all five values; '+d.coverage.withinQuoteTimeWindow+' have recent quote and receipt clocks before expiry day.</strong> Independent Greek timestamps remain unknown.</p><p class="hint">Open Time and volatility sensitivity on each candidate card for the component breakdown.</p>'+
    '<p class="hint">Capture '+esc(timestamp(d.capturedAt))+' · '+esc(words(d.captureOrigin))+' · '+esc(d.basis)+'</p>'+
    (d.rows.length?['GLD','IBIT',null].map(symbol=>{
      const rows=d.rows.filter(r=>r.symbol===symbol);if(!rows.length)return '';
      return '<details data-disclosure-key="sensitivity-compare-'+esc(symbol??'unknown')+'"><summary>'+esc(symbol??'Unknown ETF')+' · Compare '+rows.length+' selected contracts</summary><div class="table-scroll"><table><thead><tr><th>Contract</th><th>Reported IV</th><th>One day</th><th>IV down 1 point</th><th>Favorable $1 + one day + IV down 1 point</th><th>Reference quality</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(label(r))+'</td><td>'+(r.impliedVolatilityPercent===null?'Unknown':esc(decimalText(r.impliedVolatilityPercent))+'%')+'</td><td>'+amount(r.scenarios[0].valueChangeUsd)+'</td><td>'+amount(r.scenarios[1].valueChangeUsd)+'</td><td>'+amount(r.scenarios[2].valueChangeUsd)+'</td><td>'+esc(words(r.referenceStatus))+'<small>'+esc(timestamp(r.sourceAt))+'</small></td></tr>').join('')+'</tbody></table></div></details>';
    }).join(''):'<p>No saved selected contracts. Missing data cannot establish neutral exposure.</p>')+
    '<p class="hint">'+esc(d.limitation)+'</p><p><a href="'+esc(d.unitsSource)+'" target="_blank" rel="noreferrer">Robinhood: sensitivity units</a></p></section>';
}
