import {esc,timestamp,words} from './model.js';

const badge=(text,tone='gray')=>`<span class="tag ${tone}">${esc(words(text))}</span>`;
const empty=(title,text)=>`<div class="empty"><div class="empty-icon" aria-hidden="true">◇</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;

const metricNames={TOTAL_NONFARM_PAYROLL_CHANGE:'非农就业新增',U3_UNEMPLOYMENT_RATE:'失业率',ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_MOM:'平均时薪环比',ALL_PRIVATE_AVERAGE_HOURLY_EARNINGS_YOY:'平均时薪同比',PRIVATE_PAYROLL_CHANGE:'私人部门就业新增',PRIOR_MONTH_PAYROLL_REVISIONS:'前月就业修订'};
const metricName=x=>metricNames[x]??x;
const unitName=x=>x==='THOUSAND_JOBS'?'千人':x==='PERCENT'?'%':x;
const releaseDetails=f=>f?`<div class="result-grid"><strong>官方正文解析</strong><span>原文接收：${esc(timestamp(f.sourceReceivedAt))}</span></div><table><thead><tr><th>指标</th><th>时期</th><th>本次公布</th></tr></thead><tbody>${f.facts.map(r=>`<tr><td>${esc(metricName(r.metric))}</td><td>${esc(r.period)}</td><td>${esc(r.value)} ${esc(unitName(r.unit))}</td></tr>`).join('')}</tbody></table><h4>前月修订（不改写事前快照）</h4>${f.revisions.length?`<table><thead><tr><th>时期</th><th>本篇列出的旧估计</th><th>修订后</th><th>修订差额</th></tr></thead><tbody>${f.revisions.map(r=>`<tr><td>${esc(r.period)}</td><td>${esc(r.previouslyReportedInThisRelease)}</td><td>${esc(r.revisedValue)}</td><td>${esc(r.change)} 千人</td></tr>`).join('')}</tbody></table>`:'<p>尚未解析到可核对的修订。</p>'}<p class="hint">未解析：${esc(f.missingMetrics.map(metricName).join('、')||'无')}。正文解析不等于独立审计，也不等于交易方向。</p><details><summary>查看原文定位与解析版本</summary><p>${esc(f.parserVersion)} · SHA-256 ${esc(f.rawSha256)}</p>${[...f.facts,...f.revisions].map(r=>`<p><strong>${esc(metricName(r.metric))} / ${esc(r.period)}</strong>：${esc(r.locator.quote)}</p>`).join('')}</details>`:'';
const assessmentDetails=d=>{const q=d?.assessmentDetails;if(!q)return '';return `<p class="error-text">${q.prospectivePolicy?'使用事件前登记的规则。':'事后实际生成的评估；缺少事前规则，不能冒充 08:30 已存在的判断。'}</p><h4>什么变化了</h4><table><thead><tr><th>指标</th><th>事前调查预期</th><th>公布值</th><th>差值</th></tr></thead><tbody>${q.surprises.map(r=>`<tr><td>${esc(metricName(r.metric))}</td><td>${esc(r.expected??'缺失')}</td><td>${esc(r.actual)} ${esc(unitName(r.unit))}</td><td>${esc(r.difference??'不计算')}${r.unit==='PERCENT'&&r.difference!==null?' 个百分点':''}</td></tr>`).join('')}</tbody></table><p class="hint">差值只描述与事前保存的调查预期的区别，不推导买卖方向。</p><h4>判断依据与缺口</h4>${q.requirements.map(r=>`<p><strong>${esc(({PRE_EVENT_STATE:'事前市场状态',PRE_EVENT_EXPECTATION:'事前预期',OFFICIAL_RELEASE_FACTS:'官方正文数值',GLD_PRICE:'GLD 即时行情',IBIT_PRICE:'IBIT 即时行情',PREDECLARED_RULES:'事前规则'})[r.id]??r.id)}：${r.available?'可用':'不足'}</strong> — ${esc(r.reason)}</p>`).join('')}<h4>事前条件核对</h4>${q.ruleChecks.length?q.ruleChecks.map(r=>`<p>${esc(r.condition)} → ${esc(r.status)}<br><small>规则 ${esc(r.ruleId)} / ${esc(r.ruleVersion)}，定义于 ${esc(timestamp(r.definedAt))}；证据 ${esc(r.evidenceIds.join(', ')||'缺失')}</small></p>`).join(''):'<p>没有事前登记的可检查规则；未追加事后阈值。</p>'}`;};
const evidenceCard=item=>{
  const link=item.sourceUrl?.startsWith('https://')?`<a href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">原文</a>`:'';
  const expectation=item.expectationSnapshot?`<p class="hint">Expectation stage: <strong>${esc(words(item.expectationSnapshot.stage))}</strong> · Owner confirmed: <strong>${item.expectationSnapshot.ownerConfirmed?'YES':'NO'}</strong></p><ul class="rule-list">${item.expectationSnapshot.rows.filter(r=>r.selected).map(r=>`<li>${r.selected?'★ ':''}${esc(r.metric)} · ${esc(words(r.expectationType))} · ${esc(r.value??'UNKNOWN')} ${esc(r.unit)} · ${esc(r.source)} · source received ${esc(timestamp(r.sourceReceivedAt))}${r.sampleInfo?` · ${esc(r.sampleInfo)}`:''}</li>`).join('')}</ul>`:'';
  const otherExpectations=item.expectationSnapshot?.rows.filter(r=>!r.selected)??[];
  const expectationHistory=otherExpectations.length?`<details><summary>查看 ${otherExpectations.length} 项旧研究、模型估计与未知字段</summary><ul>${otherExpectations.map(r=>`<li>${esc(metricName(r.metric))} · ${esc(words(r.expectationType))} · ${esc(r.value??'未知')} ${esc(unitName(r.unit))} · ${esc(r.source)} · 收到 ${esc(timestamp(r.sourceReceivedAt))}</li>`).join('')}</ul></details>`:'';
  const diagnosedMissing=item.sourceId==='bls'&&item.availability==='CURRENT'&&item.summary.includes('health unavailable');
  const auditNote=diagnosedMissing?'<p class="error-text">事后审计提示：原始记录将缺少来源误标为 CURRENT。原文保留，但不能作为可用来源证据。</p>':'';
  const market=item.marketObservation?`<p class="hint">Market: ${esc(item.marketObservation.instrument)} · ${esc(words(item.marketObservation.session))} · Quote ${esc(timestamp(item.marketObservation.quoteObservedAt))} · Declared delay ${item.marketObservation.declaredDelayMs===null?'Unknown':esc(String(item.marketObservation.declaredDelayMs))+' ms'} · ${esc(words(item.marketObservation.comparability))}</p><p class="hint">${esc(item.marketObservation.comparabilityReason)}</p>`:'';
  return `<article class="headline"><div class="status-line">${badge(item.kind)}${badge(item.availability,item.availability==='CURRENT'&&!diagnosedMissing?'green':'amber')}</div>
    <h3>${esc(item.summary)}</h3>${auditNote}
    <div class="meta"><span>Alpha 收到 ${esc(timestamp(item.receivedAt))}</span><span>解析完成 ${esc(item.parsedAt?timestamp(item.parsedAt):'未知')}</span><span>来源 ${esc(item.sourceId)}</span></div>
    <small>Source published: ${esc(item.sourcePublishedAt?timestamp(item.sourcePublishedAt):'Unknown')} · Vendor received: ${esc(item.vendorReceivedAt?timestamp(item.vendorReceivedAt):'Unknown')}</small>
    ${releaseDetails(item.releaseFacts)}${expectation}${expectationHistory}${market}${item.supersedesEvidenceId?`<p class="hint">更正 / supersedes: ${esc(item.supersedesEvidenceId)}</p>`:''}${link}</article>`;
};

