import {esc,timestamp,words} from './model.js';

export function expectationSummary(r,thesis='',preview=false){
  if(!r)return '';
  return `<details open data-disclosure-key="expectation-summary"><summary>Market expectation / expectation difference</summary>
    <p><strong>${esc(r.stage?words(r.stage):'No snapshot linked')}</strong> · ${esc(r.status)} · ${preview?'Unsaved preview evaluated':'Frozen'} ${esc(timestamp(r.frozenAt))}</p>
    ${r.id?'<p>Snapshot: '+esc(r.id)+(r.fingerprint?' · '+esc(r.fingerprint):'')+'</p>':''}
    <p>Original saved Alpha / Owner thesis: ${esc(thesis)}</p><p>Original wording is retained as history. Current structured Event approach checks determine readiness.</p>
    ${(r.rows??[]).map(row=>`<article><h4>${esc(row.subject.metric)} · ${esc(row.subject.period)} · ${esc(row.subject.unit)}</h4>
      <p>Market expectation: ${row.market?esc(row.market.value??'UNKNOWN')+' · '+esc(row.market.source):'Consensus UNKNOWN'}. Difference: ${row.numericDifference!==null?esc(row.numericDifference)+' '+esc(row.subject.unit):esc(words(row.qualitative))+' (no numeric difference)'}.</p>
      <p>Alpha expectation: ${esc(row.alpha.value??words(row.alpha.qualitative))} · ${esc(row.alpha.attribution)} · ${esc(row.alpha.basis)}</p>
      <details><summary>Sources, clocks and limitations (${row.forecasts.length})</summary>${row.forecasts.map(f=>`<p><strong>${esc(f.type)}: ${esc(f.value??'UNKNOWN')}</strong> · ${esc(f.source)}<br>${esc(f.metric)} / ${esc(f.period)} / ${esc(f.unit)} / ${esc(f.adjustment)} / ${esc(f.releaseVersion)} / ${esc(f.valueMeaning)}<br>Published ${esc(timestamp(f.publishedAt))} · Host received ${esc(timestamp(f.receivedAt))}<br>${esc(f.coverage)} · ${esc(f.methodology)}<br>${esc(f.url)} · ${esc(f.reference)} · ${esc(f.locator)}</p>`).join('')}</details>
      ${row.issues.length?'<p class="error-text">'+row.issues.map(esc).join(' · ')+'</p>':''}</article>`).join('')}
    <p>Evidence status: ${r.ownerConfirmedAt?(preview?'Owner confirmation selected for this unsaved preview; no saved confirmation yet.':'Owner-confirmed at '+esc(timestamp(r.ownerConfirmedAt))+'; attributed, not machine authentication.'):'Owner confirmation required. Host analysis is not Owner approval.'}</p>
    <p>${esc(r.coverage??'No final expectation reference. Research may continue.')}</p>
    <p>Expectation gap is separate from event thesis, price / trend evidence, contract quality, cost / risk, event exposure and the original exit plan. Those checks remain independent below and in Candidate checks. No price direction or trade approval follows from the difference.</p>
  </details>`;
}
export function expectationEditor(s,ui,tradeId){
  const plans=(s.sourceComparisons?.data?.plans??[]).filter(p=>p.tradeId===tradeId),keys=new Set(plans.map(p=>p.key));
  const records=(s.marketExpectations?.data?.records??[]).filter(r=>keys.has(r.payload.request.planKey));
  const current=plans.filter(p=>p.kind==='DRAFT').at(-1),d=ui.expectationDraft;
  return `<details class="section-space" data-disclosure-key="expectation-editor"><summary>Market expectation snapshots (${records.length})</summary>
    <p>Append a research snapshot from the existing equipped Host, or explicitly confirm a final pre-entry revision. Saving does not fetch sources. Dates and source values remain attributed; no consensus is inferred from forecasts or previous actuals.</p>
    ${current?`<button type="button" class="button secondary" data-expectation-prepare="${esc(current.key)}">Prepare expectation snapshot</button>`:'<p>Save a plan draft with an event condition first.</p>'}
    ${d?`<form id="expectation-form"><p>Original saved plan: ${esc(d.planKey)} · ${esc(d.planVersion)}. Save plan edits before preparing a snapshot.</p>
      <label>Snapshot ID<input name="snapshotId" value="${esc(d.id)}"></label>
      <label>Snapshot stage<select name="stage"><option value="RESEARCH"${d.stage==='RESEARCH'?' selected':''}>Research snapshot</option><option value="FINAL_PRE_ENTRY"${d.stage==='FINAL_PRE_ENTRY'?' selected':''}>Final pre-entry snapshot</option></select></label>
      <label>Saved source comparison<select name="comparisonPath">${(s.sourceComparisons?.data?.records??[]).filter(r=>r.kind==='saved'&&r.payload.eventKey===d.eventKey).map(r=>`<option value="${esc(r.path)}"${r.path===d.comparisonPath?' selected':''}>${esc(r.id)} · ${esc(timestamp(r.savedAt))}</option>`).join('')}</select></label>
      <details><summary>Structured Host / Owner evidence rows</summary><p>Paste the expectation rows prepared by the existing Host. Each source retains its own identity, type, receipt, coverage and method. Never enter actual results here. Empty rows cannot be saved. See the expectation schema in the existing source-comparison delivery.</p><label>Evidence rows (JSON)<textarea name="rows" rows="14">${esc(ui.expectationRows??JSON.stringify(d.rows,null,2))}</textarea></label></details>
      <label>Research / revision note<textarea name="note">${esc(d.note)}</textarea></label>
      <label class="check-row"><input type="checkbox" name="ownerConfirmed"${d.ownerConfirmed?' checked':''}> I personally reviewed these source versions and the original thesis / Alpha expectation. For a final snapshot, I confirm this is my selected pre-entry version.</label>
      <p>Final does not mean fresh forever or executable. It must precede formal plan freeze, reported entry and release. Revisions append; old references never move. No fixed source-age threshold is invented.</p>
      <div class="form-actions"><button type="submit" value="PREVIEW_EXPECTATION" class="button secondary">Preview expectation snapshot</button><button type="submit" value="SAVE_EXPECTATION" class="button primary"${ui.expectationPreview?'':' disabled'}>Save expectation snapshot</button></div>
      <p id="expectation-error" class="error-text" role="alert"></p>${ui.expectationPreview?expectationSummary(ui.expectationPreview.assessment,current?.plan.thesis??'',true):''}</form>`:''}
    ${records.map(r=>`<article><p><strong>${esc(r.id)}</strong> · ${esc(words(r.payload.request.stage))} · Frozen ${esc(timestamp(r.savedAt))}</p><p>${esc(r.fingerprint)} · ${esc(r.payload.attribution)}</p><button type="button" class="link-button" data-expectation-open="${esc(r.id)}">View saved snapshot</button> · <button type="button" class="link-button" data-expectation-revise="${esc(r.id)}">Prepare appended revision</button> · <button type="button" class="link-button" data-expectation-use="${esc(r.id)}">Link to this plan draft</button></article>`).join('')}
    ${(s.marketExpectations?.data?.errors??[]).length?'<p class="error-text">Some expectation records could not be verified; unavailable records cannot qualify a plan.</p>':''}
  </details>`;
}
export function prepareExpectationDraft(plan,comparison,id){
  const c=plan.plan.invalidation.conditions.find(c=>c.id===plan.plan.invalidation.eventEntry?.conditionId)??plan.plan.invalidation.conditions.find(c=>c.kind!=='PRICE'&&c.eventKey&&c.releaseAt);
  if(!c||!comparison)throw Error('Save an event condition and a source comparison for this event first.');
  return {id,stage:'RESEARCH',supersedes:'',planKey:plan.key,planVersion:plan.version,comparisonPath:comparison.path,comparisonFingerprint:comparison.fingerprint,eventKey:c.eventKey,releaseAt:c.releaseAt,rows:[],note:'',ownerConfirmed:false};
}
