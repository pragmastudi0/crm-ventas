import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Copy, ExternalLink, Check, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { addBusinessDays } from "date-fns";

export default function WhatsAppSender({ open, onOpenChange, consulta, onMessageSent }) {
  const [plantillas, setPlantillas] = useState([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      loadPlantillas();
    }
  }, [open]);

  useEffect(() => {
    if (selectedPlantilla && consulta) {
      const contenido = reemplazarVariables(selectedPlantilla.contenido, consulta);
      setMensaje(contenido);
    }
  }, [selectedPlantilla, consulta]);

  const loadPlantillas = async () => {
    const data = await base44.entities.PlantillaWhatsApp.filter({ activa: true });
    setPlantillas(data);
    
    // Auto-seleccionar plantilla sugerida
    const sugerida = data.find(p => 
      p.categoriaProducto === consulta?.categoriaProducto &&
      (mapEtapaToPlantilla(consulta?.etapa) === p.etapa || p.etapa === "General")
    ) || data.find(p => p.categoriaProducto === "General") || data[0];
    
    if (sugerida) {
      setSelectedPlantilla(sugerida);
    }
  };

  const mapEtapaToPlantilla = (etapa) => {
    if (etapa === "Nuevo") return "Nuevo";
    if (["Seguimiento1", "Seguimiento2", "Seguimiento"].includes(etapa)) return "Seguimiento";
    if (etapa === "Negociacion") return "Cierre";
    if (etapa === "Concretado") return "Concretado";
    if (etapa === "Perdido") return "Perdido";
    return "General";
  };

  const reemplazarVariables = (texto, data) => {
    if (!texto) return "";
    return texto
      .replace(/{NOMBRE}/g, data.contactoNombre || "")
      .replace(/{PRODUCTO}/g, data.productoConsultado || "")
      .replace(/{VARIANTE}/g, data.variante || "")
      .replace(/{PRECIO}/g, data.precioCotizado?.toLocaleString() || "")
      .replace(/{MONEDA}/g, data.moneda === "USD" ? "US$" : "$")
      .replace(/{GARANTIA}/g, "6 meses")
      .replace(/{ENTREGA}/g, "24-48hs")
      .replace(/{PAGO}/g, "Efectivo, transferencia o tarjeta");
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    // Remove all non-numeric characters
    let clean = phone.replace(/[^0-9]/g, "");
    // Ensure it starts with 54 (Argentina country code) if not already present
    if (clean.length > 0 && !clean.startsWith("54")) {
      clean = "54" + clean;
    }
    return clean;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    toast.success("Mensaje copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = async () => {
    const phone = formatPhoneNumber(consulta.contactoWhatsapp);

    // 1. Limpieza y normalización segura
    const msg = String(mensaje || "")
      .normalize("NFC")
      // elimina caracteres de control invisibles (no rompe emojis)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

    // 2. Usar endpoint más tolerante + URLSearchParams
    const url = new URL("https://api.whatsapp.com/send");
    url.searchParams.set("phone", phone);
    url.searchParams.set("text", msg);

    // 3. Abrir WhatsApp
    window.open(url.toString(), "_blank", "noopener,noreferrer");

    // 4. Registrar el envío
    try {
      await base44.entities.EnvioWhatsApp.create({
        contactoId: consulta.contactoId,
        consultaId: consulta.id,
        contenidoEnviado: msg,
        accion: "AbrirWhatsApp",
      });
    } catch (error) {
      console.error("Error al registrar envío:", error);
    }
  };

  const handleMarkSent = async () => {
    setLoading(true);
    
    // Crear registro de mensaje
    await base44.entities.Mensaje.create({
      workspace_id: consulta.workspace_id,
      consultaId: consulta.id,
      plantillaId: selectedPlantilla?.id,
      contenidoFinal: mensaje,
      canal: "WhatsApp",
      enviado: true,
      fechaEnvio: new Date().toISOString()
    });

    // Actualizar consulta
    const updates = {
      ultimoContacto: new Date().toISOString(),
      cotizacionEnviada: true,
      proximoSeguimiento: addBusinessDays(new Date(), 3).toISOString().split('T')[0]
    };
    
    if (consulta.etapa === "Nuevo") {
      updates.etapa = "Seguimiento";
    }

    await base44.entities.Consulta.update(consulta.id, updates);

    toast.success("Mensaje registrado correctamente");
    setLoading(false);
    onMessageSent?.();
    onOpenChange(false);
  };

  if (!consulta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            Enviar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info del contacto */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="font-semibold text-slate-900">{consulta.contactoNombre}</p>
            <p className="text-sm text-slate-500">{consulta.contactoWhatsapp}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{consulta.productoConsultado}</Badge>
              {consulta.variante && <Badge variant="outline">{consulta.variante}</Badge>}
            </div>
          </div>

          {/* Selector de plantilla */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Plantilla sugerida
            </Label>
            <Select 
              value={selectedPlantilla?.id} 
              onValueChange={(val) => setSelectedPlantilla(plantillas.find(p => p.id === val))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plantilla" />
              </SelectTrigger>
              <SelectContent>
                {plantillas.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombrePlantilla}
                    {p.categoriaProducto && ` (${p.categoriaProducto})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Editor de mensaje */}
          <div className="space-y-2">
            <Label>Mensaje</Label>
            <Textarea 
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={6}
              className="resize-none w-full"
              placeholder="Escribe tu mensaje..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            onClick={handleOpenWhatsApp}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir WhatsApp
          </Button>
          <Button
            onClick={handleMarkSent}
            disabled={loading}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Marcar como enviado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}