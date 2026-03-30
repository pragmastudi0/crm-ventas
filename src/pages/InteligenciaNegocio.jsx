import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, TrendingUp, Target, Zap, BarChart2, RefreshCw, Sparkles } from "lucide-react";
import moment from "moment";

// ─── helpers ────────────────────────────────────────────────────────────────

function pct(n, d) { return d > 0 ? ((n / d) * 100).toFixed(1) : "0.0"; }
function usd(n) { return `US$ ${(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function daysLeftInMonth() {
  const now = moment();
  return now.daysInMonth() - now.date();
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || "#0f172a" }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Rank Row ────────────────────────────────────────────────────────────────

function RankRow({ rank, name, value, sub, bar, barColor, badge }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm font-bold min-w-[20px]" style={{ color: rank === 1 ? "#f59e0b" : "#94a3b8" }}>#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
          {badge && (
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">{badge}</span>
          )}
        </div>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {bar !== undefined && (
          <div className="h-1 bg-slate-100 rounded-full mt-1.5">
            <div
              className="h-1 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(bar, 100)}%`, background: barColor || "#10b981" }}
            />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-700 shrink-0">{value}</p>
    </div>
  );
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

function AIInsights({ aiData }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const runAnalysis = async () => {
    if (loading) return;
    setLoading(true);
    setDone(false);
    setAnalysis("");

    const prompt = `Sos un analista de negocios senior especializado en comercio de tecnología (Apple reseller en Argentina).
Analizá estos datos del CRM y dá recomendaciones concretas y accionables en español rioplatense informal pero profesional.

DATOS DEL NEGOCIO (últimos 30 días):
- Ventas totales: ${aiData.totalVentas} ventas | Ganancia: ${usd(aiData.totalGanancia)}
- Tasa de conversión: ${aiData.tasaConversion}% (${aiData.totalConsultas} consultas → ${aiData.totalVentas} ventas)
- Ticket promedio: ${usd(aiData.ticketPromedio)}
- Ganancia promedio por venta: ${usd(aiData.gananciaProm)}

TOP PRODUCTOS (por ganancia):
${aiData.topProductos.slice(0, 5).map((p, i) => `  ${i + 1}. ${p.name}: ${usd(p.ganancia)} | Margen: ${p.margen}%`).join("\n")}

TOP PROVEEDORES (por ganancia):
${aiData.topProveedores.slice(0, 4).map((p, i) => `  ${i + 1}. ${p.name}: ${usd(p.ganancia)} (${p.compras} compras, margen ${p.margen}%)`).join("\n")}

CANALES (por ganancia):
${aiData.canales.slice(0, 4).map(c => `  ${c.name}: ${c.ventas} ventas, conversión ${c.conversion}%, ganancia ${usd(c.ganancia)}`).join("\n")}

Respondé con 3 secciones cortas y directas:
1. **Lo que está funcionando bien** (2-3 puntos)
2. **Lo que hay que mejorar urgente** (2-3 puntos con acciones concretas)
3. **La recomendación más importante del mes** (1 sola cosa, la más impactante)

Sé específico con los números. No uses frases genéricas. Máximo 350 palabras.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const json = JSON.parse(raw);
              if (json.type === "content_block_delta" && json.delta?.text) {
                setAnalysis(prev => prev + json.delta.text);
              }
            } catch {}
          }
        }
      }
      setDone(true);
    } catch (err) {
      setAnalysis("❌ Error al conectar con la IA. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const formatText = (text) =>
    text.split("\n").map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="mb-1 text-sm leading-relaxed text-slate-700">
          {parts.map((p, j) =>
            j % 2 === 1
              ? <strong key={j} className="font-semibold text-slate-900">{p}</strong>
              : p
          )}
        </p>
      );
    });

  return (
    <Section
      title="Análisis IA del Negocio"
      icon={Sparkles}
      action={
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: loading ? "#e2e8f0" : "#0f172a",
            color: loading ? "#94a3b8" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            border: "none"
          }}
        >
          {loading
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <Sparkles className="w-3 h-3" />
          }
          {loading ? "Analizando..." : done ? "Actualizar" : "Generar análisis"}
        </button>
      }
    >
      {!analysis && !loading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Generá un análisis con IA basado en tus datos reales del CRM.
          </p>
        </div>
      )}
      {loading && !analysis && (
        <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Analizando datos del negocio...
        </div>
      )}
      {analysis && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          {formatText(analysis)}
          {loading && (
            <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse rounded-sm" />
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InteligenciaNegocio() {
  const { workspace } = useWorkspace();
  const [objetivo, setObjetivo] = useState("");
  const [diasHabiles, setDiasHabiles] = useState(String(Math.round(daysLeftInMonth() * 0.7)));
  const [tdcManual, setTdcManual] = useState(false);
  const [tdcManualVal, setTdcManualVal] = useState("");

  const { data: ventas = [] } = useQuery({
    queryKey: ["ib-ventas", workspace?.id],
    queryFn: () => workspace
      ? base44.entities.Venta.filter({ workspace_id: workspace.id, estado: "Finalizada" }, "-fecha", 1000)
      : [],
    enabled: !!workspace
  });

  const { data: consultas = [] } = useQuery({
    queryKey: ["ib-consultas", workspace?.id],
    queryFn: () => workspace
      ? base44.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 2000)
      : [],
    enabled: !!workspace
  });

  // ── últimos 30 días ──
  const cut30 = moment().subtract(30, "days");
  const ventas30 = ventas.filter(v => moment(v.fecha).isAfter(cut30));
  const consultas30 = consultas.filter(c => moment(c.created_date).isAfter(cut30));
  const concretados30 = consultas30.filter(c => c.etapa === "Concretado");

  const totalVentas = ventas30.length;
  const totalConsultas = consultas30.length;
  const totalGanancia = ventas30.reduce((s, v) => s + (v.ganancia || 0), 0);
  const totalVentaMonto = ventas30.reduce((s, v) => s + (v.venta || 0), 0);
  const tasaConversion = parseFloat(pct(concretados30.length, totalConsultas));
  const ticketPromedio = totalVentas > 0 ? totalVentaMonto / totalVentas : 0;
  const gananciaProm = totalVentas > 0 ? totalGanancia / totalVentas : 0;

  // ── mes actual ──
  const cutMes = moment().startOf("month");
  const ventasMes = ventas.filter(v => moment(v.fecha).isAfter(cutMes));
  const gananciaMes = ventasMes.reduce((s, v) => s + (v.ganancia || 0), 0);

  // ── top productos ──
  const prodMap = {};
  ventas30.forEach(v => {
    const k = v.productoSnapshot || v.modelo || "Sin especificar";
    if (!prodMap[k]) prodMap[k] = { ganancia: 0, venta: 0, count: 0 };
    prodMap[k].ganancia += v.ganancia || 0;
    prodMap[k].venta += v.venta || 0;
    prodMap[k].count++;
  });
  const topProductos = Object.entries(prodMap)
    .map(([name, d]) => ({
      name,
      ganancia: d.ganancia,
      margen: d.venta > 0 ? ((d.ganancia / d.venta) * 100).toFixed(1) : "0",
      count: d.count
    }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxProd = topProductos[0]?.ganancia || 1;

  // ── top proveedores ──
  const provMap = {};
  ventas30.forEach(v => {
    const k = v.proveedorNombreSnapshot || v.proveedorTexto || "Sin especificar";
    if (!provMap[k]) provMap[k] = { ganancia: 0, venta: 0, compras: 0 };
    provMap[k].ganancia += v.ganancia || 0;
    provMap[k].venta += v.venta || 0;
    provMap[k].compras++;
  });
  const topProveedores = Object.entries(provMap)
    .map(([name, d]) => ({
      name,
      ganancia: d.ganancia,
      margen: d.venta > 0 ? ((d.ganancia / d.venta) * 100).toFixed(1) : "0",
      compras: d.compras
    }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxProv = topProveedores[0]?.ganancia || 1;

  // ── canales ──
  const canalMap = {};
  consultas30.forEach(c => {
    const k = c.canalOrigen || "Sin especificar";
    if (!canalMap[k]) canalMap[k] = { consultas: 0, concretados: 0, ganancia: 0 };
    canalMap[k].consultas++;
    if (c.etapa === "Concretado") canalMap[k].concretados++;
  });
  ventas30.forEach(v => {
    const k = v.marketplace || "Sin especificar";
    if (!canalMap[k]) canalMap[k] = { consultas: 0, concretados: 0, ganancia: 0 };
    canalMap[k].ganancia += v.ganancia || 0;
  });
  const canales = Object.entries(canalMap)
    .map(([name, d]) => ({
      name,
      ventas: d.concretados,
      conversion: pct(d.concretados, d.consultas),
      ganancia: d.ganancia
    }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxCanal = canales[0]?.ganancia || 1;

  // ── tendencia mensual ──
  const meses = [3, 2, 1, 0].map(i => {
    const start = moment().subtract(i, "months").startOf("month");
    const end = moment().subtract(i, "months").endOf("month");
    const mv = ventas.filter(v => moment(v.fecha).isBetween(start, end, null, "[]"));
    return {
      label: start.format("MMM"),
      ganancia: mv.reduce((s, v) => s + (v.ganancia || 0), 0),
      isCurrent: i === 0
    };
  });
  const maxMes = Math.max(...meses.map(m => m.ganancia), 1);
  const tendencia = meses[2].ganancia > 0
    ? ((meses[3].ganancia - meses[2].ganancia) / meses[2].ganancia * 100).toFixed(1)
    : "0";
  const tendenciaPos = parseFloat(tendencia) >= 0;

  // ── calculadora ──
  const objNum = parseFloat(objetivo) || 0;
  const diasNum = parseFloat(diasHabiles) || 1;
  const tdcEfectiva = tdcManual ? (parseFloat(tdcManualVal) || 0) : tasaConversion;
  const faltaGanar = Math.max(0, objNum - gananciaMes);
  const ventasNecesarias = gananciaProm > 0 ? Math.ceil(faltaGanar / gananciaProm) : 0;
  const consultasNecesarias = tdcEfectiva > 0 ? Math.ceil(ventasNecesarias / (tdcEfectiva / 100)) : 0;
  const llamadasPorDia = diasNum > 0 ? Math.ceil(consultasNecesarias / diasNum) : 0;
  const yaAlcanzado = objNum > 0 && faltaGanar <= 0;

  const aiData = { totalVentas, totalConsultas, totalGanancia, tasaConversion, ticketPromedio, gananciaProm, topProductos, topProveedores, canales };
  const barColors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Home")}>
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors bg-transparent border-none cursor-pointer p-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          </Link>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">Inteligencia de Negocio</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Últimos 30 días · Solo admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">EN VIVO</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* KPIs — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Ganancia del mes" value={usd(gananciaMes)} sub={`${ventasMes.length} ventas`} color="#10b981" />
          <KPICard label="Conversión" value={`${tasaConversion}%`} sub={`${concretados30.length} de ${totalConsultas}`} color="#6366f1" />
          <KPICard label="Ticket promedio" value={usd(ticketPromedio)} sub="por venta" />
          <KPICard label="Ganancia / venta" value={usd(gananciaProm)} sub="últimos 30 días" color="#f59e0b" />
        </div>

        {/* Calculadora */}
        <Section title="Calculadora de Llamadas Diarias" icon={Target}
          action={<span className="text-xs text-slate-400">{daysLeftInMonth()} días restantes</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                Objetivo mensual (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">US$</span>
                <input
                  type="number"
                  value={objetivo}
                  onChange={e => setObjetivo(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                Días hábiles restantes
              </label>
              <input
                type="number"
                value={diasHabiles}
                onChange={e => setDiasHabiles(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tasa de conversión
                </label>
                <button
                  onClick={() => { setTdcManual(!tdcManual); setTdcManualVal(""); }}
                  className="text-xs font-medium px-2 py-0.5 rounded-md border transition-all"
                  style={{
                    background: tdcManual ? "#0f172a" : "#f8fafc",
                    color: tdcManual ? "#fff" : "#64748b",
                    borderColor: tdcManual ? "#0f172a" : "#e2e8f0",
                    cursor: "pointer"
                  }}
                >
                  {tdcManual ? "Manual ✓" : "Manual"}
                </button>
              </div>
              {tdcManual ? (
                <div className="relative">
                  <input
                    type="number"
                    value={tdcManualVal}
                    onChange={e => setTdcManualVal(e.target.value)}
                    placeholder="ej: 15"
                    min="0" max="100"
                    className="w-full border-2 border-slate-900 rounded-lg px-3 pr-8 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
              ) : (
                <div className="border border-indigo-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-indigo-600 bg-indigo-50 flex items-center justify-between">
                  <span>{tasaConversion}%</span>
                  <span className="text-xs font-normal text-indigo-400">del CRM</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                Ya ganado este mes
              </label>
              <div className="border border-emerald-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50">
                {usd(gananciaMes)}
              </div>
            </div>
          </div>

          {objNum > 0 && (
            <div className={`rounded-xl p-4 border ${yaAlcanzado ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              {yaAlcanzado ? (
                <div className="text-center py-2">
                  <p className="text-lg font-bold text-emerald-600">🎉 ¡Objetivo alcanzado!</p>
                  <p className="text-sm text-slate-500 mt-1">Ganaste {usd(gananciaMes)} de {usd(objNum)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Falta ganar</p>
                    <p className="text-xl font-bold text-amber-500">{usd(faltaGanar)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Ventas needed</p>
                    <p className="text-xl font-bold text-slate-700">{ventasNecesarias}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Consultas</p>
                    <p className="text-xl font-bold text-slate-700">{consultasNecesarias}</p>
                    <p className="text-xs text-slate-400">conv. {tdcEfectiva}%{tdcManual ? " (manual)" : ""}</p>
                  </div>
                  <div className="text-center bg-slate-900 rounded-lg py-2 px-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Por día</p>
                    <p className="text-3xl font-black text-white">{llamadasPorDia}</p>
                    <p className="text-xs text-slate-400">contactos</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {objNum === 0 && (
            <p className="text-sm text-slate-400 text-center py-3">
              Ingresá tu objetivo mensual para calcular cuántos contactos necesitás por día.
            </p>
          )}
        </Section>

        {/* Rentabilidad — 1 col mobile, 2 cols desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Rentabilidad por Producto" icon={BarChart2}>
            {topProductos.length === 0
              ? <p className="text-sm text-slate-400 text-center py-6">Sin ventas en los últimos 30 días</p>
              : topProductos.slice(0, 7).map((p, i) => (
                <RankRow
                  key={p.name} rank={i + 1} name={p.name}
                  value={usd(p.ganancia)}
                  sub={`Margen ${p.margen}% · ${p.count} uds`}
                  bar={(p.ganancia / maxProd) * 100}
                  barColor={i === 0 ? "#f59e0b" : "#10b981"}
                  badge={i === 0 ? "TOP" : null}
                />
              ))
            }
          </Section>

          <Section title="Rentabilidad por Proveedor" icon={TrendingUp}>
            {topProveedores.length === 0
              ? <p className="text-sm text-slate-400 text-center py-6">Sin ventas en los últimos 30 días</p>
              : topProveedores.slice(0, 7).map((p, i) => (
                <RankRow
                  key={p.name} rank={i + 1} name={p.name}
                  value={usd(p.ganancia)}
                  sub={`${p.compras} compras · margen ${p.margen}%`}
                  bar={(p.ganancia / maxProv) * 100}
                  barColor={i === 0 ? "#f59e0b" : "#6366f1"}
                  badge={i === 0 ? "MEJOR" : null}
                />
              ))
            }
          </Section>
        </div>

        {/* Canales + Tendencia */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Rendimiento por Canal" icon={Zap}>
            {canales.length === 0
              ? <p className="text-sm text-slate-400 text-center py-6">Sin datos</p>
              : canales.slice(0, 6).map((c, i) => (
                <RankRow
                  key={c.name} rank={i + 1} name={c.name}
                  value={usd(c.ganancia)}
                  sub={`${c.ventas} ventas · conv. ${c.conversion}%`}
                  bar={(c.ganancia / maxCanal) * 100}
                  barColor={barColors[i] || "#6366f1"}
                />
              ))
            }
          </Section>

          <Section
            title="Tendencia Mensual"
            icon={TrendingUp}
            action={
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${tendenciaPos ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                {tendenciaPos ? "↑" : "↓"} {Math.abs(tendencia)}%
              </span>
            }
          >
            <div className="flex items-end gap-3 h-32 mb-4">
              {meses.map((m) => {
                const h = maxMes > 0 ? Math.max((m.ganancia / maxMes) * 100, 4) : 4;
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-xs text-slate-400 text-center leading-tight" style={{ fontSize: 10 }}>{usd(m.ganancia)}</p>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      style={{
                        height: `${h}%`,
                        background: m.isCurrent ? "#0f172a" : "#e2e8f0",
                        minHeight: 4
                      }}
                    />
                    <p className={`text-xs font-medium ${m.isCurrent ? "text-slate-900" : "text-slate-400"}`}>
                      {m.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Mejor mes</p>
                <p className="text-sm font-bold text-slate-800">{usd(Math.max(...meses.map(m => m.ganancia)))}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Promedio mensual</p>
                <p className="text-sm font-bold text-slate-800">{usd(meses.reduce((s, m) => s + m.ganancia, 0) / 4)}</p>
              </div>
            </div>
          </Section>
        </div>

        {/* IA — full width */}
        <AIInsights aiData={aiData} />

      </div>
    </div>
  );
}
