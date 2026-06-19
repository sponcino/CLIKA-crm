"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Key, Plus, Trash2, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((data) => {
        setKeys(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCreatedKey(data.fullKey);
      load();
    } catch {
      toast.error("Error al generar la API Key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("API Key revocada");
      load();
    } catch {
      toast.error("Error al revocar la API Key");
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDialogOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setNewName("");
      setCreatedKey(null);
      setCopied(false);
    }
  }

  const activeKeys = keys.filter((k) => k.isActive);
  const revokedKeys = keys.filter((k) => !k.isActive);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-white/50" />
            API Keys
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Usadas para integrar servicios externos como n8n. Autenticá con{" "}
            <code className="text-white/60 bg-slate-50 dark:bg-white/5 px-1 rounded text-xs">X-API-Key</code>.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger>
            <Button size="sm" className="bg-white text-black hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1" />
              Nueva API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-white">Generar nueva API Key</DialogTitle>
            </DialogHeader>

            {!createdKey ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Nombre</Label>
                  <Input
                    placeholder="ej: n8n Production"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-white/30 focus:border-white/30"
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-40"
                >
                  {creating ? "Generando..." : "Generar Key"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-300">
                    Guardá esta clave ahora. No se mostrará de nuevo.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Tu API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={createdKey}
                      className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-white/80 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(createdKey)}
                      className="shrink-0 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() => handleDialogOpenChange(false)}
                  className="w-full bg-white/10 hover:bg-white/20 text-slate-900 dark:text-white"
                >
                  Listo, ya la guardé
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-white/30 text-sm">Cargando...</div>
      ) : activeKeys.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/[0.02] p-8 text-center">
          <Key className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No hay API Keys activas</p>
          <p className="text-white/25 text-xs mt-1">
            Generá una para conectar n8n u otros servicios externos
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 dark:border-white/10 hover:bg-transparent">
                <TableHead className="text-white/40 font-normal">Nombre</TableHead>
                <TableHead className="text-white/40 font-normal">Prefijo</TableHead>
                <TableHead className="text-white/40 font-normal">Último uso</TableHead>
                <TableHead className="text-white/40 font-normal">Estado</TableHead>
                <TableHead className="text-white/40 font-normal w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeKeys.map((k) => (
                <TableRow key={k.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-slate-900 dark:text-white text-sm font-medium">{k.name}</TableCell>
                  <TableCell>
                    <code className="text-white/60 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded text-xs font-mono">
                      {k.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell className="text-white/40 text-sm">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">
                      Activa
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(k.id)}
                      className="h-7 w-7 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 select-none">
            {revokedKeys.length} key{revokedKeys.length !== 1 ? "s" : ""} revocada
            {revokedKeys.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-3 rounded-xl border border-white/5 overflow-hidden opacity-50">
            <Table>
              <TableBody>
                {revokedKeys.map((k) => (
                  <TableRow key={k.id} className="border-white/5 hover:bg-transparent">
                    <TableCell className="text-white/30 text-sm line-through">{k.name}</TableCell>
                    <TableCell>
                      <code className="text-white/20 text-xs font-mono">{k.keyPrefix}...</code>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-50 dark:bg-white/5 text-white/30 border-slate-200 dark:border-white/10 text-xs">
                        Revocada
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/[0.02] p-4 space-y-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Cómo usar</p>
        <p className="text-sm text-white/40">
          Agregá el header <code className="text-white/60 bg-slate-50 dark:bg-white/5 px-1 rounded">X-API-Key: &lt;tu-key&gt;</code> en tus requests.
        </p>
        <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-white/50 space-y-1">
          <p className="text-white/30"># Enviar mensaje desde n8n / HTTP Request</p>
          <p>
            <span className="text-emerald-400">POST</span>{" "}
            <span className="text-white/60">/api/external/send</span>
          </p>
          <p className="text-white/40">
            {`{ "to": "5491112345678", "message": "Hola!" }`}
          </p>
        </div>
      </div>
    </div>
  );
}
