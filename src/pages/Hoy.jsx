import { useState } from "react";
import { crmClient } from "@/api/crmClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, AlertCircle, CheckCircle2, MessageCircle, ArrowLeft } from "lucide-react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";
import WhatsAppSender from "@/components/crm/WhatsAppSender";
import PostventaWhatsAppSender from "@/components/crm/PostventaWhatsAppSender";
import { toast } from "sonner";
import { updateDeal, isConsultaSeguimientoInactive } from "@/api/crmApi";

const etapaColors = {
  Nuevo: "bg-blue-100 text-blue-700",
  Respondido: "bg-cyan-100 text-cyan-700",
  Seguimiento1: "bg-amber-100 text-amber-700",
  Seguimiento2: "bg-orange-100 text-orange-700",
  Negociacion: "bg-purple-100 text-purple-700",
  Concretado: "bg-emerald-100 text-emerald-700",
};

const canalColors = {
  WhatsApp: "bg-emerald-100 text-emerald-700",
  Instagram: "bg-pink-100 text-pink-700",
  MercadoLibre: "bg-yellow-100 text-yellow-700",
  Referido: "bg-violet-100 text-violet-700",
  Local: "bg-slate-200 text-slate-700",
  Otro: "bg-indigo-100 text-indigo-700",
};

