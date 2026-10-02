import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {refreshFocusedNews,readFocusedSupplement} from './lib/options-focused-news-io.mjs';
import {retrieveBtcContext,withBtcContextJournal} from './lib/options-btc-context-io.mjs';
import {listEventObservations,saveEventObservation} from './lib/options-event-intelligence-observation.mjs';
import {saveEmploymentCase} from './lib/options-event-intelligence-employment-case.mjs';

const EVENT_ID='employment-situation-20261002';
const EVENT_TIME='2026-10-02T12:30:00.000Z';
const BLS_WINDOW_START='2026-10-02T12:20:00.000Z';
const fail=code=>{throw Error('EVENT_INTELLIGENCE_EMPLOYMENT_'+code);};
const safeStamp=value=>value.replace(/[:.]/g,'-').toLowerCase();
const headlineId=item=>'employment-news-'+createHash('sha256').update(item.sourceId+'\0'+item.itemId).digest('hex').slice(0,24);

async function defaultAppendBtc(workspace,retrieval){
  return withBtcContextJournal(workspace,store=>store.append(retrieval.input));
}
export async function captureEmploymentWindow({
  workspaceRoot='C:/projects/Alpha',
  now=()=>new Date().toISOString(),
  refreshNews=refreshFocusedNews,
  readNews=readFocusedSupplement,
  retrieveBtc=retrieveBtcContext,
  appendBtc=defaultAppendBtc
}={}){
  const newsRefresh=await refreshNews({workspaceRoot,now});
  const btc=await retrieveBtc({clock:now});
  await appendBtc(workspaceRoot,btc);
  const capturedAt=now();
  const supplement=readNews(workspaceRoot,capturedAt,true);
  const existing=new Set(listEventObservations(workspaceRoot,EVENT_ID,capturedAt).map(x=>x.evidence.evidenceId));
  const saved=[];
  const persist=evidence=>{
    if(existing.has(evidence.evidenceId))return;
    const record=saveEventObservation(workspaceRoot,evidence,evidence.receivedAt);
    existing.add(evidence.evidenceId);saved.push(record.path);
  };
  const bls=supplement.sources.find(x=>x.id==='bls')??null;
  persist({
    evidenceId:'employment-bls-source-status-'+safeStamp(capturedAt),
    eventId:EVENT_ID,kind:'SOURCE_STATUS',sourceId:'bls',
    sourceUrl:'https://www.bls.gov/feed/bls_latest.rss',occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,
    receivedAt:capturedAt,parsedAt:capturedAt,availability:'CURRENT',
    summary:bls?('BLS feed status '+bls.status+'; upstream observedAt '+String(bls.observedAt)+'; '+String(bls.diagnostic??'no diagnostic')):'BLS source health unavailable at capture.',
    supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
  });
  for(const item of supplement.headlines.filter(item=>item.sourceId==='bls'&&item.publishedAt&&item.publishedAt>=BLS_WINDOW_START&&/employment|payroll|unemployment|earnings|jobs/i.test(item.headline))){
    persist({
      evidenceId:headlineId(item),eventId:EVENT_ID,kind:'SOURCE_OBSERVATION',sourceId:'bls',
      sourceUrl:item.link??null,occurredAt:null,sourcePublishedAt:item.publishedAt??null,vendorReceivedAt:null,
      receivedAt:capturedAt,parsedAt:capturedAt,availability:'CURRENT',
      summary:item.headline+'; focused-news upstream observedAt '+String(item.observedAt),
      supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
    });
  }
  const assessment=btc.assessment;
  const sourceTime=assessment?.book?.sourceTime??null;
  persist({
    evidenceId:'employment-btc-'+safeStamp(capturedAt),eventId:EVENT_ID,kind:'MARKET_OBSERVATION',sourceId:'coinbase-btc-context',
    sourceUrl:null,occurredAt:sourceTime,sourcePublishedAt:null,vendorReceivedAt:null,
    receivedAt:capturedAt,parsedAt:capturedAt,availability:assessment?.usableAtReceipt?'CURRENT':'UNKNOWN',
    summary:'BTC-USD midpoint '+String(assessment?.midpointUsd??'UNKNOWN')+'; upstream Alpha BTC receivedAt '+String(assessment?.receivedAt??btc.input?.receivedAt??'UNKNOWN'),
    supersedesEvidenceId:null,expectationSnapshot:null,
    marketObservation:{
      instrument:'BTC-USD',quoteObservedAt:sourceTime??capturedAt,declaredDelayMs:null,session:'TWENTY_FOUR_SEVEN',
      comparability:assessment?.usableAtReceipt?'COMPARABLE':'LIMITED',
      comparabilityReason:'Coinbase public level-1 observation. No IBIT conversion and no causal attribution.'
    }
  });
  const materialized=saveEmploymentCase(workspaceRoot,capturedAt);
  return {version:'EMPLOYMENT_EVENT_WINDOW_CAPTURE_V1',eventId:EVENT_ID,eventTime:EVENT_TIME,capturedAt,
    newsRefreshStatus:newsRefresh.status,btcStatus:assessment?.status??'UNKNOWN',saved,materialized,executionAllowed:false};
}
function parse(argv){
  let workspace='C:/projects/Alpha';
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--workspace'&&argv[i+1]){workspace=argv[++i];continue;}
    if(argv[i]==='--capture')continue;
    if(argv[i]==='--help')return {help:true,workspace};
    fail('ARGUMENT');
  }
  return {help:false,workspace};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const parsed=parse(process.argv.slice(2));
    if(parsed.help)console.log(JSON.stringify({help:'--capture --workspace <Alpha data root>',executionAllowed:false},null,2));
    else console.log(JSON.stringify(await captureEmploymentWindow({workspaceRoot:parsed.workspace}),null,2));
  }catch(error){
    console.error(JSON.stringify({status:'ERROR',code:/^EVENT_INTELLIGENCE_[A-Z_]+$/.test(error?.message)?error.message:'EVENT_INTELLIGENCE_EMPLOYMENT_LOCAL_FAILURE',executionAllowed:false}));
    process.exitCode=2;
  }
}
