import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/hooks/useCurrentUser";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, CheckCircle2, AlertCircle, Calendar, ArrowLeft, Phone, Pencil, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";
import { toast } from "sonner";
import PostventaWhatsAppSender from "@/components/crm/PostventaWhatsAppSender";
import { cn } from "@/lib/utils";

function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const d = result.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return result.toISOString().split('T')[0];
}

const estadoColors = {
  Pendiente: "bg-amber-100 text-amber-700",
  Enviado: "bg-blue-100 text-blue-700",
  Cerrado: "bg-emerald-100 text-emerald-700"
};

export default function Postventa() {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [editingVenta, setEditingVenta] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [filtroMarketplace, setFiltroMarketplace] = useState("todos");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");

  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { workspace } = useWorkspace();

  const postventaDays = currentUser?.postventa_follow_up_days ?? 7;

  const { data: ventas = [], isLoading } = useQuery({
    queryKey: ['ventas-postventa', workspace?.id],
    queryFn: () => workspace ? base44.entities.Venta.filter({ workspace_id: workspace.id, postventaActiva: true }, "-proximoSeguimientoPostventa", 1000) : [],
    enabled: !!workspace
  });

  const { data: contactos = [] } = useQuery({
    queryKey: ['contactos-postventa-map', workspace?.id],
    queryFn: () => workspace ? base44.entities.Contacto.filter({ workspace_id: workspace.id }) : [],
    enabled: !!workspace
  });

  const contactosMap = useMemo(() =>
    Object.fromEntries(contactos.map(c => [c.id, c])),
    [contactos]
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Venta.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ventas-postventa', workspace?.id] })
  });

  const today = moment();

  const ventasFiltradas = ventas.filter(v => {
    if (filtroMarketplace !== "todos" && v.marketplace !== filtroMarketplace) return false;
    if (filtroVendedor !== "todos" && v.porUsuarioId !== filtroVendedor) return false;
    return true;
  });

  const vencidas = ventasFiltradas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isBefore(today, 'day') &&
    v.postventaEstado !== 'Cerrado'
  );

  const deHoy = ventasFiltradas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isSame(today, 'day') &&
    v.postventaEstado !== 'Cerrado'
  );

  const proximas7d = ventasFiltradas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isAfter(today, 'day') &&
    moment(v.proximoSeguimientoPostventa).isBefore(today.clone().add(7, 'days'), 'day') &&
    v.postventaEstado !== 'Cerrado'
  );

  const vendedores = [...new Set(ventas.map(v => v.porUsuarioId).filter(Boolean))];

  const getWhatsApp = (venta) => contactosMap[venta.contactoId]?.whatsapp || null;

  const handleWhatsApp = (venta) => {
    setSelectedVenta(venta);
    setShowWhatsApp(true);
  };

  const handleMarcarEnviado = async (venta) => {
    const paso = venta.postventaPaso || 0;
    let updates;
    if (paso === 0) {
      updates = {
        postventaUltimoContacto: new Date().toISOString(),
        postventaEstado: 'Enviado',
        postventaPaso: 1,
        proximoSeguimientoPostventa: addBusinessDays(new Date(), postventaDays)
      };
      toast.success("Seguimiento marcado. Próximo contacto en 7 días hábiles.");
    } else {
      updates = {
        postventaUltimoContacto: new Date().toISOString(),
        postventaEstado: 'Cerrado',
        postventaActiva: false
      };
      toast.success("Postventa cerrada.");
    }
    await updateMutation.mutateAsync({ id: venta.id, data: updates });
  };

  const handleEditarFecha = (venta) => {
    setEditingVenta(venta);
    setEditDate(venta.proximoSeguimientoPostventa || "");
  };

  const handleGuardarFecha = async () => {
    await updateMutation.mutateAsync({ id: editingVenta.id, data: { proximoSeguimientoPostventa: editDate } });
    toast.success("Fecha actualizada");
    setEditingVenta(null);
  };

  const defaultTab = vencidas.length > 0 ? "vencidas" : deHoy.length > 0 ? "hoy" : "proximas";

  const renderTable = (rows, emptyMsg) => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead className="font-semibold">Cliente</TableHead>
            <TableHead className="font-semibold">Producto</TableHead>
            <TableHead className="font-semibold">Fecha Venta</TableHead>
            <TableHead className="font-semibold">Ganancia</TableHead>
            <TableHead className="font-semibold">Próx. Seguimiento</TableHead>
            <TableHead className="font-semibold">Estado</TableHead>
            <TableHead className="font-semibold text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? rows.map(venta => {
            const whatsapp = getWhatsApp(venta);
            const vencido = venta.proximoSeguimientoPostventa &&
              moment(venta.proximoSeguimientoPostventa).isBefore(today, 'day') &&
              venta.postventaEstado !== 'Cerrado';

            return (
              <TableRow key={venta.id} className={cn(vencido ? "bg-red-50/40" : "")}>
                <TableCell>
                  <p className="font-medium text-slate-900">{venta.nombreSnapshot}</p>
                  {whatsapp && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{whatsapp}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{venta.productoSnapshot || venta.modelo || "-"}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    Paso {(venta.postventaPaso || 0) + 1}/2
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{venta.fecha ? moment(venta.fecha).format("DD/MM/YY") : "-"}</p>
                  {venta.marketplace && <p className="text-xs text-slate-400">{venta.marketplace}</p>}
                </TableCell>
                <TableCell>
                  {venta.ganancia != null ? (
                    <p className={cn("font-semibold text-sm", venta.ganancia >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {venta.moneda} {venta.ganancia.toFixed(0)}
                    </p>
                  ) : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell>
                  {venta.proximoSeguimientoPostventa ? (
                    <div className={cn("flex items-center gap-1 text-sm", vencido ? "text-red-600 font-medium" : "text-slate-600")}>
                      <Calendar className="w-3.5 h-3.5" />
                      {moment(venta.proximoSeguimientoPostventa).format("DD/MM/YY")}
                      {vencido && <span className="text-xs">(vencido)</span>}
                    </div>
                  ) : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell>
                  <Badge className={estadoColors[venta.postventaEstado] || ""}>
                    {venta.postventaEstado}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleWhatsApp(venta)}
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-white h-8 w-8 p-0"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarcarEnviado(venta)}
                      className="h-8 px-2 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {(venta.postventaPaso || 0) === 0 ? "P1 Enviado" : "Cerrar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditarFecha(venta)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          }) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-slate-400">{emptyMsg}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Link to={createPageUrl("Home")}>
            <Button variant="ghost" className="gap-2 mb-2 -ml-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Postventa</h1>
          <p className="text-slate-500">Seguimiento de clientes después de la venta</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-red-600 font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Vencidos</p>
              <p className="text-3xl font-bold text-red-600">{vencidas.length}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-amber-600 font-medium flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Para hoy</p>
              <p className="text-3xl font-bold text-amber-600">{deHoy.length}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-600 font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Próximos 7 días</p>
              <p className="text-3xl font-bold text-blue-600">{proximas7d.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Select value={filtroMarketplace} onValueChange={setFiltroMarketplace}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Marketplace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los canales</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="MercadoLibre">MercadoLibre</SelectItem>
              <SelectItem value="Local">Local</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
          {vendedores.length > 1 && (
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los vendedores</SelectItem>
                {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="vencidas" className="gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Vencidos ({vencidas.length})
            </TabsTrigger>
            <TabsTrigger value="hoy" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Hoy ({deHoy.length})
            </TabsTrigger>
            <TabsTrigger value="proximas">
              Próximos 7 días ({proximas7d.length})
            </TabsTrigger>
            <TabsTrigger value="todos">
              Todos ({ventasFiltradas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vencidas" className="mt-4">
            {renderTable(vencidas, "¡No hay seguimientos vencidos!")}
          </TabsContent>
          <TabsContent value="hoy" className="mt-4">
            {renderTable(deHoy, "No hay seguimientos programados para hoy.")}
          </TabsContent>
          <TabsContent value="proximas" className="mt-4">
            {renderTable(proximas7d, "No hay seguimientos en los próximos 7 días.")}
          </TabsContent>
          <TabsContent value="todos" className="mt-4">
            {renderTable(ventasFiltradas, "No hay ventas con postventa activa.")}
          </TabsContent>
        </Tabs>
      </div>

      <PostventaWhatsAppSender
        open={showWhatsApp}
        onOpenChange={setShowWhatsApp}
        venta={selectedVenta}
        contactoWhatsapp={selectedVenta ? getWhatsApp(selectedVenta) : null}
        onMessageSent={() => queryClient.invalidateQueries({ queryKey: ['ventas-postventa'] })}
      />

      <Dialog open={!!editingVenta} onOpenChange={(open) => !open && setEditingVenta(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar fecha de seguimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Próximo seguimiento</Label>
            <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVenta(null)}>Cancelar</Button>
            <Button onClick={handleGuardarFecha}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}