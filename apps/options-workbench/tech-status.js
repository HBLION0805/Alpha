import {esc} from './model.js';

const labels={MOCK:'MOCK · 合成演练',TEST_FIXTURE:'TEST_FIXTURE · 测试夹具',ATTRIBUTED_REAL_EVIDENCE:'真实资料归属声明 · 未认证',REAL_SAVED_SOURCE_REPLAY:'历史真实来源回放',UNKNOWN:'UNKNOWN · 来源未明确'};
const clock=v=>v?`${esc(v)} · ${esc(new Intl.DateTimeFormat('zh-CN',{timeZone:'America/New_York',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)))} ET`:'时钟未知';
const reasons=values=>values?.length?`<ul>${values.map(v=>`<li><code>${esc(v)}</code></li>`).join('')}</ul>`:'<p class="hint">此层未记录阻断原因；不表示通过。</p>';
const status=v=>`<span class="tag amber">${esc(v??'UNKNOWN')}</span>`;
const issueText={UNVERSIONED_RESIDUAL_AUDIT_WRAPPER:'未版本化的演示审计封装。内嵌 MOCK 残余算术预览不能当作 Paper 状态；原件继续保留。',UNSUPPORTED_RECEIPT:'回执格式或版本不在已确认白名单内，未显示其中字段。',INVALID_CANDIDATE_SCHEMA:'候选评估不符合已发布契约，缺字段或状态冲突，不能作为有效评估展示。',INVALID_CANDIDATE_CLI_ENVELOPE:'候选 CLI 封装字段不符合原接口；不读取其路径或扩展字段。',MALFORMED_JSON:'文件不是可解析的有效 JSON，原件未修复或覆盖。',CONFLICTING_ASSESSMENTS:'同一候选、事件和评估时钟存在不同内容；全部保留，不选赢家、不合并。',FUTURE_RECEIPT:'回执时间晚于本次检查，不能作为已发生证据。',UNSAFE_PATH:'目录为链接或超出固定读取边界，未读取目标。',UNSAFE_OR_OVERSIZE_FILE:'文件为链接、非普通文件或超出大小限制，未读取内容。',CHANGED_DURING_READ:'读取期间资料发生变化，本轮未采纳。',READ_BOUND:'读取量达到上限，未继续读取。',DIRECTORY_BOUND:'目录数量超出固定上限。',FILE_BOUND:'目录内文件数量超出固定上限。',INVALID_SAVED_EVIDENCE:'原件结构、哈希或日志顺序无法确认，未作为可用证据。'};
function issue(i){return `<div class="tech-source-issue"><p><strong>${esc(issueText[i.code]??issueText.INVALID_SAVED_EVIDENCE)}</strong></p><p><code>${esc(i.code)}</code></p><p class="hint">位置指纹 ${esc(i.locationRef??'UNKNOWN')}${i.sourceRef?`<br>原件指纹 ${esc(i.sourceRef)}`:''}</p></div>`;}
function association(r){const a=r.association;if(!a)return '';return `<p class="hint">来源位置 ${esc(r.locationRef)}<br>容器指纹 ${esc(r.containerRef)}（仅表示存放目录，不证明属于同一运行）</p><p>${a.status==='DUPLICATE_ASSESSMENT'?'重复评估副本：内容相同的来源独立保留，不重复推断一次完成流程。':a.status==='CONFLICTING_ASSESSMENTS'?'冲突评估：同一声明身份和时钟存在不同内容，不能判定哪份正确。':'独立来源记录：不与其他运行拼接成完整流程。'}</p>${a.sameAssessmentSources.length?`<p class="hint">相同评估的位置指纹：${a.sameAssessmentSources.map(esc).join('<br>')}</p>`:''}${a.conflictingSources.length?`<p class="hint">冲突来源的位置指纹：${a.conflictingSources.map(esc).join('<br>')}</p>`:''}`;}
function record(r){return `<details class="card section-space" data-disclosure-key="tech-${esc(r.locationRef??r.sourceRef)}"><summary><strong>${esc(r.symbol)} · ${esc(labels[r.evidenceContext]??labels.UNKNOWN)}</strong> · ${esc(r.paperStatus)}<br><small>${esc(r.recordClockBasis)}：${clock(r.recordedAt)}</small></summary>
 <p class="hint">来源指纹 ${esc(r.sourceRef)}<br>${esc(r.kind)} · ${esc(r.authority)}<br>${r.envelope==='PUBLISHED_CLI_RESULT_WITHOUT_ENVELOPE_VERSION'?'已发布 CLI 返回封装：外层无版本；上方版本仅属于内嵌评估。未读取封装中的文件路径。':'版本化回执；状态仅适用于其原始来源。'}</p>${association(r)}
 <p>记录类型：${esc(r.temporalStatus)}。本页未重新判断当前报价准入；旧 PASS、READY 及旧实现的拒绝码仅属于原回执。</p>
 <div class="grid-two"><section><h3>研究 / 候选</h3>${status(r.research.status)}<p>方向 ${esc(r.research.direction)} · 登记 ${clock(r.research.registeredAt)}</p>${reasons(r.research.blockers)}</section>
 <section><h3>报价 / 预检</h3>${status(r.quote.status)}<p>来源时钟：${r.quote.sourceClocks.map(clock).join('<br>')||'未提供'}</p>${reasons(r.quote.blockers)}</section>
 <section><h3>账户证据</h3><dl>${Object.entries(r.accountEvidence).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${status(v)}</dd>`).join('')}</dl><p class="hint">文档归属与哈希不认证账户；不展示账号、金额或原件。</p></section>
 <section><h3>计划 / 模拟</h3><p>计划 ${status(r.planStatus)} · Paper ${status(r.paperStatus)}</p><p>模拟订单记录 ${r.modeledOrderCount===null?'未知':esc(r.modeledOrderCount)} · 真实验收 NOT_TESTED</p><p class="hint">研究与计划不会自动生成成交；模拟订单不是真实订单。</p></section></div>
 <h3>原回执 / 模拟日志的阻断原因</h3>${reasons(r.blockers)}</details>`;}

export function techStatusPanel(data){
 const s=data??{state:'MISSING',records:[],issues:[]};
 return `<section class="section-space" id="tech-research-status" aria-labelledby="tech-status-title"><h2 id="tech-status-title">科技研究与 Paper · 只读</h2>
 <p>已有开发能力：候选研究、保存报价预检，以及同日一组等量双腿 CDS / PDS 隔离模拟。真实数据 Paper 验收：<strong>NOT_TESTED</strong>。</p>
 <p class="hint">仅检查本地开发目录的直接回执和双腿模拟日志，不包含嵌套测试目录。使用顶部“重新加载”读取保存资料；本页不请求市场数据。账户证据缺失不否定公司研究方向。</p>
 <p>${status(s.state)} · 本地检查：${clock(s.checkedAt)} · ${s.records.length} 份记录</p>
 ${s.issues.length?`<div class="notice error tech-status-issues" role="alert"><strong>部分资料无法读取或存在冲突，不能判定通过。</strong>${s.issues.map(issue).join('')}</div>`:''}
 ${!s.records.length?'<div class="empty"><h3>没有可展示的已保存记录</h3><p>研究、报价、账户证据和模拟均未由本页验证。缺失数据不是零风险，也不是验收通过。</p></div>':s.records.map(record).join('')}
 </section>`;
}
