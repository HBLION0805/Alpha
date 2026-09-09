import {esc,words,timestamp,safeLink} from './model.js';

const list=items=>'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
const link=(url,title)=>{const u=safeLink(url);return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(title)+' ↗</a>':esc(title);};
export function goldFrameworkPanel(component) {
  const f=component?.state==='AVAILABLE'?component.data:null;
  if(!f)return '<section class="card section-space"><h2>Gold driver cross-check</h2><p class="hint">Framework unavailable. Missing evidence is not neutral.</p></section>';
  const title=id=>f.areas.find(a=>a.id===id)?.title??id;
  return '<section class="card section-space" id="gold-framework"><p class="eyebrow">GLD RESEARCH CHECKLIST</p><h2>Gold driver cross-check</h2>'+
    '<p>14 screenshot areas cross-referenced · 7 additional review checks. Original catalog: '+esc(f.originalCatalog.families)+' families / '+esc(f.originalCatalog.indicators)+' indicators.</p>'+
    '<div class="notice"><div>Review order changes with the question and horizon. These are declared priorities, not fitted weights or a detected market regime. Listed factors are not necessarily connected numerical feeds.</div></div>'+
    '<h3>Choose a review horizon</h3><div class="source-grid">'+f.profiles.map(p=>'<details class="source"><summary>'+esc(p.title)+'</summary><ol>'+p.order.map(id=>'<li>'+esc(title(id))+'</li>').join('')+'</ol></details>').join('')+'</div>'+
    '<h3>Factors, additions and actual coverage</h3><p class="hint">'+esc(f.counts.partialNumericalAreas)+' / '+esc(f.areas.length)+' checklist areas have partial numerical context in this saved view. This is not a completion or confidence score.</p>'+
    f.areas.map(a=>'<details class="headline"><summary>'+esc(a.screenshotArea===null?'Additional check':a.screenshotArea+'.')+' '+esc(a.title)+'</summary>'+
      '<p class="hint">Previous catalog: '+esc(words(a.priorCoverage))+' · '+esc(a.familyIds.join(', '))+'</p><h4>Explicit checks</h4>'+list(a.addedChecks)+'<p>'+esc(a.interpretation)+'</p>'+
      '<p><strong>Numerical evidence: '+esc(words(a.numericalCoverage))+'</strong></p>'+
      (a.numericEvidence?'<p>10Y real yield '+esc((a.numericEvidence.tenYearRealYieldBps/100).toFixed(2))+'% · Source date '+esc(a.numericEvidence.sourceDate)+' · Received '+esc(timestamp(a.numericEvidence.receivedAt))+'. Daily indicative observation; current intraday freshness is not established.</p>':'')+
      '<p class="hint">'+esc(a.gap)+'</p><h4>Saved news leads ('+esc(a.headlineLeadCount)+')</h4>'+
      (a.headlineLeads.length?a.headlineLeads.map(h=>'<p>'+link(h.url,h.headline)+'<br><small>'+esc(words(h.freshness))+' · Published '+esc(timestamp(h.publishedAt))+' · Received '+esc(timestamp(h.receivedAt))+' · Unverified lead</small></p>').join(''):'<p class="hint">No matching saved title. This does not establish that no event occurred.</p>')+
      '<p class="hint">References: '+a.references.map(id=>{const r=f.references.find(s=>s.id===id);return r?link(r.url,r.title):esc(id);}).join(' · ')+'</p></details>').join('')+
    '<details><summary>Scope and evidence limits</summary>'+list(f.limitations)+'<p>Saved market capture '+esc(timestamp(f.partialContext.marketCapturedAt))+'</p><p>'+esc(f.partialContext.marketUse)+'</p><p>Framework assessed '+esc(timestamp(f.assessedAt))+' · Reference review date '+esc(f.referenceReviewDate)+' (not market freshness)</p></details></section>';
}
