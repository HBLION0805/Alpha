import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {CPI_SOURCE_URL,readPublicCpiFeed,parseDriverFeed} from './lib/options-driver-io.mjs';
import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';
import {saveEventObservation} from './lib/options-event-intelligence-observation.mjs';

export const CPI_EVENT_ID='cpi-20261014';
export const CPI_EVENT_TIME='2026-10-14T12:30:00.000Z';
const fail=c=>{throw Error('CPI_PREFLIGHT_'+c);};
const safeStamp=v=>v.replace(/[:.]/g,'-').toLowerCase();

export async function captureCpiPreflight({
  workspaceRoot='C:/projects/Alpha',
  now=()=>new Date().toISOString(),
  fetchFeed=readPublicCpiFeed
}={}){
  const requestedAt=now();
  let xml=null,receivedAt=null,parsedAt=null,items=[],diagnostic=null,partial=false;
  try{
    xml=await fetchFeed('bls');
    receivedAt=now();
    if(Date.parse(receivedAt)<Date.parse(requestedAt))throw Error('CLOCK_ROLLBACK');
    const parsed=parseDriverFeed(xml,'bls',receivedAt);
    items=parsed.items;partial=Boolean(parsed.truncated||parsed.rejectedItems);parsedAt=now();
  }catch(error){
    receivedAt??=now();parsedAt=now();partial=true;
    diagnostic=/^(?:HTTP_[1-5][0-9]{2}|FEED_[A-Z_]+|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|CLOCK_ROLLBACK)$/.test(error?.message)?error.message:'FETCH_OR_PARSE_FAILED';
  }
  const recordedAt=now();
  for(const t of [requestedAt,receivedAt,parsedAt,recordedAt])if(!Number.isFinite(Date.parse(t)))fail('CLOCK');
  if(Date.parse(receivedAt)<Date.parse(requestedAt)||Date.parse(parsedAt)<Date.parse(receivedAt)||Date.parse(recordedAt)<Date.parse(parsedAt))fail('CLOCK_ORDER');
  const status=diagnostic?'FAILED':items.length?'OK':'EMPTY';
  const dir='data/runtime/options-event-intelligence/raw-cpi-feed/'+recordedAt.slice(0,10);io.directory(workspaceRoot,dir);
  const path=dir+'/'+safeStamp(recordedAt)+'-'+randomUUID()+'.json';
  const raw={version:'CPI_BLS_FEED_PREFLIGHT_V1',eventId:CPI_EVENT_ID,eventTime:CPI_EVENT_TIME,sourceId:'bls',url:CPI_SOURCE_URL,requestedAt,receivedAt,parsedAt,recordedAt,status,diagnostic,partial,itemCount:items.length,latestItems:items.slice(0,5).map(x=>({headline:x.headline,link:x.link,publishedAt:x.publishedAt,itemId:x.itemId})),xml,sha256:xml===null?null:createHash('sha256').update(xml).digest('hex'),executionAllowed:false};
  io.writeExclusive(workspaceRoot,path,Buffer.from(JSON.stringify(raw,null,2)+'\n'));
  const evidence={evidenceId:'cpi-source-health-'+safeStamp(recordedAt),eventId:CPI_EVENT_ID,kind:'SOURCE_STATUS',sourceId:'bls-cpi-rss',sourceUrl:CPI_SOURCE_URL,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt,parsedAt,availability:status==='OK'&&!partial?'CURRENT':status==='FAILED'?'MISSING':'UNKNOWN',summary:'BLS dedicated CPI RSS preflight '+status+'; this proves source access only and does not claim the October 14 release has occurred.',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null,numericObservation:null};
  const saved=saveEventObservation(workspaceRoot,evidence,evidence.receivedAt);
  return {version:'CPI_EVENT_PREFLIGHT_V1',eventId:CPI_EVENT_ID,eventTime:CPI_EVENT_TIME,status:status==='OK'&&!partial?'PASS':'PARTIAL',rawPath:path,evidencePath:saved.path,sourceUrl:CPI_SOURCE_URL,requestedAt,receivedAt,parsedAt,itemCount:items.length,diagnostic,executionAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const i=process.argv.indexOf('--workspace');
  if(i<0||!process.argv[i+1]){console.error(JSON.stringify({status:'ERROR',code:'CPI_PREFLIGHT_ARGUMENTS',executionAllowed:false}));process.exitCode=2;}
  else captureCpiPreflight({workspaceRoot:process.argv[i+1]}).then(x=>{console.log(JSON.stringify(x,null,2));if(x.status!=='PASS')process.exitCode=3;}).catch(e=>{console.error(JSON.stringify({status:'ERROR',code:/^CPI_PREFLIGHT_[A-Z_]+$/.test(e?.message)?e.message:'CPI_PREFLIGHT_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;});
}
