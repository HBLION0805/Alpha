import {esc} from './model.js';

const labels={MOCK:'MOCK · 合成演练',TEST_FIXTURE:'TEST_FIXTURE · 测试夹具',ATTRIBUTED_REAL_EVIDENCE:'真实资料归属声明 · 未认证',REAL_SAVED_SOURCE_REPLAY:'历史真实来源回放',UNKNOWN:'UNKNOWN · 来源未明确'};
const clock=v=>v?`${esc(v)} · ${esc(new Intl.DateTimeFormat('zh-CN',{timeZone:'America/New_York',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)))} ET`:'时钟未知';
const reasons=values=>values?.length?`<ul>${values.map(v=>`<li><code>${esc(v)}</code></li>`).join('')}</ul>`:'<p class="hint">此层未记录阻断原因；不表示通过。</p>';
const status=v=>`<span class="tag amber">${esc(v??'UNKNOWN')}</span>`;
function record(r){return `<details class="card section-space" data-disclosure-key="tech-${esc(r.sourceRef)}"><summary><strong>${esc(r.symbol)} · ${esc(labels[r.evidenceContext]??labels.UNKNOWN)}</strong> · ${esc(r.paperStatus)}<br><small>${esc(r.recordClockBasis)}：${clock(r.recordedAt)}</small></summary>
 <p class="hint">来源指纹 ${esc(r.sourceRef)}<br>${esc(r.kind)} · ${esc(r.authority)}</p>
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
 ${s.issues.length?`<div class="notice error" role="alert"><strong>部分资料无法读取，不能判定通过。</strong>${reasons(s.issues.map(i=>i.code))}</div>`:''}
 ${!s.records.length?'<div class="empty"><h3>没有可展示的已保存记录</h3><p>研究、报价、账户证据和模拟均未由本页验证。缺失数据不是零风险，也不是验收通过。</p></div>':s.records.map(record).join('')}
 </section>`;
}
