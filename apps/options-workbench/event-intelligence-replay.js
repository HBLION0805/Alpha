import {esc,timestamp,words} from './model.js';

const badge=(text,tone='gray')=>`<span class="tag ${tone}">${esc(words(text))}</span>`;
const empty=(title,text)=>`<div class="empty"><div class="empty-icon" aria-hidden="true">◇</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;

const evidenceCard=item=>{
  const link=item.sourceUrl?.startsWith('https://')?`<a href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">原文</a>`:'';
  const expectation=item.expectationSnapshot?`<p class="hint">Expectation stage: <strong>${esc(words(item.expectationSnapshot.stage))}</strong> · Owner confirmed: <strong>${item.expectationSnapshot.ownerConfirmed?'YES':'NO'}</strong></p><ul class="rule-list">${item.expectationSnapshot.rows.map(r=>`<li>${r.selected?'★ ':''}${esc(r.metric)} · ${esc(words(r.expectationType))} · ${esc(r.value??'UNKNOWN')} ${esc(r.unit)} · ${esc(r.source)} · source received ${esc(timestamp(r.sourceReceivedAt))}${r.sampleInfo?` · ${esc(r.sampleInfo)}`:''}</li>`).join('')}</ul>`:'';
  const market=item.marketObservation?`<p class="hint">Market: ${esc(item.marketObservation.instrument)} · ${esc(words(item.marketObservation.session))} · Quote ${esc(timestamp(item.marketObservation.quoteObservedAt))} · Declared delay ${item.marketObservation.declaredDelayMs===null?'Unknown':esc(String(item.marketObservation.declaredDelayMs))+' ms'} · ${esc(words(item.marketObservation.comparability))}</p><p class="hint">${esc(item.marketObservation.comparabilityReason)}</p>`:'';
  return `<article class="headline"><div class="status-line">${badge(item.kind)}${badge(item.availability,item.availability==='CURRENT'?'green':'amber')}</div>
    <h3>${esc(item.summary)}</h3>
    <div class="meta"><span>Alpha 收到 ${esc(timestamp(item.receivedAt))}</span><span>来源 ${esc(item.sourceId)}</span></div>
    <small>Source published: ${esc(item.sourcePublishedAt?timestamp(item.sourcePublishedAt):'Unknown')} · Vendor received: ${esc(item.vendorReceivedAt?timestamp(item.vendorReceivedAt):'Unknown')}</small>
    ${expectation}${market}${item.supersedesEvidenceId?`<p class="hint">更正 / supersedes: ${esc(item.supersedesEvidenceId)}</p>`:''}${link}</article>`;
};

const decisionCard=(item,title)=>item?`<section class="card"><h2>${esc(title)}</h2><div class="status-line">${badge(item.thesisState,item.thesisState==='INVALIDATE'?'red':item.thesisState==='DEGRADE'?'amber':'green')}${badge(item.evidenceCompleteness)}</div>
  <p>${esc(item.reason)}</p><dl class="result-grid"><div><dt>生成时间</dt><dd>${esc(timestamp(item.generatedAt))}</dd></div><div><dt>证据截止</dt><dd>${esc(timestamp(item.evidenceCutoffAt))}</dd></div>
  <div><dt>Decision / Thesis</dt><dd>${esc(item.decisionVersion)} / ${esc(item.thesisVersion)}</dd></div><div><dt>规则 / 模型</dt><dd>${esc(item.ruleVersion)} / ${esc(item.modelVersion)}</dd></div></dl>
  <p class="hint">输入证据: ${esc(item.inputEvidenceIds.join(', ')||'None')}</p>${item.blockers.length?`<p class="error-text">${esc(item.blockers.join(' · '))}</p>`:''}</section>`:empty(title,'该时间点还没有生成历史判断。');
