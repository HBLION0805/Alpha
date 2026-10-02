import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {EMPLOYMENT_SOURCE_URL,readPublicEmploymentFeed,parseDriverFeed} from './lib/options-driver-io.mjs';
import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';
import {retrieveBtcContext,withBtcContextJournal} from './lib/options-btc-context-io.mjs';
import {listEventObservations,saveEventObservation} from './lib/options-event-intelligence-observation.mjs';
import {saveEmploymentCase} from './lib/options-event-intelligence-employment-case.mjs';
import {captureEmploymentRelease} from './lib/options-event-intelligence-assessment.mjs';
import {recordEmploymentAssessment} from './options-event-intelligence-assess.mjs';

const EVENT_ID='employment-situation-20261002';
const EVENT_TIME='2026-10-02T12:30:00.000Z';
const BLS_WINDOW_START=EVENT_TIME;
const fail=code=>{throw Error('EVENT_INTELLIGENCE_EMPLOYMENT_'+code);};
const safeStamp=value=>value.replace(/[:.]/g,'-').toLowerCase();
const headlineId=item=>'employment-news-'+createHash('sha256').update(JSON.stringify([item.sourceId,item.itemId,item.headline,item.publishedAt])).digest('hex').slice(0,24);

/** Fetch the registered BLS feed, not the three-source supplemental feed. */
export async function readEmploymentNews({workspaceRoot,now,fetchFeed=readPublicEmploymentFeed}){
  const requestedAt=now();
  let xml=null,receivedAt=null,parsedAt=null,items=[],diagnostic=null,partial=false;
  try{
    xml=await fetchFeed('bls');
    receivedAt=now();
    if(Date.parse(receivedAt)<Date.parse(requestedAt))throw Error('CLOCK_ROLLBACK');
    const parsed=parseDriverFeed(xml,'bls',receivedAt);
    items=parsed.items;partial=Boolean(parsed.truncated||parsed.rejectedItems);
    parsedAt=now();
  }catch(error){
    receivedAt??=now();parsedAt=now();partial=true;
    diagnostic=/^(?:HTTP_[1-5][0-9]{2}|FEED_[A-Z_]+|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|CLOCK_ROLLBACK)$/.test(error?.message)?error.message:'FETCH_OR_PARSE_FAILED';
  }
  const recordedAt=now();
  if([requestedAt,receivedAt,parsedAt,recordedAt].some(x=>!Number.isFinite(Date.parse(x)))||
    Date.parse(receivedAt)<Date.parse(requestedAt)||Date.parse(parsedAt)<Date.parse(receivedAt)||Date.parse(recordedAt)<Date.parse(parsedAt))fail('NEWS_CLOCK');
  const status=diagnostic?'FAILED':items.length?'OK':'EMPTY';
  const directory='data/runtime/options-event-intelligence/raw-bls/'+recordedAt.slice(0,10);
  io.directory(workspaceRoot,directory);
  const path=directory+'/'+safeStamp(recordedAt)+'-'+randomUUID()+'.json';
  const raw={version:'EMPLOYMENT_BLS_FEED_CAPTURE_V1',sourceId:'bls',url:EMPLOYMENT_SOURCE_URL,requestedAt,receivedAt,parsedAt,recordedAt,status,diagnostic,partial,xml,sha256:xml===null?null:createHash('sha256').update(xml).digest('hex'),executionAllowed:false};
  io.writeExclusive(workspaceRoot,path,Buffer.from(JSON.stringify(raw,null,2)+'\n'));
  return {status:diagnostic||partial?'PARTIAL':'SAVED',path,parsedAt,headlines:items,
    sources:[{id:'bls',status,observedAt:receivedAt,partial,diagnostic}]};
}

