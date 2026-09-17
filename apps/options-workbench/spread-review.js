import {esc,cents,words} from './model.js';
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';

export function spreadCapitalNotice(component){
  const latest=component?.data?.cases?.[0];
  if(!latest)return '';
  const amount=latest.reportedCapital;
  return `<aside class="notice warning"><div><strong>Account capital needs reconciliation</strong><p>${amount?`Owner reported ${cents(amount.amountCents)} as ${esc(words(amount.basis))} on ${esc(amount.reportedOn)}. `:''}This does not establish total equity or settled cash. Existing planning settings remain historical declarations, not refreshed account balances. Review the recorded spread exposure and available funds before relying on a new trade budget. <a href="#journal">Open spread review</a>.</p></div></aside>`;
}

export function spreadReviewPanel(component){
  if(!component)return '';
  if(component.state!=='AVAILABLE')return '<section class="card section-space"><h2>Reported spread reviews</h2><p class="error-text">Spread evidence could not be recovered. No positions or losses have been inferred.</p></section>';
  const cases=component.data?.cases??[];
  if(!cases.length)return '';
  return '<section class="card section-space"><h2>Reported spread reviews</h2><p>Separate two-leg opening evidence. These records are not included in the single-leg ledger totals or its position exit checks.</p>'+cases.map(r=>
    `<article class="lesson-card"><h3>${esc(r.id)}</h3><p>${esc(words(r.reviewStatus))} · ${esc(r.origin)}</p><p>${esc(r.limitation)}</p>
    <dl class="rationale-values"><div><dt>Opening premium</dt><dd>${cents(r.totalPremiumCents)}</dd></div><div><dt>Estimated entry fees</dt><dd>${cents(r.estimatedFeesCents)}</dd></div><div><dt>Estimated total outlay</dt><dd>${cents(r.estimatedOutlayCents)}</dd></div><div><dt>Realized net PnL</dt><dd>Unknown — closing executions required</dd></div></dl>
    <p>${r.spreadUnits} spread units / ${r.legContracts} leg contracts. ${r.ownerReportsClosed?'Owner reports all positions closed; executions and exit mechanism remain unverified.':'Current holdings have not been established.'}</p>
    ${r.reportedCapital?`<p>Owner-reported amount: ${cents(r.reportedCapital.amountCents)} on ${esc(r.reportedCapital.reportedOn)} · basis: ${esc(words(r.reportedCapital.basis))}. This is not entry-date equity or verified settled cash; settings were not changed.</p>`:''}
    ${table(['Spread / reported fill','Units / debit','Entry premium / estimated outlay','Terminal breakeven, before fees'],r.rows.map(t=>`<tr><td>${esc(t.symbol)} ${esc(words(t.optionType))} ${cents(t.longStrikeCents)} long / ${cents(t.shortStrikeCents)} short<small>Expiry ${esc(t.expiry)} · ${esc(t.filledMinute)} (minute precision; year from conversation)</small></td><td>${t.quantity} × ${cents(t.debitPerShareCents)}<small>${t.calendarDteAtOpening} calendar DTE at opening</small></td><td>${cents(t.premiumCents)} / ${cents(t.estimatedOutlayCents)}</td><td>${cents(t.terminalBreakevenCents)}<small>Expiry reference, not an early-exit target</small></td></tr>`))}
    <details data-disclosure-key="spread-plan-${esc(r.id)}"><summary>Owner's retrospective explanation</summary><p>${esc(r.originalPlanText??'No original plan supplied.')}</p><p>Recorded after the trades. This does not verify the policy outcome, price path, stop orders or brokerage liquidation.</p></details>
    <details data-disclosure-key="spread-path-${esc(r.id)}"><summary>Opposite-direction / expiry checks</summary>${r.pairs.map(p=>`<p>${esc(p.symbol)}: the put has zero intrinsic value if the ETF is at or above ${cents(p.zeroIntrinsicConditions.put.underlyingAtOrAboveCents)} at ${esc(p.zeroIntrinsicConditions.put.expiry)} expiry; the call has zero intrinsic value if it is at or below ${cents(p.zeroIntrinsicConditions.call.underlyingAtOrBelowCents)} at ${esc(p.zeroIntrinsicConditions.call.expiry)} expiry. If both conditions occur and the spreads are retained intact, paid premiums of ${cents(p.bothWorthlessPremiumLossCents)} are lost before fees. This is a conditional path example, not an observed loss or a common-expiry payoff curve.</p>`).join('')}</details>
    <details data-disclosure-key="spread-source-${esc(r.id)}"><summary>Local source evidence</summary><p>Recorded ${esc(r.recordedAt)}. Hashes preserve local source identity; they do not authenticate the broker.</p>${r.evidence.map(e=>`<p>${esc(e.name)} · <code>${esc(e.sha256)}</code></p>`).join('')}</details>
    <p>Review candidates are also in the Mistake notebook. No strategy rule, capital limit, broker order or paper record was changed.</p></article>`).join('')+'</section>';
}
