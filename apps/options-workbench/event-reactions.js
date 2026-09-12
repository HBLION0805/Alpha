import {esc,words,dollars,timestamp} from './model.js';

const note=text=>'<div class="notice"><div>'+text+'</div></div>';
const gap=seconds=>seconds===null?'Unknown':(seconds/60).toLocaleString('en-US',{maximumFractionDigits:2})+' min';
const point=p=>p?dollars(p.priceUsd)+'<small>'+esc(timestamp(p.sourceAt))+'</small>':'No eligible observation';
export function eventReactionPanel(component) {
  const r=component?.data;
  const heading='<section class="card section-space"><h2>Event expectations and observed ETF prices</h2>';
  if(!r)return heading+note('Event comparison unavailable: '+esc(component?.error??'No saved view')+'. Original guidance and its checks remain separate.')+'</section>';
  return heading+'<p>Last saved price before the scheduled time, followed by the last observation within 30 and 120 minutes. Each window shows its actual sample time; these are not exact 30-/120-minute returns or continuous candles. This is a current retrospective view; a paper plan keeps its own frozen observation cutoff.</p>'+
    '<p class="hint">'+esc(r.fromDate)+' – '+esc(r.throughDate)+' · Assessed '+esc(timestamp(r.assessedAt))+' · '+esc(r.coverage)+'</p>'+
    '<ul>'+Object.entries(r.sources??{}).map(([id,s])=>'<li>'+esc(id)+' · '+esc(words(s.state))+' / '+esc(words(s.status))+' · Received '+esc(timestamp(s.receivedAt))+(s.refreshOverdue?' · Refresh overdue':'')+(s.error?' · '+esc(words(s.error)):'')+'</li>').join('')+'</ul>'+
    note('Price changes do not establish why the market moved. A general pre-event view remains <strong>not tested</strong>; option returns, release values, surprise and technical confirmation are unknown.')+
    (r.events.length?r.events.map(e=>'<details data-disclosure-key="event-reaction-'+esc(e.key)+'" open><summary>'+esc(e.title)+' · '+esc(e.scheduledAt?timestamp(e.scheduledAt):e.startDate+' – '+e.endDate)+' · '+esc(words(e.timingState))+'</summary>'+
      '<p class="hint">Calendar received '+esc(timestamp(e.calendarReceivedAt))+' · '+esc(words(e.calendarTiming))+'. Scheduled time is not verification that the release occurred.</p>'+
      (e.confounders.length?note('Other listed events in the comparison neighborhood: '+e.confounders.map(c=>esc(c.title)).join('; ')+'. Unscheduled influences are not covered.'):'')+
      e.assets.map(a=>'<div class="section-space"><h3>'+esc(a.symbol)+'</h3>'+
        '<p><strong>Pre-event view:</strong> '+(a.priorView?esc(words(a.priorView.bias))+' · '+esc(timestamp(a.priorView.assessedAt))+' · '+esc(a.priorView.summary):'No eligible attributed note saved before this event.')+'</p>'+
        '<p class="hint">Baseline '+esc(gap(a.baselineGapSeconds))+' before the event · '+esc(words(a.baselineCoverage))+(a.baselineCoverage==='WIDE_OR_OVERNIGHT_BASELINE'?'. This includes a wide or overnight interval; it cannot isolate the event effect.':'.')+'</p>'+
        '<div class="table-scroll"><table><thead><tr><th>Window</th><th>Pre-event last trade</th><th>Last observed after scheduled time</th><th>ETF price change</th><th>Evidence state</th></tr></thead><tbody>'+a.windows.map(w=>'<tr><td>Through '+w.minutes+' min<small>'+esc(words(w.state))+'</small></td><td>'+point(a.baseline)+'</td><td>'+point(w.post)+'<small>Offset '+esc(gap(w.postOffsetSeconds))+' · '+w.eligiblePostObservations+' distinct observation(s)</small>'+(w.postSavedAfterWindow?'<small>Saved after this window ended; retrospective context only.</small>':'')+'</td><td>'+(w.comparisonAvailable?dollars(w.priceChangeUsd)+' / '+esc(w.percentChange)+'%<small>'+esc(words(w.direction))+' · Sample gap '+esc(gap(w.sampleGapSeconds))+'</small>':'Unknown')+'</td><td>'+esc(words(w.missingReason??'OBSERVED_CHANGE_ONLY'))+'<small>'+esc(words(w.priorBiasComparison))+' · Hypothesis not tested</small></td></tr>').join('')+'</tbody></table></div></div>').join('')+
      '<details data-disclosure-key="event-reaction-evidence-'+esc(e.key)+'"><summary>Exact selected observations and clocks</summary><pre>'+esc(JSON.stringify(e,null,2))+'</pre></details></details>').join(''):note('No selected events in the current saved calendar window. This does not establish an event-free market.'))+
    '<details data-disclosure-key="event-reaction-exclusions"><summary>Coverage and excluded observations</summary><p>'+esc(r.interpretation)+'</p><pre>'+esc(JSON.stringify({observations:r.observations,exclusions:r.exclusions,notesRead:r.notesRead,framesRead:r.framesRead},null,2))+'</pre></details></section>';
}
