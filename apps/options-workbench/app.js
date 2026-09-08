import {request} from './api.js';
import {routes,contractDetail,tradeDetail,plannerResult,detail,notice,table,empty} from './views.js';
import {esc,words,dollars,timestamp,exactUsd,decimalText,filterChain} from './model.js';
import {plannerDefaults,registerDefaults,fillDefaults,buildScenario,buildCommand} from './forms.js';

const $=selector=>document.querySelector(selector);
const defaultFilters=()=>({symbol:'',expiry:'',type:'',flagged:false,search:'',sort:'volume',direction:'desc',page:1});
const drafts={register:registerDefaults(),fill:fillDefaults(),correct:fillDefaults()};
const ui={chain:defaultFilters(),plannerDraft:plannerDefaults(),plannerResult:null,planningSource:null,journalMode:'register',journalDraft:drafts.register,reviewScope:'trades',lessonOrigin:'',reviewSearch:'',newsSource:'',newsSearch:''};
let state=null,pending=null,pendingKey=null,requestId=null,loading=false,saving=false,calculating=false,previewing=false,toastTimer;
const dirty=new Set();
function syncNavigation(){
  const hidden=matchMedia('(max-width: 650px)').matches&&!document.body.classList.contains('menu-open');
  $('#sidebar').inert=hidden;if(hidden)$('#sidebar').setAttribute('aria-hidden','true');else $('#sidebar').removeAttribute('aria-hidden');
}
const labels={overview:'Overview',chain:'Options & activity',planner:'Trade planner',journal:'Trade journal',reviews:'Reviews & lessons',context:'News & calendar'};
function route(){const key=location.hash.slice(1);return Object.hasOwn(routes,key)?key:'overview';}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5500);}
function render(focus=false){
  if(!state)return;
  const active=document.activeElement,id=active?.id,name=active?.name,position=active?.selectionStart;
  const key=route();ui.journalDraft=drafts[ui.journalMode];
  $('#main').innerHTML=routes[key](state,ui);$('#breadcrumb').textContent=labels[key];
  document.title=`${labels[key]} · Alpha`;
  for(const link of document.querySelectorAll('[data-route]')){const selected=link.dataset.route===key;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  if(focus)$('#main').focus({preventScroll:true});
  else {const next=id?document.getElementById(id):name?document.querySelector(`[name="${name}"]`):null;if(next){next.focus({preventScroll:true});if(typeof position==='number'&&['text','search','tel','url','password'].includes(next.type))next.setSelectionRange(position,position);}}
}
function navigate(key){if(route()===key)render(true);else location.hash=key;}
function fail(error,target){const el=target&&$(target);if(el)el.textContent=error.message??'Local operation failed.';else toast(error.message??'Local operation failed.');}
async function reload(board=state?.selectedBoardId??null){
  if(loading)return;loading=true;$('#reload').disabled=true;$('#connection').textContent='Checking saved evidence…';
  try{
    state=await request('/api/state'+(board?'?board='+encodeURIComponent(board):''));
    const unavailable=Object.values(state).filter(v=>v&&typeof v==='object'&&['MISSING','BLOCKED'].includes(v.state)).length;
    $('#connection').innerHTML=notice(`${state.manual.data?.origin==='SYNTHETIC_FIXTURE'?'<strong>ISOLATED SYNTHETIC LEDGER.</strong> ':''}<strong>Saved local evidence</strong> · Market prices are not refreshed here.${unavailable?` ${unavailable} component(s) unavailable; see the affected page.`:''}`,unavailable?'error':'');
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
  const key=form.id==='planner-form'?'planner':ui.journalMode,d=key==='planner'?ui.plannerDraft:drafts[key];
  d[el.name]=el.type==='checkbox'?el.checked:el.value;dirty.add(key);
  if(key==='planner'){ui.plannerResult=null;const panel=$('#planner-result');if(panel)panel.innerHTML=plannerResult(null);}
  if(key==='correct'&&el.name==='tradeId'){d.fillId='';d.expectedRevision='';}
  if(key==='correct'&&el.name==='fillId')chooseFill();
}
function prepareContract(row){
  ui.plannerDraft={...ui.plannerDraft,symbol:row.symbol,strategy:row.type==='call'?'LONG_CALL':'LONG_PUT',bid:decimalText(row.bid),ask:decimalText(row.ask)};
  ui.planningSource=row;ui.plannerResult=null;dirty.add('planner');$('#detail-dialog').close();navigate('planner');
}
function transferPlan(){
  const r=ui.plannerResult,s=r?.scenario,e=r?.economics;if(!s||!e)throw Error('Calculate a scenario first.');
  if([e.plannedStopCents,e.netProfitTargetCents,e.roundedNetProfitTargetCents].some(v=>v===null)||s.roundTripFeesCents===null)throw Error('Declare the costs before preparing this plan.');
  if(dirty.has('register'))throw Error('Your registration draft is preserved. Save or clear it before transferring a new plan.');
  const row=ui.planningSource;
  Object.assign(drafts.register,registerDefaults(),{symbol:s.symbol,optionType:s.strategy==='LONG_CALL'?'CALL':'PUT',expiry:row?.symbol===s.symbol?row.expiry:'',strikeUsd:row?.symbol===s.symbol?decimalText(row.strike):'',includePlan:true,declaredAt:new Date().toISOString(),maxContracts:String(s.quantity),maxEntryDebitUsd:exactUsd(e.premiumCents+s.roundTripFeesCents),plannedRiskUsd:exactUsd(e.plannedStopCents),targetNetProfitUsd:exactUsd(e.roundedNetProfitTargetCents),stopPremiumUsd:(BigInt(s.askPerShareCents)*BigInt(10000-s.stopLossBps)).toString().padStart(7,'0').replace(/(\d{6})$/,'.$1')});
  const candidate=row&&state.activity.data?.cases.find(c=>c.candidate.id===row.id);
  if(candidate&&row.symbol===s.symbol&&(row.type==='call')===(s.strategy==='LONG_CALL'))Object.assign(drafts.register,{includeActivity:true,studyId:state.activity.data.studyId,studyFingerprint:state.activity.data.studyFingerprint,candidateId:row.id});
  dirty.add('register');ui.journalMode='register';navigate('journal');toast('Scenario copied to a draft. Check the contract, entry-cost allowance, times and thesis before saving.');
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
  const components={chain:{chain:state.chain,activity:state.activity},manual:{ledgerId:state.ledgerId,manual:state.manual},reviews:{manual:state.manual,outcomes:state.outcomes,activity:state.activity},context:{headlines:state.headlines,treasury:state.treasury,btc:state.btc,calendar:state.calendar}};
  if(!Object.hasOwn(components,kind))return;
  const data={version:'OPTIONS_WORKBENCH_DOWNLOAD_V1',exportedAt:new Date().toISOString(),loadedAt:state.loadedAt,...components[kind],executionAllowed:false,accountAccessed:false};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`alpha-${kind}-${state.loadedAt.slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Evidence download requested. The original local stores remain unchanged.');
}

document.addEventListener('input',event=>{
  const el=event.target;if(el.matches('input,textarea,select'))updateDraft(el);
  const filters={'chain-search':['chain','search'],'review-search':[null,'reviewSearch'],'news-search':[null,'newsSearch']};
  if(filters[el.id]){const [group,key]=filters[el.id];(group?ui[group]:ui)[key]=el.value;if(group)ui.chain.page=1;render();}
});
document.addEventListener('change',event=>{void(async()=>{
  const el=event.target;
  if(el.closest('form')){updateDraft(el);if(el.type==='checkbox'||['action','tradeId','fillId'].includes(el.name))render();return;}
  if(el.id==='board-select'){ui.chain.page=1;await reload(el.value);return;}
  if(el.dataset.chainFilter){ui.chain[el.dataset.chainFilter]=el.value;ui.chain.page=1;if(el.dataset.chainFilter==='symbol')ui.chain.expiry='';render();return;}
  const map={'lesson-origin':'lessonOrigin','news-source':'newsSource'};if(map[el.id]){ui[map[el.id]]=el.value;render();}
})().catch(e=>fail(e));});
document.addEventListener('submit',event=>{
  if(!['planner-form','journal-form'].includes(event.target.id))return;event.preventDefault();
  if(event.target.id==='journal-form'){void previewRecord();return;}
  if(calculating)return;calculating=true;const button=event.submitter;button.disabled=true;
  const draft=JSON.stringify(ui.plannerDraft);
  void(async()=>{try{const result=await request('/api/evaluate',buildScenario(ui.plannerDraft));if(draft!==JSON.stringify(ui.plannerDraft))throw Error('Inputs changed during calculation. Calculate again.');ui.plannerResult=result;dirty.delete('planner');render();}catch(e){fail(e,'#planner-error');}finally{calculating=false;if(button.isConnected)button.disabled=false;}})();
});
document.addEventListener('click',event=>{void(async()=>{
  const el=event.target.closest('button,[data-asset]');if(!el)return;
  if(el.dataset.close){if(saving&&el.dataset.close==='preview-dialog')return;$('#'+el.dataset.close).close();return;}
  if(el.id==='reload'){await reload();return;}
  if(el.id==='menu-toggle'){const open=document.body.classList.toggle('menu-open');el.setAttribute('aria-expanded',String(open));syncNavigation();return;}
  if(el.dataset.asset){ui.chain={...defaultFilters(),symbol:el.dataset.asset};navigate('chain');return;}
  if(el.dataset.export){download(el.dataset.export);return;}
  if(el.dataset.chainScope){ui.chain.flagged=el.dataset.chainScope==='flagged';ui.chain.page=1;render();return;}
  if(el.dataset.page){ui.chain.page=filterChain(state.chain.data?.chain.rows??[],ui.chain).page+Number(el.dataset.page);render();return;}
  if(el.id==='sort-direction'){ui.chain.direction=ui.chain.direction==='asc'?'desc':'asc';render();return;}
  if(el.id==='clear-filters'){ui.chain=defaultFilters();render();return;}
  if(el.dataset.contract){const row=state.chain.data?.chain.rows.find(r=>r.id===el.dataset.contract);if(row)showDetail('Contract & activity evidence',contractDetail(row,state));return;}
  if(el.dataset.planContract){const row=state.chain.data?.chain.rows.find(r=>r.id===el.dataset.planContract);if(row)prepareContract(row);return;}
  if(el.id==='reset-planner'){ui.plannerDraft=plannerDefaults();ui.plannerResult=null;ui.planningSource=null;dirty.delete('planner');render();return;}
  if(el.id==='plan-to-journal'){transferPlan();return;}
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
