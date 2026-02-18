import { base44 } from "@/api/base44Client";

export async function generateNextVentaCode(year) {
  // Buscar todas las ventas del año con formato V-YYYY-NNNNNN
  const ventasDelAnio = await base44.entities.Venta.list(
    "-codigo",
    1000,
    {}
  );

  // Filtrar solo las del año específico y con formato válido
  const codigosValidos = ventasDelAnio
    .map(v => v.codigo)
    .filter(codigo => {
      if (!codigo) return false;
      const match = codigo.match(/^V-(\d{4})-(\d{6})$/);
      return match && match[1] === String(year);
    });

  let maxSecuencia = 0;
  
  if (codigosValidos.length > 0) {
    // Extraer el número secuencial más alto
    codigosValidos.forEach(codigo => {
      const match = codigo.match(/^V-\d{4}-(\d{6})$/);
      if (match) {
        const secuencia = parseInt(match[1], 10);
        if (secuencia > maxSecuencia) {
          maxSecuencia = secuencia;
        }
      }
    });
  }

  const siguienteSecuencia = maxSecuencia + 1;
  return `V-${year}-${String(siguienteSecuencia).padStart(6, '0')}`;
}