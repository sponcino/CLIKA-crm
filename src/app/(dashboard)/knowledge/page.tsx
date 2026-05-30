"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  ChevronRight, Loader2, X,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIES = [
  "General",
  "Productos",
  "Servicios",
  "Precios",
  "FAQ",
  "Políticas",
  "Casos de uso",
  "Objeciones",
];

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-gray-800 text-gray-300 border-gray-700",
  Productos: "bg-blue-950/60 text-blue-400 border-blue-800/40",
  Servicios: "bg-indigo-950/60 text-indigo-400 border-indigo-800/40",
  Precios: "bg-amber-950/60 text-amber-400 border-amber-800/40",
  FAQ: "bg-green-950/60 text-green-400 border-green-800/40",
  Políticas: "bg-red-950/60 text-red-400 border-red-700/40",
  "Casos de uso": "bg-purple-950/60 text-purple-400 border-purple-800/40",
  Objeciones: "bg-orange-950/60 text-orange-400 border-orange-800/40",
};

interface DocSummary {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  chunkCount: number;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  content: string;
  score: number;
}

export default function KnowledgePage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;
  const queryClient = useQueryClient();

  // Panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Editor form state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [editIsActive, setEditIsActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Search dialog
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch documents list
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

  // Fetch selected document detail
  const { data: selectedDoc } = useQuery({
    queryKey: ["knowledge-doc", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedId,
  });

  // Sync editor when doc loads
  useEffect(() => {
    if (selectedDoc) {
      setEditTitle(selectedDoc.title);
      setEditContent(selectedDoc.content || "");
      setEditCategory(selectedDoc.category || "General");
      setEditIsActive(selectedDoc.isActive);
      setIsDirty(false);
    }
  }, [selectedDoc]);

  const handleNewDoc = () => {
    setSelectedId(null);
    setIsCreating(true);
    setEditTitle("");
    setEditContent("");
    setEditCategory("General");
    setEditIsActive(true);
    setIsDirty(false);
  };

  const handleSelectDoc = (id: string) => {
    setSelectedId(id);
    setIsCreating(false);
    setIsDirty(false);
  };

  // Mutation: Create
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: editTitle,
          content: editContent,
          category: editCategory,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: (doc) => {
      toast.success("Documento creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      setIsCreating(false);
      setSelectedId(doc.id);
      setIsDirty(false);
    },
    onError: () => toast.error("Error al crear el documento"),
  });

  // Mutation: Update
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          category: editCategory,
          isActive: editIsActive,
        }),
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

  // Mutation: Delete
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

  // Mutation: Toggle isActive from list
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
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
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, query: searchQuery }),
      });
      if (!res.ok) throw new Error();
      setSearchResults(await res.json());
    } catch {
      toast.error("Error al buscar");
    } finally {
      setIsSearching(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  const canSave = editTitle.trim() && editContent.trim();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const selectedDocSummary = docs.find((d) => d.id === selectedId);

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* LEFT PANEL: Document List */}
      <div className="w-[280px] shrink-0 bg-[#0c0c0c] border-r border-[#ffffff10] flex flex-col">
        {/* Panel Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-[#ffffff0d] shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-whatsapp" />
            <span className="text-sm font-bold text-white tracking-tight">Base de Conocimiento</span>
          </div>
          <Button
            id="btn-new-doc"
            onClick={handleNewDoc}
            className="h-6 w-6 p-0 bg-whatsapp hover:bg-whatsappHover text-black rounded-sm"
            title="Nuevo documento"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 border-b border-[#ffffff08]">
          <button
            id="btn-open-search"
            onClick={() => { setSearchOpen(true); setSearchQuery(""); setSearchResults([]); }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#ffffff10] rounded-md text-xs text-gray-500 hover:border-[#ffffff20] hover:text-gray-300 transition-all duration-150"
          >
            <Search className="h-3.5 w-3.5" />
            Probar búsqueda...
          </button>
        </div>

        {/* Documents List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-600 animate-pulse text-xs">
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
                  onClick={() => handleSelectDoc(doc.id)}
                  className={`px-3 py-3 cursor-pointer transition-all duration-150 flex flex-col gap-2 group ${
                    selectedId === doc.id
                      ? "bg-[#ffffff0c] border-l-2 border-whatsapp"
                      : "hover:bg-[#ffffff06] border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate leading-tight flex-1">
                      {doc.title}
                    </span>
                    <ChevronRight className="h-3 w-3 text-gray-600 shrink-0 mt-0.5 group-hover:text-gray-400 transition-colors" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={`text-[9px] font-bold px-1.5 py-0 rounded-sm border ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS["General"]}`}
                    >
                      {doc.category}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-600">{doc.chunkCount} chunks</span>
                      <Switch
                        id={`toggle-${doc.id}`}
                        checked={doc.isActive}
                        onCheckedChange={(v) => {
                          toggleMutation.mutate({ id: doc.id, isActive: v });
                          // Optimistic update handled by invalidate
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-6 data-[state=checked]:bg-whatsapp"
                      />
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

      {/* RIGHT PANEL: Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedId && !isCreating ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="h-14 w-14 rounded-md bg-[#111111] border border-[#ffffff0d] flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Selecciona un documento</h2>
              <p className="text-xs text-gray-500 mt-1.5">
                Elige un documento de la lista o crea uno nuevo.
              </p>
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
            {/* Editor Toolbar */}
            <div className="h-12 border-b border-[#ffffff0d] flex items-center justify-between px-5 shrink-0 bg-[#0c0c0c]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-white truncate max-w-[300px]">
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
                    id="btn-delete-doc"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("¿Eliminar este documento y todos sus chunks?")) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs rounded-md flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
                <Button
                  id="btn-save-doc"
                  onClick={() => (isCreating ? createMutation.mutate() : updateMutation.mutate())}
                  disabled={isPending || !canSave}
                  className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-7 text-xs px-4 rounded-md flex items-center gap-1.5"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              <div className="max-w-3xl space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Título del documento
                  </Label>
                  <Input
                    id="input-doc-title"
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); markDirty(); }}
                    placeholder="Ej. Preguntas frecuentes sobre precios"
                    className="bg-[#111111] border-[#ffffff12] text-white text-sm font-semibold focus-visible:ring-whatsapp h-10"
                  />
                </div>

                {/* Category + isActive Row */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Categoría
                    </Label>
                    <select
                      id="select-doc-category"
                      value={editCategory}
                      onChange={(e) => { setEditCategory(e.target.value); markDirty(); }}
                      className="w-full h-9 bg-[#111111] border border-[#ffffff12] text-white text-sm rounded-md px-3 focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-[#111111]">{c}</option>
                      ))}
                    </select>
                  </div>

                  {!isCreating && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Activo
                      </Label>
                      <div className="h-9 flex items-center">
                        <Switch
                          id="switch-doc-active"
                          checked={editIsActive}
                          onCheckedChange={(v) => { setEditIsActive(v); markDirty(); }}
                          className="data-[state=checked]:bg-whatsapp"
                        />
                        <span className="ml-2 text-xs text-gray-400">
                          {editIsActive ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Contenido
                    </Label>
                    <span className="text-[9px] text-gray-600">
                      {editContent.length} caracteres · separar párrafos con línea en blanco
                    </span>
                  </div>
                  <textarea
                    id="textarea-doc-content"
                    value={editContent}
                    onChange={(e) => { setEditContent(e.target.value); markDirty(); }}
                    placeholder={`Escribe el contenido del documento aquí...\n\nUsa líneas en blanco para separar párrafos (cada párrafo se convierte en un chunk separado).\n\nEjemplo:\nNuestros precios comienzan desde $99/mes para el plan básico.\n\nEl plan profesional incluye soporte prioritario y hasta 10 usuarios.`}
                    rows={18}
                    className="w-full bg-[#111111] border border-[#ffffff12] text-gray-200 rounded-md text-sm p-4 font-mono leading-relaxed focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none resize-none scrollbar-thin"
                  />
                </div>

                {/* Chunk preview (edit mode only) */}
                {!isCreating && selectedDoc?.chunks?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Chunks generados ({selectedDoc.chunks.length})
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                      {selectedDoc.chunks.map((chunk: { id: string; content: string }, i: number) => (
                        <div
                          key={chunk.id}
                          className="bg-[#0d0d0d] border border-[#ffffff08] rounded-md p-3 text-xs text-gray-400 font-mono leading-relaxed"
                        >
                          <span className="text-[9px] text-gray-700 font-bold block mb-1">CHUNK {i + 1}</span>
                          {chunk.content}
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

      {/* SEARCH DIALOG */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-[#111111] border border-[#ffffff10] text-white rounded-md max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Search className="h-4 w-4 text-whatsapp" />
              Probar búsqueda semántica
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                id="input-search-query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Escribe una consulta..."
                className="bg-[#1a1a1a] border-[#ffffff15] text-white focus-visible:ring-whatsapp flex-1"
                autoFocus
              />
              <Button
                id="btn-run-search"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-9 px-4 rounded-md text-sm"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">
                  {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {searchResults.map((result) => (
                    <div
                      key={result.chunkId}
                      className="bg-[#1a1a1a] border border-[#ffffff08] rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">{result.documentTitle}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[9px] font-bold px-1.5 py-0 rounded-sm border ${CATEGORY_COLORS[result.category] || CATEGORY_COLORS["General"]}`}>
                            {result.category}
                          </Badge>
                          <span className="text-[9px] text-gray-600 font-mono">score:{result.score}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed font-mono line-clamp-3">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.length === 0 && !isSearching && searchQuery && (
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
