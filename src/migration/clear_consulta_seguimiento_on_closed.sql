-- Consultas cerradas: sin fechas de seguimiento en la fila de consulta.
-- La postventa (+7 días) vive solo en crm_ventas_tech_ventas (módulo Postventa).
--
-- Ejecutar en Supabase SQL Editor. Ajustá el nombre de tabla si tu prefijo no es crm_ventas_tech.

begin;

update public.crm_ventas_tech_consultas
set
  "proximoSeguimiento" = null,
  fecha_seguimiento_posventa = null
where etapa in ('Concretado', 'Perdido')
 or concretado = true;

commit;

-- Si "proximoSeguimiento" falla por nombre de columna, probá sin comillas:
--   proximoseguimiento = null
-- (revisá el nombre exacto en Table Editor)