export default function Hoy() {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showPostventaWhatsApp, setShowPostventaWhatsApp] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: consultas = [], refetch } = useQuery({
    queryKey: ['consultas-hoy', workspace?.id],
    queryFn: () => workspace ? crmClient.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 1000) : [],
    enabled: !!workspace
  });
  const { data: contactos = [] } = useQuery({
    queryKey: ['contactos-hoy', workspace?.id],
    queryFn: () => workspace ? crmClient.entities.Contacto.filter({ workspace_id: workspace.id }, "-created_date", 1000) : [],
    enabled: !!workspace
  });
  const { data: ventasPostventa = [] } = useQuery({
    queryKey: ['ventas-postventa-hoy', workspace?.id],
    queryFn: () => workspace ? crmClient.entities.Venta.filter({ workspace_id: workspace.id, estado: "Finalizada" }, "-fecha", 1000) : [],
    enabled: !!workspace
  });

  const contactoById = new Map(contactos.map((contacto) => [contacto.id, contacto]));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!workspace?.id) throw new Error("workspace_id is required");
      return updateDeal(workspace.id, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas-hoy'] });
      toast.success("Actualizado");
    }
  });
  const updateVentaMutation = useMutation({
    mutationFn: ({ id, data }) => crmClient.entities.Venta.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-postventa-hoy', workspace?.id] });
      toast.success("Postventa actualizada");
    }
  });

  const today = moment();

  const seguimientoActivo = (c) => {
    if (isConsultaSeguimientoInactive(c)) return false;
    const fecha = c.proximoSeguimiento;
    if (!fecha || !moment(fecha).isValid()) return false;
    return true;
  };

  const getVentaWhatsapp = (venta) => {
    if (venta.contactoId && contactoById.get(venta.contactoId)?.whatsapp) {
      return contactoById.get(venta.contactoId).whatsapp;
    }
    return venta.whatsappCliente || null;
  };

  const postventaActiva = ventasPostventa.filter((venta) =>
    venta.postventaActiva === true &&
    venta.postventaEstado !== "Cerrado" &&
    venta.proximoSeguimientoPostventa &&
    moment(venta.proximoSeguimientoPostventa).isValid()
  );

  const seguimientosUnificados = [
    ...consultas
      .filter((consulta) => seguimientoActivo(consulta))
      .map((consulta) => ({
        kind: "consulta",
        id: consulta.id,
        fecha: consulta.proximoSeguimiento,
        consulta,
      })),
    ...postventaActiva.map((venta) => ({
      kind: "postventa",
      id: venta.id,
      fecha: venta.proximoSeguimientoPostventa,
      venta,
    })),
  ];

  const hoy = seguimientosUnificados.filter((item) => moment(item.fecha).isSame(today, "day"));
  const vencidos = seguimientosUnificados.filter((item) => moment(item.fecha).isBefore(today, "day"));
  const proximos3d = seguimientosUnificados.filter((item) => (
    moment(item.fecha).isAfter(today, "day") &&
    moment(item.fecha).isBefore(today.clone().add(3, "days"), "day")
  ));

  const handleWhatsApp = (consulta) => {
    setSelectedConsulta(consulta);
    setShowWhatsApp(true);
  };

  const handleMarcarCompletado = async (consulta) => {
    const nuevaFecha = moment().add(3, "days").format("YYYY-MM-DD");
    await updateMutation.mutateAsync({
      id: consulta.id,
      data: { proximoSeguimiento: nuevaFecha },
    });
  };
  const handlePostventaWhatsApp = (venta) => {
    setSelectedVenta(venta);
    setShowPostventaWhatsApp(true);
  };
  const handlePostventaRealizada = async (venta) => {
    await updateVentaMutation.mutateAsync({
      id: venta.id,
      data: {
        postventaUltimoContacto: new Date().toISOString(),
        postventaEstado: "Cerrado",
        postventaActiva: false,
        proximoSeguimientoPostventa: null,
      },
    });
  };

  const SeguimientoItem = ({ item, tipo }) => {
    const isPostventa = item.kind === "postventa";
    const consulta = item.consulta;
    const venta = item.venta;
    const fechaMostrar = item.fecha;
    const canalOrigen = isPostventa
      ? (venta.marketplace || "Sin canal")
      : (consulta.canalOrigen || contactoById.get(consulta.contactoId)?.canalOrigen || "Sin canal");
    return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-900">{isPostventa ? venta.nombreSnapshot : consulta.contactoNombre}</h3>
              {isPostventa ? (
                <Badge className="bg-violet-100 text-violet-700">Postventa</Badge>
              ) : (
                <Badge className={etapaColors[consulta.etapa] || "bg-slate-100 text-slate-700"}>
                  {consulta.etapa}
                </Badge>
              )}
              <Badge className={canalColors[canalOrigen] || "bg-slate-100 text-slate-700"}>
                {canalOrigen}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mb-1">{isPostventa ? (venta.productoSnapshot || venta.modelo || "-") : consulta.productoConsultado}</p>
            {!isPostventa && consulta.variante && (
              <p className="text-xs text-slate-400">{consulta.variante}</p>
            )}
            {!isPostventa && consulta.precioCotizado && (
              <p className="text-sm font-medium text-slate-900 mt-2">
                {consulta.moneda === "USD" ? "US$" : "$"} {consulta.precioCotizado.toLocaleString()}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className={`text-xs ${
                tipo === "vencido" ? "text-red-600 font-medium" : "text-slate-500"
              }`}>
                {fechaMostrar && moment(fechaMostrar).isValid()
                  ? moment(fechaMostrar).format("DD/MM/YYYY")
                  : "—"}
                {tipo === "vencido" && " (vencido)"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <Button
              size="sm"
              onClick={() => (isPostventa ? handlePostventaWhatsApp(venta) : handleWhatsApp(consulta))}
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
              disabled={isPostventa && !getVentaWhatsapp(venta)}
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (isPostventa ? handlePostventaRealizada(venta) : handleMarcarCompletado(consulta))}
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Seguimientos del Día</h1>
            <p className="text-slate-500 mt-1">
              {today.format("dddd, DD [de] MMMM [de] YYYY")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{hoy.length}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{vencidos.length}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Próximos 3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{proximos3d.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={vencidos.length > 0 ? "vencidos" : "hoy"}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vencidos" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Vencidos ({vencidos.length})
            </TabsTrigger>
            <TabsTrigger value="hoy" className="gap-2">
              <Calendar className="w-4 h-4" />
              Hoy ({hoy.length})
            </TabsTrigger>
            <TabsTrigger value="proximos" className="gap-2">
              Próximos ({proximos3d.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vencidos" className="space-y-3 mt-4">
            {vencidos.length > 0 ? (
              vencidos.map(item => <SeguimientoItem key={`${item.kind}-${item.id}`} item={item} tipo="vencido" />)
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-500">¡Excelente! No hay seguimientos vencidos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="hoy" className="space-y-3 mt-4">
            {hoy.length > 0 ? (
              hoy.map(item => <SeguimientoItem key={`${item.kind}-${item.id}`} item={item} tipo="hoy" />)
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay seguimientos programados para hoy</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="proximos" className="space-y-3 mt-4">
            {proximos3d.length > 0 ? (
              proximos3d.map(item => <SeguimientoItem key={`${item.kind}-${item.id}`} item={item} tipo="proximo" />)
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay seguimientos en los próximos 3 días</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <WhatsAppSender
        open={showWhatsApp}
        onOpenChange={setShowWhatsApp}
        consulta={selectedConsulta}
        onMessageSent={refetch}
      />
      <PostventaWhatsAppSender
        open={showPostventaWhatsApp}
        onOpenChange={setShowPostventaWhatsApp}
        venta={selectedVenta}
        contactoWhatsapp={selectedVenta ? getVentaWhatsapp(selectedVenta) : null}
        workspaceId={workspace?.id}
        onMessageSent={() => {
          queryClient.invalidateQueries({ queryKey: ['ventas-postventa-hoy', workspace?.id] });
        }}
      />
    </div>
  );
}
