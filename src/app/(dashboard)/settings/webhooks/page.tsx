"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Webhook, Plus, Trash2, Pencil, Activity, Check,
  Loader2, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  event: string;
  events: string[];
  enabled: boolean;
  secret: string | null;
  lastStatus: number | null;
  lastCalledAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface TestResult {
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

// ─── Event groups ─────────────────────────────────────────────────────────────
const EVENT_GROUPS = [
  {
    icon: "📨",
    label: "Mensajes",
    events: ["message.received", "message.sent"],
  },
  {
    icon: "👥",
    label: "Contactos & Leads",
    events: [
      "contact.created",
      "contact.updated",
      "lead.status_changed",
      "bot.disabled",
      "bot.enabled",
    ],
  },
  {
    icon: "📅",
    label: "Agenda",
    events: [
      "appointment.created",
      "appointment.rescheduled",
      "appointment.cancelled",
    ],
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveEvents(wh: WebhookRecord): string[] {
  return wh.events?.length ? wh.events : wh.event ? [wh.event] : [];
}

function StatusCode({ code }: { code: number | null }) {
  if (!code) return <span className="text-gray-600 text-xs">—</span>;
  const ok = code >= 200 && code < 300;
  return (
    <span className={`text-[11px] font-mono font-semibold ${ok ? "text-green-400" : "text-red-400"}`}>
      {code}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[#25D366]" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function EventCheckbox({
  event, checked, onChange,
}: { event: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      onClick={onChange}
      className="flex items-center gap-2 cursor-pointer group select-none"
    >
      <span
        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${
          checked
            ? "bg-[#25D366] border-[#25D366]"
            : "border-white/25 bg-transparent group-hover:border-white/40"
        }`}
      >
        {checked && <Check className="h-2.5 w-2.5 text-black" />}
      </span>
      <span className="text-xs text-white/60 font-mono group-hover:text-white/80 transition-colors">
        {event}
      </span>
    </label>
  );
}

// ─── Event pills (table display) ──────────────────────────────────────────────
function EventPills({ events }: { events: string[] }) {
  const MAX = 2;
  const visible = events.slice(0, MAX);
  const rest = events.length - MAX;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((ev) => (
        <span
          key={ev}
          className="inline-block text-[9px] font-mono bg-slate-50 dark:bg-white/5 border border-[var(--border-color)] text-white/50 px-1.5 py-0.5 rounded"
        >
          {ev}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-block text-[9px] bg-slate-50 dark:bg-white/5 border border-[var(--border-color)] text-white/40 px-1.5 py-0.5 rounded">
          +{rest}
        </span>
      )}
    </div>
  );
}

// ─── Empty form state ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "",
  url: "",
  secret: "",
  events: [] as string[],
  enabled: true,
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // Form state (controlled, no react-hook-form)
  const [form, setForm] = useState(EMPTY_FORM);
  const setField = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleEvent = (ev: string) =>
    setField(
      "events",
      form.events.includes(ev)
        ? form.events.filter((e) => e !== ev)
        : [...form.events, ev]
    );

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((data) => {
        setWebhooks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (wh: WebhookRecord) => {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      url: wh.url,
      secret: wh.secret ?? "",
      events: resolveEvents(wh),
      enabled: wh.enabled,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.url.trim()) { toast.error("La URL es requerida"); return; }
    if (form.events.length === 0) { toast.error("Selecciona al menos un evento"); return; }

    let url = "";
    try { url = new URL(form.url).toString(); }
    catch { toast.error("URL inválida"); return; }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        url,
        secret: form.secret.trim() || undefined,
        events: form.events,
        enabled: form.enabled,
      };

      const res = await fetch(
        editingId ? `/api/webhooks/${editingId}` : "/api/webhooks",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) throw new Error();
      toast.success(editingId ? "Webhook actualizado" : "Webhook creado");
      closeModal();
      load();
    } catch {
      toast.error("Error al guardar el webhook");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle enabled ────────────────────────────────────────────────────────────
  const toggleEnabled = async (wh: WebhookRecord) => {
    const res = await fetch(`/api/webhooks/${wh.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !wh.enabled }),
    });
    if (res.ok) {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === wh.id ? { ...w, enabled: !wh.enabled } : w))
      );
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este webhook?")) return;
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      toast.success("Webhook eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  // ── Test ─────────────────────────────────────────────────────────────────────
  const handleTest = async (wh: WebhookRecord) => {
    setTesting((p) => ({ ...p, [wh.id]: true }));
    try {
      const res = await fetch(`/api/webhooks/${wh.id}/test`, { method: "POST" });
      const data: TestResult = await res.json();
      setTestResults((p) => ({ ...p, [wh.id]: data }));
      // Refresh lastStatus in list
      load();
    } catch {
      setTestResults((p) => ({ ...p, [wh.id]: { ok: false, status: 0, ms: 0, error: "fetch failed" } }));
    } finally {
      setTesting((p) => ({ ...p, [wh.id]: false }));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Webhook className="h-5 w-5 text-[#25D366]" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Webhooks</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Conecta CLIKA con n8n, Make, Zapier u otros servicios. Los eventos se envían como POST con firma HMAC.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="h-8 px-3 text-xs bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo Webhook
        </Button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md overflow-hidden">

        {/* Table header */}
        <div className="grid grid-cols-[1fr_1.4fr_160px_80px_120px_96px] gap-0 border-b border-[#ffffff08] px-4 py-2.5">
          {["NOMBRE", "URL", "EVENTOS", "ESTADO", "ÚLTIMO ENVÍO", "ACCIONES"].map((h) => (
            <span key={h} className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              {h}
            </span>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Webhook className="h-9 w-9 mx-auto text-white/10" />
            <div>
              <p className="text-sm text-gray-500 font-medium">No hay webhooks configurados</p>
              <p className="text-xs text-gray-700 mt-0.5">
                Conecta CLIKA con n8n, Make, Zapier u otros servicios
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 text-xs text-[#25D366] hover:opacity-80 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear primer webhook
            </button>
          </div>
        ) : (
          <div>
            {webhooks.map((wh, idx) => {
              const events = resolveEvents(wh);
              const result = testResults[wh.id];
              const isTesting = testing[wh.id];

              return (
                <div key={wh.id}>
                  {/* Main row */}
                  <div
                    className={`grid grid-cols-[1fr_1.4fr_160px_80px_120px_96px] gap-0 px-4 py-3 items-center border-b border-[#ffffff05] hover:bg-[#ffffff06] transition-colors ${
                      idx % 2 === 1 ? "bg-[#ffffff02]" : ""
                    }`}
                  >
                    {/* Nombre */}
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{wh.name}</p>
                    </div>

                    {/* URL */}
                    <div className="min-w-0 pr-3">
                      <p
                        className="text-[11px] font-mono text-gray-500 truncate"
                        title={wh.url}
                      >
                        {wh.url}
                      </p>
                    </div>

                    {/* Eventos */}
                    <div className="pr-3">
                      <EventPills events={events} />
                    </div>

                    {/* Estado */}
                    <div>
                      <Toggle checked={wh.enabled} onChange={() => toggleEnabled(wh)} />
                    </div>

                    {/* Último envío */}
                    <div className="pr-3 space-y-0.5">
                      {wh.lastCalledAt ? (
                        <>
                          <p className="text-[10px] text-gray-500">
                            {formatDistanceToNow(new Date(wh.lastCalledAt), { addSuffix: true, locale: es })}
                          </p>
                          <StatusCode code={wh.lastStatus} />
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-700 italic">Nunca</span>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleTest(wh)}
                        disabled={isTesting}
                        title="Probar webhook"
                        className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-[#25D366] hover:bg-[#25D366]/10 transition-all disabled:opacity-40"
                      >
                        {isTesting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Activity className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => openEdit(wh)}
                        title="Editar webhook"
                        className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        title="Eliminar webhook"
                        className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Inline test result */}
                  {result && (
                    <div className="px-4 pb-2 pt-1 border-b border-[#ffffff05]">
                      <div
                        className={`inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded ${
                          result.ok
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {result.ok ? (
                          <>
                            <Check className="h-3 w-3" />
                            {result.status} OK — respondió en {result.ms}ms
                          </>
                        ) : (
                          <>
                            <span>✗</span>
                            {result.status > 0 ? `${result.status}` : "0"} —{" "}
                            {result.error ?? "error desconocido"}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Payload reference ── */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md p-4 space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Referencia del Payload</p>
        <p className="text-xs text-gray-500">
          Todos los eventos se envían como <span className="text-white/60 font-mono">POST</span> con{" "}
          <span className="text-white/60 font-mono">Content-Type: application/json</span> y los headers:
        </p>
        <div className="bg-black/40 rounded p-3 font-mono text-[11px] text-white/40 space-y-1">
          <p><span className="text-white/60">X-CLIKA-Event</span>: message.received</p>
          <p><span className="text-white/60">X-CLIKA-Signature</span>: sha256=... <span className="text-white/25">(si tiene secret)</span></p>
        </div>
        <a
          href="https://developers.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-[#25D366] hover:opacity-80"
        >
          Documentación <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* ══ Modal ══ */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="bg-white dark:bg-[#111111] border-slate-200 dark:border-[#ffffff15] text-slate-900 dark:text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white font-bold text-base">
              {editingId ? "Editar Webhook" : "Nuevo Webhook"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">

            {/* Nombre */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ej: Zapier, Mi CRM, HubSpot"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20"
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                URL del Webhook <span className="text-[#25D366]">*</span>
              </Label>
              <Input
                value={form.url}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20 font-mono"
              />
              <p className="text-[10px] text-white/25">URL donde enviaremos los eventos (POST)</p>
            </div>

            {/* Secret */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium">Secret opcional</Label>
              <Input
                value={form.secret}
                onChange={(e) => setField("secret", e.target.value)}
                placeholder="tu-secret-key"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20 font-mono"
              />
              <p className="text-[10px] text-white/25">
                Para verificar la firma HMAC-SHA256 de los requests
              </p>
            </div>

            {/* Events */}
            <div className="space-y-3">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                Eventos a recibir <span className="text-[#25D366]">*</span>
              </Label>

              <div className="space-y-4 rounded-md border border-white/8 p-4 bg-white/[0.02]">
                {EVENT_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <span>{group.icon}</span>
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.events.map((ev) => (
                        <EventCheckbox
                          key={ev}
                          event={ev}
                          checked={form.events.includes(ev)}
                          onChange={() => toggleEvent(ev)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {form.events.length === 0 && (
                <p className="text-[10px] text-amber-400/70">Selecciona al menos un evento</p>
              )}
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between py-3 border-t border-white/8">
              <div>
                <p className="text-sm text-slate-900 dark:text-white font-medium">Webhook activo</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Desactívalo para pausar sin eliminar
                </p>
              </div>
              <Toggle checked={form.enabled} onChange={(v) => setField("enabled", v)} />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={closeModal}
                className="flex-1 border-[var(--border-color)] bg-transparent text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || form.events.length === 0 || !form.name.trim() || !form.url.trim()}
                className="flex-1 bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold disabled:opacity-40"
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Guardando...</>
                ) : "Guardar Webhook"}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
