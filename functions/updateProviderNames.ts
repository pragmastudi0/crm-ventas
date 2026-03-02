import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nameMap = {
      "GON CETSELL": "CELLSAT",
      "EMI IMPO": "IMPO CBA",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS",
      "MARTÍN MB": "MB CELUS",
      "MARTIN MB CELUS": "MB CELUS",
    };

    const allVentas = await base44.asServiceRole.entities.Venta.list('-created_date', 500);

    // Debug: show first 3 records raw
    const sample = allVentas.slice(0, 3).map(v => ({
      id: v.id,
      snap: v.proveedorNombreSnapshot,
      snapType: typeof v.proveedorNombreSnapshot,
      snapEncoded: JSON.stringify(v.proveedorNombreSnapshot),
      keys: Object.keys(v).slice(0, 15)
    }));

    return Response.json({ sample, total: allVentas.length });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});