async function defaultAppendBtc(workspace,retrieval){
  return withBtcContextJournal(workspace,store=>store.append(retrieval.input));
}
export async function captureEmploymentWindow({
  workspaceRoot='C:/projects/Alpha',
  now=()=>new Date().toISOString(),
  fetchFeed=readPublicEmploymentFeed,
  retrieveBtc=retrieveBtcContext,
  appendBtc=defaultAppendBtc,
  retrieveRelease=captureEmploymentRelease,
  issueAssessment=recordEmploymentAssessment
}={}){
  const startedAt=now();
  // Independent inputs start together. A failed source cannot erase the other source.
  const [newsOutcome,btcOutcome,releaseOutcome]=await Promise.allSettled([
    readEmploymentNews({workspaceRoot,now,fetchFeed}),
    (async()=>{const value=await retrieveBtc({clock:now});await appendBtc(workspaceRoot,value);return value;})(),
    startedAt>=EVENT_TIME?retrieveRelease(workspaceRoot,{now}):Promise.resolve(null)
  ]);
  const capturedAt=now();
  const supplement=newsOutcome.status==='fulfilled'?newsOutcome.value:{status:'FAILED',path:null,parsedAt:capturedAt,sources:[],headlines:[]};
  const btc=btcOutcome.status==='fulfilled'?btcOutcome.value:null;
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
    sourceUrl:EMPLOYMENT_SOURCE_URL,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,
    receivedAt:bls?.observedAt??capturedAt,parsedAt:supplement.parsedAt,availability:bls?.status==='OK'&&!bls.partial?'CURRENT':bls?'UNKNOWN':'MISSING',
    summary:bls?('BLS feed status '+bls.status+'; upstream observedAt '+String(bls.observedAt)+'; '+String(bls.diagnostic??'no diagnostic')):'BLS source health unavailable at capture.',
    supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
  });
  for(const item of supplement.headlines.filter(item=>item.sourceId==='bls'&&(item.publishedAt===null||item.publishedAt<=capturedAt)&&(item.link==='https://www.bls.gov/news.release/archives/empsit_10022026.htm'||(item.publishedAt&&item.publishedAt>=BLS_WINDOW_START&&/^https:\/\/www\.bls\.gov\/news\.release\/empsit(?:[._])/.test(item.link??'')&&/September/i.test(item.headline))))){
    persist({
      evidenceId:headlineId(item),eventId:EVENT_ID,kind:'SOURCE_OBSERVATION',sourceId:'bls',
      sourceUrl:item.link??null,occurredAt:null,sourcePublishedAt:item.publishedAt??null,vendorReceivedAt:null,
      receivedAt:item.observedAt,parsedAt:supplement.parsedAt,availability:'CURRENT',
      summary:item.headline+'; raw BLS feed '+String(supplement.path)+'; source publication metadata is not proof of availability; headline only, numeric fact verification pending.',
      supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
    });
  }
  const assessment=btc?.assessment;
  const sourceTime=assessment?.book?.sourceTime??null;
  if(sourceTime){persist({
    evidenceId:'employment-btc-'+safeStamp(capturedAt),eventId:EVENT_ID,kind:'MARKET_OBSERVATION',sourceId:'coinbase-btc-context',
    sourceUrl:null,occurredAt:sourceTime,sourcePublishedAt:null,vendorReceivedAt:null,
    receivedAt:assessment?.receivedAt??btc?.input?.receivedAt??capturedAt,parsedAt:capturedAt,availability:assessment?.usableAtReceipt?'CURRENT':'UNKNOWN',
    summary:'BTC-USD midpoint '+String(assessment?.midpointUsd??'UNKNOWN')+'; upstream Alpha BTC receivedAt '+String(assessment?.receivedAt??btc?.input?.receivedAt??'UNKNOWN'),
    supersedesEvidenceId:null,expectationSnapshot:null,
    marketObservation:{
      instrument:'BTC-USD',quoteObservedAt:sourceTime,declaredDelayMs:null,session:'TWENTY_FOUR_SEVEN',
      comparability:assessment?.usableAtReceipt?'COMPARABLE':'LIMITED',
      comparabilityReason:'Coinbase public level-1 observation. No IBIT conversion and no causal attribution.'
    }
  });}else{
    persist({evidenceId:'employment-btc-unavailable-'+safeStamp(capturedAt),eventId:EVENT_ID,kind:'SOURCE_STATUS',sourceId:'coinbase-btc-context',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:capturedAt,parsedAt:capturedAt,availability:'UNKNOWN',summary:'BTC source clock or capture unavailable. No market observation or replacement clock was fabricated.',supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null});
  }
  let materialized=saveEmploymentCase(workspaceRoot,capturedAt);
  let issuedAssessment=null,assessmentError=null;
  if(startedAt>=EVENT_TIME){
    if(releaseOutcome.status==='fulfilled'&&releaseOutcome.value?.path){
      try{issuedAssessment=await issueAssessment({workspaceRoot,rawPath:releaseOutcome.value.path,now});materialized=issuedAssessment.materialized;}catch{assessmentError='ASSESSMENT_WRITE_OR_READ_FAILED';}
    }else if(releaseOutcome.status==='rejected'){assessmentError='RELEASE_ARCHIVE_CAPTURE_FAILED';}
  }
  const releaseObserved=listEventObservations(workspaceRoot,EVENT_ID,capturedAt).some(r=>r.evidence.kind==='SOURCE_OBSERVATION'&&r.evidence.sourceId==='bls');
  const blockers=[...(!bls||bls.status!=='OK'||bls.partial?['BLS_SOURCE_UNAVAILABLE_OR_PARTIAL']:[]),...(!releaseObserved?['BLS_RELEASE_NOT_OBSERVED']:[]),...(!sourceTime||!assessment?.usableAtReceipt?['BTC_UNAVAILABLE']:[])];
  return {version:'EMPLOYMENT_EVENT_WINDOW_CAPTURE_V2',eventId:EVENT_ID,eventTime:EVENT_TIME,startedAt,capturedAt,
    captureKind:startedAt>='2026-10-02T12:41:00.000Z'?'POST_WINDOW_REPAIR':'EVENT_WINDOW',
    status:blockers.length?'PARTIAL':'CAPTURED',acceptanceStatus:'NOT_EVALUATED',blockers,
    assessment:issuedAssessment?{decisionPath:issuedAssessment.decisionPath,generatedAt:issuedAssessment.decision.generatedAt,thesisState:issuedAssessment.decision.thesisState,sourceError:issuedAssessment.sourceError}:null,assessmentError,
    newsRefreshStatus:supplement.status,rawBlsPath:supplement.path,btcStatus:assessment?.status??'UNKNOWN',saved,materialized,executionAllowed:false};
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
    else {const result=await captureEmploymentWindow({workspaceRoot:parsed.workspace});console.log(JSON.stringify(result,null,2));if(result.status==='PARTIAL')process.exitCode=3;}
  }catch(error){
    console.error(JSON.stringify({status:'ERROR',code:/^EVENT_INTELLIGENCE_[A-Z_]+$/.test(error?.message)?error.message:'EVENT_INTELLIGENCE_EMPLOYMENT_LOCAL_FAILURE',executionAllowed:false}));
    process.exitCode=2;
  }
}
