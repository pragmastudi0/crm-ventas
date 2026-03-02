import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const nameMap = {
      "EMI IMPO": "IMPO CBA",
      "GON CETSELL": "CELLSAT",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS"
    };

    const updatedProviders = [];

    for (const oldName in nameMap) {
      const newName = nameMap[oldName];
      const providers = await base44.asServiceRole.entities.Proveedor.filter({ nombre: oldName });

      for (const provider of providers) {
        await base44.asServiceRole.entities.Proveedor.update(provider.id, { nombre: newName });
        updatedProviders.push({ id: provider.id, oldName, newName });
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