-- Run once in a NEW Supabase project, before policies.sql and seed.sql.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;

create table private.workspace_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  role text not null default '' check (length(role) <= 160),
  color text not null default '#527260' check (color ~ '^#[0-9a-fA-F]{6}$'),
  avatar text not null default '' check (length(avatar) <= 350000 and (avatar = '' or avatar ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index team_members_name on public.team_members(lower(name));
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  archived boolean not null default false,
  color text not null default '#527260' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index clients_name on public.clients(lower(name));
create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  archived boolean not null default false,
  color text not null default '#527260' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index clusters_name on public.clusters(lower(name));
create index clusters_client on public.clusters(client_id);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 240),
  description text not null default '' check (length(description) <= 50000),
  client_id uuid references public.clients(id) on delete restrict,
  cluster_id uuid references public.clusters(id) on delete restrict,
  status text not null default 'Da fare' check (status in ('Da fare', 'In corso', 'Bloccata', 'Completata')),
  priority text not null default 'Media' check (priority in ('Bassa', 'Media', 'Alta', 'Urgente')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.team_members(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.team_members(id) on delete restrict,
  notes text not null default '' check (length(notes) <= 50000),
  check ((status = 'Completata') = (completed_at is not null))
);
create index tasks_due on public.tasks(due_date) where status <> 'Completata';
create index tasks_status on public.tasks(status);
create index tasks_priority on public.tasks(priority);
create index tasks_client on public.tasks(client_id);
create index tasks_cluster on public.tasks(cluster_id);
create index tasks_updated on public.tasks(updated_at desc);
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete restrict,
  primary key (task_id, team_member_id)
);
create index task_assignees_member on public.task_assignees(team_member_id, task_id);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 1000),
  completed boolean not null default false,
  due_date date,
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  check (completed = (completed_at is not null))
);
create index checklist_task on public.checklist_items(task_id, position);
create index checklist_due on public.checklist_items(due_date) where not completed;
create table public.checklist_assignees (
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete restrict,
  primary key (checklist_item_id, team_member_id)
);
create index checklist_assignees_member on public.checklist_assignees(team_member_id);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  task_title text not null,
  team_member_id uuid not null references public.team_members(id) on delete restrict,
  event_type text not null check (event_type in ('task_created', 'task_updated', 'status_changed', 'priority_changed', 'assignee_added', 'assignee_removed', 'due_date_changed', 'task_completed', 'checklist_changed', 'task_deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index activity_task on public.activity_log(task_id, created_at desc);
create index activity_created on public.activity_log(created_at desc);

create function private.has_access() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.workspace_access where user_id = (select auth.uid()));
$$;
create function private.require_access(p_actor uuid default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_access() then raise exception 'Account non autorizzato al workspace.' using errcode = '42501'; end if;
  if p_actor is not null and not exists(select 1 from public.team_members where id = p_actor and active) then
    raise exception 'Seleziona un membro attivo del team.';
  end if;
end;
$$;
create function private.log_event(p_task uuid, p_title text, p_actor uuid, p_event text, p_details jsonb default '{}') returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log(task_id, task_title, team_member_id, event_type, details)
  values(p_task, p_title, p_actor, p_event, p_details);
$$;

-- Read one consistent database snapshot: avoids partial joins and REST row limits.
create function private.workspace_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_access();
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.name) from public.team_members m), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.clients c), '[]'::jsonb),
    'clusters', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.clusters c), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object(
      'assignee_ids', coalesce((select jsonb_agg(a.team_member_id order by a.team_member_id) from public.task_assignees a where a.task_id=t.id), '[]'::jsonb),
      'checklist', coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('assignee_ids', coalesce((select jsonb_agg(a.team_member_id order by a.team_member_id) from public.checklist_assignees a where a.checklist_item_id=i.id), '[]'::jsonb)) order by i.position, i.id) from public.checklist_items i where i.task_id=t.id), '[]'::jsonb)
    ) order by t.created_at desc) from public.tasks t), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.activity_log order by created_at desc limit 500) a), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
create function public.workspace_snapshot() returns jsonb language sql security invoker set search_path = '' as $$ select private.workspace_snapshot(); $$;

