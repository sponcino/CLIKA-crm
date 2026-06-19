"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, X, Plus, Trash2 } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────
type Tab = "general" | "mensajes" | "captura" | "ia";

interface CaptureField {
  id: string;
  campo: string;
  descripcion: string;
  requerido: boolean;
}

interface FormState {
  agentName: string;
  agentRole: string;
  agentPersonality: string;
  language: string;
  tone: string;
  companyName: string;
  companyType: string;
  businessContext: string;
  productsServices: string;
  welcomeMessage: string;
  fallbackMessage: string;
  humanEscalationMessage: string;
  transferKeywords: string[];
  captureFields: CaptureField[];
  modelName: string;
  maxTokens: number;
  temperature: number;
  useGlobalApiKey: boolean;
  customApiKey: string;
  systemPrompt: string;
}

const DEFAULT_CAPTURE: CaptureField[] = [
  { id: "1", campo: "nombre",   descripcion: "Nombre completo del contacto", requerido: true },
  { id: "2", campo: "email",    descripcion: "Correo electrónico",            requerido: false },
  { id: "3", campo: "telefono", descripcion: "Número de teléfono",            requerido: false },
];

const EMPTY: FormState = {
  agentName: "",
  agentRole: "",
  agentPersonality: "",
  language: "es",
  tone: "professional",
  companyName: "",
  companyType: "",
  businessContext: "",
  productsServices: "",
  welcomeMessage: "",
  fallbackMessage: "",
  humanEscalationMessage: "",
  transferKeywords: [],
  captureFields: DEFAULT_CAPTURE,
  modelName: "claude-sonnet-4-6",
  maxTokens: 1000,
  temperature: 0.7,
  useGlobalApiKey: true,
  customApiKey: "",
  systemPrompt: "",
};

// ─── style helpers ─────────────────────────────────────────────────────────────
const inputCls =
  "bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20";
const textareaCls =
  "bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20 resize-none";
const selectCls =
  "w-full bg-white dark:bg-[#1a1a1a] border border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-[#25D366] cursor-pointer appearance-none";
const labelCls = "text-xs text-slate-500 dark:text-gray-400 font-medium";
const sectionLabelCls =
  "text-[10px] font-bold text-gray-500 uppercase tracking-widest";

// ─── subcomponents ────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md divide-y divide-[#ffffff08]">
      {children}
    </div>
  );
}

