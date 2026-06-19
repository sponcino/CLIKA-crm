"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Save, Building, AlertTriangle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function WorkspaceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  useEffect(() => {
    fetch("/api/settings/workspace")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setId(data.id);
          setName(data.name);
          setCreatedAt(data.createdAt);
        }
      })
      .catch(() => toast.error("Error al cargar configuración del workspace"))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success("ID del workspace copiado al portapapeles");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
      }
      toast.success("Nombre del workspace actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 animate-pulse text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Workspace</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Administra los detalles y configuración general de tu espacio de trabajo.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md divide-y divide-[#ffffff08]">
        
        {/* Info & Update Form */}
        <div className="p-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="workspaceName">
              Nombre del Workspace
            </Label>
            <Input
              id="workspaceName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi Empresa S.A."
              className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="workspaceId">
              ID del Workspace
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="workspaceId"
                value={id}
                readOnly
                className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 font-mono text-xs h-9 focus-visible:ring-0 select-all"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyId}
                className="h-9 w-9 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Este ID es único y requerido para integraciones API.</p>
          </div>
          
          <div className="space-y-1.5">
             <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium">
              Fecha de creación
            </Label>
            <p className="text-xs text-slate-600 dark:text-gray-300">
               {createdAt ? format(parseISO(createdAt), "d 'de' MMMM, yyyy", { locale: es }) : "—"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 flex items-center justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold h-9 text-xs px-5 rounded-md flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/10 border border-red-900/30 rounded-md p-5 space-y-3">
        <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Zona de Peligro
        </h3>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Eliminar el workspace borrará permanentemente todos los contactos, conversaciones, configuraciones y datos asociados. Esta acción no se puede deshacer.
        </p>
        <Button
          disabled
          variant="destructive"
          className="mt-2 h-9 text-xs opacity-50 cursor-not-allowed bg-red-900 text-slate-900 dark:text-white border-none"
          title="Contactar soporte para eliminar el workspace"
        >
          Eliminar workspace
        </Button>
      </div>

    </div>
  );
}
