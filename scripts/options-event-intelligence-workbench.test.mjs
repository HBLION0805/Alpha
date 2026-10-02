import { eventIntelligencePage } from '../apps/options-workbench/event-intelligence-replay.js';

const ok=(v,m)=>{if(!v)throw Error(m);};
const no=(v,m)=>{if(v)throw Error(m);};
const ev=(id,kind,receivedAt)=>({
  evidenceId:id,eventId:'shock-demo',kind,sourceId:kind==='MARKET_OBSERVATION'?'market':'news',
  sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt,parsedAt:receivedAt,
  availability:'CURRENT',summary:id,supersedesEvidenceId:null,
  marketObservation:kind==='MARKET_OBSERVATION'?{
    instrument:'GLD',quoteObservedAt:receivedAt,declaredDelayMs:null,session:'REGULAR',
    comparability:'LIMITED',comparabilityReason:'Test observation keeps provider delay unknown.'
  }:null
});
const decision={
  decisionId:'d1',eventId:'shock-demo',generatedAt:'2026-10-01T18:17:40.000Z',
  evidenceCutoffAt:'2026-10-01T18:17:36.000Z',inputEvidenceIds:['pre-state','price-move','late-headline'],
  decisionVersion:'d-v1',ruleVersion:'r1',modelVersion:'m1',thesisVersion:'t1',thesisState:'DEGRADE',
  evidenceCompleteness:'COMPLETE',reason:'later decision',blockers:[]
};
const earlyView={
  eventId:'shock-demo',asOf:'2026-10-01T18:17:33.000Z',
  visibleEvidence:[ev('pre-state','PRE_EVENT_STATE','2026-10-01T18:00:00.000Z'),ev('price-move','MARKET_OBSERVATION','2026-10-01T18:17:31.000Z')],
  hiddenFutureEvidenceCount:1,visibleHistoricalDecisions:[],hiddenFutureDecisionCount:1,
  latestHistoricalDecision:null,recomputedDecisions:[],hiddenFutureRecomputedDecisionCount:0,evidenceCompleteness:'PARTIAL',
  unavailableRequiredEvidenceIds:[],unseenRequiredEvidenceCount:1,thesisState:null,arrivalOrder:'ORDER_UNKNOWN',executionAllowed:false
};
const laterView={
  ...earlyView,asOf:'2026-10-01T18:17:41.000Z',
  visibleEvidence:[...earlyView.visibleEvidence,ev('late-headline','SOURCE_OBSERVATION','2026-10-01T18:17:35.000Z')],
  hiddenFutureEvidenceCount:0,visibleHistoricalDecisions:[decision],hiddenFutureDecisionCount:0,hiddenFutureRecomputedDecisionCount:0,
  latestHistoricalDecision:decision,evidenceCompleteness:'COMPLETE',unseenRequiredEvidenceCount:0,thesisState:'DEGRADE',arrivalOrder:'PRICE_LEADS_NEWS'
};
const state={
  loadedAt:'2026-10-01T18:18:00.000Z',
  eventIntelligence:{state:'AVAILABLE',data:{cases:[{
    eventId:'shock-demo',caseType:'UNSCHEDULED',title:'Shock demo',eventTime:null,
    createdAt:'2026-10-01T18:00:00.000Z',replayStartAt:'2026-10-01T18:00:00.000Z',
    replayEndAt:'2026-10-01T18:18:00.000Z',currentView:laterView
  }]}}
};

const early=eventIntelligencePage(state,{eventReplayCase:'shock-demo',eventReplayAsOf:earlyView.asOf,eventReplayView:earlyView});
ok(early.includes('price-move'),'price move visible before headline');
no(early.includes('late-headline'),'future headline identity must not reach early page');
no(early.includes('later decision'),'decision generated later must remain hidden');
ok(early.includes('未来证据隐藏 1'),'hidden evidence count shown');
ok(early.includes('1 项必需证据'),'unseen requirement is generic');

const later=eventIntelligencePage(state,{eventReplayCase:'shock-demo',eventReplayAsOf:laterView.asOf,eventReplayView:laterView});
ok(later.includes('late-headline'),'headline appears after receive time');
ok(later.includes('later decision'),'historical decision appears after generation time');

const emptyPage=eventIntelligencePage({loadedAt:state.loadedAt,eventIntelligence:{state:'AVAILABLE',data:{cases:[]}}},{});
ok(emptyPage.includes('还没有真实事件案例'),'production page does not inject fixtures');
console.log('Event intelligence Workbench tests passed');
