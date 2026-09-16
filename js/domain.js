export const STATUSES = ['Da fare', 'In corso', 'Bloccata', 'Completata'];
export const PRIORITIES = ['Bassa', 'Media', 'Alta', 'Urgente'];
export const STATUS_KEYS = ['todo', 'progress', 'blocked', 'done'];
export const COLORS = ['#527260', '#8871a5', '#ba8251', '#557eac', '#b56873', '#518e8b'];
export const isoDate = (value) => {
  if (value === undefined) return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Calendar arithmetic in local time; no UTC slicing or 24-hour millisecond assumptions.
export const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n, 12));
};
export const endOfWeek = (today = isoDate()) => {
  const d = new Date(`${today}T12:00:00`);
  return addDays(today, (7 - d.getDay()) % 7);
};
export const businessDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(timestamp)) : null;
export const open = task => task.status !== 'Completata';
export const overdue = (task, today = isoDate()) => open(task) && Boolean(task.due_date) && task.due_date < today;
export const checklistProgress = task => {
  const items = task.checklist || [];
  const done = items.filter(i => i.completed).length;
  return { done, total: items.length, percent: items.length ? Math.round(done / items.length * 100) : 0 };
};
export function metrics(tasks, today = isoDate()) {
  // The workspace is keyed by task ID. Defensively deduplicate aggregate inputs too.
  const unique = [...new Map(tasks.map(t => [t.id, t])).values()];
  const completed = unique.filter(t => !open(t));
  const datedCompleted = completed.filter(t => t.due_date && t.completed_at);
  const checklist = unique.flatMap(t => t.checklist || []);
  const late = unique.filter(t => overdue(t, today)).length;
  const percentage = (n, d) => d ? Math.round(n / d * 100) : 0;
  return {
    total: unique.length, open: unique.length - completed.length,
    todo: unique.filter(t => t.status === 'Da fare').length,
    inProgress: unique.filter(t => t.status === 'In corso').length,
    blocked: unique.filter(t => t.status === 'Bloccata').length,
    completed: completed.length, overdue: late,
    dueSoon: unique.filter(t => open(t) && t.due_date >= today && t.due_date <= addDays(today, 7)).length,
    thisWeek: unique.filter(t => open(t) && t.due_date >= today && t.due_date <= endOfWeek(today)).length,
    urgent: unique.filter(t => open(t) && t.priority === 'Urgente').length,
    completionRate: percentage(completed.length, unique.length),
    onTimeRate: datedCompleted.length ? percentage(datedCompleted.filter(t => businessDate(t.completed_at) <= t.due_date).length, datedCompleted.length) : null,
    overdueRate: percentage(late, unique.length),
    checklistRate: percentage(checklist.filter(i => i.completed).length, checklist.length),
  };
}
export function filterTasks(tasks, filters = {}, today = isoDate()) {
  return tasks.filter(t => {
    if (filters.member && !t.assignee_ids.includes(filters.member)) return false;
    if (filters.client && t.client_id !== filters.client) return false;
    if (filters.cluster && t.cluster_id !== filters.cluster) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.from && (!t.due_date || t.due_date < filters.from)) return false;
    if (filters.to && (!t.due_date || t.due_date > filters.to)) return false;
    if (filters.incomplete && !t.checklist?.some(i => !i.completed)) return false;
    if (filters.search && !String(t.search_text || `${t.title} ${t.description} ${t.notes}`).toLocaleLowerCase('it').includes(filters.search.toLocaleLowerCase('it'))) return false;
    const quick = filters.quick || 'all';
    if (quick !== 'all' && !open(t)) return false;
    if (quick === 'today' && t.due_date !== today) return false;
    if (quick === 'week' && (!t.due_date || t.due_date < today || t.due_date > endOfWeek(today))) return false;
    if (quick === 'overdue' && !overdue(t, today)) return false;
    if (quick === 'urgent' && t.priority !== 'Urgente') return false;
    if (quick === 'progress' && t.status !== 'In corso') return false;
    if (quick === 'blocked' && t.status !== 'Bloccata') return false;
    return true;
  });
}
export function sortTasks(tasks, sort = 'due_date', direction = 'asc') {
  return [...tasks].sort((a, b) => {
    let comparison = 0;
    if (sort === 'priority') comparison = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
    else if (sort === 'status') comparison = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    else if (sort === 'checklist') comparison = checklistProgress(a).percent - checklistProgress(b).percent;
    else {
      const av = a[sort], bv = b[sort];
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      comparison = String(av || '').localeCompare(String(bv || ''), 'it');
    }
    return (direction === 'desc' ? -comparison : comparison) || a.title.localeCompare(b.title, 'it');
  });
}
export function validateTask(task, data) {
  if (!task.title?.trim()) throw new Error('Inserisci il titolo dell’attività.');
  if (task.title.length > 240) throw new Error('Il titolo può contenere al massimo 240 caratteri.');
  if (!STATUSES.includes(task.status) || !PRIORITIES.includes(task.priority)) throw new Error('Stato o priorità non validi.');
  if (!task.assignee_ids?.length) throw new Error('Seleziona almeno un responsabile.');
  const known = new Set(data.members.map(m => m.id));
  if (task.assignee_ids.some(id => !known.has(id))) throw new Error('Responsabile non valido.');
  const cluster = data.clusters.find(c => c.id === task.cluster_id);
  if (cluster?.client_id && task.client_id !== cluster.client_id) throw new Error('Il cluster selezionato appartiene a un altro cliente.');
  for (const item of task.checklist || []) {
    if (!item.text?.trim()) throw new Error('Inserisci il testo di ogni sotto-attività.');
    if (item.assignee_ids?.some(id => !known.has(id))) throw new Error('Responsabile checklist non valido.');
  }
  return task;
}
