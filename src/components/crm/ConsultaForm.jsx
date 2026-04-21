import { useState, useEffect, useMemo } from "react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmClient } from "@/api/crmClient";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Package, Calendar, Plus } from "lucide-react";
import moment from "moment";
import { getNextBusinessDay } from "@/components/utils/dateUtils";
import {
  fetchPipelineStages,
  createDeal,
  updateDeal,
  isConsultaSeguimientoInactive,
} from "@/api/crmApi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  validateContactNoDuplicates,
  findContactsWithSamePhone,
  findContactsWithSameFullName,
  isMeaningfulPhoneDigits,
  normalizePhoneDigits,
} from "@/utils/contactDuplicates";

const CATEGORIAS = ["iPhone", "Mac", "iPad", "AirPods", "Apple Watch", "Accesorios", "Otro"];
const CANALES = ["Instagram", "WhatsApp", "MercadoLibre", "Referido", "Local", "Otro"];
const PRIORIDADES = ["Alta", "Media", "Baja"];
const MOTIVOS_PERDIDA = ["Caro", "SinStock", "ComproOtro", "NoResponde", "Financiacion", "Otro"];

export default function ConsultaForm({ open, onOpenChange, consulta, onSave }) {
  const [contactos, setContactos] = useState([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const { workspace } = useWorkspace();

  const { data: etapas = [] } = useQuery({
    queryKey: ['pipeline-stages', workspace?.id],
    queryFn: () => (workspace ? fetchPipelineStages(workspace.id) : []),
    enabled: open && !!workspace?.id
  });
  
  const [formData, setFormData] = useState({
    contactoId: "",
    productoConsultado: "",
    categoriaProducto: "",
    variante: "",
    presupuestoMax: "",
    moneda: "USD",
    precioCotizado: "",
    etapa: "Nuevo",
    prioridad: "Media",
    canalOrigen: "",
    proximoSeguimiento: getNextBusinessDay(new Date(), 3),
    motivoPerdida: ""
  });

  const [newContact, setNewContact] = useState({
    nombre: "",
    apellido: "",
    whatsapp: "",
    ciudad: "",
    canalOrigen: ""
  });

  useEffect(() => {
    if (workspace) loadContactos();
  }, [workspace]);

  useEffect(() => {
    if (consulta) {
      setFormData({
        ...consulta,
        presupuestoMax: consulta.presupuestoMax || "",
        precioCotizado: consulta.precioCotizado || "",
        proximoSeguimiento: consulta.proximoSeguimiento || ""
      });
    } else {
      setFormData({
        contactoId: "",
        productoConsultado: "",
        categoriaProducto: "",
        variante: "",
        presupuestoMax: "",
        moneda: "USD",
        precioCotizado: "",
        etapa: "Nuevo",
        prioridad: "Media",
        canalOrigen: "",
        proximoSeguimiento: getNextBusinessDay(new Date(), 3),
        motivoPerdida: ""
      });
    }
  }, [consulta, open]);

  const loadContactos = async () => {
    if (!workspace) return;
    const data = await crmClient.entities.Contacto.filter({ workspace_id: workspace.id }, "-created_date", 500);
    setContactos(data);
  };

  const phoneDuplicateSuggestions = useMemo(() => {
    if (!showNewContact || !newContact.whatsapp) return [];
    return findContactsWithSamePhone(contactos, newContact.whatsapp);
  }, [showNewContact, newContact.whatsapp, contactos]);

  const fullNameDuplicateMatches = useMemo(() => {
    if (!showNewContact) return [];
    return findContactsWithSameFullName(contactos, newContact.nombre, newContact.apellido);
  }, [showNewContact, newContact.nombre, newContact.apellido, contactos]);

  const selectExistingContactFromSuggestion = (c) => {
    setFormData((prev) => ({ ...prev, contactoId: c.id }));
    setShowNewContact(false);
    setNewContact({ nombre: "", apellido: "", whatsapp: "", ciudad: "", canalOrigen: "" });
    toast.info(`Usando contacto existente: ${[c.nombre, c.apellido].filter(Boolean).join(" ")}`);
  };

  const handleCreateContact = async () => {
    if (!newContact.nombre || !newContact.whatsapp) {
      toast.error("Nombre y WhatsApp son requeridos");
      return;
    }

    const dupCheck = validateContactNoDuplicates({
      existingContacts: contactos,
      nombre: newContact.nombre,
      apellido: newContact.apellido,
      whatsapp: newContact.whatsapp,
      numeroTelefono: newContact.whatsapp,
      excludeContactId: undefined,
    });
    if (dupCheck.ok === false) {
      if (dupCheck.reason === "phone") {
        toast.error(
          "Ya existe un contacto con este número. Elegí «Usar este contacto» en la sugerencia o cambiá el número.",
        );
      } else {
        toast.error(dupCheck.message);
      }
      return;
    }

    setLoading(true);
    try {
      const created = await crmClient.entities.Contacto.create({
        ...newContact,
        numeroTelefono: newContact.whatsapp,
        workspace_id: workspace?.id,
      });

      setContactos([created, ...contactos]);
      setFormData({ ...formData, contactoId: created.id });
      setShowNewContact(false);
      setNewContact({ nombre: "", apellido: "", whatsapp: "", ciudad: "", canalOrigen: "" });
      toast.success("Contacto creado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear el contacto");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contactoId || !formData.productoConsultado) {
      toast.error("Contacto y producto son requeridos");
      return;
    }

    setLoading(true);
    
    const contacto = contactos.find(c => c.id === formData.contactoId);
    
    const dataToSave = {
      ...formData,
      contactoNombre: [contacto?.nombre, contacto?.apellido].filter(Boolean).join(" "),
      contactoWhatsapp: contacto?.whatsapp,
      canalOrigen: formData.canalOrigen || contacto?.canalOrigen || "",
      presupuestoMax: formData.presupuestoMax ? Number(formData.presupuestoMax) : null,
      precioCotizado: formData.precioCotizado ? Number(formData.precioCotizado) : null,
      fechaConsulta: consulta?.fechaConsulta || moment().format("YYYY-MM-DD"),
      workspace_id: workspace?.id
    };

    // Si se marca concretado, cambiar etapa
    if (formData.concretado && formData.etapa !== "Concretado") {
      dataToSave.etapa = "Concretado";
    }
    const stage = etapas.find((item) => (item.name ?? item.nombre) === dataToSave.etapa);
    dataToSave.stage_id = stage?.id || null;

    if (consulta) {
      await updateDeal(workspace?.id, consulta.id, dataToSave);
      toast.success("Consulta actualizada");
    } else {
      await createDeal(workspace?.id, dataToSave);
      toast.success("Consulta creada");
    }

    setLoading(false);
    onSave?.();
    onOpenChange(false);
  };

  const selectedContact = contactos.find(c => c.id === formData.contactoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {consulta ? "Editar Consulta" : "Nueva Consulta"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contacto" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contacto" className="gap-2">
              <User className="w-4 h-4" /> Contacto
            </TabsTrigger>
            <TabsTrigger value="producto" className="gap-2">
              <Package className="w-4 h-4" /> Producto
            </TabsTrigger>
            <TabsTrigger value="seguimiento" className="gap-2">
              <Calendar className="w-4 h-4" /> Seguimiento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacto" className="space-y-4 mt-4">
            {!showNewContact ? (
              <>
                <div className="space-y-2">
                  <Label>Contacto existente</Label>
                  <Select 
                    value={formData.contactoId} 
                    onValueChange={(val) => setFormData({ ...formData, contactoId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar contacto" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactos.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} {c.apellido} - {c.whatsapp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedContact && (
                   <div className="bg-slate-50 rounded-xl p-4">
                     <p className="font-semibold">{selectedContact.nombre} {selectedContact.apellido}</p>
                     <p className="text-sm text-slate-500">{selectedContact.whatsapp}</p>
                     {selectedContact.ciudad && <p className="text-sm text-slate-500">{selectedContact.ciudad}</p>}
                   </div>
                 )}

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowNewContact(true)}
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear nuevo contacto
                </Button>
              </>
            ) : (
              <div className="space-y-4 border rounded-xl p-4">
                {isMeaningfulPhoneDigits(normalizePhoneDigits(newContact.whatsapp)) &&
                  phoneDuplicateSuggestions.length > 0 && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                      <AlertTitle>Contacto con el mismo teléfono</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p className="text-sm">
                          Ya tenés uno o más contactos registrados con este número. Evitá duplicar: usá el
                          existente o corregí el número si es otro cliente.
                        </p>
                        <ul className="list-disc pl-4 text-sm space-y-1">
                          {phoneDuplicateSuggestions.map((c) => (
                            <li key={c.id}>
                              <span className="font-medium">
                                {[c.nombre, c.apellido].filter(Boolean).join(" ")}
                              </span>
                              <span className="text-amber-800/80"> — {c.whatsapp || c.numeroTelefono}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-1"
                          onClick={() => selectExistingContactFromSuggestion(phoneDuplicateSuggestions[0])}
                        >
                          Usar este contacto
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                {fullNameDuplicateMatches.length > 0 && (
                  <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-700">
                    <AlertTitle>Mismo nombre y apellido</AlertTitle>
                    <AlertDescription className="text-sm">
                      Ya existe un contacto con esta combinación. No se puede crear otro igual; usá el contacto
                      existente o ajustá nombre/apellido.
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {fullNameDuplicateMatches.map((c) => (
                          <li key={c.id}>
                            {[c.nombre, c.apellido].filter(Boolean).join(" ")} — {c.whatsapp || c.numeroTelefono || "sin teléfono"}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Nombre *</Label>
                     <Input 
                       value={newContact.nombre}
                       onChange={(e) => setNewContact({ ...newContact, nombre: e.target.value })}
                       placeholder="Juan"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Apellido</Label>
                     <Input 
                       value={newContact.apellido}
                       onChange={(e) => setNewContact({ ...newContact, apellido: e.target.value })}
                       placeholder="Pérez"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>WhatsApp *</Label>
                    <Input 
                      value={newContact.whatsapp}
                      onChange={(e) => setNewContact({ ...newContact, whatsapp: e.target.value })}
                      placeholder="+54 9 11 1234-5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input 
                      value={newContact.ciudad}
                      onChange={(e) => setNewContact({ ...newContact, ciudad: e.target.value })}
                      placeholder="Buenos Aires"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Canal de origen</Label>
                    <Select 
                      value={newContact.canalOrigen} 
                      onValueChange={(val) => setNewContact({ ...newContact, canalOrigen: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CANALES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewContact(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateContact}
                    disabled={
                      loading ||
                      phoneDuplicateSuggestions.length > 0 ||
                      fullNameDuplicateMatches.length > 0
                    }
                  >
                    Crear contacto
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="producto" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Producto consultado *</Label>
                <Input 
                  value={formData.productoConsultado}
                  onChange={(e) => setFormData({ ...formData, productoConsultado: e.target.value })}
                  placeholder="iPhone 15 Pro Max"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select 
                  value={formData.categoriaProducto} 
                  onValueChange={(val) => setFormData({ ...formData, categoriaProducto: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Variante</Label>
                <Input 
                  value={formData.variante}
                  onChange={(e) => setFormData({ ...formData, variante: e.target.value })}
                  placeholder="256GB Negro"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio cotizado</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.moneda} 
                    onValueChange={(val) => setFormData({ ...formData, moneda: val })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="ARS">ARS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number"
                    value={formData.precioCotizado}
                    onChange={(e) => setFormData({ ...formData, precioCotizado: e.target.value })}
                    placeholder="1299"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Presupuesto máximo</Label>
                <Input 
                  type="number"
                  value={formData.presupuestoMax}
                  onChange={(e) => setFormData({ ...formData, presupuestoMax: e.target.value })}
                  placeholder="1500"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seguimiento" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select 
                  value={formData.etapa} 
                  onValueChange={(val) => setFormData({ ...formData, etapa: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas.map((e) => {
                      const stageName = e.name ?? e.nombre;
                      return (
                        <SelectItem key={e.id || stageName} value={stageName}>
                          {stageName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select 
                  value={formData.prioridad} 
                  onValueChange={(val) => setFormData({ ...formData, prioridad: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal de origen</Label>
                <Select 
                  value={formData.canalOrigen} 
                  onValueChange={(val) => setFormData({ ...formData, canalOrigen: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANALES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isConsultaSeguimientoInactive({
                etapa: formData.etapa,
                concretado: formData.concretado,
              }) ? (
                <div className="space-y-2">
                  <Label>Próximo seguimiento</Label>
                  <Input
                    type="date"
                    value={formData.proximoSeguimiento}
                    onChange={(e) =>
                      setFormData({ ...formData, proximoSeguimiento: e.target.value })
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500 col-span-2">
                  Consultas cerradas no llevan fecha de seguimiento. La postventa se gestiona en el
                  módulo Postventa (ventas finalizadas).
                </p>
              )}

              {formData.etapa === "Perdido" && (
                <div className="space-y-2 col-span-2">
                  <Label>Motivo de pérdida</Label>
                  <Select 
                    value={formData.motivoPerdida} 
                    onValueChange={(val) => setFormData({ ...formData, motivoPerdida: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PERDIDA.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {consulta ? "Guardar cambios" : "Crear consulta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
