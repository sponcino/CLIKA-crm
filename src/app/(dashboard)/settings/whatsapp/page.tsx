"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wifi, WifiOff, Save, FlaskConical, ShieldCheck, Loader2,
  CheckCircle2, XCircle, Phone,
} from "lucide-react";

const MASKED = "••••••••";

interface Config {
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
  displayPhoneNumber: string;
  webhookVerifyToken: string;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "ERROR";
  accessToken: string;
  appSecret: string;
}

interface TestResult {
  success: boolean;
  displayName?: string;
  phoneNumber?: string;
  error?: string;
}

export default function WhatsAppSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [form, setForm] = useState<Config>({
    phoneNumberId: "",
    wabaId: "",
    businessId: "",
    displayPhoneNumber: "",
    webhookVerifyToken: "",
    connectionStatus: "DISCONNECTED",
    accessToken: MASKED,
    appSecret: MASKED,
  });

  // Load current config
  useEffect(() => {
    fetch("/api/settings/whatsapp")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          phoneNumberId: data.phoneNumberId ?? "",
          wabaId: data.wabaId ?? "",
          businessId: data.businessId ?? "",
          displayPhoneNumber: data.displayPhoneNumber ?? "",
          webhookVerifyToken: data.webhookVerifyToken ?? "",
          connectionStatus: data.connectionStatus ?? "DISCONNECTED",
          accessToken: MASKED,
          appSecret: MASKED,
        });
      })
      .catch(() => toast.error("Error al cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof Config, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setForm((prev) => ({
        ...prev,
        connectionStatus: data.connectionStatus ?? "CONNECTED",
        accessToken: MASKED,
        appSecret: MASKED,
      }));
      toast.success("Configuración de WhatsApp guardada correctamente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/whatsapp/test");
      const data: TestResult = await res.json();
      setTestResult(data);
      if (data.success) {
        setForm((prev) => ({ ...prev, connectionStatus: "CONNECTED" }));
        toast.success("¡Conexión exitosa con Meta!");
      } else {
        toast.error("Error al probar la conexión");
      }
    } catch {
      setTestResult({ success: false, error: "Error de red al probar la conexión" });
      toast.error("Error de red");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 animate-pulse text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Cargando configuración de WhatsApp...
      </div>
    );
  }

  const isConnected = form.connectionStatus === "CONNECTED";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">WhatsApp Cloud API</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Conecta tu número de WhatsApp Business mediante Meta Cloud API.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings/whatsapp/guide">
            <Button variant="outline" className="h-8 px-3 text-xs bg-transparent border-[var(--border-color)] text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5">
              Guía de conexión
            </Button>
          </Link>
          
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider ${
              isConnected
                ? "bg-green-950/40 border-green-500/25 text-green-400"
                : "bg-red-950/40 border-red-500/25 text-red-400"
            }`}
          >
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {isConnected ? "CONECTADO" : "DESCONECTADO"}
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white dark:bg-[#111111] border border-[var(--border-color)] rounded-md divide-y divide-[var(--border-color)]">
        {/* Section: Identifiers */}
        <div className="p-5 space-y-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Identificadores Meta
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="phoneNumberId">
                Phone Number ID
              </Label>
              <Input
                id="phoneNumberId"
                value={form.phoneNumberId}
                onChange={(e) => handleChange("phoneNumberId", e.target.value)}
                placeholder="116867XXXXXXXXX"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="wabaId">
                WABA ID
              </Label>
              <Input
                id="wabaId"
                value={form.wabaId}
                onChange={(e) => handleChange("wabaId", e.target.value)}
                placeholder="175366XXXXXXXXX"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="businessId">
                Business ID
              </Label>
              <Input
                id="businessId"
                value={form.businessId}
                onChange={(e) => handleChange("businessId", e.target.value)}
                placeholder="Business Account ID"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="displayPhoneNumber">
                Número de teléfono
              </Label>
              <Input
                id="displayPhoneNumber"
                value={form.displayPhoneNumber}
                onChange={(e) => handleChange("displayPhoneNumber", e.target.value)}
                placeholder="+54 9 11 XXXX-XXXX"
                className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
              />
            </div>
          </div>
        </div>

        {/* Section: Credentials */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Credenciales
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400/70">
              <ShieldCheck className="h-3 w-3" />
              El Access Token se almacena cifrado con AES-256-GCM
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="accessToken">
              Access Token
            </Label>
            <Input
              id="accessToken"
              type="password"
              value={form.accessToken}
              onChange={(e) => handleChange("accessToken", e.target.value)}
              onFocus={(e) => {
                if (e.target.value === MASKED) handleChange("accessToken", "");
              }}
              onBlur={(e) => {
                if (e.target.value === "") handleChange("accessToken", MASKED);
              }}
              placeholder={MASKED}
              className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 font-mono focus-visible:ring-whatsapp"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="appSecret">
              App Secret
            </Label>
            <Input
              id="appSecret"
              type="password"
              value={form.appSecret}
              onChange={(e) => handleChange("appSecret", e.target.value)}
              onFocus={(e) => {
                if (e.target.value === MASKED) handleChange("appSecret", "");
              }}
              onBlur={(e) => {
                if (e.target.value === "") handleChange("appSecret", MASKED);
              }}
              placeholder={MASKED}
              className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 font-mono focus-visible:ring-whatsapp"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="webhookVerifyToken">
              Webhook Verify Token
            </Label>
            <Input
              id="webhookVerifyToken"
              value={form.webhookVerifyToken}
              onChange={(e) => handleChange("webhookVerifyToken", e.target.value)}
              placeholder="Tu token de verificación del webhook"
              className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
            />
          </div>
        </div>

        {/* Test Result Callout */}
        {testResult && (
          <div
            className={`mx-5 mb-5 mt-1 p-3 rounded-md border text-xs flex items-start gap-2 ${
              testResult.success
                ? "bg-green-950/30 border-green-500/20 text-green-400"
                : "bg-red-950/30 border-red-500/20 text-red-400"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div>
              {testResult.success ? (
                <>
                  <span className="font-semibold block">Conexión exitosa con Meta API</span>
                  {testResult.displayName && (
                    <span className="text-green-500/80 block mt-0.5">
                      Nombre verificado: <b>{testResult.displayName}</b>
                      {testResult.phoneNumber && ` · ${testResult.phoneNumber}`}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold block">Error de conexión</span>
                  {testResult.error && (
                    <span className="text-red-400/80 block mt-0.5">{testResult.error}</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 flex items-center justify-end gap-3">
          <Button
            id="btn-test-connection"
            onClick={handleTest}
            disabled={testing || saving}
            variant="outline"
            className="bg-transparent border-[var(--border-color)] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white h-9 text-xs px-4 rounded-md flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5" />
            )}
            {testing ? "Probando..." : "Probar conexión"}
          </Button>

          <Button
            id="btn-save-whatsapp"
            onClick={handleSave}
            disabled={saving || testing}
            className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold h-9 text-xs px-5 rounded-md flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Webhook URL hint */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff08] rounded-md p-4 space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          URL del Webhook (configurar en Meta)
        </p>
        <code className="text-xs text-slate-600 dark:text-gray-300 font-mono bg-slate-50 dark:bg-[#0a0a0a] border border-white/5 px-3 py-2 rounded-sm block select-all">
          {typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}
          /api/meta/webhook
        </code>
        <p className="text-[10px] text-gray-600">
          Usa el Webhook Verify Token que configuraste arriba al registrar el webhook en Meta.
        </p>
      </div>
    </div>
  );
}
