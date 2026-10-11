import {readSourceBytes,sourceHash} from './options-weekly-source-storage.mjs';
import {WEEKLY_ISSUER_SOURCES,readWeeklyIssuerRefreshes,refreshWeeklyIssuerSources} from './options-weekly-issuer-sources.mjs';
import {PDF_METADATA_ID,PDF_INTERVAL_MS,readPdfMetadata,checkPdfMetadata} from './options-weekly-pdf-metadata.mjs';
export const VERIFIED_IR_IDS=Object.freeze(['msft_ir','avgo_ir','amd_ir','lrcx_ir','klac_ir','arm_ir','crwd_ir','wdc_ir','adbe_ir_events','amat_ir_events','dell_ir_events']);
export const VERIFIED_SEC_IDS=Object.freeze(Object.keys(WEEKLY_ISSUER_SOURCES).filter(id=>WEEKLY_ISSUER_SOURCES[id].family==='SEC_SUBMISSIONS'));
export const COMPANY_REFRESH_IDS=Object.freeze([...VERIFIED_IR_IDS,...VERIFIED_SEC_IDS,PDF_METADATA_ID]);
const check=(v,c)=>{if(!v)throw Error(c);};
export function readCompanyRefreshConfig(root,path){
 const bytes=readSourceBytes(root,path,65536),c=JSON.parse(bytes);
 check(c.version==='WEEKLY_COMPANY_REFRESH_CONFIG_V1'&&Array.isArray(c.enabledSourceIds)&&new Set(c.enabledSourceIds).size===c.enabledSourceIds.length&&c.enabledSourceIds.every(id=>COMPANY_REFRESH_IDS.includes(id)),'COMPANY_CONFIG_SCOPE');
 check(Number.isInteger(c.intervalMinutes)&&c.intervalMinutes>=60&&c.intervalMinutes<=1440&&Number.isInteger(c.maxAttempts)&&c.maxAttempts>=1&&c.maxAttempts<=20,'COMPANY_CONFIG_LIMITS');
 check(c.batches&&typeof c.batches==='object'&&!Array.isArray(c.batches)&&Object.keys(c.batches).length<=12,'COMPANY_CONFIG_BATCHES');
 for(const [name,ids]of Object.entries(c.batches))check(/^[a-z][a-z0-9-]{0,39}$/.test(name)&&Array.isArray(ids)&&ids.length>0&&ids.length<=10&&new Set(ids).size===ids.length&&ids.every(id=>c.enabledSourceIds.includes(id)),'COMPANY_CONFIG_BATCH');
 return {...c,configPath:path,configSha256:sourceHash(bytes)};
}
export function readCompanyRefreshHistory(root,at){
 const issuer=readWeeklyIssuerRefreshes(root,at),pdf=readPdfMetadata(root,at);
 return {records:[...issuer.records,...pdf.records].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)),issues:[...issuer.issues,...pdf.issues]};
}
export function companySourceDue(records,sourceId,intervalMs,firstAt){
 const rows=records.filter(r=>r.sourceId===sourceId).sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt)),latest=rows.at(-1),isPdf=sourceId===PDF_METADATA_ID;
 const blocked=!COMPANY_REFRESH_IDS.includes(sourceId)?'NOT_IN_VERIFIED_ALLOWLIST':!latest?'NO_VERIFIED_SAVED_BASELINE':latest.parsed.status!=='OBTAINED_PENDING_REVIEW'?'LATEST_ATTEMPT_FAILED_REQUIRES_REVIEW':isPdf&&['CHANGED_REQUIRES_REVIEW','VALIDATOR_UNKNOWN_REQUIRES_REVIEW'].includes(latest.state)?latest.state:null;
 const delayMs=isPdf?PDF_INTERVAL_MS:Math.max(3600000,intervalMs);
 return {sourceId,lastRequestedAt:latest?.requestedAt??null,lastReceivedAt:latest?.receivedAt??null,lastStatus:latest?.parsed.status??null,blockedReason:blocked,consecutiveFailures:blocked?1:0,delayMs,nextEligibleAt:latest?new Date(Math.max(Date.parse(firstAt),Date.parse(latest.requestedAt)+delayMs)).toISOString():null};
}
export async function refreshCompanySources(args){
 check(args.sourceIds?.length===1,'COMPANY_SERIAL_SCOPE');const id=args.sourceIds[0];
 if(id===PDF_METADATA_ID)return {results:[await checkPdfMetadata(args)],executionAllowed:false};
 check(COMPANY_REFRESH_IDS.includes(id),'COMPANY_SCOPE');return refreshWeeklyIssuerSources(args);
}
export function companyRefreshPlan(root,config,at=new Date().toISOString()){
 const saved=readCompanyRefreshHistory(root,at),rows=COMPANY_REFRESH_IDS.map(id=>({...companySourceDue(saved.records,id,config.intervalMinutes*60000,at),configured:config.enabledSourceIds.includes(id)}));
 const disabledCatalog=Object.keys(WEEKLY_ISSUER_SOURCES).filter(id=>!COMPANY_REFRESH_IDS.includes(id)).map(sourceId=>{const r=saved.records.findLast(r=>r.sourceId===sourceId);return {sourceId,configured:false,reason:r?.httpStatus===403?'HTTP_403_NO_AUTOMATIC_RETRY':r?.parsed.errorCode??'UNVERIFIED_OR_STATIC_SCOPE',lastRequestedAt:r?.requestedAt??null};});
 return {version:'WEEKLY_COMPANY_REFRESH_PLAN_V1',at,config,rows,disabledCatalog,issues:saved.issues,processStarted:false,executionAllowed:false};
}
