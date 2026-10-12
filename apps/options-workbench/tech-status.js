import {techCandidateTracePanel} from './tech-candidate-trace.js';
import {esc} from './model.js';

const labels={MOCK:'MOCK · 合成演练',TEST_FIXTURE:'TEST_FIXTURE · 测试夹具',ATTRIBUTED_REAL_EVIDENCE:'真实资料归属声明 · 未认证',SIMULATED_ACCOUNT_REAL_MARKET_DATA:'独立模拟账户＋真实市场资料 · 非券商资格',TEST_FIXTURE_SIMULATED_ACCOUNT:'模拟账户测试 · 行情仍为测试夹具',REAL_SAVED_SOURCE_REPLAY:'历史真实来源回放',UNKNOWN:'UNKNOWN · 来源未明确'};
const clock=v=>v?`${esc(v)} · ${esc(new Intl.DateTimeFormat('zh-CN',{timeZone:'America/New_York',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)))} ET`:'时钟未知';
const reasons=values=>values?.length?`<ul>${values.map(v=>`<li><code>${esc(v)}</code></li>`).join('')}</ul>`:'<p class="hint">此层未记录阻断原因；不表示通过。</p>';
const status=v=>`<span class="tag amber">${esc(v??'UNKNOWN')}</span>`;
const issueText={RECEIPT_CLOCK_MISSING:'该回执契约要求的评估或保存时钟缺失，不能用另一个时钟替代。',INVALID_RECEIPT_CLOCK:'回执中的时钟格式或日期无效，未作为历史证据展示。',RECEIPT_CLOCK_ORDER:'评估、保存或研究登记时钟先后冲突，不能选择其中较有利的时间。',UNVERSIONED_RESIDUAL_AUDIT_WRAPPER:'未版本化的演示审计封装。内嵌 MOCK 残余算术预览不能当作 Paper 状态；原件继续保留。',UNSUPPORTED_RECEIPT:'回执格式或版本不在已确认白名单内，未显示其中字段。',INVALID_CANDIDATE_SCHEMA:'候选评估不符合已发布契约，缺字段或状态冲突，不能作为有效评估展示。',INVALID_CANDIDATE_CLI_ENVELOPE:'候选 CLI 封装字段不符合原接口；不读取其路径或扩展字段。',MALFORMED_JSON:'文件不是可解析的有效 JSON，原件未修复或覆盖。',CONFLICTING_ASSESSMENTS:'同一候选、事件和评估时钟存在不同内容；全部保留，不选赢家、不合并。',FUTURE_RECEIPT:'回执时间晚于本次检查，不能作为已发生证据。',UNSAFE_PATH:'目录为链接或超出固定读取边界，未读取目标。',UNSAFE_OR_OVERSIZE_FILE:'文件为链接、非普通文件或超出大小限制，未读取内容。',CHANGED_DURING_READ:'读取期间资料发生变化，本轮未采纳。',READ_BOUND:'读取量达到上限，未继续读取。',DIRECTORY_BOUND:'目录数量超出固定上限。',FILE_BOUND:'目录内文件数量超出固定上限。',INVALID_SAVED_EVIDENCE:'原件结构、哈希或日志顺序无法确认，未作为可用证据。'};
function issue(i){return `<div class="tech-source-issue"><p><strong>${esc(issueText[i.code]??issueText.INVALID_SAVED_EVIDENCE)}</strong></p><p><code>${esc(i.code)}</code></p><p class="hint">位置指纹 ${esc(i.locationRef??'UNKNOWN')}${i.sourceRef?`<br>原件指纹 ${esc(i.sourceRef)}`:''}</p></div>`;}
function association(r){const a=r.association;if(!a)return '';return `<p class="hint">来源位置 ${esc(r.locationRef)}<br>容器指纹 ${esc(r.containerRef)}（仅表示存放目录，不证明属于同一运行）</p><p>${a.status==='DUPLICATE_ASSESSMENT'?'重复评估副本：内容相同的来源独立保留，不重复推断一次完成流程。':a.status==='CONFLICTING_ASSESSMENTS'?'冲突评估：同一声明身份和时钟存在不同内容，不能判定哪份正确。':'独立来源记录：不与其他运行拼接成完整流程。'}</p>${a.sameAssessmentSources.length?`<p class="hint">相同评估的位置指纹：${a.sameAssessmentSources.map(esc).join('<br>')}</p>`:''}${a.conflictingSources.length?`<p class="hint">冲突来源的位置指纹：${a.conflictingSources.map(esc).join('<br>')}</p>`:''}`;}
function record(r){return `<details class="card section-space" data-disclosure-key="tech-${esc(r.locationRef??r.sourceRef)}"><summary><strong>${esc(r.symbol)} · ${esc(labels[r.evidenceContext]??labels.UNKNOWN)}</strong> · ${esc(r.paperStatus)}<br><small>${esc(r.recordClockBasis)}：${clock(r.recordedAt)}</small></summary>
 <p class="hint">来源指纹 ${esc(r.sourceRef)}<br>${esc(r.kind)} · ${esc(r.authority)}<br>${r.envelope==='PUBLISHED_CLI_RESULT_WITHOUT_ENVELOPE_VERSION'?'已发布 CLI 返回封装：外层无版本；上方版本仅属于内嵌评估。未读取封装中的文件路径。':'版本化回执；状态仅适用于其原始来源。'}</p>${association(r)}
 <p class="hint">评估时钟 ${clock(r.clocks?.assessmentAt)} · 保存时钟 ${clock(r.clocks?.savedAt)} · 预检时钟 ${clock(r.clocks?.preflightAt)}</p>
 <p>记录类型：${esc(r.temporalStatus)}。本页未重新判断当前报价准入；旧 PASS、READY 及旧实现的拒绝码仅属于原回执。</p>
 <div class="grid-two"><section><h3>研究 / 候选</h3>${status(r.research.status)}<p>方向 ${esc(r.research.direction)} · 登记 ${clock(r.research.registeredAt)}</p>${reasons(r.research.blockers)}</section>
 <section><h3>报价 / 预检</h3>${status(r.quote.status)}<p>来源时钟：${r.quote.sourceClocks.map(clock).join('<br>')||'未提供'}</p>${reasons(r.quote.blockers)}</section>
 <section><h3>账户证据</h3><dl>${Object.entries(r.accountEvidence).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${status(v)}</dd>`).join('')}</dl><p class="hint">文档归属与哈希不认证账户；不展示账号、金额或原件。</p></section>
 <section><h3>计划 / 模拟</h3><p>计划 ${status(r.planStatus)} · Paper ${status(r.paperStatus)}</p><p>模拟订单记录 ${r.modeledOrderCount===null?'未知':esc(r.modeledOrderCount)} · 真实验收 NOT_TESTED</p><p class="hint">研究与计划不会自动生成成交；模拟订单不是真实订单。</p></section></div>
 <h3>原回执 / 模拟日志的阻断原因</h3>${reasons(r.blockers)}</details>`;}

export function techStatusPanel(data){
 const s=data??{state:'MISSING',records:[],issues:[]};
 return `<section class="section-space" id="tech-research-status" aria-labelledby="tech-status-title"><h2 id="tech-status-title">科技研究与 Paper · 只读</h2>
 <p>已有开发能力：候选研究、保存报价预检，以及同日一组等量双腿 CDS / PDS 隔离模拟。期权全流程真实数据验收：<strong>NOT_TESTED</strong>；股票工程结果单独列示。</p>
 <p class="hint">仅检查本地开发目录的直接回执和双腿模拟日志，不包含嵌套测试目录。使用顶部“重新加载”读取保存资料；本页不请求市场数据。账户证据缺失不否定公司研究方向。</p>
 <p>${status(s.state)} · 本地检查：${clock(s.checkedAt)} · ${s.records.length} 份记录</p>
 ${engineeringStatusPanel(s.engineering)}${techCandidateTracePanel(s.researchDetails?.traceScans,s.researchDetails?.traceIssues)}${researchDetails(s.researchDetails)}
 ${s.issues.length?`<div class="notice error tech-status-issues" role="alert"><strong>部分资料无法读取或存在冲突，不能判定通过。</strong>${s.issues.map(issue).join('')}</div>`:''}
 ${!s.records.length?'<div class="empty"><h3>没有可展示的已保存记录</h3><p>研究、报价、账户证据和模拟均未由本页验证。缺失数据不是零风险，也不是验收通过。</p></div>':s.records.map(record).join('')}
 </section>`;
}

export function engineeringStatusPanel(s){
 if(!s||s.state==='MISSING')return '';
 if(s.state!=='AVAILABLE')return `<section class="notice error" id="engineering-acceptance"><h3>工程模拟结果暂不可核验</h3><p>原件、账本末端或绑定检查未通过，本页不沿用旧余额或旧通过状态。</p>${reasons(s.issues)}</section>`;
 const a=s.account,stock=s.stock,o=s.options,money=v=>Number.isSafeInteger(v)?'$'+(v/1000000).toFixed(2):'UNKNOWN';
 const fieldLabels={DELIVERABLE_COMPONENTS_AND_SHARE_QUANTITY:'精确交割内容与股份数量',EXERCISE_STYLE:'精确系列行权方式',ADJUSTMENT_STATUS:'精确系列调整状态'};
 return `<section class="card section-space" id="engineering-acceptance"><h3>真实报价工程模拟 · 已保存验收</h3>
 <p>用于检查取价、模拟成交、资金记账和恢复流程。研究与策略：NOT_APPLICABLE_ENGINEERING_ONLY。真实券商订单为 0；本页重新加载只重读原件。</p>
 <div class="grid-two"><section><h4>股票 · SPY 1 股</h4><p><strong>PASS · ${esc(stock.status)}</strong></p><p>入场 ${clock(stock.entry.at)}<br>退出 ${clock(stock.exit.at)}</p><p>模拟买入 ${money(stock.entry.priceMicros)} · 卖出 ${money(stock.exit.priceMicros)}<br>模型净损益 <strong>${money(stock.netPnlMicros)}</strong> · 持仓 ${esc(stock.positionShares)}</p><p class="hint">模型价格含每侧 $0.01 不利滑点，另计每侧 $0.01 摩擦；佣金假设为零，非券商实际费用。独立报价共 ${esc(stock.sourceCalls)} 次，新进程恢复与独立审核通过。</p></section>
 <section><h4>期权 · ${esc(o.symbol)} ${esc(o.expiry)} ${esc(o.longStrike)} / ${esc(o.shortStrike)} CDS</h4><p><strong>BLOCKED · 未入场</strong></p><p>${esc(o.status)}</p><ul>${o.missingExactSeriesFields.map(k=>`<li>${esc(fieldLabels[k]??k)}</li>`).join('')}</ul><p>元数据调用 ${esc(o.metadataCalls)} 次 · 报价 ${esc(o.quoteCalls)} 次 · 模拟成交 ${esc(o.simulatedFills)}</p><p class="hint">乘数 100 不等于已证明交割 100 股；active/tradable 不等于账户权限。期权全流程尚未验收。</p></section></div>
 <h4>同一模拟账户资金</h4><div class="grid-two"><p>已结算、可用于预算：<strong>${money(a.settledCashMicros)}</strong><br>未结算、不可用于新入场：<strong>${money(a.unsettledProceedsMicros)}</strong></p><p>总现金 ${money(a.totalCashMicros)}<br>新增资金 ${money(a.newDepositsMicros)} · 未重置账户</p></div>
 <details data-disclosure-key="engineering-run-binding"><summary>运行、版本与原始时钟</summary><p class="hint">股票 ${esc(stock.runId)}<br>代码 ${esc(stock.commit)}<br>T0 ${clock(stock.decisionAt)}<br>最早退出 ${clock(stock.entry.exitDueAt)}<br>${(stock.quoteClocks??[]).map(c=>`${esc(c.action)} 请求 ${clock(c.requestedAt)} · 收到 ${clock(c.receivedAt)}<br>源 bid ${esc(c.sourceBidAt)} · ask ${esc(c.sourceAskAt)}`).join('<br>')}<br>报告指纹 ${esc(stock.reportSha256)}</p><p class="hint">期权 ${esc(o.runId)}<br>代码 ${esc(o.commit)}<br>预检保存 ${clock(o.savedAt)}<br>元数据请求 / 收到：${o.metadataClocks.map(c=>`${clock(c.requestedAt)} → ${clock(c.receivedAt)}`).join('<br>')}<br>报告指纹 ${esc(o.reportSha256)}</p><p class="hint">账户 ${esc(a.id)}<br>账本末端 ${esc(a.headSha256)}<br>本页读取 ${clock(s.checkedAt)}。页面时钟不更新原行情；原研究 NO_TRADE 保持不变。本次不验证两周胜率。</p></details></section>`;
}

const directionLabel=v=>({UP:'偏多研究',DOWN:'偏空研究',NEUTRAL:'中性',UNKNOWN:'UNKNOWN · 方向未建立'}[v]??'UNKNOWN');
const text=v=>v?esc(v):'UNKNOWN · 尚未记录';
function researchDetails(data){
 const records=data?.records??[],groups=new Map();for(const r of records){if(!groups.has(r.sourceRef))groups.set(r.sourceRef,[]);groups.get(r.sourceRef).push(r);}
 const contextLabel=v=>({HISTORICAL_ATTRIBUTED_SAMPLE:'历史样本 · 来源归属未认证',TEST_FIXTURE:'TEST_FIXTURE · 合成测试',SAVED_RESEARCH:'已保存研究 · 不是当前行情'}[v]??'UNKNOWN');
 return `<div class="tech-research-details"><h3>三面研究依据与条件</h3><p>基本面研究方向，技术面检查结构，消息面研究时机。方向研究和试探条件可以保留；资料不足不等于交易准入，三面一致也不保证收益或支持重仓。</p>
 <p class="hint">仅展示保存记录的必要摘要和允许公开的来源链接。资料时点、原研究评估时间和研究窗口分别列出；打开页面不会刷新来源或重设研究窗口。本轮不绘制或补造 Fib。</p>
 ${data?.issues?.length?`<p class="notice error" role="alert">${data.issues.length} 组研究资料读取不完整；未将缺失视为通过。${data.issues.map(i=>`<code>${esc(i.code)}</code>`).join(' · ')}</p>`:''}
 ${!records.length?'<p class="empty">暂无可展示的三面研究记录；技术结构、方向与失效条件保持 UNKNOWN。</p>':''}
 ${[...groups].map(([ref,rows],n)=>`<details class="card section-space tech-research-group" data-disclosure-key="research-${esc(ref)}" ${n===0?'open':''}><summary><strong>${esc(contextLabel(rows[0].context))}</strong> · ${rows.length} 份研究 · ${clock(rows[0].recordedAt)}</summary><p class="hint">保存版本指纹 ${esc(ref)}。各版本独立保留，不拼接为已完成流程。</p>${rows.map(researchRow).join('')}</details>`).join('')}</div>`;
}
function researchRow(r){
 return `<details class="tech-facet-record" data-disclosure-key="facet-${esc(r.id)}"><summary><strong>${esc(r.symbol)}</strong> · ${esc(r.researchStatus)} · ${esc(r.conditionalPlanStatus)}</summary>
 <p class="hint">原研究评估：${clock(r.assessedAt)}<br>来源截止：${clock(r.sourceCutoff)}<br>研究窗口：${r.window?`${clock(r.window.from)} → ${clock(r.window.through)}`:'UNKNOWN · 未登记'}</p>
 <div class="tech-facet-grid"><section><h4>基本面 · 方向</h4><p>${esc(directionLabel(r.fundamental.direction))}</p><p class="hint">经营趋势：${esc(directionLabel(r.fundamental.operatingTrend))}；不等同于持有窗口内的价格方向。</p><p>${text(r.fundamental.summary)}</p></section>
 <section><h4>技术面 · 结构</h4><p>${esc(r.technical.status)}</p><p>${text(r.technical.summary)}</p><p class="hint">测量方向 ${esc(r.technical.measurementDirection)} · 当前观察结构 ${esc(r.technical.currentStructure)}。历史测量方向不等于当前趋势；未提供可用技术资料时不生成价位。</p></section>
 <section><h4>消息面 · 时机</h4><p>${esc(directionLabel(r.news.direction))}</p><p>${text(r.news.summary)}</p></section></div>
 <dl class="tech-condition-list"><dt>研究假设</dt><dd>${text(r.hypothesis)}</dd><dt>试探条件</dt><dd>${text(r.trial)}</dd><dt>确认条件</dt><dd>${text(r.confirmation)}</dd><dt>失效 / 反证条件</dt><dd>${text(r.invalidation)}</dd><dt>独立退出条件</dt><dd>${text(r.exit)}</dd><dt>下一项证据</dt><dd>${text(r.nextEvidence)}</dd></dl>
 <h4>原文来源与独立时钟</h4>${r.sources.items.length?`<ul class="tech-research-sources">${r.sources.items.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(s.url).hostname)} · 查看公开来源</a><br><small>发表 ${clock(s.publishedAt)}<br>收到 ${clock(s.receivedAt)} · 审阅 ${clock(s.reviewedAt)}${s.filingAcceptedAt?`<br>SEC 接收 ${clock(s.filingAcceptedAt)}（不等于首次发表）`:''}</small></li>`).join('')}</ul>`:'<p>UNKNOWN · 没有可展示的公开来源链接</p>'}
 <p class="hint">最多展示 ${r.sources.limit} 个来源；${r.sources.omitted} 个非公开或不支持链接未展示。未知发表时间不以收到时间替代。</p>
 <h4>证据缺口</h4>${reasons(r.gaps)}<p class="hint">本页当前报价准入：NOT_EVALUATED；未生成成交、仓位或概率。上述研究状态只适用于其原保存记录。</p></details>`;
}
