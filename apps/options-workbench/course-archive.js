import {esc,timestamp} from './model.js';
import {courseAssessmentPanel} from './course-panel.js';
export function courseArchiveRequest(state,ui,id){
 const p=state.courseResearch?.data?.plans.find(p=>p.key===ui.courseArchivePlanKey);
 if(!p)throw Error('Choose an exact saved plan version before archiving course declarations.');
 return {id,planKey:p.key,planVersion:p.version,declarations:structuredClone(ui.courseDraft??{})};
}
export function courseArchivePanel(state,ui){
 const d=state.courseResearch?.data,p=ui.courseArchivePreview;
 if(!d)return `<section class="card section-space"><h3>课程声明存档</h3><p>${esc(state.courseResearch?.error??'存档暂不可用')}</p></section>`;
 return `<section class="card section-space" id="course-archive"><h3>绑定已保存方案的课程声明</h3><p>先保存原方案，再选择其确切版本。此处单独预览和确认保存当前课程声明；不会把未保存的 thesis 修改写入原方案。存档含版本、实际保存时间和评估副本，后补记录不证明事前声明。</p><form id="course-archive-form"><label>原方案版本<select name="coursePlan"><option value="">请选择已保存版本</option>${d.plans.map(v=>`<option value="${esc(v.key)}"${ui.courseArchivePlanKey===v.key?' selected':''}>${esc(v.tradeId)} · ${esc(v.kind)} · ${esc(v.key)} · ${esc(timestamp(v.registeredAt))}</option>`).join('')}</select></label><div class="form-actions"><button type="submit" value="PREVIEW" class="button secondary">预览存档绑定</button><button type="submit" value="SAVE" class="button primary"${p?'':' disabled'}>确认存档课程声明</button></div><label class="check-row"><input type="checkbox" name="ownerConfirmed">我已核对本次声明及原方案版本；此操作不认证证据或批准交易。</label></form><p id="course-archive-error" class="error-text"></p><div id="course-archive-preview">${p?`<p>原版本 ${esc(p.payload.planReference.version)} · ${esc(p.payload.planReference.key)}</p>${courseAssessmentPanel(p.assessment)}<details><summary>确切存档预览</summary><pre>${esc(JSON.stringify(p.payload,null,2))}</pre></details>`:'<p>尚未预览或声明已更改。</p>'}</div>${courseArchiveBackrefs(state,true)}</section>`;
}
export function courseArchiveBackrefs(state,restore=false){
 const d=state.courseResearch?.data;if(!d)return '<p>课程研究存档不可用；不推断记录不存在。</p>';
 return `<details data-course-archive-review><summary>课程研究存档与复盘关联（${d.records.length}）</summary><p>这些是绑定原方案版本的独立研究补充，不是 Alpha Journal 已确认结果、预测评分、成交或获批准的经验。过程质量、预测结果和盈亏仍分开。</p>${d.errors.map(e=>`<p class="error-text">${esc(e.status)} · ${esc(e.path)}</p>`).join('')}${d.records.map(r=>`<article><h4>${esc(r.payload.planId)} · ${esc(r.id)}</h4><p>保存 ${esc(timestamp(r.savedAt))}<br>方案 ${esc(r.payload.planReference.key)} · ${esc(r.payload.planReference.version)}<br>框架 ${esc(r.payload.frameworkVersion)} · 目录 ${esc(r.payload.catalogVersion)}<br>原件 ${esc(r.path)} · ${esc(r.fingerprint)}</p>${courseAssessmentPanel(r.payload.assessment)}<details><summary>原声明与绑定输入</summary><pre>${esc(JSON.stringify({declarations:r.payload.request.declarations,input:r.payload.input,planReference:r.payload.planReference},null,2))}</pre></details>${restore?`<button type="button" class="link-button" data-course-restore="${esc(r.id)}">载入声明到本地草稿（不修改方案）</button>`:''}</article>`).join('')}</details>`;
}
