-- Columnas que faltaban en Supabase para importar CSV (export legacy / Base44).
-- Ejecutá este script en el SQL Editor de tu proyecto Supabase (o con psql).
--
-- Prefijo por defecto del CRM: crm_ventas_tech
-- Si usás otro prefijo, reemplazá el nombre de las tablas antes de correr el script.
--
-- Después de aplicarlo, volvé a correr: node migrate-csv.mjs

begin;

-- ─── workspaces ───────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_workspaces
  add column if not exists legacy_id text;

-- ─── workspace_members ────────────────────────────────────────────────────
alter table public.crm_ventas_tech_workspace_members
  add column if not exists legacy_id text;

-- ─── pipeline_stages ──────────────────────────────────────────────────────
alter table public.crm_ventas_tech_pipeline_stages
  add column if not exists legacy_id text;

-- ─── plantillas_whatsapp (camelCase: comillas en Postgres) ────────────────
alter table public.crm_ventas_tech_plantillas_whatsapp
  add column if not exists legacy_id text,
  add column if not exists "categoriaProducto" text,
  add column if not exists "nombrePlantilla" text;

-- ─── contactos ────────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_contactos
  add column if not exists legacy_id text,
  add column if not exists notas text,
  add column if not exists responsable text,
  add column if not exists tags jsonb;

-- ─── proveedores ──────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_proveedores
  add column if not exists legacy_id text,
  add column if not exists categorias jsonb,
  add column if not exists condiciones text,
  add column if not exists "contactoNombre" text,
  add column if not exists "garantiaNotas" text,
  add column if not exists instagram text,
  add column if not exists "metodosPago" jsonb,
  add column if not exists monedas jsonb,
  add column if not exists notas text,
  add column if not exists pais text,
  add column if not exists "tiempoEntrega" text,
  add column if not exists verificado boolean,
  add column if not exists web text,
  add column if not exists whatsapp text;

-- ─── consultas ────────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_consultas
  add column if not exists legacy_id text,
  add column if not exists "cotizacionEnviada" boolean,
  add column if not exists fecha_seguimiento_posventa timestamptz,
  add column if not exists "fuentePrecio" text,
  add column if not exists "ultimoContacto" timestamptz;

-- ─── ventas ───────────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_ventas
  add column if not exists legacy_id text,
  add column if not exists "apellidoSnapshot" text,
  add column if not exists canje numeric,
  add column if not exists capacidad text,
  add column if not exists color text,
  add column if not exists comision numeric,
  add column if not exists marketplace text,
  add column if not exists modelo text,
  add column if not exists "nombreSnapshot" text,
  add column if not exists notas text,
  add column if not exists "porUsuarioId" text,
  add column if not exists "postventaActiva" boolean,
  add column if not exists "postventaEstado" text,
  add column if not exists "postventaNotas" text,
  add column if not exists "postventaPaso" integer,
  add column if not exists "postventaUltimoContacto" timestamptz,
  add column if not exists "productoSnapshot" text,
  add column if not exists "proveedorNombreSnapshot" text,
  add column if not exists "proveedorTexto" text,
  add column if not exists "proximoSeguimientoPostventa" timestamptz,
  add column if not exists venta numeric;

-- ─── mensajes ─────────────────────────────────────────────────────────────
alter table public.crm_ventas_tech_mensajes
  add column if not exists legacy_id text,
  add column if not exists "contenidoFinal" text,
  add column if not exists enviado boolean,
  add column if not exists "fechaEnvio" timestamptz,
  add column if not exists "plantillaId" uuid,
  add column if not exists resultado text;

commit;
