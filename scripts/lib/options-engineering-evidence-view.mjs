import {createHash} from 'node:crypto';
import {verifyMockJournalRecords} from './options-isolated-mock-journal.mjs';
import {replaySpyEngineering} from './options-spy-engineering.mjs';
import {replayEngineeringContinuation} from './options-engineering-continuation.mjs';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const check=(v,c)=>{if(!v)throw Error(c);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=v=>createHash('sha256').update(v).digest('hex');
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(v);
const names=['start.json','event-0001.json','event-0002.json'];
const urls=['https://www.cboe.com/tradable_products/sp_500/mini_spx_options/european_style/','https://optionsfacts.cboe.com/'];

/** Saved attribution only. Neither a contract approval nor a source fetch. */
export function projectEngineeringContractEvidence({review,source,schema,result,priorHash,at}){
 check(review.version==='SPY_OFFICIAL_RULE_APPLICABILITY_REVIEW_V1'&&review.status==='PARTIAL_RULE_MAPPING_NO_ENTRY'&&review.priorResultSha256===priorHash&&review.priorResultPreserved===true,'RULE_PRIOR_BINDING');
 check(ns(result.savedAt)<=ns(review.reviewedAt)&&ns(review.reviewedAt)<=ns(at)&&ns(schema.finishedAt)<=ns(result.savedAt),'RULE_CLOCK');
 check(same(review.selectedSeries,{long:result.candidate.long,short:result.candidate.short}),'RULE_SERIES_BINDING');
 check(typeof source==='string'&&urls.every(u=>source.includes(u))&&source.includes('SPY (ETF) options are American style')&&/100 shares of SPY/i.test(source),'RULE_SOURCE_SUPPORT');
 check(same(review.sources.map(s=>s.url),urls)&&review.sources.every(s=>s.publishedAt===null),'RULE_SOURCE_SCOPE');
 const properties=schema.toolSchemas?.get_option_instruments?.outputSchema?.properties?.data?.properties?.instruments?.items?.properties;
 check(properties?.chain_symbol?.description?.startsWith('Underlying ticker')&&properties?.trade_value_multiplier?.description?.includes('Not a share count'),'SCHEMA_SEMANTICS');
 check(review.mapping.exerciseStyle.value==='AMERICAN'&&review.mapping.exerciseStyle.status==='PRODUCT_RULE_SUPPORTED'&&review.mapping.exerciseStyle.directInstrumentFieldReturned===false&&review.mapping.standardDeliverable.applicability==='CONDITIONAL_ON_SELECTED_SERIES_BEING_STANDARD_UNADJUSTED'&&same(review.mapping.standardDeliverable.components,[{symbol:'SPY',shares:100}])&&review.mapping.standardDeliverable.settlement==='PHYSICAL'&&review.mapping.adjustmentStatus.value==='UNKNOWN','RULE_SCOPE_PROMOTION');
 check(review.marketQuoteCalls===0&&review.journalWrites===0&&review.accountContinuationCreated===false&&review.OCC403Retried===false,'RULE_NO_EXECUTION');
 return {status:'PARTIAL_RULE_MAPPING_NO_ENTRY',reviewedAt:review.reviewedAt,sourcePublicationAt:null,sourceReceiptAt:null,sourceClockBasis:'EXACT_SOURCE_RECEIPT_UNKNOWN_REVIEW_CLOCK_ONLY',
  selectedSeries:['long','short'].map(role=>{const x=result.candidate[role];return {role,id:x.id,chainId:x.chain_id,underlying:x.chain_symbol,expiry:x.expiration_date,strike:x.strike_price,type:x.type,reportedState:x.state,reportedTradability:x.tradability,priceMultiplier:x.trade_value_multiplier,minTicks:x.min_ticks};}),
  fields:[{field:'EXACT_IDENTITIES',status:'SAVED_METADATA',value:'UUID / SPY chain / expiry / call / strikes',basis:'ORIGINAL_PROVIDER_RESPONSES'},
   {field:'EXERCISE_STYLE',status:'RULE_MAPPED',value:'AMERICAN',basis:'SPY_SPECIFIC_CBOE_PRODUCT_RULE',directInstrumentFieldReturned:false},
   {field:'DELIVERABLE',status:'CONDITIONAL',value:'100 SPY shares / PHYSICAL',basis:'STANDARD_SPY_PRODUCT_EXAMPLE',condition:'SELECTED_SERIES_STANDARD_UNADJUSTED'},
   {field:'ADJUSTMENT_STATUS',status:'UNKNOWN',value:null,basis:'NO_SAVED_EXACT_SERIES_OR_DOCUMENTED_STANDARD_CLASS_MAPPING'}],
  sources:urls.map((url,i)=>({url,label:i?'Cboe · SPY 实物交割示例':'Cboe · SPY 美式行权规则',publishedAt:null})),
  remainingEvidence:['SELECTED_SERIES_STANDARD_UNADJUSTED_APPLICABILITY','EXACT_DELIVERABLE_APPLICABILITY'],
  acceptanceRoutes:['DIRECT_APPLICABLE_SERIES_DELIVERABLE_AND_ADJUSTMENT_SOURCE','EXACT_IDS_TO_COMPLETE_SERIES_TO_DOCUMENTED_STANDARD_UNADJUSTED_CLASS'],
  retainedEvidenceRequired:['SOURCE_TEXT_AND_LOCATOR','SOURCE_VERSION_AND_APPLICABLE_DATE','EXACT_IDENTITY_MAPPING_STEPS','CONFLICTS_AND_UNKNOWNS'],
  certificateRequired:false,contractQualified:false,quoteCalls:0,simulatedFills:0,accountPermissionEstablished:false,dataEntitlementEstablished:false};
}

/** Pure fixture replay; no recovery or writer is used by a page read. */
export function projectEngineeringFixture({files,hashes,at}){
 const stock=verifyMockJournalRecords(files['account/start.json'],names.slice(1).map(name=>({name,value:files['account/'+name]})),'SPY_ENGINEERING_START_V1');
 const saved=files['fixture-report.json'];check(saved.context==='TEST_FIXTURE_ONLY'&&saved.realAcceptance==='NOT_TESTED'&&ns(saved.acceptedAt)<=ns(at)&&ns(saved.report.asOf)<=ns(saved.acceptedAt),'FIXTURE_SCOPE_OR_CLOCK');
 const parentReport=replaySpyEngineering(stock.manifest.input,stock.events,saved.report.asOf);
 check(stock.manifest.input.context==='SYNTHETIC_FIXTURE'&&parentReport.status==='CLOSED_MODELED','FIXTURE_PARENT');
 const parent={context:'SYNTHETIC_FIXTURE',files:Object.fromEntries(names.map(n=>[n,hashes['account/'+n]])),tipSha256:stock.tip,report:parentReport};
 const prefix='account/option-engineering-01/',start=files[prefix+'start.json'];
 const segment=verifyMockJournalRecords(start,names.slice(1).map(name=>({name,value:files[prefix+name]})),'OPTION_ENGINEERING_SEGMENT_START_V1');
 const p=start.input;check(p.context==='TEST_FIXTURE_ONLY'&&p.accountId===stock.manifest.input.account.id&&/^paper-spy-fixture-/.test(p.accountId),'FIXTURE_CONTEXT');
 let parentClock=ns(stock.manifest.recordedAt);
 check(parentClock>=ns(stock.manifest.input.decisionAt)&&parentClock<=ns(p.spread.decisionAt),'FIXTURE_PARENT_PERSISTENCE');
 for(const name of names.slice(1)){const row=files['account/'+name],clock=ns(row.recordedAt);check(clock>=parentClock&&clock>=ns(row.event.appliedAt)&&clock<=ns(p.spread.decisionAt),'FIXTURE_PARENT_PERSISTENCE');parentClock=clock;}
 check(same(files['account/.option-engineering-claim.json'],{version:'OPTION_ENGINEERING_PARENT_CLAIM_V1',accountId:p.accountId,parent:p.parent,segmentId:p.segmentId,inputSha256:sha(JSON.stringify(p,null,2)+'\n')}),'FIXTURE_CLAIM');
 check(ns(start.recordedAt)>=ns(p.spread.decisionAt)&&ns(start.recordedAt)<=ns(saved.report.asOf),'FIXTURE_START_CLOCK');
 for(const n of names.slice(1)){const row=files[prefix+n],e=row.event,r=JSON.parse(e.original.rawJson);check(ns(row.recordedAt)>=ns(e.appliedAt)&&ns(row.recordedAt)<=ns(saved.report.asOf)&&ns(r.intent.requestedAt)>ns(start.recordedAt),'FIXTURE_EVENT_CLOCK');const response=r.capture.receipts.at(-1).response,body=response.structuredContent??response.structured_content;check(body?.data?.results?.every(x=>ns(x.quote.updated_at)>ns(start.recordedAt)),'FIXTURE_SOURCE_CLOCK');}
 const replay=replayEngineeringContinuation(p,parent,segment.events,saved.report.asOf);
 check(same(replay,saved.report)&&replay.status==='CLOSED_MODELED'&&replay.realOptionAcceptance==='NOT_TESTED','FIXTURE_REPLAY');
 return {status:'PASS_FIXTURE_ONLY',context:'TEST_FIXTURE_ONLY',acceptedAt:saved.acceptedAt,asOf:replay.asOf,accountId:p.accountId,segmentId:p.segmentId,parentTipSha256:stock.tip,segmentTipSha256:segment.tip,events:segment.events.length,replay:'EXACT_REPORT_MATCH',claim:'SINGLE_PARENT_BOUND',realOptionAcceptance:'NOT_TESTED',affectsActualAccount:false};
}

/** Optional append-only binding; failure cannot promote the old stopped attempt. */
export function readEngineeringEvidenceView({read,registry,result,at}){
 const out={state:'MISSING',contract:null,continuation:null,issues:[],sourceCalls:0,fileSystemWrites:0};
 try{
  let b;try{b=read(['engineering-evidence.json']).data;}catch(e){if(e.code==='ENOENT')return out;throw e;}
  check(b.version==='ENGINEERING_EVIDENCE_BINDING_V1'&&ns(b.savedAt)<=ns(at)&&b.accountId===registry.accountId&&same(b.accountFiles,registry.accountFiles)&&b.optionsRunId===registry.options.runId&&b.priorResultSha256===registry.options.reportSha256,'EVIDENCE_BINDING');
  const review=read([b.optionsRunId,'official-rule-applicability-02.json'],b.reviewSha256).data;
  check(ns(review.reviewedAt)<=ns(b.savedAt),'REVIEW_BINDING_CLOCK');
  const source=read([b.optionsRunId,'official-spy-reference-read-02.json'],review.sourceReceiptSha256).data;
  const schema=read([b.optionsRunId,'schema-receipt-01.json'],b.schemaSha256).data;
  out.contract=projectEngineeringContractEvidence({review,source,schema,result,priorHash:b.priorResultSha256,at});
  const f=b.fixture;check(id(f?.runId)&&f.directory==='fixture-originals-02'&&/^[a-f0-9]{40}$/.test(f.commit),'FIXTURE_BINDING');
  const index=read([f.runId,'fixture-originals-final-02-index.json'],f.indexSha256).data;
  const expected=['account/.option-engineering-claim.json',...names.map(n=>'account/'+n),...names.map(n=>'account/option-engineering-01/'+n),'fixture-report.json'].sort();
  check(index.context==='TEST_FIXTURE_ONLY'&&ns(index.savedAt)<=ns(b.savedAt)&&same(Object.keys(index.files).sort(),expected),'FIXTURE_INDEX');
  const files=Object.fromEntries(expected.map(n=>[n,read([f.runId,f.directory,...n.split('/')],index.files[n]).data]));
  check(ns(files['fixture-report.json'].acceptedAt)<=ns(index.savedAt),'FIXTURE_INDEX_CLOCK');
  out.continuation={...projectEngineeringFixture({files,hashes:index.files,at}),runId:f.runId,commit:f.commit,indexSha256:f.indexSha256};out.state='AVAILABLE';
 }catch(e){out.state='BLOCKED';out.contract=null;out.continuation=null;out.issues=[/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'INVALID_ENGINEERING_EVIDENCE'];}
 return out;
}
