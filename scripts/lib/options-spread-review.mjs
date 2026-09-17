import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { optionsEvidenceExportStorage as io } from '../options-evidence-export.mjs';
import { readinessClock } from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';
import { exportId } from '../../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts';

const BASE='data/runtime/options-reported-spreads', MAX=12*1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const fail=code=>{throw Error('SPREAD_REVIEW_'+code);};
function keys(v,list){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==list.split(' ').sort().join())fail('SHAPE');}
function integer(v,min=0,max=100000000){if(!Number.isSafeInteger(v)||v<min||v>max)fail('AMOUNT');return v;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('DATE');return v;}
function text(v){if(typeof v!=='string'||!v.trim()||v.length>1000)fail('TEXT');}
const usd=c=>(c/100).toFixed(2);
const note=(code,title,nextCheck,support)=>({code,title,nextCheck,support,origin:'Owner-supplied spread evidence',status:'CANDIDATE',approvedRule:false,approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'});

export function assessReportedSpreads(input){
  keys(input,'version id recordedAt origin yearBasis reportedCapital originalPlanText ownerReportsClosed evidence trades');
  if(input.version!=='REPORTED_SPREAD_INPUT_V1'||input.origin!=='OWNER_SUPPLIED_SCREENSHOTS'||input.yearBasis!=='CONVERSATION_CONTEXT')fail('VERSION');
  exportId(input.id);readinessClock(input.recordedAt);
  if(input.originalPlanText!==null)text(input.originalPlanText);
  if(typeof input.ownerReportsClosed!=='boolean')fail('CLOSING_STATEMENT');
  if(input.reportedCapital!==null){keys(input.reportedCapital,'amountCents basis reportedOn');integer(input.reportedCapital.amountCents);date(input.reportedCapital.reportedOn);if(input.reportedCapital.reportedOn>input.recordedAt.slice(0,10)||!['UNKNOWN','TOTAL_EQUITY','CASH','BUYING_POWER'].includes(input.reportedCapital.basis))fail('CAPITAL');}
  if(!Array.isArray(input.evidence)||input.evidence.length<1||input.evidence.length>20)fail('EVIDENCE');
  const evidenceIds=new Set();
  for(const e of input.evidence){keys(e,'name sha256');if(!/^evidence-[1-9]\d?\.jpg$/.test(e.name)||!/^[a-f0-9]{64}$/.test(e.sha256)||evidenceIds.has(e.name))fail('EVIDENCE');evidenceIds.add(e.name);}
  if(!Array.isArray(input.trades)||!input.trades.length||input.trades.length>20)fail('TRADE_BOUND');
  const seen=new Set(),identities=new Set();
  const rows=input.trades.map(t=>{
    keys(t,'id symbol optionType expiry filledMinute quantity multiplier debitPerShareCents estimatedFeesCents estimatedCostCents longStrikeCents shortStrikeCents longPriceCents shortPriceCents evidenceName');
    exportId(t.id);if(seen.has(t.id))fail('DUPLICATE');seen.add(t.id);
    if(!['GLD','IBIT'].includes(t.symbol)||!['CALL','PUT'].includes(t.optionType)||t.multiplier!==100)fail('CONTRACT');
    date(t.expiry);
    if(typeof t.filledMinute!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(t.filledMinute))fail('TIME');
    date(t.filledMinute.slice(0,10));
    const fillMs=Date.parse(t.filledMinute),localMinute=t.filledMinute.slice(11,16),offset=t.filledMinute.slice(16);
    if(!Number.isFinite(fillMs)||localMinute>'23:59'||Number(localMinute.slice(3))>59||!['-04:00','-05:00'].includes(offset)||fillMs>Date.parse(input.recordedAt)||t.expiry<t.filledMinute.slice(0,10))fail('TIME');
    if(!evidenceIds.has(t.evidenceName))fail('EVIDENCE');
    integer(t.quantity,1,1000);integer(t.longStrikeCents,1,10000000);integer(t.shortStrikeCents,1,10000000);
    integer(t.debitPerShareCents,1,1000000);integer(t.longPriceCents,0,1000000);integer(t.shortPriceCents,0,1000000);
    if(t.estimatedFeesCents!==null)integer(t.estimatedFeesCents);
    if(t.estimatedCostCents!==null)integer(t.estimatedCostCents);
    const width=t.optionType==='CALL'?t.shortStrikeCents-t.longStrikeCents:t.longStrikeCents-t.shortStrikeCents;
    if(width<=0||t.debitPerShareCents>=width||t.longPriceCents-t.shortPriceCents!==t.debitPerShareCents)fail('LEG_RECONCILIATION');
    const identity=[t.symbol,t.optionType,t.expiry,t.longStrikeCents,t.shortStrikeCents,t.filledMinute].join('|');
    if(identities.has(identity))fail('DUPLICATE');identities.add(identity);
    const premium=t.debitPerShareCents*100*t.quantity;
    const estimatedOutlay=t.estimatedFeesCents===null?null:premium+t.estimatedFeesCents;
    if(t.estimatedCostCents!==null&&(estimatedOutlay===null||t.estimatedCostCents!==estimatedOutlay))fail('COST_RECONCILIATION');
    return {...t,premiumCents:premium,estimatedOutlayCents:estimatedOutlay,actualFeesCents:null,realizedNetPnlCents:null,currentPositionStatus:input.ownerReportsClosed?'CLOSE_REPORTED_AWAITING_EXECUTIONS':'CLOSING_EVIDENCE_NOT_SUPPLIED',
      calendarDteAtOpening:(Date.parse(t.expiry)-Date.parse(t.filledMinute.slice(0,10)))/86400000,
      terminalBreakevenCents:t.longStrikeCents+(t.optionType==='CALL'?t.debitPerShareCents:-t.debitPerShareCents),
      terminalMaxProfitBeforeFeesCents:(width-t.debitPerShareCents)*100*t.quantity,
      terminalMaxLossBeforeFeesCents:premium};
  });
  const totalPremiumCents=rows.reduce((n,r)=>n+r.premiumCents,0),estimatedFeesCents=rows.some(r=>r.estimatedFeesCents===null)?null:rows.reduce((n,r)=>n+r.estimatedFeesCents,0);
  const candidateLessons=[
    note('COMBINED_DEBIT_REVIEW','Review the combined debit','Opening debits total $'+usd(totalPremiumCents)+'. Review all positions together; separate minimum allocations do not create diversification or a combined loss limit.',input.id),
    note('CLOSING_EVIDENCE_MISSING','Closing evidence is missing','Supply actual closing executions or current holdings before attributing realized losses, declaring expiry worthless, or checking stop discipline.',input.id),
    note('ACTUAL_FEES_UNKNOWN','Estimated fees are not final charges','Obtain trade confirmations; quoted estimated fees remain separate from actual fees and net PnL.',input.id),
    note('CAPITAL_RECONCILIATION_REQUIRED','Reconcile capital and available cash','An owner-reported balance is not verified settled cash or entry-date equity. Reconcile holdings and cash flows before sizing another trade.',input.id)
  ];
  if(input.originalPlanText===null)candidateLessons.push(note('ORIGINAL_PLAN_NOT_SUPPLIED','Original entry and exit plan is missing','Record the original direction, expected move, timing, invalidation and spread-level exit conditions. Missing documentation is not proof that no plan existed.',input.id));
  candidateLessons.push(note('ORIGINAL_EXIT_TERMS_NOT_SUPPLIED','Original exit terms need evidence','A retrospective explanation does not establish the original spread-level stop, target, time exit or whole-portfolio loss plan. Review the combined position and exit sequence; do not assume both directions cannot lose.',input.id));
  const pairs=[];
  for(const call of rows.filter(r=>r.optionType==='CALL'))for(const put of rows.filter(r=>r.optionType==='PUT'&&r.symbol===call.symbol)){
    const differentExpiries=call.expiry!==put.expiry;
    pairs.push({symbol:call.symbol,callId:call.id,putId:put.id,differentExpiries,
      zeroIntrinsicConditions:{call:{expiry:call.expiry,underlyingAtOrBelowCents:call.longStrikeCents},put:{expiry:put.expiry,underlyingAtOrAboveCents:put.longStrikeCents}},
      bothWorthlessPremiumLossCents:call.premiumCents+put.premiumCents});
    candidateLessons.push(note(differentExpiries?'OPPOSITE_DIRECTIONS_DIFFERENT_EXPIRIES':'OPPOSITE_DIRECTIONS_NOT_AUTOMATIC_HEDGE',call.symbol+' opposite-direction spread review',
      'Call expiry '+call.expiry+' and put expiry '+put.expiry+'. Both can lose their paid debit. Test each expiry and the price path; no hedge credit, common-expiry portfolio curve or guaranteed offset is inferred.',call.id+', '+put.id));
  }
  if(rows.some(r=>r.calendarDteAtOpening<=3))candidateLessons.push(note('NEAR_EXPIRY_OPENING','Short time remaining at entry','At least one spread opened with three or fewer calendar days to expiry. Review the required move and event/expiry timing. This does not establish theta or volatility as the cause of loss.',input.id));
  return {version:'REPORTED_SPREAD_REVIEW_V1',id:input.id,recordedAt:input.recordedAt,origin:input.origin,yearBasis:input.yearBasis,rows,pairs,candidateLessons,
    reportedCapital:input.reportedCapital,originalPlanText:input.originalPlanText,planEvidence:'RETROSPECTIVE_OWNER_STATEMENT',ownerReportsClosed:input.ownerReportsClosed,evidence:input.evidence,
    totalPremiumCents,estimatedFeesCents,estimatedOutlayCents:estimatedFeesCents===null?null:totalPremiumCents+estimatedFeesCents,
    spreadUnits:rows.reduce((n,r)=>n+r.quantity,0),legContracts:rows.reduce((n,r)=>n+2*r.quantity,0),actualFeesCents:null,realizedNetPnlCents:null,
    reviewStatus:'INCOMPLETE_OPENING_EVIDENCE_ONLY',executionAllowed:false,approvedRule:false,
    limitation:'Owner-supplied screenshot transcription, not authenticated account history. Terminal references assume intact standard 100-share legs and exclude fees, early-close pricing and exercise/assignment exposure. Closing state, realized PnL, original plan and entry-date equity require separate evidence.'};
}

export function saveReportedSpreadReview(root,input,evidenceBytes){
  const report=assessReportedSpreads(input);
  if(input.recordedAt>new Date().toISOString())fail('FUTURE_RECEIPT');
  if(!Array.isArray(evidenceBytes)||evidenceBytes.length!==input.evidence.length)fail('EVIDENCE');
  for(let i=0;i<input.evidence.length;i++){const b=evidenceBytes[i];if(!Buffer.isBuffer(b)||b.length>MAX||b.length<4||b[0]!==255||b[1]!==216||hash(b)!==input.evidence[i].sha256)fail('EVIDENCE_HASH');}
  io.directory(root,BASE);const base=BASE+'/'+input.id;mkdirSync(resolve(root,base));
  const files=[{name:'inputs.json',data:bytes(input)},{name:'report.json',data:bytes(report)},...input.evidence.map((e,i)=>({name:e.name,data:evidenceBytes[i]}))];
  for(const f of files)io.writeExclusive(root,base+'/'+f.name,f.data);
  io.writeExclusive(root,base+'/manifest.json',bytes({version:'REPORTED_SPREAD_FILES_V1',id:input.id,files:files.map(f=>({name:f.name,sha256:hash(f.data)}))}));
  return readReportedSpreadReview(root,input.id);
}
export function readReportedSpreadReview(root,id){
  exportId(id);const base=BASE+'/'+id,read=name=>io.readBytes(root,base+'/'+name,MAX),parse=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
  const input=parse(read('inputs.json')),report=assessReportedSpreads(input),manifest=parse(read('manifest.json'));
  if(input.id!==id)fail('IDENTITY');keys(manifest,'version id files');
  const names=['inputs.json','report.json',...input.evidence.map(e=>e.name)];
  if(manifest.version!=='REPORTED_SPREAD_FILES_V1'||manifest.id!==id||!Array.isArray(manifest.files)||manifest.files.map(f=>f.name).join('|')!==names.join('|'))fail('MANIFEST');
  for(const f of manifest.files){keys(f,'name sha256');if(hash(read(f.name))!==f.sha256)fail('FILE_HASH');}
  for(const e of input.evidence)if(hash(read(e.name))!==e.sha256)fail('EVIDENCE_HASH');
  if(!bytes(report).equals(read('report.json')))fail('RECOMPUTATION');
  return report;
}
export function reportedSpreadView(root,at){
  readinessClock(at);const path=resolve(root,BASE);if(!existsSync(path))return {cases:[],executionAllowed:false};
  if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isDirectory())fail('UNSAFE_DIRECTORY');
  const entries=readdirSync(path,{withFileTypes:true});if(entries.length>64)fail('CATALOG_BOUND');
  const cases=entries.map(e=>{if(!e.isDirectory()||e.isSymbolicLink())fail('UNSAFE_DIRECTORY');const r=readReportedSpreadReview(root,e.name);if(r.recordedAt>at)fail('FUTURE_RECEIPT');return r;});
  return {cases:cases.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)),executionAllowed:false};
}
