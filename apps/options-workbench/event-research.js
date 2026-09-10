import {esc,words,cents,timestamp} from './model.js';
import {barQualityPanel} from './bar-quality.js';
const money=v=>v===null||v===undefined?'Pending / unknown':cents(v);
const quoteLabel=q=>`${q.symbol} · ${q.expiry} · ${q.strike} ${q.type.toUpperCase()}`;
const key=e=>[e.source,e.scheduledAt,e.title].join('|');
function nyUtc(date,hour,minute) {
  const target=Date.parse(date+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00Z');
  let guess=target+4*3600000;
  for(let i=0;i<3;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));const displayed=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);guess+=target-displayed;}
  return new Date(guess).toISOString().slice(0,16);
}
export function eventDraft(state,id='event-'+crypto.randomUUID()) {
  const g=state.guidance?.data,quotes=g?.input?.quotes??[],events=(g?.current?.events??[]).filter(e=>e.scheduledAt&&e.scheduledAt>state.loadedAt&&e.major);
  const event=events[0],eligible=quotes.filter(q=>event&&(Date.parse(q.expiry)-Date.parse(event.startDate))/86400000>=14&&(Date.parse(q.expiry)-Date.parse(event.startDate))/86400000<=45);
  const pre=eligible.find(q=>q.symbol==='GLD'&&q.type==='call')??quotes[0],call=eligible.find(q=>q.symbol==='IBIT'&&q.type==='call')??eligible.find(q=>q.type==='call'),put=quotes.find(q=>q.type==='put'&&q.symbol===call?.symbol&&q.expiry===call?.expiry);
  let day=event?.startDate,prior='';
  if(day){let d=new Date(Date.parse(day+'T12:00:00Z')-86400000);while([0,6].includes(d.getUTCDay()))d=new Date(d.getTime()-86400000);prior=d.toISOString().slice(0,10);}
  return {id,title:'Inflation anticipation and reaction',eventKey:event?key(event):'',capturePath:g?.sourcePaths?.[0]??'',settings:g?.input?.settings??null,
    preContractId:pre?.id??'',postCallId:call?.id??'',postPutId:put?.id??'',minimumMoveBps:'20',
    preEntryAt:prior?nyUtc(prior,12,40):'',preExitAt:prior?nyUtc(prior,15,40):'',postEntryAt:day?nyUtc(day,9,40):'',postExitAt:day?nyUtc(day,15,40):''};
}
export function eventRequest(d) {
  const result={...d};
  for(const k of ['preEntryAt','preExitAt','postEntryAt','postExitAt']){
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(d[k]))throw Error('Enter all observation window starts in UTC.');
    result[k]=d[k]+':00.000Z';
  }
  if(!/^\d+$/.test(String(d.minimumMoveBps)))throw Error('The reaction threshold must be a whole number of basis points.');
  result.minimumMoveBps=Number(d.minimumMoveBps);return result;
}
function status(s){return `<span class="tag ${['OBSERVED','REFERENCE_COMPLETE','ACCEPTED_REFERENCE'].includes(s)?'green':'amber'}">${esc(words(s))}</span>`;}
function phaseCard(p,plan){
  const prefix=p.name==='PRE'?'pre':'post';
  return `<article class="event-phase"><div class="status-line"><h3>${p.name==='PRE'?'Before the release':'After the release'}</h3>${status(p.status)}</div>
    <p>${p.contract?esc(quoteLabel(p.contract)):'No reaction contract selected yet'}</p><dl class="event-clocks">
    <dt>Planned entry window</dt><dd>${esc(timestamp(plan[prefix+'EntryAt']))} · 20 minutes</dd>
    <dt>Planned exit window</dt><dd>${esc(timestamp(plan[prefix+'ExitAt']))} · 20 minutes</dd>
    <dt>Entry observation</dt><dd>${esc(timestamp(p.entry.frame?.capturedAt))} · ${esc(words(p.entry.status))}</dd>
    <dt>Exit observation</dt><dd>${esc(timestamp(p.exit.frame?.capturedAt))} · ${esc(words(p.exit.status))}</dd>
    <dt>Ask → bid reference</dt><dd>${money(p.entry.quote?.askCents)} → ${money(p.exit.quote?.bidCents)} per share</dd>
    <dt>Net endpoint reference</dt><dd>${money(p.netReferencePnlCents)}</dd></dl>
    <p class="hint">Not an actual fill. Stops and targets between snapshots are unobserved.</p>
    ${p.blockers.length?'<ul class="blocker-list">'+p.blockers.map(b=>'<li>'+esc(words(b))+'</li>').join('')+'</ul>':''}</article>`;
}
function studyCard(r){
  const blocked=r.selectionDiagnostics?.some(d=>d.blockers.length);
  return `<section class="card section-space event-study"><div class="card-head"><div><p class="eyebrow">FROZEN EXPERIMENT · ${esc(r.plan.id)}</p><h2>${esc(r.plan.title)}</h2><p>${esc(r.plan.event.title)} · ${esc(timestamp(r.plan.event.scheduledAt))}</p></div><button class="button secondary small" data-event-save="${esc(r.plan.id)}">Save evidence snapshot</button></div>
    <p class="hint">Registered ${esc(timestamp(r.plan.createdAt))}. Independent counterfactual account; not an allocation across all studies.</p>
    ${blocked?'<div class="notice error"><div><strong>Selection does not qualify for an entry.</strong> The saved contract/cost assumptions fail one or more checks. This experiment observes a hypothesis; it is not a trade recommendation.</div></div>':''}
    <div class="grid-equal">${r.phases.map(p=>phaseCard(p,r.plan)).join('')}</div>
    <div class="notice"><div>Shared planned-loss allowance: <strong>${r.eventRisk.legacyLossCapsEnforced===false?'Not capped':money(r.eventRisk.plannedLossBudgetCents)}</strong> · Full-loss stress allowance: <strong>${r.eventRisk.legacyLossCapsEnforced===false?'Not capped':money(r.eventRisk.fullLossStressBudgetCents)}</strong>. ${r.eventRisk.legacyLossCapsEnforced===false?'Legacy caps removed for this frozen plan. Previous losses remain recorded.':'Previous losses consume the allowance.'} Sale proceeds are not assumed settled.</div></div>
    <div class="table-scroll"><table><thead><tr><th>Comparison</th><th>Assessment</th><th>Net reference</th><th>Loss allowance left</th></tr></thead><tbody>${r.comparisons.map(c=>`<tr><td>${esc(words(c.mode))}</td><td>${status(c.status)}</td><td>${money(c.netReferencePnlCents)}</td><td>${r.eventRisk.legacyLossCapsEnforced===false?'Not capped':money(c.remainingEventLossCents)}</td></tr>`).join('')}</tbody></table></div>
    <details><summary>Selection checks at registration</summary><ul>${(r.selectionDiagnostics??[]).map(d=>'<li>'+esc(quoteLabel(d.contract))+' · one-contract ask '+money(d.contract.askCents===null?null:d.contract.askCents*100)+' · '+esc(d.blockers.length?d.blockers.map(words).join('; '):'No budget blocker at selection; future quotes still required')+'</li>').join('')}</ul></details>
    <details><summary>Risk decisions and original observation clocks</summary><pre>${esc(JSON.stringify({reaction:r.reaction,comparisons:r.comparisons},null,2))}</pre></details>
    <h3>Candidate process lessons</h3><ul>${r.candidateLessons.map(l=>`<li>${esc(l.text)}</li>`).join('')}</ul><p class="hint">0 actual trades · No calibrated probability · Candidate notes do not change a strategy.</p></section>`;
}
export function eventResearchPage(s,ui={}) {
  const head='<div class="page-heading"><div><p class="eyebrow">ONE EVENT, TWO DECISIONS</p><h1>Event research</h1><p class="subtitle">Compare anticipation and reaction with one shared risk allowance.</p></div></div>';
  const g=s.guidance?.data,desk=s.eventResearch;
  if(!g)return head+'<div class="empty"><h2>Guidance evidence unavailable</h2><p>Save a verified market capture and restore calendar coverage before registering an experiment.</p></div>';
  if(!ui.eventDraft){ui.eventDraft=eventDraft(s);ui.eventChoices={capturedAt:g.current.marketCapturedAt,quotes:structuredClone(g.input.quotes),events:structuredClone(g.input.events.filter(e=>e.scheduledAt&&e.scheduledAt>s.loadedAt))};}
  const d=ui.eventDraft,choice=ui.eventChoices;
  const select=(name,label,entries)=>`<label class="form-field">${label}<select name="${name}" required><option value="">Choose…</option>${entries.map(([v,t])=>`<option value="${esc(v)}"${d[name]===v?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  return head+'<div class="notice"><div><strong>Prospective quote-reference research.</strong> Freeze the rules before collecting outcomes. Scheduled snapshots do not establish candle trends, stop fills or executable returns.</div></div>'+barQualityPanel(s.barQuality,s.loadedAt)+
    `<details class="card section-space" ${desk?.data?.studies?.length?'':'open'}><summary>Register a future event experiment</summary><form id="event-research-form"><div class="form-grid">`+
    `<label class="form-field full">Experiment name<input name="title" value="${esc(d.title)}" maxlength="160" required></label>`+
    select('eventKey','Saved official event',choice.events.map(e=>[key(e),e.title+' · '+timestamp(e.scheduledAt)]))+
    `<label class="form-field">Minimum reaction (basis points)<input name="minimumMoveBps" type="number" min="1" max="1000" step="1" value="${esc(d.minimumMoveBps)}" required><small>20 bps = 0.20%. A hypothesis, not a validated threshold.</small></label>`+
    select('preContractId','Before event: chosen contract',choice.quotes.map(q=>[q.id,quoteLabel(q)]))+
    select('postCallId','After event: call alternative',choice.quotes.filter(q=>q.type==='call').map(q=>[q.id,quoteLabel(q)]))+
    select('postPutId','After event: put alternative',choice.quotes.filter(q=>q.type==='put').map(q=>[q.id,quoteLabel(q)]))+
    ['preEntryAt','preExitAt','postEntryAt','postExitAt'].map(k=>`<label class="form-field">${esc(({preEntryAt:'PRE entry',preExitAt:'PRE exit',postEntryAt:'POST entry',postExitAt:'POST exit'})[k])} window starts (UTC)<input type="datetime-local" name="${k}" value="${esc(d[k])}" required><small>First usable snapshot within the next 20 minutes.</small></label>`).join('')+
    '</div><p class="hint">PRE exits before release. POST starts at least 30 minutes after release. Choose matching POST underlying and expiry. Review the UTC windows; defaults do not verify exchange holidays. One contract per phase, with the current declared costs and original risk limits frozen.</p>'+
    `<p class="hint">Selection quotes: ${esc(timestamp(choice.capturedAt))}. Fee allowance ${money(d.settings?.roundTripFeesCents)}; slippage reserve ${money(d.settings?.slippageReserveCents)}. Change cost assumptions in Daily guidance, then reset this draft.</p>`+
    '<p id="event-research-error" class="form-error" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">Freeze research plan</button><button class="button secondary" type="button" id="reset-event-research">Reset draft</button></div></form></details>'+
    (desk?.state!=='AVAILABLE'?'<div class="notice error"><div>Research store unavailable: '+esc(desk?.error??'Unknown')+'</div></div>':desk.data.studies.length?desk.data.studies.map(studyCard).join(''):'<div class="empty"><h2>No frozen experiments yet</h2><p>Register a future event to start collecting evidence. No retrospective winning example is preloaded.</p></div>');
}