const decisionCard=(item,title)=>item?`<section class="card"><h2>${esc(title)}</h2><div class="status-line">${badge(item.thesisState,item.thesisState==='INVALIDATE'?'red':['DEGRADE','UNEVALUABLE'].includes(item.thesisState)?'amber':'green')}${badge(item.evidenceCompleteness)}${item.generatorType?badge(item.generatorType):''}</div>
  <p>${esc(item.reason)}</p>${assessmentDetails(item)}<dl class="result-grid"><div><dt>生成时间</dt><dd>${esc(timestamp(item.generatedAt))}</dd></div><div><dt>证据截止</dt><dd>${esc(timestamp(item.evidenceCutoffAt))}</dd></div>
  <div><dt>Decision / Thesis</dt><dd>${esc(item.decisionVersion)} / ${esc(item.thesisVersion)}</dd></div><div><dt>规则 / 生成器</dt><dd>${esc(item.ruleVersion)} / ${esc(item.generatorType??'LEGACY')}</dd></div><div><dt>模型</dt><dd>${item.modelVersion===null?'未使用模型':esc(item.modelVersion??'Legacy')}</dd></div><div><dt>Decision latency</dt><dd>${Number.isSafeInteger(item.decisionLatencyMs)?esc(String(item.decisionLatencyMs))+' ms':'未记录'}${item.latencyPolicyVersion?` · ${esc(item.latencyPolicyVersion)}`:''}</dd></div></dl>
  <p class="hint">触发证据: ${esc(item.triggerEvidenceIds?.join(', ')||'未记录')} · 输入证据: ${esc(item.inputEvidenceIds.join(', ')||'None')}</p>${item.blockers.length?`<p class="error-text">${esc(item.blockers.join(' · '))}</p>`:''}</section>`:empty(title,'该时间点还没有生成历史判断。');
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

  const allBefore=view.visibleEvidence.filter(x=>['EXPECTATION_SNAPSHOT','PRE_EVENT_STATE'].includes(x.kind));
  const states=allBefore.filter(x=>x.kind==='PRE_EVENT_STATE');
  const before=allBefore.filter(x=>x.kind==='EXPECTATION_SNAPSHOT').concat(states.slice(-1));
  const olderStates=states.slice(0,-1);
  const verified=view.visibleEvidence.filter(x=>['SOURCE_OBSERVATION','CORRECTION'].includes(x.kind));
  const allMarket=view.visibleEvidence.filter(x=>x.kind==='MARKET_OBSERVATION');
  const market=allMarket.slice(-3),olderMarket=allMarket.slice(0,-3);
  const eventClock=selected.eventTime?Date.parse(selected.eventTime):null;
  const first=view.visibleEvidence.find(x=>!['EXPECTATION_SNAPSHOT','PRE_EVENT_STATE'].includes(x.kind)&&(eventClock===null||Date.parse(x.receivedAt)>=eventClock))??null;
  const missing=view.unavailableRequiredEvidenceIds.length||view.unseenRequiredEvidenceCount
    ?`<ul class="rule-list">${view.unavailableRequiredEvidenceIds.map(x=>`<li>已观察但当前不可用：${esc(x)}</li>`).join('')}${view.unseenRequiredEvidenceCount?`<li>${view.unseenRequiredEvidenceCount} 项必需证据在这个时间点尚未被 Alpha 收到；未来证据 ID 不提前显示。</li>`:''}</ul>`
    :'<p>当前所声明的必需证据均可用。</p>';
  const orderNote=`<p class="hint"><strong>${esc(words(view.arrivalOrder))}</strong> · 这里只描述 Alpha 收到新闻与市场观察的先后顺序，不把时序当作因果证明。</p>`;

  const d=view.latestHistoricalDecision;
  const decisionSummary=d?`<section class="card section-space"><h2>这个时间点的判断：${esc(({UNEVALUABLE:'证据不足，无法评估',MAINTAIN:'维持',DEGRADE:'降级',INVALIDATE:'失效'})[d.thesisState]??d.thesisState)}</h2><p>实际生成于 ${esc(timestamp(d.generatedAt))}。${esc(d.reason)}</p>${d.assessmentDetails&&!d.assessmentDetails.prospectivePolicy?'<p class="error-text">这是事后实际生成的评估，不是 08:30 已存在的判断；原窗口验收仍未通过。</p>':''}</section>`:'';
  return head+controls+decisionSummary+
  `<div class="grid-two section-space"><section class="card"><h2>① Before · 当时已知</h2>${before.length?before.map(evidenceCard).join(''):empty('没有可见的事前记录','缺失不代表没有发生；当前只能说证据不足。')}${olderStates.length?`<details><summary>查看更早的 ${olderStates.length} 份事前快照</summary>${olderStates.map(evidenceCard).join('')}</details>`:''}</section>
  <section class="card"><h2>② First Seen · 最早收到</h2>${first?evidenceCard(first):empty('尚无可见信息','拖动时间后，只显示 Alpha 当时已经收到的记录。')}</section></div>
  <div class="grid-two section-space"><section class="card"><h2>③ Verified / Corrected</h2>${verified.length?verified.map(evidenceCard).join(''):empty('尚未验证','没有官方或后续来源确认并不等于事件为假。')}</section>
  <section class="card"><h2>④ Market · 市场观察</h2>${orderNote}${market.length?market.map(evidenceCard).join(''):empty('没有可比较的市场观察','行情缺失或过旧时不生成方向分数。')}${olderMarket.length?`<details><summary>查看更早的 ${olderMarket.length} 项市场观察</summary>${olderMarket.map(evidenceCard).join('')}</details>`:''}</section></div>
  <div class="grid-two section-space">${decisionCard(view.latestHistoricalDecision,'⑤ Original Decision · 当时判断')}<section class="card"><h2>⑥ Missing · 缺失证据</h2>${missing}<p class="hint">Evidence completeness 与 thesis state 独立；缺数据不会自动 MAINTAIN，也不会自动 INVALIDATE。</p></section></div>
  <section class="card section-space"><h2>今天重新计算的判断</h2><p class="hint">这一栏永远不能覆盖 Historical Decision。</p>${view.recomputedDecisions.length?view.recomputedDecisions.map(x=>decisionCard(x,'Recomputed · '+timestamp(x.recomputedAt))).join(''):empty('没有重算结果','V1 不要求为了填满页面而重算历史。')}</section>`;
}
