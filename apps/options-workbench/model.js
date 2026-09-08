export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const words=value=>String(value??'Unknown').toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const dollars=value=>value===null||value===undefined?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:6}).format(Number(value));
export const cents=value=>value===null||value===undefined?'Unknown':dollars(value/100);
export const number=value=>value===null||value===undefined?'—':new Intl.NumberFormat('en-US').format(value);
export function timestamp(value){if(!value)return 'Unknown';const date=new Date(value);return Number.isFinite(date.valueOf())?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(date):String(value);}
export function decimalInteger(value,places=2,nullable=false){
  const text=String(value).trim();if(!text&&nullable)return null;
  if(!new RegExp('^(0|[1-9]\\d{0,7})(\\.\\d{1,'+places+'})?$').test(text))throw Error('Enter a non-negative number with at most '+places+' decimal places.');
  const [a,b='']=text.split('.'),n=BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0'));
  if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Number is too large.');return Number(n);
}
export function whole(value){if(!/^[1-9]\d{0,3}$/.test(String(value))||Number(value)>1000)throw Error('Quantity must be 1–1,000 whole contracts.');return Number(value);}
export function exactUsd(value){return (BigInt(value)/100n).toString()+'.'+(BigInt(value)%100n).toString().padStart(2,'0');}
export function decimalText(value){return value===null||value===undefined?'':String(value).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');}
export function filterChain(rows,filters){
  const q=(filters.search??'').trim().toLowerCase();
  const selected=rows.filter(r=>(!filters.symbol||r.symbol===filters.symbol)&&(!filters.expiry||r.expiry===filters.expiry)&&(!filters.type||r.type===filters.type)&&(!filters.flagged||r.reviewCandidate)&&(!q||`${r.symbol} ${r.expiry} ${r.type} ${r.strike}`.toLowerCase().includes(q)));
  const field=filters.sort??'volume',direction=filters.direction==='asc'?1:-1;
  selected.sort((a,b)=>{const av=a[field],bv=b[field];if(av===null||av===undefined)return bv===null||bv===undefined?a.id.localeCompare(b.id):1;if(bv===null||bv===undefined)return -1;const d=['volume','openInterest','strike','ask'].includes(field)?Number(av)-Number(bv):String(av).localeCompare(String(bv));return d*direction||a.id.localeCompare(b.id);});
  const pages=Math.max(1,Math.ceil(selected.length/25)),page=Math.min(Math.max(1,filters.page??1),pages);
  return {rows:selected.slice((page-1)*25,page*25),total:selected.length,pages,page};
}
export const LESSONS={
  FEES_UNKNOWN:['Fees are missing','Add the actual fee for each fill before relying on net profit.'],
  PLAN_MISSING:['No plan was recorded','Record the original plan when available; do not invent a pre-entry plan.'],
  PLAN_RECORDED_AFTER_REPORTED_ENTRY:['Plan entered after the trade','Keep the declared plan timing visible when reviewing discipline.'],
  DOCUMENT_EVIDENCE_MISSING:['Supporting record is missing','Attach a document reference when available. A hash does not authenticate it.'],
  POSSIBLE_DUPLICATE_FILL:['Possible duplicate execution','Compare distinct execution references before making a correction.'],
  CORRECTED_RECORDS_REVIEW:['A fill was corrected','Review the corrected costs and position; original history is preserved.'],
  NEGATIVE_REPORTED_OUTCOME:['Trade closed at a net loss','Inspect the plan, recorded costs and execution evidence. Cause is unconfirmed.'],
  CLOSED_LOSS_EXCEEDS_DECLARED_RISK:['Loss exceeded declared risk','Review execution and price gaps; a stop is not a guaranteed fill.'],
  DECLARED_QUANTITY_EXCEEDED:['Quantity exceeded the plan','Review peak open contracts against the declared limit.'],
  DECLARED_ENTRY_DEBIT_EXCEEDED:['Opening debit exceeded the plan','Review all opening premiums and recorded fees.'],
  ENTRY_DEBIT_EXCEEDS_50_USD_DIAGNOSTIC:['Opening debit exceeded $50','This is the saved allocation diagnostic, not brokerage buying power.'],
  EXIT_PRICE_BELOW_DECLARED_STOP_NOT_PROOF_OF_VIOLATION:['Sale price below declared stop','The execution price alone cannot establish when a stop was triggered.'],
  PAST_EXPIRY_POSITION_UNRESOLVED:['Position remains unresolved after expiry','Reconcile the broker record. Do not assume a zero-value close.'],
  ENTRY_AFTER_DECLARED_DEADLINE:['Entry after the declared deadline','Review the reported timestamp against the original plan.'],
  EXIT_AFTER_DECLARED_TIME:['Exit after the declared time','Review the reported exit timestamp and the original time limit.']
};
export const lesson=code=>LESSONS[code]??[words(code),'Review the supporting evidence. This candidate does not establish a cause or change a strategy.'];
export function collectLessons(state){
  const result=[];
  for(const t of state.manual.data?.trades??[])for(const l of t.candidateLessons)result.push({...l,origin:state.manual.data.origin==='SYNTHETIC_FIXTURE'?'Synthetic ledger':'Owner reported',support:t.tradeId,title:lesson(l.code)[0],nextCheck:lesson(l.code)[1]});
  for(const id of ['paper','historical'])for(const l of state.outcomes.data?.components[id]?.audit?.candidateNotebook.entries??[])result.push({...l,origin:id==='paper'?'Paper simulation':'Historical research',support:(l.supportingTradeIds??l.supportingRunIds??[]).join(', '),title:words(l.code),nextCheck:l.nextCheck??l.observation});
  for(const l of state.activity.data?.candidateLessons??[])result.push({...l,origin:'Activity research',support:l.candidateId??l.contractId??'',title:words(l.code),nextCheck:l.nextCheck??l.observation??'Inspect the saved comparison and its evidence limits.'});
  return result;
}
export function safeLink(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function explainError(code){
  const explanations={
    SESSION_REQUIRED:'The local server session changed. Close the preview, reload saved data and preview your retained draft again.',
    WORKBENCH_LEDGER_CHANGED_REVIEW_AGAIN:'The ledger changed after this preview. Return to the draft and preview it again.',
    MANUAL_LEDGER_TRADE_ID_OR_BOUND:'This trade ID is already registered or the ledger has reached its trade limit. Use the existing trade for fills.',
    MANUAL_LEDGER_TRADE_UNKNOWN:'Select a registered trade before recording its fill.',
    MANUAL_LEDGER_FILL_ID_REUSED:'This fill ID already exists. Use a correction for an existing execution.',
    MANUAL_LEDGER_OVERSELL:'The reported sale exceeds the recorded open contracts. Review the quantity and execution sequence.',
    MANUAL_LEDGER_CLOSED_TRADE_REOPENED:'This trade is already closed. Register a new trade for a new position.',
    MANUAL_LEDGER_STALE_CORRECTION:'This fill has a newer revision. Reload and select the current fill before correcting it.',
    MANUAL_LEDGER_FUTURE_EXECUTION:'The reported execution time is in the future. Check the UTC date and time.',
    MANUAL_LEDGER_FUTURE_PLAN:'The plan declaration time is in the future. Check the UTC date and time.',
    MANUAL_LEDGER_PLAN_CLOCK_ORDER:'The entry deadline and time exit must follow the plan declaration; the exit must follow the deadline.',
    MANUAL_LEDGER_EXECUTION_ORDER:'Execution sequences must be unique and follow the reported time order.',
    MANUAL_LEDGER_DUPLICATE_EXECUTION_REF:'This execution reference already exists. Check for a duplicate before recording another fill.',
    MANUAL_LEDGER_MONEY:'Use a non-negative dollar amount with at most six decimal places.',
    MANUAL_LEDGER_LABEL:'Text fields must be nonempty, within their stated limits and contain no control characters.',
    MANUAL_LEDGER_DATE:'Enter a valid contract expiration date.',
    MANUAL_LEDGER_COUNT:'Enter a valid whole-contract count or revision.',
    MANUAL_LEDGER_WRITER_LOCKED:'Another local writer holds this ledger. Wait for it to finish, then reload.',
    LOCAL_RECOVERY_FAILED:'A saved-data integrity check failed. Inspect the local service log and original store before continuing.'
  };
  return explanations[code]?`${explanations[code]} (${code})`:String(code??'Local request failed.');
}
