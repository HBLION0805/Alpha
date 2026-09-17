import {esc,words,cents,timestamp,safeLink} from './model.js';
const money=n=>n===null||n===undefined?'Unknown':cents(n);
const list=items=>items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="hint">No current attributed evidence.</p>';
function buyerBoundaryPanel(b,symbol) {
  if(!b)return '';
  return '<details data-disclosure-key="decision-buyer-'+esc(symbol)+'"><summary>Buyer entry rules · '+esc(words(b.status))+'</summary>'+
    '<p>'+esc(b.scope)+'</p><p class="hint">'+esc(b.sampledContractCount)+' sampled contracts · '+esc(b.expiryCounts.RESEARCH_14_TO_45)+' within 14–45 DTE · '+esc(b.expiryCounts.ZERO_DTE)+' same-day expiry. '+esc(b.expiryCoverage)+'</p>'+
    '<p><strong>Confirm on '+esc(b.requiredUnderlying)+':</strong> '+esc(b.proxyBoundary)+'</p>'+
    b.setups.map(s=>'<h4>'+esc(s.label)+' · '+esc(words(s.status))+'</h4><p>'+esc(s.confirmation)+'</p><p><strong>Invalidation:</strong> '+esc(s.invalidation)+'</p>').join('')+
    '<h4>Missing evidence</h4>'+list(b.missingEvidence)+'<p>'+esc(b.optionChecks)+'</p><p>'+esc(b.eventBoundary)+'</p><p class="hint">'+esc(b.validation)+' No win rate or doubling probability is established.</p></details>';
}
export function decisionCardsPanel(component) {
  const d=component?.data;
  if(!d)return '<section class="card section-space"><h2>Today’s decision</h2><p>Decision cards unavailable. Check source health before acting.</p></section>';
  return '<section class="section-space decision-desk" aria-label="Daily decision cards"><div class="card-head"><div><h2>Today’s decision</h2><p>Current action first. Reference contracts and cost examples remain conditional.</p></div></div>'+
    '<div class="decision-health">'+(d.session?.knownYear?(d.session.isOpen?'Regular session open':'Regular session closed'):'Session status unknown')+' · Analysis '+esc(timestamp(d.analysisAt))+' · '+(d.reviewCurrent?'Current review':'Review needs refresh')+' · '+d.sourceHealth.filter(s=>s.status==='OK'&&s.refreshOverdue===false).length+' / '+d.sourceHealth.length+' news sources within refresh window · '+d.sourceHealth.filter(s=>s.partial===true).length+' partial feeds</div>'+
    '<div class="grid-two grid-equal">'+d.cards.map(c=>'<article class="card guidance-asset"><div class="status-line"><h2>'+esc(c.symbol)+'</h2><span class="tag '+(c.action==='WATCH'?'amber':'blue')+'">'+esc(words(c.action))+'</span></div>'+
      '<p><strong>'+esc(words(c.bias))+'</strong> · Saved ETF $'+esc(c.price?.price??'Unknown')+'<br><small>Price clock '+esc(timestamp(c.price?.sourceAt))+'</small></p><p>'+esc(c.summary)+'</p>'+
      (c.blockers.length?'<p class="error-text">Wait: '+esc(c.blockers.slice(0,3).map(words).join(' · '))+'</p>':'')+
      '<details data-disclosure-key="decision-evidence-'+esc(c.symbol)+'"><summary>Supporting and opposing evidence</summary><h4>Supporting</h4>'+list(c.supporting)+'<h4>Opposing</h4>'+list(c.opposing)+
      '<ul>'+c.sources.map(s=>{const url=safeLink(s.url);return url?'<li><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a></li>':'';}).join('')+'</ul></details>'+
      '<p><strong>Entry:</strong> '+esc(c.entryCondition)+'</p>'+
      buyerBoundaryPanel(c.buyerEntryBoundary,c.symbol)+
      (c.references.length?c.references.map(x=>{const q=x.contract,e=x.costExample;return '<div class="decision-reference"><strong>'+esc(q.expiry+' · $'+q.strike+' '+q.type.toUpperCase())+'</strong><p class="hint">Reference only · '+esc(words(x.disposition))+'<br>Quote '+esc(timestamp(q.updatedAt))+'</p>'+
        '<div class="guidance-prices"><span>Ask / share<strong>'+money(q.askCents)+'</strong></span><span>Stop / share<strong>'+money(x.plan.stopTriggerCents)+'</strong></span><span>Net target / share<strong>'+money(x.plan.targetExitCents)+'</strong></span></div>'+
        (e?'<details data-disclosure-key="decision-cost-'+esc(q.id)+'"><summary>Dated-fee example: target '+money(e.targetPerShareCents)+' / share</summary><p>One contract · premium '+money(e.premiumCents)+' · fee reserve '+money(e.feeReserveCents)+' · one-tick exit allowance '+money(e.exitAllowanceCents)+' · planned risk '+money(e.plannedRiskCents)+' · net target '+money(e.netTargetCents)+'.</p><p>Estimated fees reviewed '+esc(timestamp(e.profile.reviewedAt))+'. Account and trade-date applicability unverified. This example does not change the action or fill missing global costs. Stops are not guaranteed.</p>'+list(e.blockers.map(words))+'</details>':'')+
        '<button class="button secondary small" data-guidance-plan="'+esc(q.id)+'">Inspect contract and full checks</button></div>';}).join(''):'<p class="notice">'+esc(c.noContractReason)+'</p>')+
      '<details data-disclosure-key="decision-exit-'+esc(c.symbol)+'"><summary>Event, invalidation and time exit</summary><p>'+esc(c.eventPlan)+'</p><p>'+esc(c.invalidation)+'</p><p>'+esc(c.timeExit)+'</p></details></article>').join('')+'</div>'+
    '<p class="hint">No calibrated win probability. Quotes are snapshots; the page refresh does not collect brokerage data. Actual orders remain manual.</p></section>';
}
