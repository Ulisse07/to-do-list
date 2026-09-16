import { state } from './state.js';
import { STATUSES, PRIORITIES, checklistProgress } from './domain.js';
import { escape as e, icon, formatDate, safeColor } from './utils.js';
import { avatar, options, activityList } from './ui.js';
export function memberOptions(ids, name, compact = false) {
  return `<div class="assignee-options">${state.data.members.filter(m => m.active || ids.includes(m.id)).map(m => `<label class="assignee-option">${compact ? '' : avatar(m, 'small', false)}<input type="checkbox" name="${name}" value="${m.id}" ${ids.includes(m.id) ? 'checked' : ''} ${!m.active && !ids.includes(m.id) ? 'disabled' : ''}/>${e(m.name)}${m.active ? '' : ' · disattivato'}</label>`).join('')}</div>`;
}
function checklist(task) {
  const p = checklistProgress(task);
  return `<div class="panel-section"><div class="checklist-header"><h3>Checklist</h3><span class="subtle">${p.done} / ${p.total} · ${p.percent}%</span></div><div class="track"><span style="width:${p.percent}%"></span></div><p class="field-note">${task.created_at ? 'Un clic sulla spunta salva la checklist e le modifiche presenti nel pannello.' : 'La checklist sarà salvata insieme alla nuova attività.'}</p><div id="checklist-editor">${task.checklist.map((item, i) => `<div class="checklist-item ${item.completed ? 'is-done' : ''}" data-checklist-item="${item.id}"><div class="checklist-main"><input type="checkbox" data-item-completed="${item.id}" ${item.completed ? 'checked' : ''} aria-label="Completa sotto-attività ${i + 1}"/><input type="text" maxlength="1000" data-item-text="${item.id}" value="${e(item.text)}" placeholder="Scrivi una sotto-attività…" aria-label="Testo sotto-attività ${i + 1}" required/><button type="button" class="icon-button" data-move-item="${item.id}" data-direction="-1" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su sotto-attività ${i + 1}">${icon('up', 13)}</button><button type="button" class="icon-button" data-move-item="${item.id}" data-direction="1" ${i === task.checklist.length - 1 ? 'disabled' : ''} aria-label="Sposta giù sotto-attività ${i + 1}">${icon('down', 13)}</button><button type="button" class="icon-button" data-remove-item="${item.id}" aria-label="Elimina sotto-attività ${i + 1}">${icon('close', 14)}</button></div><details class="checklist-details"><summary>Responsabili e scadenza${item.assignee_ids.length ? ` · ${item.assignee_ids.length} assegnati` : ''}${item.due_date ? ` · ${formatDate(item.due_date)}` : ''}</summary>${memberOptions(item.assignee_ids, `item-assignees-${item.id}`, true)}<label>Scadenza sotto-attività<input type="date" data-item-due="${item.id}" value="${e(item.due_date)}"/></label></details></div>`).join('')}</div><button type="button" class="checklist-add" data-action="add-checklist">${icon('plus', 15)}Aggiungi sotto-attività</button></div>`;
}
function taskPanel() {
  const t = state.selectedTask;
  const clients = state.data.clients.filter(c => !c.archived || c.id === t.client_id);
  const clusters = state.data.clusters.filter(c => (!c.archived || c.id === t.cluster_id) && (!t.client_id || !c.client_id || c.client_id === t.client_id));
  return `<section class="side-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><div class="eyebrow">${t.created_at ? `ATTIVITÀ · ${e(t.id.slice(-8).toUpperCase())}` : 'FAI SPAZIO AL PROSSIMO PASSO'}</div><h2 id="panel-title">${t.created_at ? 'Dettaglio attività' : 'Nuova attività'}</h2></div><button type="button" class="icon-button" data-action="close-panel" aria-label="Chiudi pannello">${icon('close', 20)}</button></header><form id="task-form" class="panel-form"><div class="panel-body"><label class="sr-only" for="task-title">Titolo attività</label><input class="title-input" id="task-title" name="title" placeholder="Cosa dobbiamo fare?" value="${e(t.title)}" maxlength="240" required/><div class="form-grid"><label>Cliente<select name="client_id" id="task-client">${options(clients, t.client_id, 'Interno / nessun cliente')}</select></label><label>Cluster<select name="cluster_id" id="task-cluster">${options(clusters, t.cluster_id, 'Nessun cluster')}</select></label><label>Stato<select name="status">${options(STATUSES, t.status, 'Seleziona stato').replace('<option value="">Seleziona stato</option>', '')}</select></label><label>Priorità<select name="priority">${options(PRIORITIES, t.priority, 'Seleziona priorità').replace('<option value="">Seleziona priorità</option>', '')}</select></label><label>Scadenza<input name="due_date" type="date" value="${e(t.due_date)}"/></label><div></div><fieldset class="span-two assignee-fieldset"><legend>Responsabili <span class="subtle">· almeno uno</span></legend>${memberOptions(t.assignee_ids, 'assignees')}</fieldset></div><details class="panel-section secondary-fields" ${t.description || t.notes ? 'open' : ''}><summary>Descrizione e note</summary><label>Descrizione<textarea name="description" maxlength="50000" placeholder="Contesto, risultato atteso, informazioni utili…">${e(t.description)}</textarea></label><label>Note<textarea name="notes" maxlength="50000" placeholder="Appunti e aggiornamenti del team…">${e(t.notes)}</textarea></label></details>${checklist(t)}${t.created_at ? `<div class="panel-meta">Creata il ${formatDate(t.created_at, { year: 'numeric', hour: '2-digit', minute: '2-digit' })} da ${e(state.data.members.find(m => m.id === t.created_by)?.name)}<br/>Ultima modifica il ${formatDate(t.updated_at, { hour: '2-digit', minute: '2-digit' })} da ${e(state.data.members.find(m => m.id === t.updated_by)?.name)}${t.completed_at ? `<br/>Completata il ${formatDate(t.completed_at, { year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</div><section class="panel-activity"><h3>Storico attività</h3>${activityList(t.id, 40)}</section>` : ''}</div><div id="panel-error" class="panel-error" role="alert"></div><footer class="panel-footer">${t.created_at ? `<button type="button" class="text-button danger-text" data-action="delete-task">${icon('trash', 15)}Elimina</button>` : '<span class="subtle">Tutto il team può collaborare.</span>'}<div><button type="button" class="btn secondary" data-action="close-panel">Annulla</button><button class="btn primary" id="save-task">${icon('check', 16)}${t.created_at ? 'Salva modifiche' : 'Crea attività'}</button></div></footer></form></section>`;
}
function teamPanel() {
  return `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><div class="eyebrow">LO SPAZIO CRESCE CON VOI</div><h2 id="panel-title">Gestisci team</h2></div><button class="icon-button" data-action="close-panel" aria-label="Chiudi pannello">${icon('close', 20)}</button></header><div class="panel-body"><p class="subtle">Aggiungi persone, modifica nomi e avatar. I membri disattivati restano nelle attività e nello storico.</p><div class="team-list">${state.data.members.map(m => `<div class="team-row">${avatar(m)}<div><strong>${e(m.name)}</strong><p>${e(m.role || 'Team ENG')}${m.active ? '' : ' · disattivato'}</p></div><button class="text-button" data-edit-entity="${m.id}" data-kind="members">Modifica ${icon('chevron', 13)}</button></div>`).join('')}</div></div><footer class="panel-footer"><span class="subtle">${state.data.members.filter(m => m.active).length} membri attivi</span><button class="btn primary" data-new-entity="members">${icon('plus', 16)}Aggiungi membro</button></footer></section>`;
}
function entityPanel() {
  const { kind, value: c } = state.entityDraft;
  const member = kind === 'members';
  const name = member ? 'membro' : kind === 'clients' ? 'cliente' : 'cluster';
  return `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><div class="eyebrow">ENG WORKSPACE</div><h2 id="panel-title">${c.id ? 'Modifica' : 'Nuovo'} ${name}</h2></div><button type="button" class="icon-button" data-action="close-panel" aria-label="Chiudi pannello">${icon('close', 20)}</button></header><form id="entity-form" class="panel-form"><div class="panel-body">${member ? `<div class="avatar-editor"><span id="avatar-preview">${avatar(c, 'large')}</span><div><label>Avatar (JPG, PNG, WebP · massimo 5 MB)<input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp"/></label><p class="field-note">L’immagine viene ridimensionata a 160 × 160 px e salvata nel workspace.</p><button type="button" class="text-button" data-action="remove-avatar">Rimuovi avatar</button></div></div>` : ''}<div class="form-grid"><label class="span-two">Nome<input name="name" id="entity-name" value="${e(c.name)}" maxlength="${member ? 120 : 160}" required/></label>${member ? `<label class="span-two">Ruolo / area<input name="role" value="${e(c.role)}" maxlength="160"/></label>` : `<label class="span-two">Descrizione<textarea name="description" maxlength="10000">${e(c.description)}</textarea></label>`}${kind === 'clusters' ? `<label class="span-two">Cliente<select name="client_id">${options(state.data.clients.filter(x => !x.archived || x.id === c.client_id), c.client_id, 'Interno · nessun cliente')}</select></label>` : ''}<label>Colore<input name="color" type="color" value="${safeColor(c.color)}"/></label><label class="checkbox-label"><input type="checkbox" name="${member ? 'active' : 'archived'}" ${member ? c.active ? 'checked' : '' : c.archived ? 'checked' : ''}/>${member ? 'Membro attivo' : 'Archiviato'}</label></div><p class="field-note">${member ? 'La disattivazione rimuove il membro dalla selezione iniziale. Le assegnazioni esistenti e lo storico vengono conservati.' : 'L’archiviazione conserva tutte le attività e i collegamenti esistenti.'}</p></div><div id="panel-error" class="panel-error" role="alert"></div><footer class="panel-footer"><button type="button" class="btn secondary" data-action="close-panel">Annulla</button><button class="btn primary" id="save-entity">${icon('check', 16)}Salva ${name}</button></footer></form></section>`;
}
export function renderPanel(focus = true) {
  const root = document.getElementById('overlay-root');
  document.getElementById('app').inert = Boolean(state.panel);
  if (!state.panel) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="overlay" id="panel-overlay">${state.panel === 'task' ? taskPanel() : state.panel === 'team' ? teamPanel() : entityPanel()}</div>`;
  if (focus) (root.querySelector('#task-title, #entity-name') || root.querySelector('button'))?.focus();
}
export function readTaskForm() {
  const form = document.getElementById('task-form');
  if (!form) return state.selectedTask;
  const fields = new FormData(form);
  const t = state.selectedTask;
  return { ...t, title: fields.get('title'), client_id: fields.get('client_id') || null, cluster_id: fields.get('cluster_id') || null, status: fields.get('status'), priority: fields.get('priority'), due_date: fields.get('due_date') || null, description: fields.get('description') || '', notes: fields.get('notes') || '', assignee_ids: fields.getAll('assignees'), checklist: t.checklist.map(item => ({ ...item, text: form.querySelector(`[data-item-text="${item.id}"]`).value, completed: form.querySelector(`[data-item-completed="${item.id}"]`).checked, due_date: form.querySelector(`[data-item-due="${item.id}"]`).value || null, assignee_ids: fields.getAll(`item-assignees-${item.id}`) })) };
}
export function readEntityForm() {
  const form = document.getElementById('entity-form');
  if (!form) return state.entityDraft.value;
  const f = new FormData(form), { kind, value } = state.entityDraft;
  return { ...value, name: f.get('name'), color: f.get('color'), ...(kind === 'members' ? { role: f.get('role'), active: f.has('active') } : { description: f.get('description'), archived: f.has('archived'), ...(kind === 'clusters' ? { client_id: f.get('client_id') || null } : {}) }) };
}
export function panelError(message) { const el = document.getElementById('panel-error'); if (el) { el.innerHTML = `<div class="form-error">${e(message)}</div>`; el.scrollIntoView({ block: 'nearest' }); } }
export function confirmDialog(title, message, confirmLabel = 'Conferma') {
  return new Promise(resolve => {
    const previouslyFocused = document.activeElement;
    const behind = document.querySelector('#panel-overlay');
    const app = document.getElementById('app');
    app.inert = true;
    if (behind) behind.inert = true;
    const el = document.createElement('div'); el.className = 'overlay confirm-overlay';
    el.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div class="panel-body"><h2 id="confirm-title">${e(title)}</h2><p class="confirm-copy">${e(message)}</p><div class="confirm-actions"><button class="btn secondary" data-confirm="false">Annulla</button><button class="btn danger" data-confirm="true">${e(confirmLabel)}</button></div></div></section>`;
    const finish = value => { el.remove(); if (behind) behind.inert = false; app.inert = Boolean(state.panel); previouslyFocused?.focus(); resolve(value); };
    el.addEventListener('click', event => { const b = event.target.closest('[data-confirm]'); if (b) finish(b.dataset.confirm === 'true'); });
    el.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); finish(false); } });
    document.body.append(el); el.querySelector('button').focus();
  });
}
export async function loadAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa un’immagine JPG, PNG o WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('L’avatar può pesare al massimo 5 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
    const context = canvas.getContext('2d');
    const size = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 160, 160);
    return canvas.toDataURL('image/webp', .84);
  } finally { bitmap.close(); }
}
