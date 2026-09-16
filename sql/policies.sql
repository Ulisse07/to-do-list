begin;
-- Only the shared Auth account(s) explicitly added by an administrator can read.
-- Everyone using that account can edit everything via validated, atomic RPCs.
grant usage on schema private to authenticated;
grant execute on function private.has_access(),private.workspace_snapshot(),private.save_task(jsonb,uuid,timestamptz),private.delete_task(uuid,uuid,timestamptz),private.save_entity(text,jsonb,uuid,timestamptz) to authenticated;
grant execute on function public.workspace_snapshot(),public.save_task(jsonb,uuid,timestamptz),public.delete_task(uuid,uuid,timestamptz),public.save_entity(text,jsonb,uuid,timestamptz) to authenticated;
grant select on public.team_members,public.clients,public.clusters,public.tasks,public.task_assignees,public.checklist_items,public.checklist_assignees,public.activity_log to authenticated;
create policy workspace_read on public.team_members for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.clients for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.clusters for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.tasks for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.task_assignees for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.checklist_items for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.checklist_assignees for select to authenticated using ((select private.has_access()));
create policy workspace_read on public.activity_log for select to authenticated using ((select private.has_access()));
-- No direct INSERT/UPDATE/DELETE or log forgery from the browser. No anon grants.
commit;
