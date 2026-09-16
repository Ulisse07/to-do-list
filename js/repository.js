import { config } from './config.js';
import { rpc } from './supabase.js';
import { createDemo } from './demo.js';
import { validateTask } from './domain.js';
import { clone, uid } from './utils.js';
const DEMO_KEY = 'eng-workspace-demo-v1';
function readDemo() {
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) { const data = createDemo(); localStorage.setItem(DEMO_KEY, JSON.stringify(data)); return data; }
  try { return JSON.parse(raw); } catch { throw new Error('I dati demo locali non sono leggibili. Elimina solo la voce eng-workspace-demo-v1 dalla memoria del browser per rigenerarli.'); }
}
function writeDemo(data) { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); }
function audit(data, task, actor, type, details = {}) {
  data.activity.unshift({ id: uid(), task_id: task.id, task_title: task.title, team_member_id: actor, event_type: type, details, created_at: new Date().toISOString() });
}
export async function loadWorkspace() { return config.demo ? readDemo() : rpc('workspace_snapshot'); }
export async function saveTask(input, actor, expected = null) {
  if (!config.demo) return rpc('save_task', { p_task: input, p_actor: actor, p_expected: expected });
  const data = readDemo();
  const old = data.tasks.find(t => t.id === input.id);
  if (old && expected !== old.updated_at) throw new Error('Attività modificata da un altro membro. Chiudi e riapri il pannello per aggiornare i dati.');
  validateTask(input, data);
  const now = new Date().toISOString();
  const task = { ...clone(input), id: old?.id || uid(), title: input.title.trim(), created_at: old?.created_at || now, created_by: old?.created_by || actor, updated_at: now, updated_by: actor, completed_at: input.status === 'Completata' ? old?.completed_at || now : null };
  task.checklist = task.checklist.map((item, i) => ({ ...item, text: item.text.trim(), position: i, completed_at: item.completed ? old?.checklist.find(c => c.id === item.id)?.completed_at || now : null }));
  if (!old) { data.tasks.push(task); audit(data, task, actor, 'task_created'); }
  else {
    data.tasks[data.tasks.findIndex(t => t.id === task.id)] = task;
    audit(data, task, actor, 'task_updated');
    for (const [field, event] of [['status', 'status_changed'], ['priority', 'priority_changed'], ['due_date', 'due_date_changed']]) if (old[field] !== task[field]) audit(data, task, actor, event, { from: old[field], to: task[field] });
    for (const id of task.assignee_ids.filter(id => !old.assignee_ids.includes(id))) audit(data, task, actor, 'assignee_added', { member_id: id });
    for (const id of old.assignee_ids.filter(id => !task.assignee_ids.includes(id))) audit(data, task, actor, 'assignee_removed', { member_id: id });
    if (JSON.stringify(old.checklist) !== JSON.stringify(task.checklist)) audit(data, task, actor, 'checklist_changed');
  }
  if (task.status === 'Completata' && old?.status !== 'Completata') audit(data, task, actor, 'task_completed');
  writeDemo(data);
  return task.id;
}
export async function deleteTask(task, actor) {
  if (!config.demo) return rpc('delete_task', { p_id: task.id, p_actor: actor, p_expected: task.updated_at });
  const data = readDemo();
  const old = data.tasks.find(t => t.id === task.id);
  if (old?.updated_at !== task.updated_at) throw new Error('Attività modificata. Aggiorna prima di eliminarla.');
  audit(data, old, actor, 'task_deleted');
  data.tasks = data.tasks.filter(t => t.id !== task.id);
  data.activity = data.activity.map(a => a.task_id === task.id ? { ...a, task_id: null } : a);
  writeDemo(data);
}
export async function saveEntity(kind, input, actor) {
  if (!config.demo) return rpc('save_entity', { p_kind: kind, p_entity: input, p_actor: actor, p_expected: input.updated_at || null });
  const data = readDemo();
  if (!['members', 'clients', 'clusters'].includes(kind)) throw new Error('Sezione non valida.');
  if (!input.name?.trim()) throw new Error('Inserisci un nome.');
  const old = data[kind].find(x => x.id === input.id);
  if (old && old.updated_at !== input.updated_at) throw new Error('Dati modificati da un altro membro. Riapri il pannello.');
  if (data[kind].some(x => x.id !== input.id && x.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error('Questo nome esiste già.');
  if (kind === 'members' && input.active === false && data.members.filter(m => m.active && m.id !== input.id).length === 0) throw new Error('Mantieni almeno un membro attivo.');
  if (kind === 'clusters' && old && (old.client_id || null) !== (input.client_id || null) && data.tasks.some(t => t.cluster_id === old.id)) throw new Error('Il cluster contiene attività: mantieni il cliente attuale oppure sposta prima le attività.');
  const now = new Date().toISOString();
  const entity = { ...input, id: old?.id || uid(), name: input.name.trim(), created_at: old?.created_at || now, updated_at: now };
  if (old) data[kind][data[kind].findIndex(x => x.id === old.id)] = entity; else data[kind].push(entity);
  writeDemo(data);
  return entity.id;
}
