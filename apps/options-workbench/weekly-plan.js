import {esc,timestamp} from './model.js';

const categories={ECONOMIC_DATA:'经济数据',CENTRAL_BANK:'央行',EARNINGS:'财报',COMPANY_EVENT:'公司事件',CONFERENCE:'会议',TREASURY_OR_FISCAL:'财政与国债',POLICY_GEOPOLITICAL:'政策与地缘政治',OPTIONS_MARKET:'期权市场',OTHER_SCHEDULED_EVENT:'其他已安排事件',UNSCHEDULED_NEWS_WATCH:'突发新闻关注'};
const domains={macroDataCoverage:'经济数据',centralBankCoverage:'央行',earningsCoverage:'财报',companyEventCoverage:'公司事件',conferenceCoverage:'会议',treasuryFiscalCoverage:'财政与国债',policyGeopoliticalCoverage:'政策与地缘政治',optionsMarketCoverage:'期权市场',newsRiskCoverage:'新闻风险'};
const coverageLabels={REVIEWED:'已复核',MISSING_SOURCE:'缺少来源',UNKNOWN:'未知',NOT_APPLICABLE:'不适用'};
const precisionLabels={EXACT_TIME:'明确时间',DATE_ONLY:'仅有日期，时间未知',DATE_RANGE:'日期范围，具体时间未知',UNKNOWN:'时间未知'};
const nyDay=new Intl.DateTimeFormat('zh-CN',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'long'});
const raw=value=>`<span translate="no">${esc(value)}</span>`;
const lines=value=>String(value??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const csv=value=>String(value??'').split(',').map(x=>x.trim()).filter(Boolean);
export const emptyWeeklyDraft=()=>({manualEvents:[],newsWatch:[],notes:'',noTradeConditions:[],eventResearchRefs:[]});
export function weeklyDraftFromState(data){
  const latest=data?.latest;
  if(latest?.requestPlan)return structuredClone(latest.requestPlan);
  if(latest?.plan)return {manualEvents:structuredClone(latest.plan.events?.filter(e=>e.sourceCharacter==='OWNER_DECLARED'||e.sourceCharacter==='UNVERIFIED')??[]),newsWatch:[...(latest.plan.newsWatch??[])],notes:latest.plan.notes??'',noTradeConditions:[...(latest.plan.noTradeConditions??[])],eventResearchRefs:[...(latest.plan.eventResearchRefs??[])]};
  return emptyWeeklyDraft();
}
export function weeklyPlanFromForm(form,draft){
  const values=Object.fromEntries(new FormData(form));
  return {manualEvents:structuredClone(draft?.manualEvents??[]),newsWatch:lines(values.newsWatch),notes:String(values.notes??''),noTradeConditions:lines(values.noTradeConditions),eventResearchRefs:lines(values.eventResearchRefs)};
}
export function weeklyEventFromForm(form,currentId){
  const f=Object.fromEntries(new FormData(form)),precision=f.timePrecision;
  const start=String(f.startAt??'').trim(),end=String(f.endAt??'').trim();
  if(precision==='EXACT_TIME'&&!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(start))throw Error('请填写明确的 UTC 时间，例如 2026-10-02T12:30:00.000Z。');
  if(['DATE_ONLY','DATE_RANGE'].includes(precision)&&!/^20\d\d-\d\d-\d\d$/.test(start))throw Error('请填写日期，格式为 YYYY-MM-DD。');
  if(precision==='DATE_RANGE'&&!/^20\d\d-\d\d-\d\d$/.test(end))throw Error('日期范围需要结束日期，格式为 YYYY-MM-DD。');
  if(precision==='UNKNOWN'&&start)throw Error('时间未知时请留空开始时间。');
  const clock=value=>value.trim()||null;
  for(const name of ['retrievedAt','publishedAt'])if(clock(String(f[name]??''))&&!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(f[name]))throw Error('来源时间必须是完整 UTC 时间，或留空。');
  return {eventId:currentId??`event-${crypto.randomUUID()}`,category:f.category,title:String(f.title??'').trim(),startAt:precision==='UNKNOWN'?null:start,endAt:precision==='DATE_ONLY'||precision==='UNKNOWN'?null:clock(end),timezone:'America/New_York',timePrecision:precision,sourceId:String(f.sourceId??'').trim(),sourceRef:clock(String(f.sourceRef??'')),retrievedAt:clock(String(f.retrievedAt??'')),publishedAt:clock(String(f.publishedAt??'')),affectedSymbols:csv(f.affectedSymbols),affectedThemes:csv(f.affectedThemes),notes:String(f.notes??''),status:'SCHEDULED_UNVERIFIED',sourceCharacter:f.sourceCharacter};
}
const list=(items,empty)=>Array.isArray(items)&&items.length?`<ul>${items.map(x=>`<li>${typeof x==='string'?raw(x):raw(x?.title??x?.note??x?.text??x?.symbol??JSON.stringify(x))}</li>`).join('')}</ul>`:`<p class="hint">${empty}</p>`;
const unknownLabel=value=>{const [key,status]=String(value).split(':').map(x=>x.trim());return `${domains[key]??key}：${coverageLabels[status]??status??'未知'}`;};
const unknownList=values=>Array.isArray(values)&&values.length?`<ul>${values.map(x=>`<li>${esc(unknownLabel(x))}</li>`).join('')}</ul>`:'<p class="hint">暂无额外记录；请核对上方覆盖缺口。</p>';
const assetList=values=>Array.isArray(values)&&values.length?`<ul>${values.map(a=>{
  const owner={WATCH:'Owner 关注研究，非买入建议',FUTURE_WATCH:'未来关注，非当前交易候选',EXCLUDED:'Owner 已排除，不纳入当前监测'}[a.ownerStatus]??'Owner 状态未知';
  const identity=a.identityStatus==='VERIFIED'?'身份已核实':'身份待独立核实';
  return `<li><strong>${raw(a.symbol??'')}</strong>${a.themes?.length?` · 主题：${a.themes.map(raw).join('、')}`:''}<br><span class="hint">${owner} · ${identity}</span></li>`;
}).join('')}</ul>`:'<p class="hint">当前没有已保存的研究范围。关注不表示买入。</p>';
function referenceList(preview){
  const refs=preview?.eventResearchRefs??[],evidence=new Map((preview?.referenceEvidence??[]).map(x=>[x.id,x]));
  if(!refs.length)return '<p class="hint">尚未关联事件研究或计划草稿。</p>';
  return `<ul class="weekly-references">${refs.map(id=>{const r=evidence.get(id),draft=r?.kind==='MANUAL_PLAN_DRAFT';
    return `<li><strong>${raw(id)}</strong>${r?`<p>${draft?'现有已保存的计划草稿，仅供引用；仍未冻结或创建交易':'现有事件研究个案'} · 保存时间 ${raw(r.savedAt)}（纽约时间 ${esc(timestamp(r.savedAt))}）</p><p>原始路径：${raw(r.sourcePath)}<br>原始指纹：${raw(r.sourceFingerprint)}</p>`:'<p class="hint">此引用没有可显示的来源回执。</p>'}<a href="${draft?'#planner':'#event-research'}">${draft?'打开交易计划':'打开事件研究'} →</a></li>`;
  }).join('')}</ul>`;
}
const dataOf=state=>state?.weeklyPlan?.data??null;
const coverageState=value=>typeof value==='string'?value:value?.status??value?.state??'UNKNOWN';
const coverageIncomplete=coverage=>Object.values(domains).length&&Object.keys(domains).some(key=>coverageState(coverage?.[key])!=='REVIEWED'&&coverageState(coverage?.[key])!=='NOT_APPLICABLE');

export function weeklyPlanStatusCard(state){
  const d=dataOf(state),latest=d?.latest,week=d?.weekStartDate&&d?.weekEndDate?`${esc(d.weekStartDate)}—${esc(d.weekEndDate)}`:'当前目标周';
  const message=!latest?'本周交易计划：尚未建立':coverageIncomplete(latest?.plan?.coverage??latest?.coverage??d?.preview?.coverage)?'本周交易计划：信息覆盖不完整':'本周交易计划：已复核';
  return `<section class="card weekly-status section-space" aria-label="每周交易计划状态"><div><h2>${message}</h2><p class="hint">${week} · 计划只用于复核已知事项，不改变每日决策或交易权限。</p></div><a class="button secondary small" href="#weekly-plan">查看每周交易计划 →</a></section>`;
}

function eventTime(event){
  const precision=event.timePrecision??event.precision??'UNKNOWN';
  if(precision==='EXACT_TIME'&&event.startAt)return `${timestamp(event.startAt)}${event.endAt?'—'+timestamp(event.endAt):''} · 纽约时间`;
  if(precision==='DATE_RANGE')return `${esc(event.startDate??event.startAt??'日期未知')}—${esc(event.endDate??event.endAt??'日期未知')} · 日期范围`;
  return `${esc(event.startDate??event.startAt??'日期未知')} · ${precisionLabels[precision]??'时间未知'}`;
}
function eventCard(event){
  const source=event.sourceId??event.sourceReference??event.source??null;
  const character={OFFICIAL_SAVED:'已保存官方来源',OWNER_DECLARED:'Owner 声明，尚未核实',UNVERIFIED:'未经核实'}[event.sourceCharacter]??'来源性质未知';
  const status={CANCELLED:'已取消，不作为待执行事件',TENTATIVE:'暂定，需再次核实',CONFIRMED:'来源标记已确认',UNSPECIFIED:'状态未指定',NOT_INDEPENDENTLY_VERIFIED:'尚未独立核实'}[event.status]??event.status??'状态未知';
  return `<article class="weekly-event"><div class="weekly-event-head"><strong translate="no">${esc(event.title??'未命名事件')}</strong><span class="tag gray">${categories[event.category]??'其他事件'}</span></div><p>${eventTime(event)} · 来源状态：${esc(status)}</p><p>来源：${source?raw(source):'未提供'} · ${character}</p>${event.sourceRef?`<p>来源引用：${raw(event.sourceRef)}</p>`:''}${event.retrievedAt?`<p>接收：${esc(timestamp(event.retrievedAt))}</p>`:''}${event.publishedAt?`<p>发布：${esc(timestamp(event.publishedAt))}</p>`:''}${event.affectedSymbols?.length?`<p>标的：${event.affectedSymbols.map(raw).join('、')}</p>`:''}${event.notes?`<p>备注：${raw(event.notes)}</p>`:''}</article>`;
}
function newYorkDate(at){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
function occursOn(event,day){if(event.timePrecision==='UNKNOWN')return false;const begin=event.timePrecision==='EXACT_TIME'?newYorkDate(event.startAt):event.startAt;const end=event.endAt?(event.timePrecision==='EXACT_TIME'?newYorkDate(event.endAt):event.endAt):begin;return begin<=day&&end>=day;}
function timeline(preview,weekStartDate){
  const events=Array.isArray(preview?.events)?preview.events:[];
  if(!weekStartDate)return '<p class="hint">目标周尚未确定。</p>';
  return `<div class="weekly-days">${Array.from({length:5},(_,i)=>{
    const date=new Date(`${weekStartDate}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+i);const day=date.toISOString().slice(0,10);
    const matching=events.filter(e=>occursOn(e,day));
    return `<section class="weekly-day"><h3>${esc(nyDay.format(date))}</h3>${matching.length?matching.map(eventCard).join(''):'<p class="hint">暂无已保存的事件证据；不能据此断定当天没有事件。</p>'}</section>`;
  }).join('')}</div>${events.some(e=>e.timePrecision==='UNKNOWN')?`<div class="weekly-unknown-events"><h3>时间尚未确定</h3>${events.filter(e=>e.timePrecision==='UNKNOWN').map(eventCard).join('')}</div>`:''}`;
}
function dailyPanel(daily,events=[]){
  const days=Array.isArray(daily)?daily:Object.entries(daily??{}).map(([date,value])=>({date,...value}));
  if(!days.length)return '<p class="hint">尚无分日复核项目。</p>';
  const eventTitles=new Map(events.map(e=>[e.eventId,e.title]));
  const eventList=(ids,empty)=>list((ids??[]).map(id=>eventTitles.get(id)??id),empty);
  return `<div class="weekly-days">${days.map(day=>`<article class="weekly-day"><h3>${esc(day.date??day.day??'日期未知')}</h3><h4>开盘前</h4>${eventList(day.beforeMarket??day.before,'核对当天事件与所需证据。')}<h4>交易时段</h4>${eventList(day.duringMarket??day.during,'留意已知事件节点与时间风险。')}<h4>收盘后</h4>${eventList(day.afterMarket??day.after,'复核公布结果与原计划差异。')}</article>`).join('')}</div>`;
}
function revisionPanel(revisions){
  if(!revisions?.length)return '<p class="hint">尚无已复核版本或修订。</p>';
  return `<ol class="weekly-revisions">${revisions.map(r=>`<li><strong>${r.state==='AMENDMENT'?'追加修订':'已复核版本'} ${esc(r.revision??r.revisionId??'')}</strong><p>${esc(timestamp(r.savedAt??r.reviewedAt??r.createdAt))} · 指纹 ${raw(r.fingerprint??'未知')}</p>${r.plan?.notes?`<p>说明：${raw(r.plan.notes)}</p>`:''}</li>`).join('')}</ol>`;
}
function sourcePanel(evidence){
  if(!evidence)return '<p class="hint">尚无可核对的来源回执。</p>';
  const sourceStates={AVAILABLE:'可用',MISSING:'缺失',BLOCKED:'已阻止'};
  return `<div class="weekly-sources">${Object.entries(evidence).map(([key,value])=>`<div><strong>${key==='bls'?'BLS 发布日历':key==='fomc'?'FOMC 会议日历':esc(key)}</strong><p>状态：${sourceStates[value?.state]??'未知'} · 最近接收：${value?.latestReceivedAt?esc(timestamp(value.latestReceivedAt)):'未知'}</p><p>最近可用来源：${value?.lastKnownReceivedAt?esc(timestamp(value.lastKnownReceivedAt)):'未知'} · ${value?.refreshOverdue?'时效需重新复核':'时效状态未知或未过期'}</p>${value?.url?`<p>来源：${raw(value.url)}</p>`:''}</div>`).join('')}</div>`;
}
function eventEditor(ui){
  const d=ui.weeklyEventDraft??{},selected=ui.weeklyEventIndex,field=(name,label,placeholder='',required=false)=>`<label class="form-field">${label}<input name="${name}" value="${esc(d[name]??'')}" placeholder="${esc(placeholder)}"${required?' required':''}></label>`;
  return `<section class="card section-space"><h2>${Number.isInteger(selected)?'修改人工事件':'加入来源说明的人工事件'}</h2><p class="hint">人工录入仅保留 Owner 声明或未核实的来源性质；不会替代官方日历。</p><form id="weekly-event-form" class="form-grid"><label class="form-field">类别<select name="category">${Object.entries(categories).filter(([key])=>key!=='UNSCHEDULED_NEWS_WATCH').map(([key,label])=>`<option value="${key}"${d.category===key?' selected':''}>${label}</option>`).join('')}</select></label><label class="form-field">时间精度<select name="timePrecision">${Object.entries(precisionLabels).map(([key,label])=>`<option value="${key}"${d.timePrecision===key?' selected':''}>${label}</option>`).join('')}</select></label>${field('title','事件标题','保留来源原标题',true)}${field('startAt','开始日期或 UTC 时间','仅日期 2026-10-02；明确时间 2026-10-02T12:30:00.000Z')}${field('endAt','结束日期或 UTC 时间（可选）','日期范围必填')}${field('sourceId','来源名称或标识','例如公司投资者关系页面',true)}${field('sourceRef','来源引用（可选）','原始网址或文档标识')}${field('retrievedAt','接收时间 UTC（可选）','2026-09-27T14:00:00.000Z')}${field('publishedAt','发布时间 UTC（可选）','2026-09-27T13:00:00.000Z')}${field('affectedSymbols','相关标的（逗号分隔）','GLD, IBIT')}${field('affectedThemes','相关主题（逗号分隔）','黄金, 利率')}<label class="form-field">来源性质<select name="sourceCharacter"><option value="OWNER_DECLARED"${d.sourceCharacter==='OWNER_DECLARED'?' selected':''}>Owner 声明，尚未核实</option><option value="UNVERIFIED"${d.sourceCharacter==='UNVERIFIED'?' selected':''}>未经核实</option></select></label><label class="form-field full">备注<textarea name="notes" rows="3">${esc(d.notes??'')}</textarea></label><div class="form-actions full"><button class="button secondary" type="submit">${Number.isInteger(selected)?'保存此事件修改':'加入草稿'}</button>${Number.isInteger(selected)?'<button class="button secondary" id="weekly-event-cancel" type="button">取消修改</button>':''}</div><p id="weekly-event-error" class="error-text full" role="alert"></p></form></section>`;
}
function planEditor(data,ui){
  const draft=ui.weeklyDraft??weeklyDraftFromState(data),latest=data.latest,preview=ui.weeklyPreview;
  return `<section class="card section-space"><h2>${latest?'准备追加修订':'准备本周复核'}</h2><p class="hint">先预览当前草稿，再明确保存。保存后原版本不会被覆盖。多行输入每行一项。</p><form id="weekly-plan-form"><div class="weekly-edit-grid"><label>突发新闻关注主题<textarea name="newsWatch" rows="4">${esc(draft.newsWatch.join('\n'))}</textarea></label><label>暂不交易／等待条件<textarea name="noTradeConditions" rows="4">${esc(draft.noTradeConditions.join('\n'))}</textarea></label><label>事件研究／计划草稿引用<textarea name="eventResearchRefs" rows="3">${esc(draft.eventResearchRefs.join('\n'))}</textarea></label><label>本周复核说明<textarea name="notes" rows="3">${esc(draft.notes)}</textarea></label></div><div class="form-actions"><button class="button secondary" type="submit" value="PREVIEW">预览当前草稿</button><button class="button primary" type="submit" value="${latest?'AMEND':'REVIEW'}"${preview?'':' disabled'}>${latest?'明确保存追加修订':'明确复核并保存'}</button></div><p id="weekly-plan-error" class="error-text" role="alert"></p></form><div id="weekly-plan-preview">${preview?`<p class="success-text">已预览当前草稿 · 指纹 ${raw(preview.fingerprint)}。请核对上方事件和覆盖状态，再明确保存。</p>`:'<p class="hint">尚未预览任何本地修改。</p>'}</div><h3>人工事件草稿</h3>${draft.manualEvents.length?`<div class="weekly-manual-events">${draft.manualEvents.map((e,i)=>`<article>${eventCard(e)}<div class="form-actions"><button class="button secondary small" type="button" data-weekly-event-edit="${i}">修改</button><button class="button secondary small" type="button" data-weekly-event-remove="${i}">移除</button></div></article>`).join('')}</div>`:'<p class="hint">尚未加入人工事件。现有 BLS/FOMC 证据独立读取。</p>'}</section>${eventEditor(ui)}`;
}
export function weeklyPlanPage(state,ui={}){
  const component=state?.weeklyPlan,d=dataOf(state),latest=d?.latest,preview=ui.weeklyPreview??latest?.plan??d?.preview,coverage=preview?.coverage??{};
  const header='<div class="page-heading"><div><p class="eyebrow">每周先看已知事项</p><h1>每周交易计划</h1><p class="subtitle">把事件、风险、证据缺口与等待条件放在同一周内复核。任何单项交易仍需独立计划和现有风险检查。</p></div></div>';
  if(!d)return `<div id="weekly-plan">${header}<section class="card"><h2>本周交易计划：尚未建立</h2><p>本地计划证据暂不可用。请重新读取已保存数据。</p><p class="error-text">${esc(component?.error??'')}</p></section></div>`;
  return `<div id="weekly-plan">${header}${weeklyPlanStatusCard(state)}
    <section class="card section-space"><div class="card-head"><div><h2>${esc(d.weekStartDate)}—${esc(d.weekEndDate)}</h2><p>状态：${ui.weeklyPreview?'待保存的本地预览':latest?'已复核快照；后续信息须预览并追加修订':'草稿预览；尚未复核保存'} · 证据检查时间 ${esc(timestamp(preview?.assessedAt??d.assessedAt))}</p></div></div><p class="hint">此页仅读取已保存的本地证据。缺少来源不代表本周没有事件；事件类别不表示方向或交易建议。</p></section>
    <section class="card section-space"><h2>信息覆盖</h2><div class="weekly-coverage">${Object.entries(domains).map(([key,label])=>`<div><strong>${label}</strong><span class="tag ${coverageState(coverage[key])==='REVIEWED'?'green':'amber'}">${coverageLabels[coverageState(coverage[key])]??'未知'}</span></div>`).join('')}</div><p class="hint">财报、公司活动和会议需要可追溯的来源；缺少来源时继续显示缺口。</p></section>
    <section class="card section-space"><h2>周一至周五已知事件</h2>${timeline(preview,d.weekStartDate)}</section>
    <section class="card section-space"><h2>每日复核</h2>${dailyPanel(preview?.daily,preview?.events)}</section>
    <div class="weekly-two"><section class="card section-space"><h2>购物清单研究范围（不含已排除项）</h2><h3>突发新闻关注主题</h3>${list(preview?.newsWatch,'未来的新闻无法提前列入日历；当前没有已保存的关注主题。')}<h3>标的与主题</h3>${assetList(preview?.monitoredAssets)}</section><section class="card section-space"><h2>重要未知与等待条件</h2>${unknownList(preview?.unknowns)}<h3>暂不交易／等待</h3>${list(preview?.noTradeConditions,'尚未记录额外等待条件；原有交易与风险门槛仍适用。')}</section></div>
    <section class="card section-space"><h2>事件研究／计划草稿引用</h2>${referenceList(preview)}<p class="hint">引用保留原有个案身份和状态，不会冻结草稿或创建交易。</p></section>
    ${planEditor(d,ui)}
    <section class="card section-space"><h2>保存的来源回执</h2>${sourcePanel(preview?.sourceEvidence)}<h3>现有新闻背景</h3>${list(preview?.newsContext,'没有可用的已保存新闻背景；不能据此断定没有新闻。')}</section>
    <section class="card section-space"><h2>已复核版本与追加修订</h2>${revisionPanel(d.revisions)}<p class="hint">已复核版本保持原样；新信息需建立追加修订，保留当时所知。</p></section>
  </div>`;
}