export function eventIntelligencePage(state,ui){
  const component=state.eventIntelligence;
  const head=`<div class="page-heading"><div><p class="eyebrow">POINT-IN-TIME</p><h1>事件回放</h1><p class="subtitle">事件发生前我们知道什么 → 最早收到什么 → 哪些被证实或更正 → 市场如何反应 → 判断如何变化。</p></div></div>`;
  if(!component||component.state!=='AVAILABLE')return head+empty('事件回放不可用',component?.error??'No saved event intelligence data');
  const cases=component.data?.cases??[];
  if(!cases.length)return head+empty('还没有真实事件案例','这里只读取真实保存的案例。Synthetic fixture 只用于测试，不会自动显示在产品页面。');

  const selected=cases.find(x=>x.eventId===ui.eventReplayCase)??cases[0];
  const min=Date.parse(selected.replayStartAt),max=Date.parse(selected.replayEndAt);
  const requested=ui.eventReplayAsOf?Date.parse(ui.eventReplayAsOf):max;
  const current=Math.min(max,Math.max(min,Number.isFinite(requested)?requested:max));
  const asOf=new Date(current).toISOString();
  const requestedView=ui.eventReplayView?.eventId===selected.eventId&&ui.eventReplayView.asOf===asOf?ui.eventReplayView:null;
  const currentView=selected.currentView?.asOf===asOf?selected.currentView:null;
  const view=requestedView??currentView;
  const controls=`<section class="card"><div class="toolbar"><label>案例<select id="event-replay-case">${cases.map(x=>`<option value="${esc(x.eventId)}"${x.eventId===selected.eventId?' selected':''}>${esc(x.title)} · ${esc(words(x.caseType))}</option>`).join('')}</select></label></div>
    <label class="form-field">回放时间 <strong id="event-replay-clock">${esc(timestamp(asOf))}</strong>
      <input id="event-replay-slider" type="range" min="${min}" max="${max}" step="1" value="${current}">
    </label>
    <div class="status-line">${view?badge(view.evidenceCompleteness,view.evidenceCompleteness==='COMPLETE'?'green':'amber'):badge('LOADING','amber')}${badge(selected.caseType)}
    ${view?`<span class="hint">未来证据隐藏 ${view.hiddenFutureEvidenceCount} · 未来历史判断隐藏 ${view.hiddenFutureDecisionCount} · 未来重算隐藏 ${view.hiddenFutureRecomputedDecisionCount}</span>`:''}</div></section>`;

  if(!view)return head+controls+empty('正在读取该时间点','Alpha 只会返回该 as-of 时刻允许看到的证据和历史判断。');

  const before=view.visibleEvidence.filter(x=>['EXPECTATION_SNAPSHOT','PRE_EVENT_STATE'].includes(x.kind));
  const verified=view.visibleEvidence.filter(x=>['SOURCE_OBSERVATION','CORRECTION'].includes(x.kind));
  const market=view.visibleEvidence.filter(x=>x.kind==='MARKET_OBSERVATION');
  const eventClock=selected.eventTime?Date.parse(selected.eventTime):null;
  const first=view.visibleEvidence.find(x=>!['EXPECTATION_SNAPSHOT','PRE_EVENT_STATE'].includes(x.kind)&&(eventClock===null||Date.parse(x.receivedAt)>=eventClock))??null;
  const missing=view.unavailableRequiredEvidenceIds.length||view.unseenRequiredEvidenceCount
    ?`<ul class="rule-list">${view.unavailableRequiredEvidenceIds.map(x=>`<li>已观察但当前不可用：${esc(x)}</li>`).join('')}${view.unseenRequiredEvidenceCount?`<li>${view.unseenRequiredEvidenceCount} 项必需证据在这个时间点尚未被 Alpha 收到；未来证据 ID 不提前显示。</li>`:''}</ul>`
    :'<p>当前所声明的必需证据均可用。</p>';
  const orderNote=`<p class="hint"><strong>${esc(words(view.arrivalOrder))}</strong> · 这里只描述 Alpha 收到新闻与市场观察的先后顺序，不把时序当作因果证明。</p>`;

  return head+controls+
  `<div class="grid-two section-space"><section class="card"><h2>① Before · 当时已知</h2>${before.length?before.map(evidenceCard).join(''):empty('没有可见的事前记录','缺失不代表没有发生；当前只能说证据不足。')}</section>
  <section class="card"><h2>② First Seen · 最早收到</h2>${first?evidenceCard(first):empty('尚无可见信息','拖动时间后，只显示 Alpha 当时已经收到的记录。')}</section></div>
  <div class="grid-two section-space"><section class="card"><h2>③ Verified / Corrected</h2>${verified.length?verified.map(evidenceCard).join(''):empty('尚未验证','没有官方或后续来源确认并不等于事件为假。')}</section>
  <section class="card"><h2>④ Market · 市场观察</h2>${orderNote}${market.length?market.map(evidenceCard).join(''):empty('没有可比较的市场观察','行情缺失或过旧时不生成方向分数。')}</section></div>
  <div class="grid-two section-space">${decisionCard(view.latestHistoricalDecision,'⑤ Original Decision · 当时判断')}<section class="card"><h2>⑥ Missing · 缺失证据</h2>${missing}<p class="hint">Evidence completeness 与 thesis state 独立；缺数据不会自动 MAINTAIN，也不会自动 INVALIDATE。</p></section></div>
  <section class="card section-space"><h2>今天重新计算的判断</h2><p class="hint">这一栏永远不能覆盖 Historical Decision。</p>${view.recomputedDecisions.length?view.recomputedDecisions.map(x=>decisionCard(x,'Recomputed · '+timestamp(x.recomputedAt))).join(''):empty('没有重算结果','V1 不要求为了填满页面而重算历史。')}</section>`;
}