function CardSection({
  label,
  children,
  extra,
}: {
  label: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className={sectionLabelCls}>{label}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={labelCls}>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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

// ─── main page ────────────────────────────────────────────────────────────────
export default function AIAgentSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const savedRef = useRef<FormState>(EMPTY);

  // ── load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/ai-agent")
      .then((r) => r.json())
      .then((data) => {
        const loaded: FormState = {
          agentName:              data.agentName              ?? "",
          agentRole:              data.agentRole              ?? "",
          agentPersonality:       data.agentPersonality       ?? "",
          language:               data.language               ?? "es",
          tone:                   data.tone                   ?? "professional",
          companyName:            data.companyName            ?? "",
          companyType:            data.companyType            ?? "",
          businessContext:        data.businessContext        ?? "",
          productsServices:       data.productsServices       ?? "",
          welcomeMessage:         data.welcomeMessage         ?? "",
          fallbackMessage:        data.fallbackMessage        ?? "",
          humanEscalationMessage: data.humanEscalationMessage ?? "",
          transferKeywords:       data.transferKeywords       ?? [],
          captureFields:          data.captureFields?.length  ? data.captureFields : DEFAULT_CAPTURE,
          modelName:              data.modelName              ?? "claude-sonnet-4-6",
          maxTokens:              data.maxTokens              ?? 1000,
          temperature:            data.temperature            ?? 0.7,
          useGlobalApiKey:        data.useGlobalApiKey        ?? true,
          customApiKey:           "",
          systemPrompt:           data.systemPrompt           ?? "",
        };
        setForm(loaded);
        savedRef.current = loaded;
        setIsDirty(false);
      })
      .catch(() => toast.error("Error al cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  // ── helpers ────────────────────────────────────────────────────────────────
  const set = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((p) => ({ ...p, [field]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleDiscard = () => {
    setForm(savedRef.current);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-agent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      savedRef.current = form;
      setIsDirty(false);
      toast.success("Configuración guardada correctamente");
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  // keyword tags
  const addKeyword = (raw: string) => {
    const kw = raw.trim();
    if (!kw || form.transferKeywords.includes(kw)) return;
    set("transferKeywords", [...form.transferKeywords, kw]);
    setKwInput("");
  };

  const removeKeyword = (kw: string) =>
    set("transferKeywords", form.transferKeywords.filter((k) => k !== kw));

  // capture fields
  const addCaptureField = () => {
    const id = Date.now().toString();
    set("captureFields", [
      ...form.captureFields,
      { id, campo: "", descripcion: "", requerido: false },
    ]);
  };

  const updateCaptureField = (id: string, key: keyof CaptureField, value: string | boolean) =>
    set(
      "captureFields",
      form.captureFields.map((f) => (f.id === id ? { ...f, [key]: value } : f))
    );

  const removeCaptureField = (id: string) =>
    set("captureFields", form.captureFields.filter((f) => f.id !== id));

  // ── tabs ───────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string }[] = [
    { id: "general",  label: "General" },
    { id: "mensajes", label: "Mensajes" },
    { id: "captura",  label: "Captura de Datos" },
    { id: "ia",       label: "Configuración IA" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 text-sm animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Cargando configuración del agente...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[#25D366]" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Agente de IA</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Configura el comportamiento y cerebro de tu asistente virtual.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-1 uppercase tracking-wide">
              Sin guardar
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || saving}
            className="h-8 px-3 text-xs bg-transparent border-[var(--border-color)] text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5 disabled:opacity-30"
          >
            Descartar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3 text-xs bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" />Guardando...</>
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-[#ffffff10]">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-gray-500 hover:text-slate-600 dark:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ Tab 1 — General ══════════ */}
      {tab === "general" && (
        <div className="space-y-6">
          <Card>
            <CardSection label="Identidad del Agente">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre del Agente">
                  <Input
                    value={form.agentName}
                    onChange={(e) => set("agentName", e.target.value)}
                    placeholder="Ej: Sofía"
                    className={inputCls}
                  />
                </Field>
                <Field label="Rol del Agente">
                  <Input
                    value={form.agentRole}
                    onChange={(e) => set("agentRole", e.target.value)}
                    placeholder="Ej: Agente de ventas"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Personalidad">
                <Input
                  value={form.agentPersonality}
                  onChange={(e) => set("agentPersonality", e.target.value)}
                  placeholder="Ej: Amigable, empática, orientada a resultados"
                  className={inputCls}
                />
              </Field>
            </CardSection>
          </Card>

          <Card>
            <CardSection label="Estilo de Comunicación">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Idioma">
                  <select
                    value={form.language}
                    onChange={(e) => set("language", e.target.value)}
                    className={selectCls}
                  >
                    <option value="es" className="bg-white dark:bg-[#1a1a1a]">Español</option>
                    <option value="en" className="bg-white dark:bg-[#1a1a1a]">Inglés</option>
                    <option value="pt" className="bg-white dark:bg-[#1a1a1a]">Portugués</option>
                  </select>
                </Field>
                <Field label="Tono">
                  <select
                    value={form.tone}
                    onChange={(e) => set("tone", e.target.value)}
                    className={selectCls}
                  >
                    <option value="professional" className="bg-white dark:bg-[#1a1a1a]">Profesional y formal</option>
                    <option value="friendly"     className="bg-white dark:bg-[#1a1a1a]">Amigable y cercano</option>
                    <option value="direct"       className="bg-white dark:bg-[#1a1a1a]">Directo y conciso</option>
                    <option value="enthusiastic" className="bg-white dark:bg-[#1a1a1a]">Entusiasta y persuasivo</option>
                  </select>
                </Field>
              </div>
            </CardSection>
          </Card>

          <Card>
            <CardSection label="Información del Negocio">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre de la Empresa">
                  <Input
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    placeholder="Ej: Inmobiliaria Sur"
                    className={inputCls}
                  />
                </Field>
                <Field label="Tipo de Negocio">
                  <select
                    value={form.companyType}
                    onChange={(e) => set("companyType", e.target.value)}
                    className={selectCls}
                  >
                    <option value=""              className="bg-white dark:bg-[#1a1a1a]">Seleccionar...</option>
                    <option value="servicios"     className="bg-white dark:bg-[#1a1a1a]">Servicios Profesionales</option>
                    <option value="inmobiliaria"  className="bg-white dark:bg-[#1a1a1a]">Inmobiliaria</option>
                    <option value="ecommerce"     className="bg-white dark:bg-[#1a1a1a]">E-commerce</option>
                    <option value="salud"         className="bg-white dark:bg-[#1a1a1a]">Salud / Clínica</option>
                    <option value="restaurante"   className="bg-white dark:bg-[#1a1a1a]">Restaurante</option>
                    <option value="educacion"     className="bg-white dark:bg-[#1a1a1a]">Educación</option>
                    <option value="automotriz"    className="bg-white dark:bg-[#1a1a1a]">Automotriz</option>
                    <option value="otro"          className="bg-white dark:bg-[#1a1a1a]">Otro</option>
                  </select>
                </Field>
              </div>

              <Field label="Descripción del Negocio">
                <Textarea
                  value={form.businessContext}
                  onChange={(e) => set("businessContext", e.target.value)}
                  placeholder="Describe tu empresa, qué hace, quiénes son sus clientes..."
                  rows={4}
                  className={textareaCls}
                />
              </Field>

              <Field label="Productos / Servicios">
                <Textarea
                  value={form.productsServices}
                  onChange={(e) => set("productsServices", e.target.value)}
                  placeholder="Lista tus productos o servicios, precios, beneficios clave..."
                  rows={4}
                  className={textareaCls}
                />
              </Field>
            </CardSection>
          </Card>
        </div>
      )}

      {/* ══════════ Tab 2 — Mensajes ══════════ */}
      {tab === "mensajes" && (
        <div className="space-y-6">
          <Card>
            <CardSection label="Mensajes Predefinidos">
              <Field label="Mensaje de Bienvenida">
                <Textarea
                  value={form.welcomeMessage}
                  onChange={(e) => set("welcomeMessage", e.target.value)}
                  placeholder="¡Hola! Soy Sofía, ¿en qué puedo ayudarte hoy?"
                  rows={3}
                  className={textareaCls}
                />
              </Field>
              <Field label="Mensaje cuando no entiende">
                <Textarea
                  value={form.fallbackMessage}
                  onChange={(e) => set("fallbackMessage", e.target.value)}
                  placeholder="Disculpá, no entendí bien. ¿Podés reformularlo?"
                  rows={3}
                  className={textareaCls}
                />
              </Field>
              <Field label="Mensaje al escalar a humano">
                <Textarea
                  value={form.humanEscalationMessage}
                  onChange={(e) => set("humanEscalationMessage", e.target.value)}
                  placeholder="Te voy a comunicar con uno de nuestros asesores. ¡Ya te atienden!"
                  rows={3}
                  className={textareaCls}
                />
              </Field>
            </CardSection>
          </Card>

          <Card>
            <CardSection label="Intervención Humana">
              <Field label="Palabras Clave de Transferencia">
                {/* Tag pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.transferKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 bg-slate-50 dark:bg-white/5 border border-[var(--border-color)] text-white/70 text-xs px-2 py-0.5 rounded-full"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-slate-900 dark:text-white transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addKeyword(kwInput); }
                      if (e.key === ",")     { e.preventDefault(); addKeyword(kwInput); }
                    }}
                    placeholder="Escribe y presiona Enter..."
                    className={inputCls}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addKeyword(kwInput)}
                    className="h-9 px-3 bg-transparent border-[var(--border-color)] text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  El agente transferirá al humano si detecta estas palabras en el mensaje del contacto.
                </p>
              </Field>
            </CardSection>
          </Card>
        </div>
      )}

      {/* ══════════ Tab 3 — Captura de Datos ══════════ */}
      {tab === "captura" && (
        <div className="space-y-6">
          <Card>
            <CardSection label="Tipo de Negocio">
              <Field label="Rubro">
                <select
                  value={form.companyType}
                  onChange={(e) => set("companyType", e.target.value)}
                  className={selectCls}
                >
                  <option value=""              className="bg-white dark:bg-[#1a1a1a]">Seleccionar...</option>
                  <option value="servicios"     className="bg-white dark:bg-[#1a1a1a]">Servicios Profesionales</option>
                  <option value="inmobiliaria"  className="bg-white dark:bg-[#1a1a1a]">Inmobiliaria</option>
                  <option value="ecommerce"     className="bg-white dark:bg-[#1a1a1a]">E-commerce</option>
                  <option value="salud"         className="bg-white dark:bg-[#1a1a1a]">Salud / Clínica</option>
                  <option value="restaurante"   className="bg-white dark:bg-[#1a1a1a]">Restaurante</option>
                  <option value="educacion"     className="bg-white dark:bg-[#1a1a1a]">Educación</option>
                  <option value="automotriz"    className="bg-white dark:bg-[#1a1a1a]">Automotriz</option>
                  <option value="otro"          className="bg-white dark:bg-[#1a1a1a]">Otro</option>
                </select>
              </Field>
            </CardSection>
          </Card>

          <Card>
            <CardSection
              label="Campos a Capturar"
              extra={
                <button
                  type="button"
                  onClick={addCaptureField}
                  className="flex items-center gap-1 text-[11px] text-[#25D366] hover:text-[#1fbd59] transition-colors font-medium"
                >
                  <Plus className="h-3 w-3" />
                  Agregar campo
                </button>
              }
            >
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-2 pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Campo</span>
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Descripción</span>
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider text-center">Requerido</span>
                <span />
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {form.captureFields.map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-2 items-center">
                    <Input
                      value={f.campo}
                      onChange={(e) => updateCaptureField(f.id, "campo", e.target.value)}
                      placeholder="nombre"
                      className={inputCls}
                    />
                    <Input
                      value={f.descripcion}
                      onChange={(e) => updateCaptureField(f.id, "descripcion", e.target.value)}
                      placeholder="Descripción del campo"
                      className={inputCls}
                    />
                    <div className="flex justify-center">
                      <Toggle
                        checked={f.requerido}
                        onChange={(v) => updateCaptureField(f.id, "requerido", v)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCaptureField(f.id)}
                      className="flex items-center justify-center h-9 w-8 text-white/20 hover:text-red-400 transition-colors rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {form.captureFields.length === 0 && (
                  <p className="text-xs text-gray-600 italic py-2">
                    Sin campos configurados. Agrega al menos uno.
                  </p>
                )}
              </div>
            </CardSection>
          </Card>
        </div>
      )}

      {/* ══════════ Tab 4 — Configuración IA ══════════ */}
      {tab === "ia" && (
        <div className="space-y-6">
          <Card>
            <CardSection label="Modelo de IA">
              {/* Global API key toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">Usar API Key global del sistema</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Desactivar para usar una API Key propia
                  </p>
                </div>
                <Toggle
                  checked={form.useGlobalApiKey}
                  onChange={(v) => set("useGlobalApiKey", v)}
                />
              </div>

              {!form.useGlobalApiKey && (
                <Field label="API Key personalizada">
                  <Input
                    type="password"
                    value={form.customApiKey}
                    onChange={(e) => set("customApiKey", e.target.value)}
                    placeholder="sk-ant-... / sk-..."
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              )}

              <Field label="Modelo">
                <select
                  value={form.modelName}
                  onChange={(e) => set("modelName", e.target.value)}
                  className={selectCls}
                >
                  <optgroup label="Anthropic" className="bg-white dark:bg-[#1a1a1a]">
                    <option value="claude-sonnet-4-6"           className="bg-white dark:bg-[#1a1a1a]">claude-sonnet-4-6 (Recomendado)</option>
                    <option value="claude-opus-4-8"             className="bg-white dark:bg-[#1a1a1a]">claude-opus-4-8 (Mayor calidad)</option>
                    <option value="claude-haiku-4-5-20251001"   className="bg-white dark:bg-[#1a1a1a]">claude-haiku-4-5 (Más rápido)</option>
                    <option value="claude-sonnet-4-20250514"    className="bg-white dark:bg-[#1a1a1a]">claude-sonnet-4-20250514</option>
                  </optgroup>
                  <optgroup label="OpenAI" className="bg-white dark:bg-[#1a1a1a]">
                    <option value="gpt-4o"      className="bg-white dark:bg-[#1a1a1a]">gpt-4o</option>
                    <option value="gpt-4o-mini" className="bg-white dark:bg-[#1a1a1a]">gpt-4o-mini</option>
                  </optgroup>
                </select>
              </Field>

              <Field label="Máximo de Tokens por respuesta">
                <Input
                  type="number"
                  min={100}
                  max={8000}
                  step={100}
                  value={form.maxTokens}
                  onChange={(e) => set("maxTokens", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </CardSection>
          </Card>

          <Card>
            <CardSection label="Parámetros Avanzados">
              {/* Temperature slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Temperatura</Label>
                  <span className="text-sm font-mono text-white/60 tabular-nums">
                    {form.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.temperature}
                  onChange={(e) => set("temperature", parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#25D366] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>0 — Determinista</span>
                  <span>1 — Creativo</span>
                </div>
              </div>

              <Field label="Instrucciones Personalizadas (System Prompt)">
                <Textarea
                  value={form.systemPrompt}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                  placeholder={"Eres un agente de ventas de [empresa]. Nunca des precios sin antes calificar al lead. Siempre tutear al cliente..."}
                  rows={8}
                  className={`${textareaCls} font-mono text-xs`}
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Estas instrucciones se agregan al inicio de cada conversación. Tienen prioridad sobre el contexto del negocio.
                </p>
              </Field>
            </CardSection>
          </Card>
        </div>
      )}
    </div>
  );
}
