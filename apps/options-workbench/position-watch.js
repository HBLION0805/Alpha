import {esc,words,cents,dollars,timestamp} from './model.js';
const own=(values,key)=>values&&Object.hasOwn(values,key)?values[key]:undefined;

export function positionWatchRequest(tradeId,value){
  const cost=value.trim();
  if(cost&&!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(cost))throw Error('Enter a nonnegative dollar cost with at most two decimal places, or leave it blank for unknown.');
  return {tradeId,exitCostUsd:cost||null};
}
export function positionWatchPreviewMatches(base,preview,id){return !!base&&!!preview&&typeof base.ledgerEventsFingerprint==='string'&&base.ledgerId===preview.ledgerId&&base.ledgerEventsFingerprint===preview.ledgerEventsFingerprint&&base.origin===preview.origin&&preview.rows.some(r=>r.tradeId===id);}
export function positionWatchResult(row,at){
  return `<p><strong>${esc(words(row.status))}</strong> · Checked ${esc(timestamp(at))}</p>
    ${row.attentionReasons.length?'<p class="error-text">'+esc(row.attentionReasons.map(words).join(' · '))+' — check the position and any existing orders manually. No exit is confirmed.</p>':''}
    <dl class="rationale-values"><div><dt>Stop check</dt><dd>${esc(words(row.checks.stop))}</dd></div><div><dt>Net target check</dt><dd>${esc(words(row.checks.target))}</dd></div><div><dt>Time exit</dt><dd>${esc(words(row.checks.time))}</dd></div><div><dt>Expiry</dt><dd>${esc(words(row.checks.expiry))}</dd></div></dl>
    <p>Recorded stop / share: ${dollars(row.plan?.stopPremiumUsd)} · Whole-trade net target: ${dollars(row.plan?.targetNetProfitUsd)} · Time exit: ${esc(timestamp(row.plan?.timeExitAt))}</p>
    <p>Saved reference bid / ask: ${cents(row.quote?.bidCents)} / ${cents(row.quote?.askCents)} · Bid size: ${esc(row.quote?.bidSize??'Unknown')}. Source ${esc(timestamp(row.quote?.sourceAt))}; received ${esc(timestamp(row.quote?.receivedAt))}.</p>
    ${!row.usableQuote?'<p class="hint">This reference cannot establish a current exit value. '+esc(row.quoteBlockers.map(words).join(' · '))+'.</p>':''}
    <dl class="rationale-values"><div><dt>Remaining value at usable bid</dt><dd>${dollars(row.liquidationValueAtBidUsd)}</dd></div><div><dt>Whole-trade PnL before future exit costs</dt><dd>${dollars(row.fullTradePnlBeforeFutureExitCostsUsd)}</dd></div><div><dt>Assumed remaining exit cost</dt><dd>${dollars(row.assumedRemainingExitCostUsd)}</dd></div><div><dt>Estimated whole-trade net PnL</dt><dd>${dollars(row.estimatedFullTradeNetPnlUsd)}</dd></div></dl>
    <p class="hint">Whole-trade estimates include the recorded partial exits and known entry/exit fees once. Unknown fees stay unknown. Remaining exit cost includes fees and adverse execution allowance; it is a preview assumption. Bid value is not guaranteed proceeds.</p>
    <details data-disclosure-key="position-source-${esc(row.tradeId)}"><summary>Saved quote identity and source</summary><p>${esc(row.quote?.id??'No unambiguous contract match')}</p><p>${esc(row.source?.path??'No capture')}</p><p>Capture ${esc(timestamp(row.source?.capturedAt))} · SHA-256 ${esc(row.source?.sha256??'Unknown')}</p><p>A price match does not verify deliverables or orders. Historical outcomes and ledger values are unchanged.</p></details>`;
}
export function positionWatchPanel(component,ui={}){
  const d=component?.data;
  if(!d)return '<section class="card section-space"><h2>Position exit checks</h2><p>Checks unavailable. Recorded positions remain open; inspect the saved ledger and quote sources.</p></section>';
  return `<section class="card section-space"><h2>Position exit checks</h2><p>${esc(d.limitation)}</p>${d.sourceRecovery==='UNAVAILABLE'?'<p class="error-text">Quote recovery is unavailable. Time and expiry checks still use the recorded plan; positions remain unresolved.</p>':''}<p>${d.openTrades} reported open trade(s). Review each position below; optional cost previews apply separately. Saved data checked ${esc(timestamp(d.assessedAt))}.</p>`+
    (d.rows.length?d.rows.map(row=>{
      const preview=own(ui.positionCostPreviews,row.tradeId),r=preview?.rows.find(r=>r.tradeId===row.tradeId)??row;
      return `<article class="lesson-card"><h3>${esc(row.contract.symbol+' '+row.contract.expiry+' '+row.contract.strikeUsd+' '+row.contract.optionType)} · ${row.openContracts} open</h3><p>${esc(row.tradeId)} · ${esc(words(d.origin))} · ${esc(words(row.planTiming))}</p><p>Remaining premium exposure: ${dollars(row.remainingPremiumUsd)} · Remaining basis: ${dollars(row.remainingCostBasisUsd)} · Recorded realized net: ${dollars(row.realizedNetPnlUsd)}</p>
        <div data-position-result="${esc(row.tradeId)}">${positionWatchResult(r,preview?.assessedAt??d.assessedAt)}</div>
        <form data-position-cost="${esc(row.tradeId)}" class="form-grid"><label>Total cost to sell remaining contracts ($, assumption)<input name="exitCostUsd" inputmode="decimal" value="${esc(own(ui.positionCostDrafts,row.tradeId)??'')}"><small>Fees plus adverse execution allowance. Blank = unknown; zero is explicit. Nothing is saved.</small></label><div class="form-actions"><button type="submit" class="button secondary">Preview exit checks</button></div></form><p data-position-error="${esc(row.tradeId)}" class="error-text" role="alert"></p>
        </article>`;
    }).join(''):'<p>No reported open positions. Quotes and paper fills do not create Owner positions. Record actual fills in the journal when they occur.</p>')+'</section>';
}
