import { useState } from "react";
import { crmClient } from "@/api/crmClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DragDropContext } from "@hello-pangea/dnd";
import PipelineColumn from "@/components/crm/PipelineColumn";
import ConsultaForm from "@/components/crm/ConsultaForm";
import WhatsAppSender from "@/components/crm/WhatsAppSender";
import VentaForm from "@/components/ventas/VentaForm";
import { Button } from "@/components/ui/button";
import { Plus, Filter, ArrowLeft, Settings } from "lucide-react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fetchPipelineStages, updateDeal } from "@/api/crmApi";

export default function Pipeline() {
  const [showForm, setShowForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState("todas");

  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: consultas = [], refetch } = useQuery({
    queryKey: ['consultas-pipeline', workspace?.id],
    queryFn: () => workspace ? crmClient.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 500) : [],
    enabled: !!workspace?.id
  });

  const { data: etapas = [] } = useQuery({
    queryKey: ['pipeline-stages', workspace?.id],
    queryFn: () => (workspace ? fetchPipelineStages(workspace.id) : []),
    enabled: !!workspace?.id
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDeal(workspace?.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas-pipeline', workspace?.id] });
    }
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newEtapa = destination.droppableId;
    const stage = etapas.find((item) => (item.id || item.name || item.nombre) === newEtapa);

    updateMutation.mutate({
      id: draggableId,
      data: {
        stage_id: stage?.id || null,
        etapa: stage?.name ?? stage?.nombre ?? newEtapa
      }
    });

    toast.success(`Movido a ${stage?.name ?? stage?.nombre ?? newEtapa}`);
  };

  const handleWhatsApp = (consulta) => {
    setSelectedConsulta(consulta);
    setShowWhatsApp(true);
  };

  const handleEdit = (consulta) => {
    setSelectedConsulta(consulta);
    setShowForm(true);
  };

  const handleConcretarVenta = (consulta) => {
    setSelectedConsulta(consulta);
    setShowVentaForm(true);
  };

  // Nuevo: marcar como perdido directamente desde la card del pipeline
  const handleMarcarPerdido = async (consulta, motivo) => {
    await updateMutation.mutateAsync({
      id: consulta.id,
      data: { etapa: "Perdido", motivoPerdida: motivo, stage_id: null }
    });
    toast.success(`Marcado como Perdido — ${motivo}`);
  };

  const handleVentaCreada = async (ventaId) => {
    if (selectedConsulta && workspace?.id) {
      await updateDeal(workspace.id, selectedConsulta.id, {
        etapa: "Concretado",
        concretado: true,
        stage_id: null,
      });
      queryClient.invalidateQueries({ queryKey: ['consultas-pipeline'] });
      toast.success("Venta registrada y consulta marcada como Concretado");
    }
    if (ventaId) {
      await crmClient.entities.Venta.update(ventaId, { estado: "Finalizada" });
    }
    setShowVentaForm(false);
    setSelectedConsulta(null);
  };

  // Filtrar consultas
  const consultasFiltradas = consultas.filter(c => {
    if (filtroCanal !== "todos" && c.canalOrigen !== filtroCanal) return false;
    if (filtroPrioridad !== "todas" && c.prioridad !== filtroPrioridad) return false;
    return true;
  });

  // Agrupar por etapa
  const consultasPorEtapa = etapas.reduce((acc, etapa) => {
    const stageName = etapa.name ?? etapa.nombre;
    const key = etapa.id || stageName;
    acc[key] = consultasFiltradas.filter((c) => c.stage_id === etapa.id || c.etapa === stageName);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-full mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
            <p className="text-slate-500">{consultasFiltradas.length} consultas activas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="MercadoLibre">MercadoLibre</SelectItem>
                  <SelectItem value="Referido">Referido</SelectItem>
                  <SelectItem value="Local">Local</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Link to={createPageUrl("ConfigurarPipeline")}>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Configurar
              </Button>
            </Link>
            <Button onClick={() => { setSelectedConsulta(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="p-6 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {etapas.map(etapa => {
              const stageName = etapa.name ?? etapa.nombre;
              const stageKey = etapa.id || stageName;
              return (
                <PipelineColumn
                  key={stageKey}
                  etapa={stageName}
                  etapaColor={etapa.color}
                  consultas={consultasPorEtapa[stageKey]}
                  onWhatsApp={handleWhatsApp}
                  onEdit={handleEdit}
                  onConcretarVenta={handleConcretarVenta}
                  onMarcarPerdido={handleMarcarPerdido}
                />
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <ConsultaForm
        open={showForm}
        onOpenChange={setShowForm}
        consulta={selectedConsulta}
        onSave={() => {
          refetch();
          setSelectedConsulta(null);
        }}
      />

      <WhatsAppSender
        open={showWhatsApp}
        onOpenChange={setShowWhatsApp}
        consulta={selectedConsulta}
        onMessageSent={refetch}
      />

      <VentaForm
        open={showVentaForm}
        onOpenChange={setShowVentaForm}
        consulta={selectedConsulta}
        onVentaCreada={handleVentaCreada}
      />
    </div>
  );
}