create function private.save_task(p_task jsonb, p_actor uuid, p_expected timestamptz) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tid uuid := coalesce(nullif(p_task->>'id','')::uuid, gen_random_uuid());
  previous public.tasks%rowtype;
  existed boolean;
  old_assignees uuid[];
  new_assignees uuid[];
  client uuid := nullif(p_task->>'client_id','')::uuid;
  cluster uuid := nullif(p_task->>'cluster_id','')::uuid;
  linked_client uuid;
  item jsonb;
  item_id uuid;
  previous_item public.checklist_items%rowtype;
  keep_ids uuid[] := '{}';
  member_id uuid;
  completed boolean;
  stamp timestamptz := clock_timestamp();
  task_status text := coalesce(p_task->>'status','Da fare');
  task_priority text := coalesce(p_task->>'priority','Media');
  task_due date := nullif(p_task->>'due_date','')::date;
  field text;
  event text;
  pos integer := 0;
  old_checklist jsonb;
  new_checklist jsonb;
begin
  perform private.require_access(p_actor);
  if p_actor is null then raise exception 'Membro richiesto.'; end if;
  select * into previous from public.tasks where id=tid for update;
  existed := found;
  if existed and (p_expected is null or previous.updated_at <> p_expected) then
    raise exception 'Attività modificata da un altro membro. Chiudi e riapri il pannello per aggiornare i dati.' using errcode='40001';
  end if;
  if not existed and p_expected is not null then raise exception 'L’attività è stata eliminata da un altro membro.'; end if;
  if cluster is not null then
    select client_id into linked_client from public.clusters where id=cluster;
    if not found then raise exception 'Cluster non valido.'; end if;
    if linked_client is not null and client is distinct from linked_client then raise exception 'Il cluster appartiene a un altro cliente.'; end if;
    if (not existed or cluster is distinct from previous.cluster_id) and exists(select 1 from public.clusters where id=cluster and archived) then raise exception 'Il cluster è archiviato.'; end if;
  end if;
  if client is not null and (not existed or client is distinct from previous.client_id) and exists(select 1 from public.clients where id=client and archived) then raise exception 'Il cliente è archiviato.'; end if;
  select coalesce(array_agg(team_member_id order by team_member_id), '{}') into old_assignees from public.task_assignees where task_id=tid;
  select coalesce(array_agg(distinct value::uuid order by value::uuid), '{}') into new_assignees from jsonb_array_elements_text(coalesce(p_task->'assignee_ids','[]'));
  if cardinality(new_assignees)=0 then raise exception 'Seleziona almeno un responsabile.'; end if;
  foreach member_id in array new_assignees loop
    if not exists(select 1 from public.team_members where id=member_id and (active or member_id=any(old_assignees))) then raise exception 'Responsabile non valido o disattivato.'; end if;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('assignee_ids', coalesce((select jsonb_agg(team_member_id order by team_member_id) from public.checklist_assignees where checklist_item_id=i.id),'[]'::jsonb)) order by i.position, i.id),'[]') into old_checklist from public.checklist_items i where task_id=tid;
  insert into public.tasks(id,title,description,client_id,cluster_id,status,priority,due_date,completed_at,created_by,updated_by,updated_at,notes)
  values(tid,btrim(p_task->>'title'),coalesce(p_task->>'description',''),client,cluster,task_status,task_priority,task_due,
    case when task_status='Completata' then coalesce(previous.completed_at,stamp) else null end,
    p_actor,p_actor,stamp,coalesce(p_task->>'notes',''))
  on conflict(id) do update set title=excluded.title,description=excluded.description,client_id=excluded.client_id,cluster_id=excluded.cluster_id,status=excluded.status,priority=excluded.priority,due_date=excluded.due_date,completed_at=excluded.completed_at,updated_by=p_actor,updated_at=stamp,notes=excluded.notes;
  delete from public.task_assignees where task_id=tid and not (team_member_id=any(new_assignees));
  insert into public.task_assignees(task_id,team_member_id) select tid,unnest(new_assignees) on conflict do nothing;
  for item in select value from jsonb_array_elements(coalesce(p_task->'checklist','[]')) loop
    item_id := coalesce(nullif(item->>'id','')::uuid,gen_random_uuid());
    if item_id=any(keep_ids) then raise exception 'Elemento checklist duplicato.'; end if;
    select * into previous_item from public.checklist_items where id=item_id;
    if found and previous_item.task_id <> tid then raise exception 'Elemento checklist di un’altra attività.'; end if;
    completed := coalesce((item->>'completed')::boolean,false);
    insert into public.checklist_items(id,task_id,text,completed,due_date,position,completed_at)
    values(item_id,tid,btrim(item->>'text'),completed,nullif(item->>'due_date','')::date,pos,case when completed then coalesce(previous_item.completed_at,stamp) else null end)
    on conflict(id) do update set text=excluded.text,completed=excluded.completed,due_date=excluded.due_date,position=excluded.position,completed_at=excluded.completed_at;
    for member_id in select value::uuid from jsonb_array_elements_text(coalesce(item->'assignee_ids','[]')) loop
      if not exists(select 1 from public.team_members where id=member_id and (active or exists(select 1 from public.checklist_assignees where checklist_item_id=item_id and team_member_id=member_id))) then raise exception 'Responsabile checklist non valido o disattivato.'; end if;
    end loop;
    delete from public.checklist_assignees where checklist_item_id=item_id;
    insert into public.checklist_assignees(checklist_item_id,team_member_id) select item_id,value::uuid from jsonb_array_elements_text(coalesce(item->'assignee_ids','[]')) on conflict do nothing;
    keep_ids := array_append(keep_ids,item_id);
    pos := pos+1;
  end loop;
  delete from public.checklist_items where task_id=tid and not(id=any(keep_ids));
  perform private.log_event(tid,p_task->>'title',p_actor,case when existed then 'task_updated' else 'task_created' end);
  if existed then
    if previous.status is distinct from task_status then perform private.log_event(tid,p_task->>'title',p_actor,'status_changed',jsonb_build_object('from',previous.status,'to',task_status)); end if;
    if previous.priority is distinct from task_priority then perform private.log_event(tid,p_task->>'title',p_actor,'priority_changed',jsonb_build_object('from',previous.priority,'to',task_priority)); end if;
    if previous.due_date is distinct from task_due then perform private.log_event(tid,p_task->>'title',p_actor,'due_date_changed',jsonb_build_object('from',previous.due_date,'to',task_due)); end if;
  end if;
  foreach member_id in array new_assignees loop
    if not(member_id=any(old_assignees)) then perform private.log_event(tid,p_task->>'title',p_actor,'assignee_added',jsonb_build_object('member_id',member_id)); end if;
  end loop;
  foreach member_id in array old_assignees loop
    if not(member_id=any(new_assignees)) then perform private.log_event(tid,p_task->>'title',p_actor,'assignee_removed',jsonb_build_object('member_id',member_id)); end if;
  end loop;
  if task_status='Completata' and (not existed or previous.status <> 'Completata') then perform private.log_event(tid,p_task->>'title',p_actor,'task_completed'); end if;
  select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('assignee_ids', coalesce((select jsonb_agg(team_member_id order by team_member_id) from public.checklist_assignees where checklist_item_id=i.id),'[]'::jsonb)) order by i.position, i.id),'[]') into new_checklist from public.checklist_items i where task_id=tid;
  if old_checklist is distinct from new_checklist then perform private.log_event(tid,p_task->>'title',p_actor,'checklist_changed'); end if;
  return tid;
