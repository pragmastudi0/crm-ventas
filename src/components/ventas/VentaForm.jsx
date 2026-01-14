import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

const MARKETPLACES = ["WhatsApp", "Instagram", "MercadoLibre", "Local", "Otro"];

export default function VentaForm({ open, onOpenChange, consulta, onVentaCreada }) {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    contactoId: "",
    consultaId: "",
    nombre: "",
    modelo: "",
    capacidad: "",
    color: "",
    proveedorId: "",
    proveedorNombreSnapshot: "",
    marketplace: "WhatsApp",
    porUsuarioId: "",
    costo: "",
    comision: 0,
    venta: "",
    canje: 0,
    notas: ""
  });

  const [gananciaCalculada, setGananciaCalculada] = useState(0);
  const [searchProveedor, setSearchProveedor] = useState("");

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores-activos'],
    queryFn: async () => {
      const all = await base44.entities.Proveedor.list();
      return all.filter(p => p.activo !== false);
    },
    enabled: open
  });

  useEffect(() => {
    if (consulta && open) {
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        contactoId: consulta.contactoId || "",
        consultaId: consulta.id || "",
        nombre: consulta.contactoNombre || "",
        modelo: consulta.productoConsultado || "",
        capacidad: consulta.variante || "",
        color: "",
        proveedorId: "",
        proveedorNombreSnapshot: consulta.fuentePrecio || "",
        marketplace: consulta.canalOrigen || "WhatsApp",
        porUsuarioId: consulta.created_by || "",
        costo: "",
        comision: 0,
        venta: consulta.precioCotizado || "",
        canje: 0,
        notas: ""
      });
      setSearchProveedor(consulta.fuentePrecio || "");
    }
  }, [consulta, open]);

  useEffect(() => {
    const costo = parseFloat(formData.costo) || 0;
    const venta = parseFloat(formData.venta) || 0;
    const comision = parseFloat(formData.comision) || 0;
    const canje = parseFloat(formData.canje) || 0;
    
    const ganancia = venta - costo - comision + canje;
    setGananciaCalculada(ganancia);
  }, [formData.costo, formData.venta, formData.comision, formData.canje]);

  const handleSubmit = async () => {
    if (!formData.costo || !formData.venta) {
      toast.error("Costo y precio de venta son obligatorios");
      return;
    }

    if (!formData.proveedorId && !formData.proveedorNombreSnapshot) {
      toast.error("Selecciona un proveedor o ingresa un nombre");
      return;
    }

    const costo = parseFloat(formData.costo);
    const venta = parseFloat(formData.venta);
    const comision = parseFloat(formData.comision) || 0;
    const canje = parseFloat(formData.canje) || 0;

    if (costo < 0 || venta <= 0 || comision < 0 || canje < 0) {
      toast.error("Los montos deben ser válidos");
      return;
    }

    try {
      // Obtener el último código para generar el siguiente
      const ventas = await base44.entities.Venta.list("-created_date", 1);
      let nuevoCodigo = `V-${new Date().getFullYear()}-000001`;
      
      if (ventas.length > 0 && ventas[0].codigo) {
        const ultimoCodigo = ventas[0].codigo;
        const partes = ultimoCodigo.split('-');
        if (partes.length === 3) {
          const numero = parseInt(partes[2]) + 1;
          nuevoCodigo = `V-${new Date().getFullYear()}-${numero.toString().padStart(6, '0')}`;
        }
      }

      const ventaData = {
        codigo: nuevoCodigo,
        fecha: formData.fecha,
        contactoId: formData.contactoId,
        consultaId: formData.consultaId,
        nombre: formData.nombre,
        modelo: formData.modelo,
        capacidad: formData.capacidad,
        color: formData.color,
        proveedorId: formData.proveedorId || null,
        proveedorNombreSnapshot: formData.proveedorNombreSnapshot,
        marketplace: formData.marketplace,
        porUsuarioId: formData.porUsuarioId,
        costo: costo,
        comision: comision,
        venta: venta,
        canje: canje,
        ganancia: gananciaCalculada,
        notas: formData.notas
      };

      await base44.entities.Venta.create(ventaData);
      toast.success("Venta registrada correctamente");
      onVentaCreada?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Error al registrar la venta");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Registrar Venta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={formData.nombre} disabled className="bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Modelo *</Label>
              <Input
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                placeholder="iPhone 15 Pro Max"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacidad</Label>
              <Input
                value={formData.capacidad}
                onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                placeholder="256GB"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="Negro"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Proveedor *</Label>
              <a href={createPageUrl("ProveedorDetalle?id=nuevo")} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs">
                  <Plus className="w-3 h-3" />
                  Crear Nuevo
                </Button>
              </a>
            </div>
            <Select
              value={formData.proveedorId}
              onValueChange={(val) => {
                const prov = proveedores.find(p => p.id === val);
                setFormData({ 
                  ...formData, 
                  proveedorId: val,
                  proveedorNombreSnapshot: prov?.nombre || ""
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proveedor">
                  {formData.proveedorId 
                    ? proveedores.find(p => p.id === formData.proveedorId)?.nombre 
                    : "Selecciona un proveedor"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {proveedores.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                    {p.ciudad && <span className="text-xs text-slate-500"> • {p.ciudad}</span>}
                  </SelectItem>
                ))}
                {proveedores.length === 0 && (
                  <SelectItem value="none" disabled>
                    No hay proveedores. Crea uno primero.
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {!formData.proveedorId && (
              <Input
                value={formData.proveedorNombreSnapshot}
                onChange={(e) => setFormData({ ...formData, proveedorNombreSnapshot: e.target.value })}
                placeholder="O escribe el nombre del proveedor"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Marketplace</Label>
            <Select
              value={formData.marketplace}
              onValueChange={(val) => setFormData({ ...formData, marketplace: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Costo *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.costo}
                onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Precio de Venta *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.venta}
                onChange={(e) => setFormData({ ...formData, venta: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Comisión</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.comision}
                onChange={(e) => setFormData({ ...formData, comision: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Canje</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.canje}
                onChange={(e) => setFormData({ ...formData, canje: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={3}
              placeholder="Notas adicionales..."
            />
          </div>

          {/* Ganancia calculada */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className={gananciaCalculada >= 0 ? "w-5 h-5 text-green-600" : "w-5 h-5 text-red-600"} />
                <span className="font-semibold text-slate-700">Ganancia Calculada:</span>
              </div>
              <span className={`text-2xl font-bold ${gananciaCalculada >= 0 ? "text-green-600" : "text-red-600"}`}>
                US$ {gananciaCalculada.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Venta ({formData.venta || 0}) - Costo ({formData.costo || 0}) - Comisión ({formData.comision || 0}) + Canje ({formData.canje || 0})
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Registrar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}