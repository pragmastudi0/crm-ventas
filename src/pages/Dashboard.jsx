import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import KPICard from "@/components/crm/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, TrendingUp, CheckCircle2, XCircle, Clock, 
  MessageCircle, Calendar, ArrowRight, Plus, ArrowLeft, DollarSign
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { createPageUrl } from "@/utils";
import moment from "moment";
import ConsultaForm from "@/components/crm/ConsultaForm";
import WhatsAppSender from "@/components/crm/WhatsAppSender";

const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const [showForm, setShowForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);

  const { data: consultas = [], refetch } = useQuery({
    queryKey: ['consultas-dashboard'],
    queryFn: () => base44.entities.Consulta.list("-created_date", 500)
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-dashboard'],
    queryFn: () => base44.entities.Venta.list("-fecha", 500)
  });

  // KPIs
  const today = moment();
  const last7Days = consultas.filter(c => moment(c.created_date).isAfter(today.clone().subtract(7, 'days')));
  const last30Days = consultas.filter(c => moment(c.created_date).isAfter(today.clone().subtract(30, 'days')));
  const concretados = consultas.filter(c => c.etapa === "Concretado");
  const perdidos = consultas.filter(c => c.etapa === "Perdido");
  const activos = consultas.filter(c => !["Concretado", "Perdido"].includes(c.etapa));
  const tasaConversion = consultas.length > 0 ? ((concretados.length / consultas.length) * 100).toFixed(1) : 0;

  // Ganancia mensual
  const ventasMesActual = ventas.filter(v => 
    v.fecha && moment(v.fecha).isSame(today, 'month') && v.estado === "Finalizada"
  );
  const gananciaMensual = ventasMesActual.reduce((acc, v) => acc + (v.ganancia || 0), 0);

  // Seguimientos del día
  const seguimientosHoy = consultas.filter(c => 
    c.proximoSeguimiento && 
    moment(c.proximoSeguimiento).isSameOrBefore(today, 'day') &&
    !["Concretado", "Perdido"].includes(c.etapa)
  );

  // Leads por canal
  const leadsPorCanal = CANALES.reduce((acc, canal) => {
    acc[canal] = consultas.filter(c => c.canalOrigen === canal).length;
    return acc;
  }, {});
  const canalData = Object.entries(leadsPorCanal)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  // Productos más consultados
  const productosCounts = {};
  consultas.forEach(c => {
    const cat = c.categoriaProducto || "Otro";
    productosCounts[cat] = (productosCounts[cat] || 0) + 1;
  });
  const productosData = Object.entries(productosCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Motivos de pérdida
  const motivosCounts = {};
  perdidos.forEach(c => {
    if (c.motivoPerdida) {
      motivosCounts[c.motivoPerdida] = (motivosCounts[c.motivoPerdida] || 0) + 1;
    }
  });
  const motivosData = Object.entries(motivosCounts).map(([name, value]) => ({ name, value }));

  const handleWhatsApp = (consulta) => {
    setSelectedConsulta(consulta);
    setShowWhatsApp(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Avanzado</h1>
            <p className="text-slate-500">Resumen de tu actividad comercial</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva consulta
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Leads últimos 7 días"
            value={last7Days.length}
            subtitle={`${last30Days.length} en 30 días`}
            icon={Users}
          />
          <KPICard
            title="Tasa de conversión"
            value={`${tasaConversion}%`}
            subtitle={`${concretados.length} concretados`}
            icon={TrendingUp}
          />
          <KPICard
            title="Ganancia Mensual"
            value={`$${gananciaMensual.toFixed(0)}`}
            subtitle={`${ventasMesActual.length} ventas`}
            icon={DollarSign}
          />
          <KPICard
            title="Activos"
            value={activos.length}
            subtitle="En seguimiento"
            icon={Clock}
          />
          <KPICard
            title="Perdidos"
            value={perdidos.length}
            subtitle={`${((perdidos.length / (consultas.length || 1)) * 100).toFixed(0)}% del total`}
            icon={XCircle}
          />
        </div>

        {/* Seguimientos del día */}
        {seguimientosHoy.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Calendar className="w-5 h-5" />
                Seguimientos pendientes ({seguimientosHoy.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {seguimientosHoy.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">{c.contactoNombre}</p>
                      <p className="text-sm text-slate-500">{c.productoConsultado}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={moment(c.proximoSeguimiento).isBefore(today, 'day') ? "destructive" : "secondary"}>
                        {moment(c.proximoSeguimiento).isBefore(today, 'day') ? "Vencido" : "Hoy"}
                      </Badge>
                      <Button 
                        size="sm" 
                        onClick={() => handleWhatsApp(c)}
                        className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {seguimientosHoy.length > 5 && (
                  <Link to={createPageUrl("Consultas")} className="block">
                    <Button variant="ghost" className="w-full gap-2">
                      Ver todos <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráficos */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Por canal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads por canal</CardTitle>
            </CardHeader>
            <CardContent>
              {canalData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={canalData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 py-12">Sin datos</p>
              )}
            </CardContent>
          </Card>

          {/* Por producto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos más consultados</CardTitle>
            </CardHeader>
            <CardContent>
              {productosData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={productosData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {productosData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 py-12">Sin datos</p>
              )}
            </CardContent>
          </Card>

          {/* Motivos de pérdida */}
          {motivosData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Motivos de pérdida</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={motivosData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConsultaForm
        open={showForm}
        onOpenChange={setShowForm}
        onSave={refetch}
      />

      <WhatsAppSender
        open={showWhatsApp}
        onOpenChange={setShowWhatsApp}
        consulta={selectedConsulta}
        onMessageSent={refetch}
      />
    </div>
  );
}

const CANALES = ["Instagram", "WhatsApp", "MercadoLibre", "Referido", "Local", "Otro"];