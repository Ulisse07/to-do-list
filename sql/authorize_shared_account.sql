-- Run as project administrator AFTER creating exactly ONE shared Auth account.
-- The guard prevents accidentally granting workspace access to unrelated users.
do $$
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Configurazione iniziale: deve esistere esattamente un account Auth condiviso. Verifica gli utenti prima di autorizzare il workspace.';
  end if;
  insert into private.workspace_access(user_id) select id from auth.users on conflict do nothing;
end;
$$;
