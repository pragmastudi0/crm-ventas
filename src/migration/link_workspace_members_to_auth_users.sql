-- Enlaza workspaces y workspace_members con auth.users tras migrar CSV.
-- La app (WorkspaceContext) busca filas en workspace_members donde user_id = auth.uid().
--
-- Cuándo usarlo:
--   - user_id u owner_user_id quedaron NULL, o con UUID que no existe en auth.users
-- Requisitos:
--   - Los usuarios deben existir en Authentication (mismo email).
--   - Tabla workspaces debe tener legacy_id poblado (lo setea migrate-csv.mjs).
--
-- Ajustá emails y legacy_id si tu export usa otros valores. Prefijo de tablas: crm_ventas_tech

begin;

-- gasparquintana00@gmail.com → workspace legacy 69a5e1ea15eb8e1958a5bcf1
update public.crm_ventas_tech_workspaces w
set owner_user_id = au.id::text
from auth.users au
where w.legacy_id = '69a5e1ea15eb8e1958a5bcf1'
  and au.email = 'gasparquintana00@gmail.com'
  and (
    w.owner_user_id is null
    or btrim(w.owner_user_id) = ''
    or not exists (select 1 from auth.users u where u.id::text = w.owner_user_id)
  );

update public.crm_ventas_tech_workspace_members wm
set user_id = au.id::text
from public.crm_ventas_tech_workspaces w
join auth.users au on au.email = 'gasparquintana00@gmail.com'
where wm.workspace_id = w.id
  and w.legacy_id = '69a5e1ea15eb8e1958a5bcf1'
  and (
    wm.user_id is null
    or btrim(wm.user_id) = ''
    or not exists (select 1 from auth.users u where u.id::text = wm.user_id)
  );

-- fedegonberetta@gmail.com → workspace legacy 69bd3080e70ce5d9acbb5241
update public.crm_ventas_tech_workspaces w
set owner_user_id = au.id::text
from auth.users au
where w.legacy_id = '69bd3080e70ce5d9acbb5241'
  and au.email = 'fedegonberetta@gmail.com'
  and (
    w.owner_user_id is null
    or btrim(w.owner_user_id) = ''
    or not exists (select 1 from auth.users u where u.id::text = w.owner_user_id)
  );

update public.crm_ventas_tech_workspace_members wm
set user_id = au.id::text
from public.crm_ventas_tech_workspaces w
join auth.users au on au.email = 'fedegonberetta@gmail.com'
where wm.workspace_id = w.id
  and w.legacy_id = '69bd3080e70ce5d9acbb5241'
  and (
    wm.user_id is null
    or btrim(wm.user_id) = ''
    or not exists (select 1 from auth.users u where u.id::text = wm.user_id)
  );

commit;

-- Opcional: otras tablas con user_id como email → ver backfillWorkspaceIdentity.sql