end;
$$;
create function public.save_task(p_task jsonb,p_actor uuid,p_expected timestamptz default null) returns uuid language sql security invoker set search_path='' as $$ select private.save_task(p_task,p_actor,p_expected); $$;

create function private.delete_task(p_id uuid,p_actor uuid,p_expected timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare previous public.tasks%rowtype;
begin
  perform private.require_access(p_actor);
  if p_actor is null then raise exception 'Membro richiesto.'; end if;
  select * into previous from public.tasks where id=p_id for update;
  if not found then raise exception 'L’attività non esiste più.'; end if;
  if p_expected is null or previous.updated_at <> p_expected then raise exception 'Attività modificata. Aggiorna prima di eliminarla.' using errcode='40001'; end if;
  perform private.log_event(p_id,previous.title,p_actor,'task_deleted');
  delete from public.tasks where id=p_id;
end;
$$;
create function public.delete_task(p_id uuid,p_actor uuid,p_expected timestamptz) returns void language sql security invoker set search_path='' as $$ select private.delete_task(p_id,p_actor,p_expected); $$;

create function private.save_entity(p_kind text,p_entity jsonb,p_actor uuid,p_expected timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare
  eid uuid := coalesce(nullif(p_entity->>'id','')::uuid,gen_random_uuid());
  old_updated timestamptz;
  table_name text;
  old_client uuid;
  linked_client uuid := nullif(p_entity->>'client_id','')::uuid;
  stamp timestamptz := clock_timestamp();
begin
  perform private.require_access(p_actor);
  if p_actor is null then raise exception 'Membro richiesto.'; end if;
  table_name := case p_kind when 'members' then 'team_members' when 'clients' then 'clients' when 'clusters' then 'clusters' else null end;
  if table_name is null then raise exception 'Sezione non valida.'; end if;
  -- Serialize member edits so two simultaneous deactivations cannot remove the last active member.
  if p_kind='members' then perform pg_advisory_xact_lock(731994); end if;
  execute format('select updated_at from public.%I where id=$1 for update',table_name) into old_updated using eid;
  if old_updated is not null and (p_expected is null or p_expected<>old_updated) then raise exception 'Dati modificati da un altro membro. Riapri il pannello.' using errcode='40001'; end if;
  if old_updated is null and p_expected is not null then raise exception 'Elemento non più disponibile.'; end if;
  if p_kind='members' then
    if not coalesce((p_entity->>'active')::boolean,true) and not exists(select 1 from public.team_members where active and id<>eid) then raise exception 'Mantieni almeno un membro attivo.'; end if;
    insert into public.team_members(id,name,role,color,avatar,active,updated_at)
    values(eid,btrim(p_entity->>'name'),coalesce(p_entity->>'role',''),coalesce(p_entity->>'color','#527260'),coalesce(p_entity->>'avatar',''),coalesce((p_entity->>'active')::boolean,true),stamp)
    on conflict(id) do update set name=excluded.name,role=excluded.role,color=excluded.color,avatar=excluded.avatar,active=excluded.active,updated_at=stamp;
  elsif p_kind='clients' then
    insert into public.clients(id,name,description,color,archived,updated_at)
    values(eid,btrim(p_entity->>'name'),coalesce(p_entity->>'description',''),coalesce(p_entity->>'color','#527260'),coalesce((p_entity->>'archived')::boolean,false),stamp)
    on conflict(id) do update set name=excluded.name,description=excluded.description,color=excluded.color,archived=excluded.archived,updated_at=stamp;
  else
    select client_id into old_client from public.clusters where id=eid;
    if old_updated is not null and old_client is distinct from linked_client and exists(select 1 from public.tasks where cluster_id=eid) then raise exception 'Il cluster contiene attività: mantieni il cliente attuale oppure sposta prima le attività.'; end if;
    if (old_updated is null or old_client is distinct from linked_client) and exists(select 1 from public.clients where id=linked_client and archived) then raise exception 'Il cliente è archiviato.'; end if;
    insert into public.clusters(id,name,description,color,client_id,archived,updated_at)
    values(eid,btrim(p_entity->>'name'),coalesce(p_entity->>'description',''),coalesce(p_entity->>'color','#527260'),linked_client,coalesce((p_entity->>'archived')::boolean,false),stamp)
    on conflict(id) do update set name=excluded.name,description=excluded.description,color=excluded.color,client_id=excluded.client_id,archived=excluded.archived,updated_at=stamp;
  end if;
  return eid;
end;
$$;
create function public.save_entity(p_kind text,p_entity jsonb,p_actor uuid,p_expected timestamptz default null) returns uuid language sql security invoker set search_path='' as $$ select private.save_entity(p_kind,p_entity,p_actor,p_expected); $$;

-- Least privilege from the very first migration, even before policies.sql runs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.workspace_snapshot(),public.save_task(jsonb,uuid,timestamptz),public.delete_task(uuid,uuid,timestamptz),public.save_entity(text,jsonb,uuid,timestamptz) from public, anon, authenticated;
alter table public.team_members enable row level security;
alter table public.clients enable row level security;
alter table public.clusters enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_assignees enable row level security;
alter table public.activity_log enable row level security;
commit;
