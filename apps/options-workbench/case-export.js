import {esc,timestamp} from './model.js';
export function caseExportPanel(caseId,ui={}){
  const state=ui.caseExports?.[caseId]??{},p=state.preview,r=state.result;
  const list=(title,items)=>`<details><summary>${title} (${items.length})</summary><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`;
  return `<details class="section-space" data-disclosure-key="case-export-${esc(caseId)}"><summary>Export private case evidence</summary>
    <p>Local evidence copy only. Not an off-device backup. PRIVATE / LOCAL_ONLY. No production restore or trading permission.</p>
    <p>Case: <strong>${esc(caseId)}</strong></p><button type="button" class="button secondary" data-case-export="PREVIEW" data-case-id="${esc(caseId)}">Preview private export</button>
    ${p?`<p>Preview at ${esc(timestamp(p.asOf))} · ${p.recordCount} records · ${esc(p.status.plan)} / ${esc(p.status.prediction)} / ${esc(p.status.trade)}</p>
      ${list('Included records',p.records.map(x=>x.recordType+' · '+x.recordId+' · '+x.status))}
      ${list('Missing records',p.missingRecords.map(x=>x.recordType+' · '+x.status))}
      ${list('Unresolved references',p.unresolvedReferences.map(x=>x.target+' · '+x.status))}
      ${list('Known unknowns',p.knownUnknowns)}
      <p>Destination: Private local export. Integrity: ${esc(p.integrity)}. Source records and original lifecycle remain unchanged.</p>
      <button type="button" class="button primary" data-case-export="CREATE" data-case-id="${esc(caseId)}"${r?' disabled':''}>Create local evidence bundle</button>`:''}
    ${r?`<div class="notice"><div><strong>Private local evidence exported</strong><p>Export ID: ${esc(r.exportId)}<br>${r.recordCount} records / ${r.fileCount} files. SHA-256 verified. Source unchanged.</p><p>Logical location: ${esc(r.logicalLocation)}</p><p>Isolated recovery is a separate developer validation step; this does not restore the current workspace.</p></div></div>`:''}
    ${state.error?`<p class="error-text">${esc(state.error)}</p>`:''}</details>`;
}
