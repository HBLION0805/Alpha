import {snapshotRequest,snapshotResult} from './snapshot-paper.js';
import {etfSetupRequest} from './etf-setup.js';
import {positionWatchRequest,positionWatchResult,positionWatchPreviewMatches} from './position-watch.js';
import {spreadCapitalNotice} from './spread-review.js';
import {request} from './api.js';
import {routes,contractDetail,tradeDetail,plannerResult,detail,notice,table,empty} from './views.js';
import {esc,words,dollars,timestamp,exactUsd,decimalText,decimalInteger,filterChain} from './model.js';
import {plannerDefaults,registerDefaults,fillDefaults,buildScenario,buildCommand,plannerBudgetDraft} from './forms.js';
import {eventRequest} from './event-research.js';
import {candidateCheckDetail} from './candidate-checks.js';
import {costDeskResult,costRequestMatches} from './cost-desk.js';
import {deniedNewsSources} from './focused-news.js';
import {capitalPolicyPanel,capitalPolicyMatches,policySettingsFromFields} from './capital-policy.js';
import {macroComparisonRequest,macroPreviewMatches,macroComparisonResult} from './macro-context.js';
import {macroNoteDefaults,macroNoteRequest,macroCoverage,appendMacroReflection} from './macro-playbook.js';
import {thesisDefaults,updateThesisDraft,thesisPlanCommand,thesisReviewRequest} from './trade-thesis.js';

