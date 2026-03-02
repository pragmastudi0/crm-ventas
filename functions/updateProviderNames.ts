import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const normalizeName = (name) => {
      if (!name) return '';
      return name.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    const nameMap = {
      "EMI IMPO": "IMPO CBA",
      "GON CETSELL": "CELLSAT",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS"
    };

    const normalizedNameMap = {};
    for (const oldName in nameMap) {
      normalizedNameMap[normalizeName(oldName)] = nameMap[oldName];
    }

    const allProviders = await base44.asServiceRole.entities.Proveedor.list();
    const updatedProviders = [];

    for (const provider of allProviders) {
      const normalizedProviderName = normalizeName(venta.proveedorNombreSnapshot);
      const newName = normalizedNameMap[normalizedProviderName];
      if (newName && venta.proveedorNombreSnapshot !== newName) {
        await base44.asServiceRole.entities.Proveedor.update(provider.id, { nombre: newName });
        updatedProviders.push({ id: provider.id, oldName: venta.proveedorNombreSnapshot, newName });
      }
    }

    return Response.json({
      message: `Se actualizaron ${updatedProviders.length} proveedores.`,
      details: updatedProviders
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});