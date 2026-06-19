"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MessageSquare, Trash2, Edit2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

export default function QuickRepliesSettingsPage() {
  const { data: session } = useSession();
  const workspaceId = (session?.user as any)?.workspaceId;
  
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReplies = () => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/quick-replies?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => setReplies(data))
      .catch(() => toast.error("Error al cargar respuestas rápidas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReplies();
  }, [workspaceId]);

  const handleOpenNew = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsOpen(true);
  };

  const handleOpenEdit = (reply: QuickReply) => {
    setEditingId(reply.id);
    setTitle(reply.title);
    setContent(reply.content);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("El título y el contenido son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingId;
      const url = isEdit ? `/api/quick-replies/${editingId}` : `/api/quick-replies`;
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit ? { title, content } : { workspaceId, title, content };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success(isEdit ? "Respuesta actualizada" : "Respuesta creada");
      setIsOpen(false);
      fetchReplies();
    } catch (error) {
      toast.error("Ocurrió un error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta respuesta rápida?")) return;
    
    try {
      const res = await fetch(`/api/quick-replies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Respuesta eliminada");
      fetchReplies();
    } catch (error) {
      toast.error("Ocurrió un error al eliminar");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Respuestas Rápidas</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Crea atajos para mensajes comunes. Escribe "/" en el chat para usarlos.
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenNew}
          className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold h-8 text-xs px-3 rounded-md flex items-center gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Respuesta
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-[#0a0a0a]">
            <TableRow className="hover:bg-slate-50 dark:bg-[#0a0a0a] border-b border-[#ffffff10]">
              <TableHead className="text-gray-500 font-semibold h-10 text-xs w-[30%]">Atajo / Título</TableHead>
              <TableHead className="text-gray-500 font-semibold h-10 text-xs w-[60%]">Contenido</TableHead>
              <TableHead className="text-gray-500 font-semibold h-10 text-xs text-right w-[10%]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={3} className="text-center h-24 text-gray-600 animate-pulse">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : replies.length === 0 ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={3} className="text-center h-24 text-gray-600 text-sm italic">
                  No hay respuestas rápidas configuradas.
                </TableCell>
              </TableRow>
            ) : (
              replies.map((reply) => (
                <TableRow
                  key={reply.id}
                  className="border-b border-[#ffffff05] hover:bg-[#ffffff04] transition-colors"
                >
                  <TableCell className="py-3">
                    <span className="text-sm font-semibold text-whatsapp bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90/10 px-2 py-0.5 rounded-md">
                      /{reply.title}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-slate-500 dark:text-gray-400 text-xs truncate max-w-xs">
                    {reply.content}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(reply)}
                        className="h-7 w-7 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(reply.id)}
                        className="h-7 w-7 text-slate-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-md max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {editingId ? "Editar Respuesta" : "Nueva Respuesta"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-gray-400 font-medium">Título (Atajo sin /)</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                placeholder="ejemplo-saludo"
                className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-gray-400 font-medium">Mensaje</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¡Hola! ¿En qué podemos ayudarte?"
                className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm h-24 resize-none focus-visible:ring-whatsapp"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 h-8 text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !title.trim() || !content.trim()} 
              className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold h-8 text-xs px-4"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
