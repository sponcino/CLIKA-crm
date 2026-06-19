"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, Search, Save, FileText,
  ChevronRight, Loader2, X, Upload, Sparkles, Zap,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "General", "Productos", "Servicios", "Precios",
  "FAQ", "Políticas", "Casos de uso", "Objeciones",
];

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-gray-800 text-slate-600 dark:text-gray-300 border-gray-700",
  Productos: "bg-blue-950/60 text-blue-400 border-blue-800/40",
  Servicios: "bg-indigo-950/60 text-indigo-400 border-indigo-800/40",
  Precios: "bg-amber-950/60 text-amber-400 border-amber-800/40",
  FAQ: "bg-green-950/60 text-green-400 border-green-800/40",
  Políticas: "bg-red-950/60 text-red-400 border-red-700/40",
  "Casos de uso": "bg-purple-950/60 text-purple-400 border-purple-800/40",
  Objeciones: "bg-orange-950/60 text-orange-400 border-orange-800/40",
};

// ─── Document templates ───────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: "Información General",
    category: "General",
    titlePlaceholder: "Información General de la Empresa",
    content: `# Información General

## ¿Quiénes somos?
[Describe tu empresa aquí]

## ¿Qué ofrecemos?
[Describe tus productos o servicios principales]

## ¿Dónde estamos ubicados?
[Dirección y cobertura]

## Horarios de atención
[Detalla los horarios]`,
  },
  {
    label: "Productos y Servicios",
    category: "Productos",
    titlePlaceholder: "Catálogo de Productos y Servicios",
    content: `# Productos y Servicios

## [Nombre del Producto/Servicio]
**Descripción:**
**Precio:**
**Beneficios:**
-
-

## [Nombre del Producto/Servicio 2]
**Descripción:**
**Precio:**
**Beneficios:**
-
- `,
  },
  {
    label: "Preguntas Frecuentes",
    category: "FAQ",
    titlePlaceholder: "Preguntas Frecuentes",
    content: `# Preguntas Frecuentes

## ¿Cuáles son los horarios de atención?
[Respuesta aquí]

## ¿Cómo puedo contactarlos?
[Respuesta aquí]

## ¿Cuáles son los métodos de pago?
[Respuesta aquí]

## ¿Hacen envíos a todo el país?
[Respuesta aquí]

## ¿Tienen garantía?
[Respuesta aquí]`,
  },
  {
    label: "Políticas de la Empresa",
    category: "Políticas",
    titlePlaceholder: "Políticas de la Empresa",
    content: `# Políticas

## Política de Cancelación
[Detalla tu política de cancelación]

## Política de Reembolso
[Detalla tu política de reembolsos y devoluciones]

## Política de Privacidad
[Cómo se manejan los datos de los clientes]`,
  },
  {
    label: "Casos de Uso",
    category: "Casos de uso",
    titlePlaceholder: "Casos de Uso y Ejemplos",
    content: `# Casos de Uso

## Caso 1: [Tipo de cliente]
**Problema:**
**Solución:**
**Resultado:**

## Caso 2: [Tipo de cliente]
**Problema:**
**Solución:**
**Resultado:** `,
  },
  {
    label: "Manejo de Objeciones",
    category: "Objeciones",
    titlePlaceholder: "Manejo de Objeciones Comerciales",
    content: `# Manejo de Objeciones

## "Es muy caro"
[Respuesta sugerida para objeción de precio]

## "Necesito pensarlo"
[Respuesta para cuando el cliente duda]

## "Ya tengo proveedor"
[Respuesta para competencia]

## "No tengo tiempo ahora"
[Respuesta para urgencia]`,
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DocSummary {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  chunkCount: number;
  hasEmbeddings: boolean;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  content: string;
  score: number;
  similarity?: number;
  searchType: 'vector' | 'text';
}

// ─── Similarity badge ─────────────────────────────────────────────────────────
function SimilarityBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500/15 text-green-400 border-green-500/25" :
    score >= 60 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" :
                  "bg-red-500/15 text-red-400 border-red-500/25";
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${color}`}>
      {score}%
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function KnowledgePage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [editIsActive, setEditIsActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: docs = [], isLoading } = useQuery<DocSummary[]>({
    queryKey: ["knowledge-docs", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`/api/knowledge?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  const { data: selectedDoc } = useQuery({
    queryKey: ["knowledge-doc", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (selectedDoc) {
      setEditTitle(selectedDoc.title);
      setEditContent(selectedDoc.content || "");
      setEditCategory(selectedDoc.category || "General");
      setEditIsActive(selectedDoc.isActive);
      setIsDirty(false);
    }
  }, [selectedDoc]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const handleNewDoc = () => {
    setSelectedId(null);
    setIsCreating(true);
    setEditTitle("");
    setEditContent("");
    setEditCategory("General");
    setEditIsActive(true);
    setIsDirty(false);
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setEditTitle(tpl.titlePlaceholder);
    setEditContent(tpl.content);
    setEditCategory(tpl.category);
    setIsDirty(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md"].includes(ext ?? "")) {
      toast.error("Solo se admiten archivos .txt y .md por ahora");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setEditContent(text);
      if (!editTitle.trim()) setEditTitle(file.name.replace(/\.[^.]+$/, ""));
      setIsDirty(true);
      toast.success(`Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const markDirty = () => setIsDirty(true);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title: editTitle, content: editContent, category: editCategory }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: (doc) => {
      toast.success("Documento creado y embeddings generados");
      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      setIsCreating(false);
      setSelectedId(doc.id);
      setIsDirty(false);
    },
    onError: () => toast.error("Error al crear el documento"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent, category: editCategory, isActive: editIsActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Documento actualizado");
      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-doc", selectedId] });
      setIsDirty(false);
    },
    onError: () => toast.error("Error al guardar el documento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Documento eliminado");
      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      setSelectedId(null);
      setIsCreating(false);
    },
    onError: () => toast.error("Error al eliminar el documento"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-doc", selectedId] });
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim() || !workspaceId) return;
    setIsSearching(true);
    setSearchDone(false);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, query: searchQuery }),
      });
      if (!res.ok) throw new Error();
      setSearchResults(await res.json());
      setSearchDone(true);
    } catch {
      toast.error("Error al buscar");
    } finally {
      setIsSearching(false);
    }
  };

  const canSave = editTitle.trim() && editContent.trim();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedDocSummary = docs.find((d) => d.id === selectedId);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)] text-slate-900 dark:text-white overflow-hidden">

      {/* ══ LEFT PANEL ══ */}
      <div className="w-[280px] shrink-0 bg-[#0c0c0c] border-r border-[#ffffff10] flex flex-col">
        <div className="h-12 flex items-center justify-between px-4 border-b border-[#ffffff0d] shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-whatsapp" />
            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Base de Conocimiento</span>
          </div>
          <Button
            onClick={handleNewDoc}
            className="h-6 w-6 p-0 bg-whatsapp hover:bg-whatsappHover text-black rounded-sm"
            title="Nuevo documento"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search button */}
        <div className="px-3 py-2 border-b border-[#ffffff08]">
          <button
            onClick={() => { setSearchOpen(true); setSearchQuery(""); setSearchResults([]); setSearchDone(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[#ffffff10] rounded-md text-xs text-gray-500 hover:border-[#ffffff20] hover:text-slate-600 dark:text-gray-300 transition-all"
          >
            <Search className="h-3.5 w-3.5" />
            Probar búsqueda semántica...
          </button>
        </div>

        {/* Doc list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-600 text-xs animate-pulse">
              Cargando documentos...
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
              <FileText className="h-8 w-8 text-gray-700" />
              <p className="text-xs text-gray-600">Sin documentos. Crea el primero.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#ffffff06]">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => { setSelectedId(doc.id); setIsCreating(false); setIsDirty(false); }}
                  className={`px-3 py-3 cursor-pointer transition-all flex flex-col gap-1.5 group ${
                    selectedId === doc.id
                      ? "bg-[#ffffff0c] border-l-2 border-whatsapp"
                      : "hover:bg-[#ffffff06] border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-tight flex-1">
                      {doc.title}
                    </span>
                    <ChevronRight className="h-3 w-3 text-gray-600 shrink-0 mt-0.5 group-hover:text-slate-500 dark:text-gray-400" />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`text-[9px] font-bold px-1.5 py-0 rounded-sm border ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS["General"]}`}>
                      {doc.category}
                    </Badge>
                    <Switch
                      checked={doc.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: doc.id, isActive: v })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-6 data-[state=checked]:bg-whatsapp"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600">{doc.chunkCount} chunks</span>
                    <div className="flex items-center gap-1">
                      {doc.hasEmbeddings ? (
                        <span className="flex items-center gap-1 text-[9px] text-green-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          embeddings
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] text-gray-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                          sin embed.
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[9px] text-gray-600">
                    {formatDistanceToNow(parseISO(doc.createdAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedId && !isCreating ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="h-14 w-14 rounded-md bg-[var(--bg-secondary)] border border-[#ffffff0d] flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Selecciona un documento</h2>
              <p className="text-xs text-gray-500 mt-1.5">Elige un documento de la lista o crea uno nuevo.</p>
            </div>
            <Button
              onClick={handleNewDoc}
              className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-8 text-xs px-4 rounded-md flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo documento
            </Button>
          </div>
        ) : (
          <>
            {/* Editor toolbar */}
            <div className="h-12 border-b border-[#ffffff0d] flex items-center justify-between px-5 shrink-0 bg-[#0c0c0c]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[300px]">
                  {isCreating ? "Nuevo documento" : (selectedDocSummary?.title || "Editar documento")}
                </span>
                {isDirty && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded-sm">
                    SIN GUARDAR
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isCreating && selectedId && (
                  <Button
                    variant="ghost"
                    onClick={() => { if (confirm("¿Eliminar este documento?")) deleteMutation.mutate(); }}
                    disabled={deleteMutation.isPending}
                    className="h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs rounded-md flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
                <Button
                  onClick={() => isCreating ? createMutation.mutate() : updateMutation.mutate()}
                  disabled={isPending || !canSave}
                  className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-7 text-xs px-4 rounded-md flex items-center gap-1.5"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              <div className="max-w-3xl space-y-5">

                {/* Templates */}
                {isCreating && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> Plantillas
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.label}
                          onClick={() => applyTemplate(tpl)}
                          className="text-[10px] px-2.5 py-1.5 rounded border border-[#ffffff12] bg-[var(--bg-secondary)] text-slate-500 dark:text-gray-400 hover:border-whatsapp/40 hover:text-whatsapp hover:bg-whatsapp/5 transition-all"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Título del documento
                  </Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); markDirty(); }}
                    placeholder="Ej. Preguntas frecuentes sobre precios"
                    className="bg-[var(--bg-secondary)] border-[#ffffff12] text-slate-900 dark:text-white text-sm font-semibold focus-visible:ring-whatsapp h-10"
                  />
                </div>

                {/* Category + isActive + Upload row */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Categoría</Label>
                    <select
                      value={editCategory}
                      onChange={(e) => { setEditCategory(e.target.value); markDirty(); }}
                      className="w-full h-9 bg-[var(--bg-secondary)] border border-[#ffffff12] text-slate-900 dark:text-white text-sm rounded-md px-3 focus:ring-1 focus:ring-whatsapp outline-none cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-[var(--bg-secondary)]">{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subir archivo</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 border border-[#ffffff12] bg-[var(--bg-secondary)] rounded-md hover:border-white/20 hover:text-slate-900 dark:text-white transition-all"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      .txt / .md
                    </button>
                  </div>

                  {!isCreating && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Activo</Label>
                      <div className="h-9 flex items-center">
                        <Switch
                          checked={editIsActive}
                          onCheckedChange={(v) => { setEditIsActive(v); markDirty(); }}
                          className="data-[state=checked]:bg-whatsapp"
                        />
                        <span className="ml-2 text-xs text-slate-500 dark:text-gray-400">{editIsActive ? "Activo" : "Inactivo"}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contenido</Label>
                    <span className="text-[9px] text-gray-600">
                      {editContent.length} chars · separar párrafos con línea en blanco
                    </span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => { setEditContent(e.target.value); markDirty(); }}
                    placeholder={
                      "Escribe el contenido aquí...\n\nUsa líneas en blanco para separar párrafos (cada uno se convierte en un chunk).\n\nEjemplo:\nNuestros precios comienzan desde $99/mes.\n\nEl plan profesional incluye soporte prioritario."
                    }
                    rows={16}
                    className="w-full bg-[var(--bg-secondary)] border border-[#ffffff12] text-gray-200 rounded-md text-sm p-4 font-mono leading-relaxed focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none resize-none scrollbar-thin"
                  />
                </div>

                {/* Chunk preview strip */}
                {!isCreating && selectedDoc?.chunks?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Zap className="h-3 w-3" />
                      Chunks generados ({selectedDoc.chunks.length})
                    </Label>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin pr-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {selectedDoc.chunks.map((chunk: any, i: number) => (
                        <div
                          key={chunk.id}
                          className="bg-[#0d0d0d] border border-[#ffffff08] rounded-md p-3 flex items-start gap-2"
                        >
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <span className="text-[9px] text-gray-700 font-bold">#{i + 1}</span>
                            {chunk.hasEmbedding ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="Con embedding" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-600" title="Sin embedding" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 font-mono leading-relaxed line-clamp-2 flex-1">
                            {chunk.content.slice(0, 100)}{chunk.content.length > 100 ? "…" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══ SEARCH DIALOG ══ */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-[var(--bg-secondary)] border border-[#ffffff10] text-slate-900 dark:text-white rounded-md max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Search className="h-4 w-4 text-whatsapp" />
              Probar búsqueda semántica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Escribe una consulta..."
                className="bg-[var(--bg-card)] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp flex-1"
                autoFocus
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-9 px-4 rounded-md text-sm"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                    searchResults[0]?.searchType === "vector"
                      ? "bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20"
                      : "bg-slate-50 dark:bg-white/5 text-gray-500 border-[var(--border-color)]"
                  }`}>
                    {searchResults[0]?.searchType === "vector" ? "🔮 Vector search" : "📝 Text search"}
                  </span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {searchResults.map((result) => (
                    <div
                      key={result.chunkId}
                      className="bg-[var(--bg-card)] border border-[#ffffff08] rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{result.documentTitle}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`text-[9px] font-bold px-1.5 py-0 rounded-sm border ${CATEGORY_COLORS[result.category] ?? CATEGORY_COLORS["General"]}`}>
                            {result.category}
                          </Badge>
                          <SimilarityBadge score={result.score} />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed font-mono line-clamp-3">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchDone && searchResults.length === 0 && !isSearching && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <X className="h-5 w-5 text-gray-600" />
                <span className="text-xs text-gray-500">Sin resultados para &ldquo;{searchQuery}&rdquo;</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