const $=selector=>document.querySelector(selector);
const defaultFilters=()=>({symbol:'',expiry:'',type:'',flagged:false,search:'',sort:'volume',direction:'desc',page:1});
const drafts={register:registerDefaults(),fill:fillDefaults(),correct:fillDefaults()};
const ui={chain:defaultFilters(),plannerDraft:plannerDefaults(),plannerResult:null,planningSource:null,costFeeBasis:'DECLARED_FEES',costDeskResult:null,journalMode:'register',journalDraft:drafts.register,reviewScope:'trades',lessonOrigin:'',reviewSearch:'',newsSource:'',newsSearch:'',newsAsset:''};
let comparingCosts=false,previewingPolicy=false;
function clearPolicyPreview(){ui.capitalPolicyPreview=null;const p=$('#capital-policy-preview');if(p)p.innerHTML=capitalPolicyPanel(null,{preview:true});}
function costRequest(){return {scenario:buildScenario(plannerBudgetDraft(ui.plannerDraft,state.guidance?.data?.current.settings)),feeBasis:ui.costFeeBasis};}
function clearCosts(){ui.costDeskResult=null;const panel=$('#cost-desk-result');if(panel)panel.innerHTML=costDeskResult(null);}
let state=null,pending=null,pendingKey=null,requestId=null,loading=false,saving=false,calculating=false,previewing=false,toastTimer;
let renderedRoute=null;
const dirty=new Set();
function syncNavigation(){
  const hidden=matchMedia('(max-width: 650px)').matches&&!document.body.classList.contains('menu-open');
  $('#sidebar').inert=hidden;if(hidden)$('#sidebar').setAttribute('aria-hidden','true');else $('#sidebar').removeAttribute('aria-hidden');
}
const labels={overview:'Overview',chain:'Options & activity',planner:'Trade planner',journal:'Trade journal',reviews:'Reviews & lessons',context:'News & calendar',guidance:'Daily guidance','event-research':'Event research','macro-playbook':'Macro playbook'};
function route(){const key=location.hash.slice(1);return Object.hasOwn(routes,key)?key:'guidance';}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5500);}
function render(focus=false){
  if(!state)return;
  const active=document.activeElement,id=active?.id,name=active?.name,position=active?.selectionStart;
  const key=route();ui.journalDraft=drafts[ui.journalMode];
  const disclosures=new Map(!focus&&renderedRoute===key?[...$('#main').querySelectorAll('details[data-disclosure-key]')].map(el=>[el.dataset.disclosureKey,el.open]):[]);
  const focusedDisclosure=active?.tagName==='SUMMARY'?active.parentElement?.dataset.disclosureKey:null;
  $('#main').innerHTML=(['overview','guidance','planner'].includes(key)?spreadCapitalNotice(state.reportedSpreads):'')+routes[key](state,ui);$('#breadcrumb').textContent=labels[key];
  if(['guidance','planner','reviews'].includes(key))$('#main').insertAdjacentHTML('afterbegin','<p class="hint"><a href="#macro-playbook">Macro playbook & decision worksheet →</a> · source-attributed education and local notes</p>');
  let nextSummary=null;
  for(const el of $('#main').querySelectorAll('details[data-disclosure-key]')){
    if(disclosures.has(el.dataset.disclosureKey))el.open=disclosures.get(el.dataset.disclosureKey);
    if(disclosures.has(el.dataset.disclosureKey)&&el.dataset.disclosureKey===focusedDisclosure)nextSummary=el.querySelector('summary');
  }
  renderedRoute=key;
  document.title=`${labels[key]} · Alpha`;
  for(const link of document.querySelectorAll('[data-route]')){const selected=link.dataset.route===key;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  if(focus)$('#main').focus({preventScroll:true});
  else {const next=id?document.getElementById(id):name?document.querySelector(`[name="${name}"]`):nextSummary;if(next){next.focus({preventScroll:true});if(typeof position==='number'&&['text','search','tel','url','password'].includes(next.type))next.setSelectionRange(position,position);}}
}
function navigate(key){if(route()===key)render(true);else location.hash=key;}
function fail(error,target){const el=target&&$(target);if(el)el.textContent=error.message??'Local operation failed.';else toast(error.message??'Local operation failed.');}
async function reload(board=state?.selectedBoardId??null){
  if(loading)return;loading=true;$('#reload').disabled=true;$('#connection').textContent='Checking saved evidence…';
  try{
    state=await request('/api/state'+(board?'?board='+encodeURIComponent(board):''));
    ui.positionCostPreviews={};
    if(ui.costDeskResult&&!costRequestMatches({scenario:ui.costDeskResult.original.scenario,feeBasis:ui.costDeskResult.feeBasis},costRequest())){clearCosts();ui.plannerResult=null;}
    if(ui.capitalPolicyPreview&&!dirty.has('guidance')&&!capitalPolicyMatches(ui.capitalPolicyPreview.settings,state.guidance?.data?.current.settings))clearPolicyPreview();
    const unavailable=Object.values(state).filter(v=>v&&typeof v==='object'&&['MISSING','BLOCKED'].includes(v.state)).length;
    const newsDenied=deniedNewsSources(state.focusedNews?.data?.sources).length;
    $('#connection').innerHTML=notice(`${state.manual.data?.origin==='SYNTHETIC_FIXTURE'?'<strong>ISOLATED SYNTHETIC LEDGER.</strong> ':''}<strong>Saved local evidence</strong> · ${newsDenied?'Public news collection recorded local network permission failures. See News & calendar for source clocks.':state.backgroundContextRefreshEnabled?'Public context is scheduled hourly while Alpha runs. Check News & calendar for successful reads. Option quotes follow their scheduled reads.':'Market prices are not refreshed here.'}${unavailable?` ${unavailable} component(s) unavailable; see the affected page.`:''}`,unavailable||newsDenied?'error':'');
    $('#loaded-at').textContent='Local files checked '+timestamp(state.loadedAt);render();
  }catch(e){$('#connection').innerHTML=notice(esc(e.message),'error');if(!state)$('#main').innerHTML=empty('Workspace unavailable','Start the local Alpha server, then use Reload saved data.');}
  finally{loading=false;$('#reload').disabled=false;}
}
function showDetail(title,html){$('#detail-title').textContent=title;$('#detail-body').innerHTML=html;$('#detail-dialog').showModal();}
function chooseFill(){
  const d=drafts.correct,trade=state.manual.data?.trades.find(t=>t.tradeId===d.tradeId),fill=trade?.effectiveFills.find(f=>f.fillId===d.fillId);
  if(!fill){d.expectedRevision='';return;}
  const value=fill.value;Object.assign(d,fillDefaults(),{tradeId:trade.tradeId,fillId:fill.fillId,expectedRevision:String(fill.revision)},value??{});
  d.quantity=String(d.quantity);d.executionSequence=String(d.executionSequence);d.feesUsd=value?.feesUsd??'';d.externalExecutionRef=value?.externalExecutionRef??'';d.description=value?.evidence?.description??'';d.documentSha256=value?.evidence?.documentSha256??'';d.voidFill=!value;d.exitReason=value?.exitReason==='NOT_APPLICABLE'?'UNKNOWN':value?.exitReason??'UNKNOWN';
}
function updateDraft(el){
  if(!el.name)return;
  const form=el.closest('form');if(!form)return;
  if(form.id==='thesis-plan-form'){
    updateThesisDraft(ui,el.name,el.type==='checkbox'?el.checked:el.value);dirty.add('thesis');
    const b=form.querySelector('[value="CONFIRM"]');if(b)b.disabled=true;
    const p=$('#thesis-plan-preview');if(p)p.innerHTML='Draft changed. Preview again before freezing.';return;
  }
  if(form.dataset?.thesisReview){
    const id=form.dataset.thesisReview;ui.thesisReviewDrafts??={};if(!Object.hasOwn(ui.thesisReviewDrafts,id))ui.thesisReviewDrafts[id]={};
    ui.thesisReviewDrafts[id][el.name]=el.type==='checkbox'?el.checked:el.value;
    ui.thesisReviewIds??={};delete ui.thesisReviewIds[id];dirty.add('thesis-review');
    const p=document.querySelector(`[data-thesis-review-preview="${id}"]`);if(p)p.innerHTML='';return;
  }
  if(form.id==='macro-note-form'){
    ui.macroNoteDraft={...macroNoteDefaults(state.macroPlaybook.data.catalog),...Object.fromEntries(new FormData(form))};
    if(ui.macroNoteDraft.phase==='PRE_TRADE_NOTE'){ui.macroNoteDraft.process='UNKNOWN';ui.macroNoteDraft.outcome='UNKNOWN';}
    ui.macroNoteRequestId=null;ui.macroNotePreview=null;ui.macroNoteSaved=null;dirty.add('macro-note');
    const p=$('#macro-note-preview');if(p)p.innerHTML='';return;
  }
  if(form.dataset?.positionCost){
    const id=form.dataset.positionCost;ui.positionCostDrafts??={};ui.positionCostPreviews??={};ui.positionCostDrafts[id]=el.value;delete ui.positionCostPreviews[id];
    const row=state.positionWatch?.data?.rows.find(r=>r.tradeId===id),panel=document.querySelector(`[data-position-result="${id}"]`);if(row&&panel)panel.innerHTML=positionWatchResult(row,state.positionWatch.data.assessedAt);return;
  }
  if(form.getAttribute('id')==='snapshot-paper-form'){ui.snapshotDraft=Object.fromEntries(new FormData(form));ui.snapshotPreview=null;dirty.add('snapshot-paper');const p=$('#snapshot-paper-preview');if(p)p.innerHTML=snapshotResult(null);const b=$('#freeze-snapshot-paper');if(b)b.disabled=true;return;}
  if(form.id==='macro-comparison-form'){ui.macroDraft=Object.fromEntries(new FormData(form));ui.macroPreview=null;dirty.add('macro');const p=$('#macro-comparison-preview');if(p)p.innerHTML=macroComparisonResult(null);const b=$('#save-macro-comparison');if(b)b.disabled=true;return;}
  if(form.id==='guidance-settings-form'){ui.guidanceSettingsDraft=Object.fromEntries(new FormData(form));clearPolicyPreview();dirty.add('guidance');const snapshot=$('#save-candidate-checks');if(snapshot)snapshot.disabled=true;return;}
  if(form.id==='etf-setup-form'){ui.etfSetupDraft=Object.fromEntries(new FormData(form));dirty.add('etf-setup');return;}
  if(form.id==='etf-bars-form'){dirty.add('etf-bars');return;}
  if(form.id==='event-research-form'){Object.assign(ui.eventDraft,Object.fromEntries(new FormData(form)));dirty.add('event-research');return;}
  const key=form.id==='planner-form'?'planner':ui.journalMode,d=key==='planner'?ui.plannerDraft:drafts[key];
  d[el.name]=el.type==='checkbox'?el.checked:el.value;dirty.add(key);
  if(key==='planner'){ui.plannerResult=null;clearCosts();const panel=$('#planner-result');if(panel)panel.innerHTML=plannerResult(null);}
  if(key==='correct'&&el.name==='tradeId'){d.fillId='';d.expectedRevision='';}
  if(key==='correct'&&el.name==='fillId')chooseFill();
}
function prepareContract(row){
  ui.plannerDraft={...ui.plannerDraft,symbol:row.symbol,strategy:row.type==='call'?'LONG_CALL':'LONG_PUT',bid:decimalText(row.bid),ask:decimalText(row.ask)};
  ui.planningSource=row;ui.plannerResult=null;clearCosts();dirty.add('planner');$('#detail-dialog').close();navigate('planner');
}
function transferPlan(destination='journal'){
  const r=ui.plannerResult,s=r?.scenario,e=r?.economics;if(!s||!e)throw Error('Calculate a scenario first.');
  if([e.plannedStopCents,e.netProfitTargetCents,e.roundedNetProfitTargetCents].some(v=>v===null)||s.roundTripFeesCents===null)throw Error('Declare the costs before preparing this plan.');
  if(dirty.has('register')||destination==='thesis'&&dirty.has('thesis'))throw Error('Your existing plan draft is preserved. Save or clear it before transferring a new plan.');
  const row=ui.planningSource;
  Object.assign(drafts.register,registerDefaults(),{symbol:s.symbol,optionType:s.strategy==='LONG_CALL'?'CALL':'PUT',expiry:row?.symbol===s.symbol?row.expiry:'',strikeUsd:row?.symbol===s.symbol?decimalText(row.strike):'',includePlan:true,declaredAt:new Date().toISOString(),maxContracts:String(s.quantity),maxEntryDebitUsd:exactUsd(e.premiumCents+s.roundTripFeesCents),plannedRiskUsd:exactUsd(e.plannedStopCents),targetNetProfitUsd:exactUsd(e.roundedNetProfitTargetCents),stopPremiumUsd:(BigInt(s.askPerShareCents)*BigInt(10000-s.stopLossBps)).toString().padStart(7,'0').replace(/(\d{6})$/,'.$1')});
  const candidate=row&&state.activity.data?.cases.find(c=>c.candidate.id===row.id);
  if(candidate&&row.symbol===s.symbol&&(row.type==='call')===(s.strategy==='LONG_CALL'))Object.assign(drafts.register,{includeActivity:true,studyId:state.activity.data.studyId,studyFingerprint:state.activity.data.studyFingerprint,candidateId:row.id});
  if(destination==='thesis'){ui.thesisFields=structuredClone(drafts.register);drafts.register=registerDefaults();ui.thesisDraft??=thesisDefaults();ui.thesisPreview=null;dirty.add('thesis');render();}
  else {dirty.add('register');ui.journalMode='register';navigate('journal');}
  toast('Scenario copied to a draft. Check the contract, entry-cost allowance, times and thesis before saving.');
}
async function previewRecord(){
  if(previewing||saving)return;previewing=true;
  const button=$('#journal-form button[type="submit"]');button.disabled=true;$('#journal-error').textContent='';
  try{
    const mode=ui.journalMode,draft={...drafts[mode]},key=JSON.stringify({mode,draft});
    if(key!==pendingKey){requestId='request-'+crypto.randomUUID();pendingKey=key;}
    const command=buildCommand(mode,draft,requestId),p=await request('/api/preview',command);
    if(key!==JSON.stringify({mode,draft:drafts[mode]}))throw Error('The draft changed during preview. Preview the current draft again.');
    pending={...p,mode,key};const t=p.report.trades.find(t=>t.tradeId===command.tradeId);
    $('#preview-body').innerHTML=notice(`<strong>${esc(words(command.type))}</strong> · ${esc(command.tradeId)}. This saves a local ${esc(words(p.report.origin))} record. No brokerage instruction is sent.`)+
      (t?table(['Result after this record','Value'],[['Position',t.openContracts+' open contracts'],['Disposition',words(t.status)],['Realized net',dollars(t.realizedNetPnlUsd)],['Candidate review notes',t.candidateLessons.length]].map(([k,v])=>`<tr><td>${k}</td><td>${esc(v)}</td></tr>`)):'')+detail('Exact record to save',command)+detail('Recomputed trade and limits',t);
    $('#save-error').textContent='';$('#confirm-save').disabled=false;$('#confirm-save').textContent=p.alreadyRecorded?'Verify saved record':'Save local record';$('#preview-dialog').showModal();
  }catch(e){fail(e,'#journal-error');}finally{previewing=false;if(button.isConnected)button.disabled=false;}
}
async function saveRecord(){
  if(!pending||saving)return;saving=true;$('#confirm-save').disabled=true;$('#save-error').textContent='';
  try{
    await request('/api/save',{command:pending.command,expectedHeadSha256:pending.headSha256});
    const mode=pending.mode;drafts[mode]=mode==='register'?registerDefaults():fillDefaults();dirty.delete(mode);pending=null;pendingKey=null;requestId=null;
    $('#preview-dialog').close();await reload();toast('Local record saved and recovered. Its original history is preserved.');
  }catch(e){fail(Error(e.message+' If the response was interrupted, retry this same preview to check the same request ID.'),'#save-error');}
  finally{saving=false;$('#confirm-save').disabled=false;}
}
function download(kind){
  const components={chain:{chain:state.chain,activity:state.activity},manual:{ledgerId:state.ledgerId,manual:state.manual,reportedSpreads:state.reportedSpreads},reviews:{manual:state.manual,outcomes:state.outcomes,activity:state.activity,reportedSpreads:state.reportedSpreads},context:{macroContext:state.macroContext,goldFramework:state.goldFramework,headlines:state.headlines,focusedNews:state.focusedNews,treasury:state.treasury,btc:state.btc,calendar:state.calendar}};
  if(!Object.hasOwn(components,kind))return;
  const data={version:'OPTIONS_WORKBENCH_DOWNLOAD_V1',exportedAt:new Date().toISOString(),loadedAt:state.loadedAt,...components[kind],executionAllowed:false,accountAccessed:false};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`alpha-${kind}-${state.loadedAt.slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Evidence download requested. The original local stores remain unchanged.');
}

document.addEventListener('input',event=>{
  const el=event.target;if(el.matches('input,textarea,select'))updateDraft(el);
  const filters={'chain-search':['chain','search'],'review-search':[null,'reviewSearch'],'news-search':[null,'newsSearch'],'macro-knowledge-search':[null,'macroKnowledgeSearch']};
  if(filters[el.id]){const [group,key]=filters[el.id];(group?ui[group]:ui)[key]=el.value;if(group)ui.chain.page=1;render();}
});
document.addEventListener('change',event=>{void(async()=>{
  const el=event.target;
  if(el.closest('form')){updateDraft(el);if(el.type==='checkbox'||['action','tradeId','fillId'].includes(el.name)||(el.closest('form').id==='macro-note-form'&&el.name==='phase'))render();return;}
  if(el.id==='board-select'){ui.chain.page=1;await reload(el.value);return;}
  if(el.id==='cost-fee-basis'){ui.costFeeBasis=el.value;clearCosts();return;}
  if(['candidate-check-asset','candidate-check-budget'].includes(el.id)){ui.candidateCheckFilter={...ui.candidateCheckFilter,[el.id==='candidate-check-asset'?'asset':'budget']:el.value};render();return;}
  if(el.dataset.chainFilter){ui.chain[el.dataset.chainFilter]=el.value;ui.chain.page=1;if(el.dataset.chainFilter==='symbol')ui.chain.expiry='';render();return;}
  const map={'lesson-origin':'lessonOrigin','news-source':'newsSource','news-asset':'newsAsset'};if(map[el.id]){ui[map[el.id]]=el.value;render();}
})().catch(e=>fail(e));});
document.addEventListener('submit',event=>{
  if(event.target.id==='thesis-plan-form'){
    event.preventDefault();if(saving||previewing)return;
    const button=event.submitter,mode=button.value;button.disabled=true;saving=true;
    void(async()=>{try{
      $('#thesis-plan-error').textContent='';
      ui.thesisFields??={...registerDefaults(),includePlan:true};ui.thesisDraft??=thesisDefaults();
      if(!ui.thesisFields.tradeId)ui.thesisFields.tradeId='plan-'+crypto.randomUUID();
      const key=JSON.stringify([ui.thesisFields,ui.thesisDraft]);
      if(mode==='CONFIRM'){
        if(!ui.thesisPreview||ui.thesisPreview.draftKey!==key)throw Error('Preview the unchanged plan before confirmation.');
        await request('/api/save',{command:ui.thesisPreview.command,expectedHeadSha256:ui.thesisPreview.headSha256});
        if(key===JSON.stringify([ui.thesisFields,ui.thesisDraft])){ui.thesisFields={...registerDefaults(),includePlan:true};ui.thesisDraft=thesisDefaults();dirty.delete('thesis');}
        ui.thesisPreview=null;ui.thesisRequestId=null;await reload();toast('Original plan frozen locally. No entry or order created.');
      }else{
        ui.thesisRequestId??='request-'+crypto.randomUUID();
        const command=thesisPlanCommand(ui,mode,ui.thesisRequestId),p=await request('/api/preview',command);
        if(key!==JSON.stringify([ui.thesisFields,ui.thesisDraft]))throw Error('Draft changed during preview. Try again.');
        if(mode==='DRAFT'){await request('/api/save',{command,expectedHeadSha256:p.headSha256});ui.thesisRequestId=null;if(key===JSON.stringify([ui.thesisFields,ui.thesisDraft]))dirty.delete('thesis');await reload();toast('Incomplete plan draft saved; no executable plan or position created.');}
        else {ui.thesisPreview={...p,draftKey:key};render();}
      }
    }catch(e){fail(e,'#thesis-plan-error');}finally{saving=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.dataset.thesisReview){
    event.preventDefault();if(saving)return;
    const form=event.target,id=form.dataset.thesisReview,button=event.submitter;button.disabled=true;saving=true;
    const d={...Object.fromEntries(new FormData(form)),ownerConfirmed:form.elements.ownerConfirmed?.checked??false};
    ui.thesisReviewDrafts??={};ui.thesisReviewDrafts[id]=d;ui.thesisReviewIds??={};if(!Object.hasOwn(ui.thesisReviewIds,id))ui.thesisReviewIds[id]='review-'+crypto.randomUUID();
    void(async()=>{try{
      const body=thesisReviewRequest(id,d,ui.positionCostDrafts?.[id],button.value,ui.thesisReviewIds[id]);
      const r=await request('/api/position-watch',body);
      if(button.value==='SAVE_REVIEW'){delete ui.thesisReviewIds[id];if(JSON.stringify(d)===JSON.stringify(ui.thesisReviewDrafts[id]))dirty.delete('thesis-review');await reload();toast('Evaluation saved. Existing triggers retained; no fill or exit recorded.');}
      else {const p=document.querySelector(`[data-thesis-review-preview="${id}"]`);if(p)p.innerHTML='<pre>'+esc(JSON.stringify(r.review.result,null,2))+'</pre>';}
    }catch(e){const p=document.querySelector(`[data-thesis-review-error="${id}"]`);if(p)p.textContent=e.message;}finally{saving=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.id==='macro-note-form'){
    event.preventDefault();if(saving)return;const form=event.target,button=event.submitter,action=button.value;saving=true;button.disabled=true;
    const fields={...macroNoteDefaults(state.macroPlaybook.data.catalog),...Object.fromEntries(new FormData(form))};ui.macroNoteDraft=fields;
    ui.macroNoteRequestId??=crypto.randomUUID();const value=macroNoteRequest(fields,state.macroPlaybook.data.catalog,ui.macroNoteRequestId);
    void(async()=>{try{
      $('#macro-note-error').textContent='';const result=await request('/api/macro-playbook',{action,request:value});
      if(action==='PREVIEW'){
        if(ui.macroNoteRequestId===value.requestId){ui.macroNotePreview=result;const panel=$('#macro-note-preview');if(panel)panel.innerHTML=macroCoverage(result);}
      } else {
        if(ui.macroNoteRequestId===value.requestId){ui.macroNoteSaved=result;dirty.delete('macro-note');}
        await reload();toast('Submitted decision note saved locally. Any newer draft is retained.');
      }
    }catch(e){fail(e,'#macro-note-error');}finally{saving=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(['etf-setup-form','etf-bars-form'].includes(event.target.id)){
    event.preventDefault();if(saving)return;const form=event.target,button=event.submitter,mode=form.id==='etf-setup-form'?'REGISTER':'IMPORT';saving=true;button.disabled=true;
    void(async()=>{try{
      let value;
      if(mode==='REGISTER')value=etfSetupRequest(Object.fromEntries(new FormData(form)));
      else {const file=form.elements.bars.files[0];if(!file||file.size>60000)throw Error('Choose a normalized evidence JSON file under 60 KB.');value=JSON.parse(await file.text());}
      await request('/api/etf-setup',{action:mode,request:value});
      dirty.delete(mode==='REGISTER'?'etf-setup':'etf-bars');if(mode==='REGISTER')ui.etfSetupDraft=null;
      await reload();toast('Local research evidence saved and verified. No trade or paper enrollment created.');
    }catch(e){fail(e,'#etf-setup-error');}finally{saving=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.dataset.positionCost){
    event.preventDefault();if(previewing)return;
    const form=event.target,id=form.dataset.positionCost,button=event.submitter,error=document.querySelector(`[data-position-error="${id}"]`),baseAt=state.loadedAt;
    const raw=String(new FormData(form).get('exitCostUsd')??'');error.textContent='';
    let input;try{input=positionWatchRequest(id,raw);}catch(e){error.textContent=e.message;return;}
    previewing=true;button.disabled=true;
    void(async()=>{try{
      const r=await request('/api/position-watch',input);
      if(!form.isConnected||baseAt!==state.loadedAt||raw!==String(new FormData(form).get('exitCostUsd')??''))throw Error('Inputs or saved data changed. Preview the current exit checks again.');
      if(!positionWatchPreviewMatches(state.positionWatch?.data,r,id))throw Error('Reported positions changed. Reload saved data before previewing their exit costs.');
      ui.positionCostPreviews??={};ui.positionCostPreviews[id]=r;
      document.querySelector(`[data-position-result="${id}"]`).innerHTML=positionWatchResult(r.rows.find(row=>row.tradeId===id),r.assessedAt);
    }catch(e){if(error.isConnected)error.textContent=e.message;}finally{previewing=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.getAttribute('id')==='snapshot-paper-form'){event.preventDefault();return;}
  if(event.target.id==='macro-comparison-form'){
    event.preventDefault();if(saving||previewing)return;const action=event.submitter.value,button=event.submitter;
    if(action==='SAVE'&&!macroPreviewMatches(ui.macroPreview,ui.macroDraft)){fail(Error('Preview the current values before saving.'),'#macro-comparison-error');return;}
    const requestBody=macroComparisonRequest(ui.macroDraft);previewing=true;button.disabled=true;
    void(async()=>{try{const result=await request('/api/macro-comparison',{action,request:requestBody});
      if(action==='SAVE'){ui.macroPreview=null;dirty.delete('macro');await reload();toast('Model comparison saved. Actual remains owner-reported and unverified.');}
      else if(JSON.stringify(requestBody)===JSON.stringify(macroComparisonRequest(ui.macroDraft))){ui.macroPreview=result;$('#macro-comparison-preview').innerHTML=macroComparisonResult(result);$('#save-macro-comparison').disabled=false;$('#macro-comparison-error').textContent='';}
    }catch(e){fail(e,'#macro-comparison-error');}finally{previewing=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.id==='event-research-form'){
    event.preventDefault();if(saving)return;saving=true;const button=event.submitter;button.disabled=true;
    void(async()=>{try{await request('/api/event-research',{action:'REGISTER',request:eventRequest(ui.eventDraft)});ui.eventDraft=null;ui.eventChoices=null;dirty.delete('event-research');await reload();toast('Research plan frozen. Future observations will retain their actual clocks.');}catch(e){fail(e,'#event-research-error');}finally{saving=false;if(button.isConnected)button.disabled=false;}})();return;
  }
  if(event.target.id==='guidance-settings-form'){
    event.preventDefault();const button=event.submitter;button.disabled=true;
    void(async()=>{try{const d=Object.fromEntries(new FormData(event.target));const value=policySettingsFromFields(d);await request('/api/guidance-settings',value);clearPolicyPreview();ui.guidanceSettingsDraft=null;dirty.delete('guidance');await reload();toast('Declared assumptions saved. Existing issued recommendations retain their original inputs.');}catch(e){fail(e,'#guidance-settings-error');}finally{if(button.isConnected)button.disabled=false;}})();return;
  }
  if(!['planner-form','journal-form'].includes(event.target.id))return;event.preventDefault();
  if(event.target.id==='journal-form'){void previewRecord();return;}
  if(calculating)return;calculating=true;const button=event.submitter;button.disabled=true;
  const draft=JSON.stringify(ui.plannerDraft);
  void(async()=>{try{const result=await request('/api/evaluate',buildScenario(plannerBudgetDraft(ui.plannerDraft,state.guidance?.data?.current.settings)));if(draft!==JSON.stringify(ui.plannerDraft))throw Error('Inputs changed during calculation. Calculate again.');ui.plannerResult=result;dirty.delete('planner');render();}catch(e){fail(e,'#planner-error');}finally{calculating=false;if(button.isConnected)button.disabled=false;}})();
});
document.addEventListener('click',event=>{void(async()=>{
  const el=event.target.closest('button,[data-asset]');if(!el)return;
  if(el.id==='observe-trend-study'){if(saving)return;saving=true;el.disabled=true;try{const r=await request('/api/etf-setup',{action:'OBSERVE_TREND',request:null});if(r.results.some(x=>x.error))throw Error('Some study records could not be recovered. Inspect saved evidence before continuing.');await reload();toast('Available evidence checked; no source request or order.');}catch(e){fail(e,'#trend-study-error');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.dataset.etfSnapshot){if(saving)return;saving=true;el.disabled=true;try{await request('/api/etf-setup',{action:'SNAPSHOT',request:el.dataset.etfSnapshot});await reload();toast('Copied research assessment saved and recovered.');}catch(e){fail(e,'#etf-setup-error');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.dataset.close){if(saving&&el.dataset.close==='preview-dialog')return;$('#'+el.dataset.close).close();return;}
  if(el.id==='discard-snapshot-paper'){ui.snapshotDraft=null;ui.snapshotPreview=null;dirty.delete('snapshot-paper');render();return;}
  if(['preview-snapshot-paper','freeze-snapshot-paper'].includes(el.id)){
    if(saving)return;const form=$('#snapshot-paper-form');if(!form.reportValidity())return;
    const input=snapshotRequest(Object.fromEntries(new FormData(form))),freeze=el.id==='freeze-snapshot-paper';
    if(freeze&&JSON.stringify(input)!==JSON.stringify(ui.snapshotPreviewRequest))throw Error('Preview the current paper plan first.');
    saving=true;el.disabled=true;
    try{const r=await request('/api/snapshot-paper',{action:freeze?'REGISTER':'PREVIEW',request:input});
      if(freeze){ui.snapshotPreview=null;ui.snapshotDraft=null;dirty.delete('snapshot-paper');await reload();toast('Local paper plan frozen. No order was created.');}
      else if(JSON.stringify(input)===JSON.stringify(snapshotRequest(Object.fromEntries(new FormData(form))))){ui.snapshotPreview=r;ui.snapshotPreviewRequest=input;$('#snapshot-paper-preview').innerHTML=snapshotResult(r);$('#freeze-snapshot-paper').disabled=false;}
    }finally{saving=false;if(el.isConnected)el.disabled=false;}return;
  }
  if(el.dataset.paperEnroll||el.dataset.paperCancel){if(saving)return;saving=true;el.disabled=true;try{await request('/api/snapshot-paper',{action:el.dataset.paperEnroll?'ENROLL':'CANCEL',id:el.dataset.paperEnroll||el.dataset.paperCancel});await reload();toast(el.dataset.paperEnroll?'Paper observation enrolled for existing bounded captures.':'Paper observation cancelled. Saved plans and modeled exposure remain.');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.dataset.snapshotSave){if(saving)return;saving=true;el.disabled=true;try{await request('/api/snapshot-paper',{action:'SAVE_REPORT',id:el.dataset.snapshotSave});await reload();toast('Observed paper result and candidate review saved and recomputed.');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.id==='reload'){await reload();return;}
  if(el.id==='preview-capital-policy'){
    if(previewingPolicy)return;previewingPolicy=true;el.disabled=true;$('#guidance-settings-error').textContent='';clearPolicyPreview();
    try{const input=policySettingsFromFields(Object.fromEntries(new FormData($('#guidance-settings-form')))),r=await request('/api/capital-policy',input);
      const form=$('#guidance-settings-form');if(!form||!capitalPolicyMatches(input,policySettingsFromFields(Object.fromEntries(new FormData(form)))))throw Error('Inputs changed during preview. Preview again.');
      ui.capitalPolicyPreview=r;$('#capital-policy-preview').innerHTML=capitalPolicyPanel(r,{preview:true});
    }catch(e){fail(e,'#guidance-settings-error');}finally{previewingPolicy=false;if(el.isConnected)el.disabled=false;}return;
  }
  if(el.id==='compare-costs'){
    if(comparingCosts)return;comparingCosts=true;el.disabled=true;$('#cost-desk-error').textContent='';
    try{const input=costRequest(),r=await request('/api/cost-desk',input);if(!costRequestMatches(input,costRequest()))throw Error('Inputs changed during comparison. Compare again.');ui.costDeskResult=r;ui.plannerResult=r.original;render();}
    catch(e){fail(e,'#cost-desk-error');}finally{comparingCosts=false;if(el.isConnected)el.disabled=false;}return;
  }
  if(el.id==='menu-toggle'){const open=document.body.classList.toggle('menu-open');el.setAttribute('aria-expanded',String(open));syncNavigation();return;}
  if(el.dataset.asset){ui.chain={...defaultFilters(),symbol:el.dataset.asset};navigate('chain');return;}
  if(el.dataset.export){download(el.dataset.export);return;}
  if(el.dataset.chainScope){ui.chain.flagged=el.dataset.chainScope==='flagged';ui.chain.page=1;render();return;}
  if(el.dataset.page){ui.chain.page=filterChain(state.chain.data?.chain.rows??[],ui.chain).page+Number(el.dataset.page);render();return;}
  if(el.id==='sort-direction'){ui.chain.direction=ui.chain.direction==='asc'?'desc':'asc';render();return;}
  if(el.id==='clear-filters'){ui.chain=defaultFilters();render();return;}
  if(el.dataset.contract){const row=state.chain.data?.chain.rows.find(r=>r.id===el.dataset.contract);if(row)showDetail('Contract & activity evidence',contractDetail(row,state));return;}
  if(el.dataset.planContract){const row=state.chain.data?.chain.rows.find(r=>r.id===el.dataset.planContract);if(row)prepareContract(row);return;}
  if(el.dataset.guidancePlan){
    const c=state.guidance.data.current.assets.flatMap(a=>a.candidates).find(c=>c.contract.id===el.dataset.guidancePlan);if(!c)return;
    if(dirty.has('planner'))throw Error('Your planner draft is preserved. Clear or finish it before inspecting a candidate.');
    const q=c.contract,v=c.scenario,toUsd=n=>n===null||n<0?'':exactUsd(n);
    ui.plannerDraft={symbol:q.symbol,strategy:v.strategy,equity:toUsd(v.currentEquityCents),cash:toUsd(v.settledCashCents),quantity:'1',tick:toUsd(q.tickCents),bid:toUsd(q.bidCents),ask:toUsd(q.askCents),fees:toUsd(v.roundTripFeesCents),slippage:toUsd(v.slippageReserveCents),stop:String(v.stopLossBps/100),reward:String(v.rewardMultipleMilliR/1000),...(v.tradeBudget?.version==='OWNER_ALLOCATION_ONLY_V2'?{budgetVersion:v.tradeBudget.version}:{}),budgetMin:v.tradeBudget?exactUsd(v.tradeBudget.minCents):'',budgetMax:v.tradeBudget?exactUsd(v.tradeBudget.maxCents):''};
    ui.planningSource={...q,bid:toUsd(q.bidCents),ask:toUsd(q.askCents),quoteUpdatedAt:q.updatedAt};ui.plannerResult=null;clearCosts();dirty.add('planner');navigate('planner');return;
  }
  if(el.id==='reset-guidance-assumptions'){clearPolicyPreview();ui.guidanceSettingsDraft=null;dirty.delete('guidance');render();return;}
  if(el.id==='clear-macro-note'){ui.macroNoteDraft=null;ui.macroNoteRequestId=null;ui.macroNotePreview=null;ui.macroNoteSaved=null;dirty.delete('macro-note');render();return;}
  if(el.dataset.macroPrompt){
    ui.macroNoteDraft=appendMacroReflection(ui.macroNoteDraft,state.macroPlaybook.data.catalog,el.dataset.macroPrompt);
    ui.macroNoteRequestId=null;ui.macroNotePreview=null;ui.macroNoteSaved=null;dirty.add('macro-note');render();
    const form=$('#macro-note-form');form.closest('details').open=true;form.elements.personalNote.focus();return;
  }
  if(el.dataset.candidateCheck){const r=state.candidateChecks?.data?.current,row=r?.rows.find(x=>x.contract.id===el.dataset.candidateCheck);if(row)showDetail('Candidate checks',candidateCheckDetail(row,r));return;}
  if(el.id==='save-candidate-checks'){if(saving)return;if(dirty.has('guidance'))throw Error('Save or discard the planning-assumption draft first.');saving=true;el.disabled=true;try{const r=await request('/api/candidate-checks',{});await reload();toast('Check snapshot saved and verified at '+timestamp(r.assessedAt)+'. No trade was created.');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.id==='reset-event-research'){ui.eventDraft=null;ui.eventChoices=null;dirty.delete('event-research');render();return;}
  if(el.dataset.eventSave){if(saving)return;saving=true;el.disabled=true;try{await request('/api/event-research',{action:'SAVE_REPORT',id:el.dataset.eventSave});toast('Independent research snapshot saved and verified.');}finally{saving=false;if(el.isConnected)el.disabled=false;}return;}
  if(el.id==='reset-planner'){ui.plannerDraft=plannerDefaults();ui.plannerResult=null;ui.planningSource=null;ui.costFeeBasis='DECLARED_FEES';clearCosts();dirty.delete('planner');render();return;}
  if(el.id==='plan-to-journal'){transferPlan();return;}
  if(el.id==='plan-to-thesis'){transferPlan('thesis');return;}
  if(el.dataset.thesisComparison){
    const id=el.dataset.thesisTrade,r=state.macroContext?.data?.comparisons.find(r=>r.request.requestId===el.dataset.thesisComparison),trade=state.manual.data?.trades.find(t=>t.tradeId===id);
    const c=trade?.plan?.invalidation?.conditions.find(c=>c.kind==='EVENT_NUMERIC'&&c.metric===r?.request.metric&&c.period===r?.request.period);
    if(!r||!c)throw Error('The saved comparison no longer matches this original condition.');
    ui.thesisReviewDrafts??={};ui.thesisReviewIds??={};delete ui.thesisReviewIds[id];
    ui.thesisReviewDrafts[id]={...ui.thesisReviewDrafts[id],conditionId:c.id,eventKey:c.eventKey,metric:r.request.metric,period:r.request.period,source:r.request.sourceUrl,sourceAt:r.request.releaseAt,receivedAt:r.assessedAt,value:r.request.actualValue,unit:'',releaseVersion:'',comparisonRef:'data/runtime/options-macro-comparisons/'+r.request.requestId+'.json',ownerConfirmed:false};
    dirty.add('thesis-review');render();toast('Saved comparison copied. Confirm its unit, release vintage and original source before using it.');return;
  }
  if(el.dataset.thesisDraft){
    if(dirty.has('thesis'))throw Error('Your current thesis draft is preserved. Save it before loading another.');
    const r=(state.manual.data?.planRecords??[]).filter(e=>e.command.type==='SAVE_PLAN_DRAFT'&&e.command.tradeId===el.dataset.thesisDraft).at(-1);
    if(r){ui.thesisFields=structuredClone(r.command.draft.fields);ui.thesisDraft=structuredClone(r.command.draft.thesis);ui.thesisPreview=null;ui.thesisRequestId=null;render();}return;
  }
  if(el.dataset.journalMode){ui.journalMode=el.dataset.journalMode;render();return;}
  if(el.id==='reset-journal'){drafts[ui.journalMode]=ui.journalMode==='register'?registerDefaults():fillDefaults();dirty.delete(ui.journalMode);render();return;}
  if(el.id==='confirm-save'){await saveRecord();return;}
  if(el.id==='initialize-ledger'){el.disabled=true;try{await request('/api/initialize',{});await reload();}catch(e){el.disabled=false;throw e;}return;}
  if(el.dataset.trade){const t=state.manual.data?.trades.find(t=>t.tradeId===el.dataset.trade);if(t)showDetail('Trade reconciliation',tradeDetail(t,state.manual.data));return;}
  if(el.dataset.reviewScope){ui.reviewScope=el.dataset.reviewScope;render();}
})().catch(e=>fail(e));});
$('#preview-dialog').addEventListener('cancel',event=>{if(saving)event.preventDefault();});
window.addEventListener('hashchange',()=>{document.body.classList.remove('menu-open');$('#menu-toggle').setAttribute('aria-expanded','false');syncNavigation();if(location.hash==='#main'){$('#main').focus();return;}render(true);window.scrollTo(0,0);});
window.addEventListener('resize',syncNavigation);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('menu-open')){document.body.classList.remove('menu-open');$('#menu-toggle').setAttribute('aria-expanded','false');syncNavigation();$('#menu-toggle').focus();}});
window.addEventListener('beforeunload',event=>{if(dirty.size||saving){event.preventDefault();event.returnValue='';}});
syncNavigation();void reload();
setInterval(()=>{if(document.visibilityState==='visible'&&!dirty.size&&!saving&&!previewing&&!calculating&&!loading&&!document.querySelector('dialog[open]'))void reload(state?.selectedBoardId??'');},60000);
