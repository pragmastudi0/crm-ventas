-- Diagnóstico: alinear identidad de usuario con workspace y datos migrados.
-- Sustituye el email y el prefijo de tablas si difieren de tu proyecto.

--1) UUID en auth para un email
-- select id, email from auth.users where email = 'gasparquintana00@gmail.com';

-- 2) Membrecías que coinciden con ese usuario (email o UUID)
-- select wm.id, wm.workspace_id, wm.user_id, wm.role
-- from crm_ventas_tech_workspace_members wm
-- where wm.user_id = 'gasparquintana00@gmail.com'
--    or wm.user_id = (select id::text from auth.users where email = 'gasparquintana00@gmail.com' limit 1);

-- 3) Volumen de datos por workspace (¿mismo workspace_id que la membrecía?)
-- select workspace_id, count(*) as consultas
-- from crm_ventas_tech_consultas
-- group by workspace_id
-- order by consultas desc;
