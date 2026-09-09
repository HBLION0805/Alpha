import { goldFrameworkCatalog } from '../../src/engines/options-drivers/OptionsGoldFramework.ts';
import { readinessClock } from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';

// Consumes original validated readers. No source fetch, journal write or signal.
export function goldFrameworkView(state, at) {
  readinessClock(at);
  const read = name => state[name]?.state === 'AVAILABLE' ? state[name].data : null;
  const treasury=read('treasury'),focused=read('focusedNews'),guidance=read('guidance'),calendar=read('calendar');
  const knownClock = value => {
    if(typeof value!=='string')return false;
    try{readinessClock(value);return value<=at;}catch{return false;}
  };
  const tr=treasury?.latestRetrieval,row=treasury?.currentRow;
  const macro=read('macroContext');
  const macroEvidence=id=>{const s=macro?.sources?.find(s=>s.id===id);return s?.status==='OK'&&s.latest?.status==='OK'&&knownClock(s.latest.receivedAt)&&knownClock(s.latest.recordedAt)?s.latest:null;};
  const dollar=macroEvidence('dollar'),nowcast=macroEvidence('nowcast'),nominal=macroEvidence('nominal');
  const dollarRow=dollar?.data.rows.at(-1);
  const nominalRow=nominal?.data.rows.at(-1);
  const nominalRate=nominalRow?.ratesBps?.[10]!=null?{kind:'DAILY_NOMINAL_PAR_YIELD',sourceDate:nominalRow.sourceDate,receivedAt:nominal.receivedAt,url:nominal.url,tenYearNominalYieldBps:nominalRow.ratesBps[10],description:'Treasury 10Y nominal par yield '+(nominalRow.ratesBps[10]/100).toFixed(2)+'%; daily context, not an intraday reaction.'}:null;
  const realRate=tr?.status==='OK' && knownClock(tr.receivedAt) && row
    && /^\d{4}-\d{2}-\d{2}$/.test(row.sourceDate) && row.sourceDate<=at.slice(0,10)
    && Number.isSafeInteger(row.ratesBps?.[10])
    ? {sourceDate:row.sourceDate,receivedAt:tr.receivedAt,tenYearRealYieldBps:row.ratesBps[10],url:tr.url,
      sourceDateLagDays:treasury.currentDateLagDays,frequency:'DAILY_INDICATIVE_NOT_INTRADAY',freshness:'SOURCE_DATE_AND_RECEIPT_ONLY'} : null;
  const leads=(focused?.items??[]).filter(h=>h.origin==='PUBLIC_FEED' && h.assets?.includes('GLD')
    && knownClock(h.observedAt) && typeof h.headline==='string');
  const c=goldFrameworkCatalog();
  const areas=c.areas.map(({headlinePattern,...entry})=>{
    const pattern=new RegExp('\\b(?:'+headlinePattern+')\\b','i'),seen=new Set();
    const matching=leads.filter(h=>{
      if(!pattern.test(h.headline))return false;
      const key=h.link||`${h.sourceId}:${h.itemId}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
    const extra=entry.id==='dollar'&&dollarRow?.broadIndexE4!=null?{kind:'BROAD_USD_NOT_DXY',sourceDate:dollarRow.sourceDate,receivedAt:dollar.receivedAt,url:dollar.url,description:'Fed broad USD '+(dollarRow.broadIndexE4/10000).toFixed(4)+'; daily observations in a delayed weekly release.'}:
      entry.id==='inflation'&&nowcast?.data.rows.some(r=>r.valueBps!==null)?{kind:'MODEL_ESTIMATES_NOT_ACTUAL_OR_CONSENSUS',sourceDate:null,receivedAt:nowcast.receivedAt,url:nowcast.url,description:'Saved Cleveland Fed CPI/PCE model estimates. See the macro desk for period, adjustment and benchmark clocks.'}:null;
    const rateEvidence=realRate?(nominalRate?{...realRate,nominal:nominalRate}:realRate):nominalRate;
    return {...entry,numericalCoverage:entry.id==='real_rates'&&rateEvidence?(nominalRate?'PARTIAL_DAILY_RATE_CONTEXT':'PARTIAL_DAILY_REAL_YIELD'):extra?'PARTIAL_'+extra.kind:'NOT_CONNECTED_FOR_CHECKLIST',
      numericEvidence:entry.id==='real_rates'?rateEvidence:extra,
      headlineLeadCount:matching.length,
      headlineLeads:matching.slice(0,3).map(h=>({headline:h.headline,url:h.link,publishedAt:h.publishedAt,receivedAt:h.observedAt,
        freshness:!knownClock(h.publishedAt)?'UNKNOWN_OR_FUTURE_PUBLICATION':Date.parse(at)-Date.parse(h.publishedAt)>72*3600000?'STALE':'RECENT',
        verifiedFact:false})),direction:'UNDETERMINED'};
  });
  const market=guidance?.current;
  const capture=knownClock(market?.marketCapturedAt)?market.marketCapturedAt:null;
  return {...c,assessedAt:at,areas,
    counts:{screenshotAreas:areas.filter(a=>a.screenshotArea!==null).length,additionalChecks:areas.filter(a=>a.screenshotArea===null).length,
      partialNumericalAreas:areas.filter(a=>a.numericEvidence!==null).length},
    partialContext:{marketCapturedAt:capture,
      marketUse:'Saved quote sample only; current underlying OHLCV, NAV and executable option paths are not established.',
      calendarSources:Object.entries(calendar?.sources??{}).filter(([,s])=>s.state==='AVAILABLE'&&knownClock(s.latestReceivedAt)).map(([id,s])=>({id,receivedAt:s.latestReceivedAt,
        refreshOverdue:s.refreshOverdue??null,scope:'SCHEDULE_ONLY_NOT_ACTUAL_OR_CONSENSUS'})),
      readerStates:Object.fromEntries(['treasury','macroContext','focusedNews','guidance','calendar','barQuality'].map(k=>[k,state[k]?.state??'UNAVAILABLE']))},
    limitations:[
      'All 14 screenshot areas are cross-referenced, not fully monitored numerical factors. Seven overlays expand the review checklist.',
      'Prior coverage means catalog content, never live data availability. References are research documentation, not newly connected feeds.',
      'These ordered checklists are analyst hypotheses. No current regime, direction, numerical weight or probability is inferred.',
      'One story can appear in several areas. Headline counts are navigation aids, not independent confirmations or directional votes.',
      'Failed, old, missing or future evidence cannot establish current coverage. Daily real yields cannot confirm an intraday move.',
      'Gold-specific causal signs and priorities must not be copied to IBIT; shared macro drivers can produce different responses.',
    ]};
}
