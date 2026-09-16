import '../css/variables.css';
import '../css/base.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/responsive.css';
import { config, configurationError } from './config.js';
import { supabase } from './supabase.js';
import { currentSession, signIn, signOut, selectMember, selectedMember, memberSessionKey } from './auth.js';
import { state, currentMember } from './state.js';
import { loadWorkspace, saveTask, deleteTask, saveEntity } from './repository.js';
import { renderApp, renderLogin, renderMemberPicker, toast, NAV } from './ui.js';
import { renderPanel, readTaskForm, readEntityForm, panelError, confirmDialog, loadAvatar } from './panels.js';
import { validateTask } from './domain.js';
import { clone, uid, debounce, escape as e } from './utils.js';
let authenticated = false;
let baseline = '';
let loading = false;
let refreshQueue = Promise.resolve();
let exporting = false;
let returnFocus = null;
const fingerprint = value => JSON.stringify(value, (key, item) => key === 'assignee_ids' ? [...item].sort() : item);
function render() { if (!authenticated) return renderLogin(); if (!currentMember()?.active) return renderMemberPicker(); renderApp(); }
function refresh(quiet = false, strict = false) {
  const request = refreshQueue.then(async () => {
  loading = true;
  try {
    const data = await loadWorkspace();
    if (!authenticated) return;
    state.data = data; state.syncedAt = new Date(); state.offline = false;
    if (state.memberId && !currentMember()?.active) { state.memberId = null; sessionStorage.removeItem(memberSessionKey); state.panel = null; renderPanel(); }
    if (!quiet || !state.panel) render();
  } catch (error) {
    state.offline = true;
    if (!quiet || strict) throw error;
    if (!state.panel) render();
  } finally { loading = false; }
  });
  refreshQueue = request.catch(() => {});
  return request;
}
function navigate(view, filters = {}) {
  if (!NAV.some(n => n[0] === view)) return;
  state.view = view; state.filters = filters; state.search = ''; state.showFilters = Object.keys(filters).length > 0; state.archived = false;
  history.replaceState(null,'',`#${view}`); render(); window.scrollTo({top:0});
}
function showTask(id = null, status = 'Da fare') {
  const task = id ? state.data.tasks.find(t => t.id === id) : { id:null,title:'',client_id:null,cluster_id:null,assignee_ids:[state.memberId],status,priority:'Media',due_date:null,description:'',notes:'',checklist:[] };
  if (!task) return toast('Questa attività non è più disponibile.',true);
  returnFocus = document.activeElement;
  state.selectedTask = clone(task); state.panel = 'task'; baseline = fingerprint(task); renderPanel();
}
function showEntity(kind, id = null) {
  const value = id ? state.data[kind].find(x => x.id === id) : { name:'',description:'',color:'#527260',archived:false,client_id:null,role:'',avatar:'',active:true };
  if (!value) return;
  returnFocus = document.activeElement;
  state.entityDraft = {kind,value:clone(value)}; state.panel='entity'; baseline=fingerprint(value); renderPanel();
}
function hasChanges() {
  if(state.panel==='task') return fingerprint(readTaskForm())!==baseline;
  if(state.panel==='entity') return fingerprint(readEntityForm())!==baseline;
  return false;
}
async function closePanel(force = false) {
  if(state.busy) return;
  if(!force && hasChanges() && !await confirmDialog('Chiudere senza salvare?','Le modifiche presenti nel pannello non sono ancora state salvate.','Scarta modifiche')) return;
  state.panel=null;state.selectedTask=null;state.entityDraft=null;renderPanel();
  if(returnFocus?.isConnected) returnFocus.focus(); else document.getElementById('new-task-button')?.focus();
}
async function persistTask(close = true) {
  if(state.busy) return;
  state.selectedTask=readTaskForm();
  const draft=clone(state.selectedTask);
  const form=document.getElementById('task-form');
  if(!form.reportValidity()) return;
  let saved = false;
  try {
    validateTask(draft,state.data);
    state.busy=true; setPanelBusy(true);
    const id=await saveTask(draft,state.memberId,draft.updated_at||null);
    saved = true;
    await refresh(true, true);
    if(!state.panel) return;
    state.selectedTask=clone(state.data.tasks.find(t=>t.id===id));baseline=fingerprint(state.selectedTask);
    state.busy=false;
    if(close) await closePanel(true); else renderPanel(false);
    render();toast(close?'Attività salvata.':'Checklist aggiornata.');
  } catch(error) { panelError(saved ? 'Il salvataggio è riuscito, ma non è stato possibile ricaricare il workspace. Chiudi il pannello e aggiorna la pagina prima di continuare.' : error.message); }
  finally { state.busy=false;setPanelBusy(false); }
}
function setPanelBusy(busy) { document.querySelectorAll('#task-form button, #entity-form button, #task-form input, #task-form select, #entity-form input, #entity-form select').forEach(el=>{if(busy){el.dataset.wasDisabled=String(el.disabled);el.disabled=true;}else if(el.dataset.wasDisabled!==undefined){el.disabled=el.dataset.wasDisabled==='true';delete el.dataset.wasDisabled;}}); }
async function quickSave(id, patch) {
  if(state.busy) return;
  const task=state.data.tasks.find(t=>t.id===id);if(!task) return;
  state.busy=true;
  try { await saveTask({...task,...patch},state.memberId,task.updated_at); await refresh();toast('Attività aggiornata.'); }
  catch(error){render();toast(error.message,true);}
  finally {state.busy=false;}
}
async function persistEntity() {
  if(state.busy) return;
  const value=readEntityForm();
  const kind=state.entityDraft.kind;
  if(!document.getElementById('entity-form').reportValidity()) return;
  let saved=false;
  try {state.busy=true;setPanelBusy(true);await saveEntity(kind,value,state.memberId);saved=true;await refresh(true,true);state.busy=false;await closePanel(true);render();toast('Dati salvati.');}
  catch(error){panelError(saved?'I dati sono stati salvati. Ricarica il workspace per visualizzare la versione aggiornata.':error.message);}
  finally{state.busy=false;setPanelBusy(false);}
}
async function exportAll() {
  if(exporting) return;
  exporting=true;
  document.querySelectorAll('[data-action="export"]').forEach(b=>b.disabled=true);
  try {const {exportExcel}=await import('./export.js');await exportExcel(clone(state.data));toast('Report Excel pronto: 4 fogli con tutti i dati del workspace.');}
  catch(error){toast(`Esportazione non riuscita: ${error.message}`,true);}
  finally{exporting=false;document.querySelectorAll('[data-action="export"]').forEach(b=>b.disabled=false);}
}
async function handleClick(event) {
  const button=event.target.closest('button,a[data-nav]');
  if(!button) {if(event.target.id==='panel-overlay') await closePanel();return;}
  if(button.disabled || state.busy) return;
  if(button.dataset.nav){event.preventDefault();navigate(button.dataset.nav);return;}
  if(button.dataset.selectMember){state.memberId=button.dataset.selectMember;selectMember(state.memberId);state.quick='today';state.dashboardScope='personal';navigate('dashboard');return;}
  if(button.dataset.quick){state.quick=button.dataset.quick;render();return;}
  if(button.dataset.scope){state.dashboardScope=button.dataset.scope;render();return;}
  if(button.dataset.sort){state.direction=state.sort===button.dataset.sort && state.direction==='asc'?'desc':'asc';state.sort=button.dataset.sort;render();return;}
  if(button.dataset.openTask){showTask(button.dataset.openTask);return;}
  if(button.dataset.complete){const t=state.data.tasks.find(x=>x.id===button.dataset.complete);await quickSave(t.id,{status:t.status==='Completata'?'Da fare':'Completata'});return;}
  if(button.dataset.newStatus){showTask(null,button.dataset.newStatus);return;}
  if(button.dataset.memberFilter){navigate('tasks',{member:button.dataset.memberFilter});return;}
  if(button.dataset.clusterFilter){navigate('tasks',{cluster:button.dataset.clusterFilter});return;}
  if(button.dataset.entityFilter){navigate('tasks',{[button.dataset.kind==='clients'?'client':'cluster']:button.dataset.entityFilter});return;}
  if(button.hasAttribute('data-show-blocked')){navigate('tasks',{status:'Bloccata'});return;}
  if(button.dataset.newEntity){showEntity(button.dataset.newEntity);return;}
  if(button.dataset.editEntity){showEntity(button.dataset.kind,button.dataset.editEntity);return;}
  if(button.dataset.removeItem){state.selectedTask=readTaskForm();state.selectedTask.checklist=state.selectedTask.checklist.filter(i=>i.id!==button.dataset.removeItem);renderPanel(false);return;}
  if(button.dataset.moveItem){state.selectedTask=readTaskForm();const items=state.selectedTask.checklist;const at=items.findIndex(i=>i.id===button.dataset.moveItem),to=at+Number(button.dataset.direction);if(to>=0&&to<items.length)[items[at],items[to]]=[items[to],items[at]];renderPanel(false);return;}
  switch(button.dataset.action){
    case 'new-task':showTask();break;
    case 'close-panel':await closePanel();break;
    case 'manage-team':state.panel='team';baseline='';returnFocus=button;renderPanel();break;
    case 'switch-member':state.memberId=null;sessionStorage.removeItem(memberSessionKey);renderMemberPicker();break;
    case 'logout':await signOut();authenticated=false;state.memberId=null;state.data={members:[],clients:[],clusters:[],tasks:[],activity:[]};renderLogin();break;
    case 'toggle-filters':state.showFilters=!state.showFilters;render();break;
    case 'reset-filters':state.filters={};state.search='';state.quick='all';render();break;
    case 'mobile-menu':document.getElementById('sidebar').classList.toggle('mobile-open');break;
    case 'refresh':await refresh();break;
    case 'export':await exportAll();break;
    case 'add-checklist':state.selectedTask=readTaskForm();state.selectedTask.checklist.push({id:uid(),text:'',completed:false,assignee_ids:[],due_date:null,completed_at:null,position:state.selectedTask.checklist.length});renderPanel(false);document.querySelector('#checklist-editor .checklist-item:last-child input[type=text]')?.focus();break;
    case 'remove-avatar':state.entityDraft.value={...readEntityForm(),avatar:''};renderPanel(false);break;
    case 'delete-task':if(await confirmDialog('Eliminare questa attività?','L’attività e la sua checklist verranno eliminate. Lo storico essenziale dell’eliminazione sarà conservato.','Elimina attività')){try{state.busy=true;await deleteTask(state.selectedTask,state.memberId);await refresh(true);state.busy=false;await closePanel(true);render();toast('Attività eliminata.');}finally{state.busy=false;}}break;
  }
}
document.addEventListener('click',event=>{handleClick(event).catch(error=>toast(error.message,true));});
document.addEventListener('submit',async event=>{
  if(!['login-form','task-form','entity-form'].includes(event.target.id))return;
  event.preventDefault();
  if(event.target.id==='task-form')return persistTask();
  if(event.target.id==='entity-form')return persistEntity();
  const f=new FormData(event.target);
  const b=event.target.querySelector('button');b.disabled=true;b.textContent='Accesso in corso…';
  try{await signIn(f.get('email'),f.get('password'));authenticated=true;state.memberId=selectedMember();await refresh();}
  catch(error){authenticated=false;renderLogin(error.message);}
});
const search=debounce(value=>{state.search=value;if(value.trim() && state.view!=='tasks'){state.view='tasks';state.filters={};state.quick='all';history.replaceState(null,'','#tasks');}render();const input=document.getElementById('global-search');input?.focus();},200);
document.addEventListener('input',event=>{if(event.target.id==='global-search')search(event.target.value);});
document.addEventListener('change',async event=>{
  const el=event.target;
  try{
    if(el.dataset.filter){state.filters[el.dataset.filter]=el.type==='checkbox'?el.checked:el.value;if(el.dataset.filter==='client')state.filters.cluster='';render();}
    else if(el.id==='show-archived'){state.archived=el.checked;render();}
    else if(el.dataset.statusTask)await quickSave(el.dataset.statusTask,{status:el.value});
    else if(el.id==='task-client'){state.selectedTask=readTaskForm();const cluster=state.data.clusters.find(c=>c.id===state.selectedTask.cluster_id);if(cluster?.client_id && cluster.client_id!==el.value)state.selectedTask.cluster_id=null;renderPanel(false);document.getElementById('task-client')?.focus();}
    else if(el.id==='task-cluster'){state.selectedTask=readTaskForm();const cluster=state.data.clusters.find(c=>c.id===el.value);if(cluster?.client_id)state.selectedTask.client_id=cluster.client_id;renderPanel(false);document.getElementById('task-cluster')?.focus();}
    else if(el.dataset.itemCompleted){state.selectedTask=readTaskForm();if(state.selectedTask.created_at)await persistTask(false);else renderPanel(false);}
    else if(el.id==='avatar-input' && el.files[0]){state.entityDraft.value={...readEntityForm(),avatar:await loadAvatar(el.files[0])};renderPanel(false);}
  }catch(error){panelError(error.message);toast(error.message,true);}
});
document.addEventListener('keydown',event=>{
  const modal=document.querySelector('.confirm-overlay') || document.querySelector('#panel-overlay');
  if(event.key==='Tab' && modal){const elements=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=elements[0],last=elements.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
  if(event.key==='Escape' && state.panel && !document.querySelector('.confirm-overlay')){event.preventDefault();closePanel();}
  if(event.key==='/' && authenticated && !state.panel && !['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();document.getElementById('global-search')?.focus();}
});
let draggedTask=null;
let pointerDrag=null;
function finishDrag(){
  document.querySelectorAll('.drag-over,.dragging').forEach(c=>c.classList.remove('drag-over','dragging'));
  document.querySelector('.drag-ghost')?.remove();
  document.body.classList.remove('is-dragging');
  pointerDrag=null;draggedTask=null;
}
document.addEventListener('pointerdown',event=>{
  const card=event.target.closest('[data-drag-task]');
  if(!card||state.busy||event.button!==0||event.pointerType==='touch'||event.target.closest('button,select,input,a'))return;
  const rect=card.getBoundingClientRect();
  pointerDrag={id:card.dataset.dragTask,card,pointerId:event.pointerId,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.x,offsetY:event.clientY-rect.y,width:rect.width};
  card.setPointerCapture(event.pointerId);
  event.preventDefault();
});
document.addEventListener('pointermove',event=>{
  if(!pointerDrag||event.pointerId!==pointerDrag.pointerId)return;
  const d=pointerDrag;
  if(!draggedTask&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<6)return;
  if(!draggedTask){
    draggedTask=d.id;d.card.classList.add('dragging');document.body.classList.add('is-dragging');
    const ghost=d.card.cloneNode(true);ghost.classList.remove('dragging');ghost.classList.add('drag-ghost');ghost.removeAttribute('data-drag-task');ghost.setAttribute('aria-hidden','true');ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.style.width=`${d.width}px`;document.body.append(ghost);
  }
  const ghost=document.querySelector('.drag-ghost');
  ghost.style.left=`${event.clientX-d.offsetX}px`;ghost.style.top=`${event.clientY-d.offsetY}px`;
  const column=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-status]');
  document.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));
  column?.classList.add('drag-over');
});
document.addEventListener('pointerup',event=>{
  if(!pointerDrag||event.pointerId!==pointerDrag.pointerId)return;
  const id=draggedTask;
  const status=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-status]')?.dataset.dropStatus;
  if(pointerDrag.card.hasPointerCapture(event.pointerId))pointerDrag.card.releasePointerCapture(event.pointerId);
  finishDrag();
  if(id&&status&&state.data.tasks.find(t=>t.id===id)?.status!==status)quickSave(id,{status});
});
document.addEventListener('pointercancel',finishDrag);
window.addEventListener('blur',finishDrag);
function refreshIfIdle(){if(authenticated&&!state.panel&&!state.busy&&!loading&&!pointerDrag&&document.visibilityState==='visible'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))refresh(true);}
setInterval(refreshIfIdle,30000);
window.addEventListener('focus',refreshIfIdle);
window.addEventListener('online',refreshIfIdle);
window.addEventListener('storage',event=>{if(config.demo&&event.key==='eng-workspace-demo-v1')refreshIfIdle();});
window.addEventListener('beforeunload',event=>{if(hasChanges()){event.preventDefault();event.returnValue='';}});
supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){authenticated=false;state.memberId=null;state.panel=null;sessionStorage.removeItem(memberSessionKey);renderPanel();renderLogin('La sessione è terminata. Accedi nuovamente.');}});
async function boot(){
  const error=configurationError();
  if(error){document.getElementById('app').innerHTML=`<main class="config-screen"><div class="eyebrow">ENG WORKSPACE</div><h1>Prepariamo il tuo spazio.</h1><p>${e(error)}</p><p>Nel progetto trovi schema SQL, regole di accesso, dati iniziali e istruzioni complete. Dopo la configurazione riavvia l’app.</p></main>`;return;}
  try{authenticated=await currentSession();if(authenticated){state.memberId=selectedMember();const view=location.hash.slice(1);if(NAV.some(n=>n[0]===view))state.view=view;await refresh();}else renderLogin();}
  catch(error){authenticated=false;renderLogin(error.message);}
}
boot();
