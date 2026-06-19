"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FileText, RefreshCw, Send, Eye, 
  CheckCircle2, XCircle, AlertTriangle 
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Contact {
  id: string;
  whatsappName: string;
  fullName: string;
  whatsappPhone: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  status: string;
  updatedAt: string;
}

interface SendLog {
  id: string;
  status: string;
  error?: string;
  createdAt: string;
  template: {
    name: string;
  };
  contact?: {
    whatsappName?: string;
    fullName?: string;
    whatsappPhone: string;
  };
}

export default function TemplatesPage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"templates" | "logs">("templates");
  
  // Modals
  const [selectedPreview, setSelectedPreview] = useState<Template | null>(null);
  const [selectedSend, setSelectedSend] = useState<Template | null>(null);

  // Form State
  const [searchContact, setSearchContact] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Fetch Templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<Template[]>({
    queryKey: ["templates", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`/api/templates?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch Recent Send Logs
  const { data: recentLogs = [], isLoading: isLoadingLogs } = useQuery<SendLog[]>({
    queryKey: ["template-logs", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      // We can query audit logs or create a specific logger API
      // Since template logs belong to templates, we can quickly fetch send history
      const res = await fetch(`/api/templates/send?workspaceId=${workspaceId}`);
      if (!res.ok) return []; // Gracefully handle if not implemented
      return res.json();
    },
    enabled: !!workspaceId && activeTab === "logs",
  });

  // Fetch Contacts for Autocomplete
  const { data: contactsData } = useQuery<{ data: Contact[] }>({
    queryKey: ["contacts-autocomplete-templates", workspaceId, searchContact],
    queryFn: async () => {
      if (!workspaceId) return { data: [] };
      const res = await fetch(`/api/contacts?workspaceId=${workspaceId}&search=${searchContact}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  // Mutate: Sync from Meta
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Sincronización exitosa: ${data.count} plantillas añadidas.`);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (err: Error) => {
      toast.error(`Error de sincronización: ${err.message}`);
    },
  });

  // Mutate: Direct Send Template
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedSend?.id,
          contactId: selectedContact?.id,
          variables,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Mensaje plantilla enviado correctamente");
      setSelectedSend(null);
      resetSendForm();
      queryClient.invalidateQueries({ queryKey: ["template-logs"] });
    },
    onError: (err: Error) => {
      toast.error(`Error al enviar: ${err.message}`);
    },
  });

  const resetSendForm = () => {
    setSelectedContact(null);
    setSearchContact("");
    setVariables({});
  };

  // Parse variables inside double braces e.g. {{1}}, {{2}}
  const getTemplateVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\d+)\}\}/g) || [];
    // Extract unique indices sorted
    return Array.from(new Set(matches.map((m) => m.replace(/[\{\}]/g, "")))).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
  };

  const handleOpenSend = (template: Template) => {
    setSelectedSend(template);
    resetSendForm();
    // Pre-populate empty fields for parsed variables
    const vars = getTemplateVariables(template.content);
    const initialVars: Record<string, string> = {};
    vars.forEach((v) => {
      initialVars[v] = "";
    });
    setVariables(initialVars);
  };

  const handleVarChange = (key: string, val: string) => {
    setVariables((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="p-8 w-full h-full flex flex-col bg-[var(--bg-primary)] text-slate-900 dark:text-white overflow-y-auto scrollbar-thin font-sans antialiased">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-whatsapp" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Plantillas de WhatsApp</h1>
            <p className="text-slate-500 dark:text-gray-400 text-xs mt-1.5">Gestiona y envía plantillas aprobadas por Meta.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] p-1 border border-[#ffffff10] rounded-md">
            <Button
              onClick={() => setActiveTab("templates")}
              className={`h-7 text-xs px-3 rounded-sm border-0 font-medium ${
                activeTab === "templates" ? "bg-white/10 text-slate-900 dark:text-white" : "bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"
              }`}
            >
              Plantillas
            </Button>
            <Button
              onClick={() => setActiveTab("logs")}
              className={`h-7 text-xs px-3 rounded-sm border-0 font-medium ${
                activeTab === "logs" ? "bg-white/10 text-slate-900 dark:text-white" : "bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"
              }`}
            >
              Envíos Recientes
            </Button>
          </div>

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-[var(--bg-secondary)] hover:bg-slate-50 dark:bg-white/5 border border-[#ffffff10] text-slate-900 dark:text-white font-semibold rounded-md h-9 text-xs flex items-center gap-2 px-3 transition-all duration-150"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar Meta
          </Button>
        </div>
      </div>

      {/* TEMPLATES LIST TABLE */}
      {activeTab === "templates" ? (
        <div className="border border-[#ffffff10] rounded-md overflow-hidden bg-[var(--bg-secondary)] max-w-5xl">
          <Table>
            <TableHeader className="bg-[var(--bg-primary)]">
              <TableRow className="hover:bg-[var(--bg-primary)] border-b border-[#ffffff10]">
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Nombre</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Vista Previa de Contenido</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Estado</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTemplates ? (
                <TableRow className="border-b border-[#ffffff05]">
                  <TableCell colSpan={4} className="text-center h-24 text-gray-500 animate-pulse">
                    Cargando plantillas locales...
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow className="border-b border-[#ffffff05]">
                  <TableCell colSpan={4} className="text-center h-24 text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <AlertTriangle className="h-6 w-6 text-amber-500 opacity-60" />
                      <span className="text-xs">No hay plantillas sincronizadas. Haz clic en &quot;Sincronizar Meta&quot;.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id} className="border-b border-[#ffffff05] hover:bg-[#ffffff06] transition-all duration-150">
                    <TableCell className="font-semibold text-slate-900 dark:text-white py-3">{template.name}</TableCell>
                    <TableCell className="text-slate-500 dark:text-gray-400 py-3 font-mono text-xs max-w-[350px] truncate">
                      {template.content}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge className="bg-green-950/40 text-green-400 border border-green-500/20 text-[10px] font-bold py-0.5 px-2 rounded-sm uppercase tracking-wider">
                        {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedPreview(template)}
                          className="h-7 w-7 p-0 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white rounded-md hover:bg-slate-50 dark:bg-white/5"
                          title="Previsualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleOpenSend(template)}
                          className="h-7 px-3 bg-whatsapp hover:bg-whatsappHover text-black font-bold text-xs rounded-md transition-all duration-150 flex items-center gap-1.5 shadow-sm"
                          title="Enviar"
                        >
                          <Send className="h-3 w-3" />
                          Enviar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* RECENT LOGS TABLE */
        <div className="border border-[#ffffff10] rounded-md overflow-hidden bg-[var(--bg-secondary)] max-w-5xl">
          <Table>
            <TableHeader className="bg-[var(--bg-primary)]">
              <TableRow className="hover:bg-[var(--bg-primary)] border-b border-[#ffffff10]">
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Contacto</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Plantilla</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Estado</TableHead>
                <TableHead className="text-slate-500 dark:text-gray-400 font-semibold h-10">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLogs ? (
                <TableRow className="border-b border-[#ffffff05]">
                  <TableCell colSpan={4} className="text-center h-24 text-gray-500 animate-pulse">
                    Cargando historial de envíos...
                  </TableCell>
                </TableRow>
              ) : recentLogs.length === 0 ? (
                <TableRow className="border-b border-[#ffffff05]">
                  <TableCell colSpan={4} className="text-center h-24 text-gray-500 italic py-6">
                    Sin historial de envíos de plantillas disponible en este workspace.
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log) => (
                  <TableRow key={log.id} className="border-b border-[#ffffff05] hover:bg-[#ffffff06]">
                    <TableCell className="py-3">
                      <div className="text-slate-900 dark:text-white font-medium">
                        {log.contact?.whatsappName || log.contact?.fullName || "Desconocido"}
                      </div>
                      <div className="text-[10px] text-gray-500">{log.contact?.whatsappPhone}</div>
                    </TableCell>
                    <TableCell className="py-3 font-semibold text-slate-600 dark:text-gray-300">{log.template.name}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        {log.status === "SENT" ? (
                          <span className="text-green-400 flex items-center gap-1 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1 text-xs" title={log.error}>
                            <XCircle className="h-3.5 w-3.5" /> Fallido
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-slate-500 dark:text-gray-400 text-xs">
                      {formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true, locale: es })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* DIALOG: PREVISUALIZAR */}
      <Dialog open={selectedPreview !== null} onOpenChange={(open) => !open && setSelectedPreview(null)}>
        <DialogContent className="bg-[var(--bg-secondary)] border border-[#ffffff10] text-slate-900 dark:text-white rounded-md max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Previsualizar Plantilla</DialogTitle>
          </DialogHeader>
          {selectedPreview && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Nombre</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white block">{selectedPreview.name}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Cuerpo del mensaje</span>
                <div className="p-3 bg-[var(--bg-card)] rounded-md border border-[#ffffff08] font-mono text-xs text-slate-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedPreview.content}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button onClick={() => setSelectedPreview(null)} className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold rounded-md h-8 text-xs px-4">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ENVIAR PLANTILLA */}
      <Dialog open={selectedSend !== null} onOpenChange={(open) => !open && setSelectedSend(null)}>
        <DialogContent className="bg-[var(--bg-secondary)] border border-[#ffffff10] text-slate-900 dark:text-white rounded-md max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Enviar Mensaje de Plantilla</DialogTitle>
          </DialogHeader>
          {selectedSend && (
            <div className="space-y-4 py-2">
              {/* Contact Autocomplete */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Destinatario</Label>
                <Input
                  placeholder="Buscar contacto..."
                  value={searchContact}
                  onChange={(e) => setSearchContact(e.target.value)}
                  className="bg-[var(--bg-card)] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
                />

                {searchContact.trim() !== "" && contactsData?.data && (
                  <div className="bg-[var(--bg-card)] border border-[#ffffff10] rounded-md max-h-32 overflow-y-auto scrollbar-thin text-xs divide-y divide-[#ffffff05]">
                    {contactsData.data.slice(0, 5).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedContact(c);
                          setSearchContact("");
                        }}
                        className="p-2 hover:bg-slate-50 dark:bg-white/5 cursor-pointer transition-colors"
                      >
                        {c.whatsappName || c.fullName} ({c.whatsappPhone})
                      </div>
                    ))}
                  </div>
                )}

                {selectedContact && (
                  <div className="mt-2 p-2 bg-whatsapp/10 border border-whatsapp/20 rounded-md flex items-center justify-between text-xs text-whatsapp">
                    <span>Destinatario: <b>{selectedContact.whatsappName || selectedContact.fullName}</b></span>
                    <Button variant="ghost" className="h-5 px-1 hover:text-slate-900 dark:text-white" onClick={() => setSelectedContact(null)}>Remover</Button>
                  </div>
                )}
              </div>

              {/* Dynamic Variables Inputs */}
              {getTemplateVariables(selectedSend.content).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-[#ffffff08]">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider block mb-1">Variables del mensaje</Label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {getTemplateVariables(selectedSend.content).map((v) => (
                      <div key={v} className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-gray-500 w-10 shrink-0">{"{{" + v + "}}"}</span>
                        <Input
                          placeholder={`Valor para variable ${v}`}
                          value={variables[v] || ""}
                          onChange={(e) => handleVarChange(v, e.target.value)}
                          className="bg-[var(--bg-card)] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp text-xs h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview with parsed variables */}
              <div className="space-y-1.5 pt-2 border-t border-[#ffffff08]">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Vista previa final</span>
                <div className="p-3 bg-[#0d0d0d] rounded-md border border-[#ffffff05] text-xs text-slate-500 dark:text-gray-400 leading-relaxed font-mono">
                  {selectedSend.content.replace(/\{\{(\d+)\}\}/g, (_, num) => {
                    return variables[num] !== undefined && variables[num] !== ""
                      ? `[${variables[num]}]`
                      : `{{${num}}}`;
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSelectedSend(null)} className="bg-transparent border-[#ffffff15] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white rounded-md h-8 text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={() => sendMutation.mutate()} 
              disabled={sendMutation.isPending || !selectedContact} 
              className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold rounded-md h-8 text-xs px-4"
            >
              {sendMutation.isPending ? "Enviando..." : "Enviar Mensaje"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
