import {esc,words,timestamp} from './model.js';
import {registerDefaults} from './forms.js';
import {thesisDefaults} from './trade-thesis.js';

export function prepareOwnerPlanDraft(row,tradeId){
  if(!row?.draftSeed||!row.contract?.id)throw Error('Owner plan reference unavailable.');
  return {thesisFields:{...registerDefaults(),...structuredClone(row.draftSeed),tradeId},
    thesisDraft:thesisDefaults()};
}
export function ownerPlanPanel(component){
  const d=component?.data;
  if(!d)return '<section class="card section-space"><h2>Prepare an Owner plan</h2><p>Current evidence unavailable. No plan has been prepared.</p></section>';
  return '<section class="card section-space"><h2>Evidence to Owner plan</h2><p>Research rule matches and trade qualification are separate. Choose a reference to prepare an incomplete plan; review and freeze through the existing planner.</p>'+
    d.noCandidateSymbols.map(x=>'<p>'+esc(x.symbol)+': '+esc(x.reason)+'</p>').join('')+
    d.rows.map(r=>'<article class="section-space"><h3>'+esc(r.symbol+' '+r.contract.expiry+' '+r.contract.strike+' '+r.contract.type)+'</h3>'+
      '<p>Pending Owner preparation · Capture '+esc(timestamp(r.lineage.marketCapturedAt))+' · Analysis '+esc(timestamp(r.lineage.analysisAt))+'</p>'+
      '<div class="table-scroll"><table><thead><tr><th>Check</th><th>Current evidence</th></tr></thead><tbody>'+
      Object.entries(r.gates).map(([k,v])=>'<tr><td>'+esc(k.replace(/([A-Z])/g,' $1'))+'</td><td>'+esc(v===true?'Yes':v===false?'No':'Unknown')+'</td></tr>').join('')+'</tbody></table></div>'+
      '<p>Research setup: '+esc(words(r.research.status))+' · Trigger '+esc(timestamp(r.research.triggerAt))+'. Source remains unqualified; no entry approval.</p>'+
      '<details><summary>All remaining conditions ('+r.blockers.length+')</summary><ul>'+r.blockers.map(b=>'<li><code>'+esc(b)+'</code></li>').join('')+'</ul></details>'+
      '<p>Saved matching draft: '+esc(r.savedPlan.tradeId??'None / ambiguous')+'. Model fees are not confirmed brokerage charges.</p>'+
      '<button class="button secondary" data-owner-plan="'+esc(r.contract.id)+'">Prepare incomplete Owner draft</button></article>').join('')+
    '<p class="hint">No declaration time, entry limit, stop, target or deadline is supplied. Saving and freezing require separate Owner actions. Refresh does not collect new market data.</p></section>';
}
