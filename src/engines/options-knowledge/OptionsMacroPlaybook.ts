import {macroCatalog, MACRO_PLAYBOOK_VERSION} from './MacroKnowledgeCatalog';

export interface MacroNote {
  requestId:string; phase:'PRE_TRADE_NOTE'|'REVIEW_NOTE'; symbol:'GLD'|'IBIT'; title:string;
  originalPlanRef:string; answers:Record<string,string>;
  process:'UNKNOWN'|'FOLLOWED'|'DEVIATED'; outcome:'UNKNOWN'|'PROFIT'|'LOSS'|'FLAT';
  reviewEvidence:string; personalNote:string;
}
const fail=(code:string):never=>{throw Error('MACRO_PLAYBOOK_'+code);};
function object(v:unknown):asserts v is Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v))fail('OBJECT');
}
function keys(v:Record<string,unknown>,names:string[]) {
  if(Object.keys(v).sort().join()!==names.sort().join())fail('FIELDS');
}
function text(v:unknown,max:number):asserts v is string {
  if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('TEXT');
}
export function validateMacroNote(value:unknown,catalog=macroCatalog()):MacroNote {
  object(value);keys(value,['requestId','phase','symbol','title','originalPlanRef','answers','process','outcome','reviewEvidence','personalNote']);
  if(typeof value.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.requestId))fail('REQUEST_ID');
  if(!['PRE_TRADE_NOTE','REVIEW_NOTE'].includes(value.phase as string)||!['GLD','IBIT'].includes(value.symbol as string))fail('SCOPE');
  text(value.title,160);if(!value.title.trim())fail('TITLE');text(value.originalPlanRef,500);
  text(value.reviewEvidence,2000);text(value.personalNote,1400);
  if(!['UNKNOWN','FOLLOWED','DEVIATED'].includes(value.process as string)||!['UNKNOWN','PROFIT','LOSS','FLAT'].includes(value.outcome as string))fail('ASSESSMENT');
  if(value.phase==='PRE_TRADE_NOTE'&&(value.process!=='UNKNOWN'||value.outcome!=='UNKNOWN'))fail('PRE_TRADE_OUTCOME');
  if(catalog.version!==MACRO_PLAYBOOK_VERSION||catalog.executionAllowed!==false||catalog.activeRuleCount!==0)fail('CATALOG');
  object(value.answers);keys(value.answers,catalog.fields.map(f=>f.id));
  for(const v of Object.values(value.answers))text(v,1400);
  return structuredClone(value) as unknown as MacroNote;
}
export function assessMacroNote(value:unknown,catalog=macroCatalog()) {
  const input=validateMacroNote(value,catalog);
  const fields=catalog.fields.map(f=>({id:f.id,label:f.label,status:input.answers[f.id]?.trim()?'TEXT_RECORDED':'UNDOCUMENTED'}));
  const hasSupport=Boolean(input.originalPlanRef.trim()&&input.reviewEvidence.trim());
  const process=input.phase==='REVIEW_NOTE'&&hasSupport?input.process:'UNKNOWN';
  const outcome=input.phase==='REVIEW_NOTE'?input.outcome:'UNKNOWN';
  return {
    version:MACRO_PLAYBOOK_VERSION,fields,documentedFields:fields.filter(f=>f.status==='TEXT_RECORDED').length,
    coverageMeaning:'Text presence only; claims, chronology and decision quality are not verified.',
    process:{status:process,basis:'OWNER_REPORTED_NOT_VERIFIED',reason:input.phase==='PRE_TRADE_NOTE'?'NOT_A_REVIEW':!hasSupport?'ORIGINAL_PLAN_AND_REVIEW_EVIDENCE_REQUIRED':'SELF_REPORT_ONLY'},
    outcome:{status:outcome,basis:'OWNER_REPORTED_NOT_AUDITED_PNL'},
    comparison:`${process} / ${outcome}`,timing:'SERVER_RECEIPT_ONLY_NOT_VERIFIED_PRE_ENTRY',
    strategyStatus:'UNVALIDATED',approvedLesson:false,executionAllowed:false,
  };
}
