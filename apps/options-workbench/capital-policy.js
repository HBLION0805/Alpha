import {esc,cents,decimalInteger} from './model.js';
import {tradeBudgetFromFields} from './forms.js';
const money=v=>v===null||v===undefined?'Unknown':cents(v);
export function policySettingsFromFields(d) {
  return {currentEquityCents:decimalInteger(d.currentEquityCents),settledCashCents:decimalInteger(d.settledCashCents),
    roundTripFeesCents:decimalInteger(d.roundTripFeesCents,2,true),slippageReserveCents:decimalInteger(d.slippageReserveCents,2,true),
    stopLossBps:Number(d.stopLossBps),rewardMultipleMilliR:Number(d.rewardMultipleMilliR),...tradeBudgetFromFields(d)};
}
export function capitalPolicyMatches(a,b) {
  const values=s=>['currentEquityCents','settledCashCents','roundTripFeesCents','slippageReserveCents','stopLossBps','rewardMultipleMilliR'].map(k=>s?.[k]).concat([s?.tradeBudget?.version,s?.tradeBudget?.minCents,s?.tradeBudget?.maxCents]);
  return JSON.stringify(values(a))===JSON.stringify(values(b));
}
export function capitalPolicyPanel(r,{preview=false,compact=false}={}) {
  if(!r)return preview?'<p class="hint">Preview the form to inspect capital constraints without saving.</p>':'<div class="notice error"><div>Capital preflight unavailable. Saved assumptions have not been checked here.</div></div>';
  const conflict=r.status==='CONFLICTING_CONSTRAINTS';
  return '<section class="card section-space capital-policy"><div class="card-head"><div><h2>'+(preview?'Unsaved capital preflight':'Capital policy preflight')+'</h2><p>'+(preview?'Form preview only. Saved settings remain unchanged.':'Saved Daily guidance assumptions. Planner edits and cost-desk comparisons are separate.')+'</p></div><span class="tag '+(conflict?'red':'gray')+'">'+(conflict?'Conflicting limits':'Capital checks only')+'</span></div>'+
    '<p><strong>'+(conflict?'No trade can meet these capital constraints together.':'No conflict is proven by these capital bounds; all contract and trading checks still apply.')+'</strong></p>'+
    '<p>Allocation '+(r.allocation.minimumCents===null?'up to '+money(r.allocation.maximumCents):money(r.allocation.minimumCents)+'–'+money(r.allocation.maximumCents))+' · Planned-loss cap '+money(r.limits.plannedRiskBudgetCents)+' · Full-premium stress cap '+money(r.limits.fullPremiumStressCapCents)+'.</p>'+
    (r.conflicts.length?'<ul class="blocker-list">'+r.conflicts.map(c=>'<li>'+esc(c.message)+' Required lower bound '+money(c.requiredCents)+'; available limit '+money(c.limitCents)+'.</li>').join('')+'</ul>':'')+
    (compact?'':'<p class="hint">Necessary capital ceiling under these declarations: '+money(r.constraints.necessaryUpperBoundCents)+'. Fees: '+money(r.settings.roundTripFeesCents)+'; exit reserve: '+money(r.settings.slippageReserveCents)+'. A lower-bound result is not an exact loss estimate.</p>'+
    '<div class="table-scroll"><table><thead><tr><th>Illustrative all-in capital</th><th>Planned loss</th><th>Full-premium stress</th><th>Capital checks</th></tr></thead><tbody>'+r.rows.map(x=>'<tr><td>'+money(x.capitalCents)+'</td><td>'+(x.inputIssue?'Unavailable':x.plannedLossCents===null?'Unknown; at least '+money(x.plannedLossLowerBoundCents):money(x.plannedLossCents))+'</td><td>'+money(x.fullPremiumStressCents)+'</td><td>'+esc(x.inputIssue?'Insufficient capital for known fees and minimum premium':x.stressExceedsCap||x.plannedLossExceedsCap||x.cashExceeded?'Exceeds a limit':'Other checks still required')+(x.standardContractPossibleByCents===false?'<small>Does not form a standard cent-quoted contract</small>':'')+'</td></tr>').join('')+'</tbody></table></div>')+
    '<p class="hint">Each illustration assumes one standard contract and declared per-contract costs. Capital includes the fee reserve; no contract is selected. A stop cannot guarantee the loss. Reviewing this panel does not change a risk limit.</p></section>';
}
