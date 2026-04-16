-- Backfill workspace/user identity consistency for Supabase migration.
-- Assumes:
-- - workspace scope is workspace_id
-- - identity key is auth.users.id (UUID)
--
-- Si owner_user_id / user_id están NULL o con UUID inválido (CSV viejo), ejecutá primero:
--   link_workspace_members_to_auth_users.sql
-- y después este script, o re-importá workspaces/members con migrate-csv.mjs (inyecta emails).

begin;

-- 1) Normalize workspace owner_user_id to UUID (from email text when possible)
update crm_ventas_tech_workspaces w
set owner_user_id = au.id::text
from auth.users au
where w.owner_user_id = au.email;

-- 2) Normalize workspace_members.user_id to UUID (from email text when possible)
update crm_ventas_tech_workspace_members wm
set user_id = au.id::text
from auth.users au
where wm.user_id = au.email;

-- 3) Backfill missing workspace_id in pipeline stages using membership/user ownership
update crm_ventas_tech_pipeline_stages ps
set workspace_id = wm.workspace_id
from crm_ventas_tech_workspace_members wm
where ps.workspace_id is null
  and ps.user_id is not null
  and wm.user_id = ps.user_id::text;

-- 4) Backfill missing workspace_id in consultas from related contacto
update crm_ventas_tech_consultas c
set workspace_id = ct.workspace_id
from crm_ventas_tech_contactos ct
where c.workspace_id is null
  and c."contactoId" = ct.id;

-- 5) Backfill missing stage_id in consultas by matching stage name in same workspace
update crm_ventas_tech_consultas c
set stage_id = ps.id
from crm_ventas_tech_pipeline_stages ps
where c.stage_id is null
  and c.workspace_id = ps.workspace_id
  and (ps.name = c.etapa or ps.nombre = c.etapa);

commit;
