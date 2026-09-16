export const state = {
  data: { members: [], clients: [], clusters: [], tasks: [], activity: [] },
  memberId: null, view: 'dashboard', quick: 'today', dashboardScope: 'personal',
  filters: {}, search: '', sort: 'due_date', direction: 'asc', busy: false,
  selectedTask: null, panel: null, entityDraft: null, showFilters: false,
  archived: false, syncedAt: null, offline: false,
};
export const currentMember = () => state.data.members.find(m => m.id === state.memberId);
export function decorateTasks(tasks = state.data.tasks) {
  return tasks.map(t => ({ ...t,
    client_name: state.data.clients.find(c => c.id === t.client_id)?.name || '',
    cluster_name: state.data.clusters.find(c => c.id === t.cluster_id)?.name || '',
    assignee_names: t.assignee_ids.map(id => state.data.members.find(m => m.id === id)?.name || '').join(', '),
    search_text: [t.id, t.title, t.description, t.notes, state.data.clients.find(c => c.id === t.client_id)?.name, state.data.clusters.find(c => c.id === t.cluster_id)?.name, ...t.assignee_ids.map(id => state.data.members.find(m => m.id === id)?.name), ...(t.checklist || []).map(i => i.text)].join(' '),
  }));
}
