"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, CheckCircle2, ChevronRight, Phone } from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  docUrl: string;
}

const STEPS: Step[] = [
  {
    id: "business-manager",
    title: "1. Crear cuenta Meta Business",
    description: "Para usar la API de WhatsApp, necesitas una cuenta de Meta Business Manager. Si ya tienes una, puedes omitir este paso.",
    docUrl: "https://business.facebook.com/overview",
  },
  {
    id: "create-app",
    title: "2. Crear App en Meta for Developers",
    description: "Ve a developers.facebook.com, crea una nueva aplicación del tipo 'Empresa' y asóciala a tu cuenta de Business Manager.",
    docUrl: "https://developers.facebook.com/apps/",
  },
  {
    id: "add-whatsapp",
    title: "3. Agregar el producto WhatsApp",
    description: "Dentro del panel de tu aplicación, busca la sección 'Agregar un producto' y selecciona 'WhatsApp'. Sigue los pasos de configuración inicial.",
    docUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
  },
  {
    id: "get-ids",
    title: "4. Obtener Phone Number ID y WABA ID",
    description: "En el menú lateral, ve a WhatsApp > Configuración de la API. Allí encontrarás el 'Identificador del número de teléfono' y el 'Identificador de la cuenta de WhatsApp Business'. Cópialos en la configuración de CLIKA.",
    docUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
  },
  {
    id: "permanent-token",
    title: "5. Generar Access Token permanente",
    description: "Por defecto, Meta genera tokens de 24 horas. Para producción, debes crear un Usuario del Sistema en tu Business Manager y generar un token permanente con los permisos 'whatsapp_business_messaging' y 'whatsapp_business_management'.",
    docUrl: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-users",
  },
  {
    id: "webhook",
    title: "6. Configurar Webhook",
    description: "En WhatsApp > Configuración, haz clic en 'Configurar' webhooks. Ingresa la URL proporcionada en la configuración de CLIKA y el Token de verificación que hayas definido.",
    docUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks",
  },
  {
    id: "subscribe",
    title: "7. Suscribir al evento messages",
    description: "En la misma sección de webhooks, haz clic en 'Administrar' bajo Campos de webhook y marca la casilla 'Suscribirse' para el evento 'messages'. ¡Listo!",
    docUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks#webhooks-for-whatsapp",
  }
];

export default function WhatsAppGuidePage() {
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (id: string) => {
    setCompletedSteps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const progress = Math.round((Object.values(completedSteps).filter(Boolean).length / STEPS.length) * 100);
  const isComplete = progress === 100;
  
  const webhookUrl = typeof window !== "undefined" ? window.location.origin + "/api/meta/webhook" : "https://tu-dominio.com/api/meta/webhook";

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <Link href="/settings/whatsapp" className="text-xs text-gray-500 hover:text-slate-900 dark:text-white flex items-center gap-1 w-fit mb-4 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Volver a WhatsApp
        </Link>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Guía de Configuración Meta</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Sigue estos pasos para conectar la Cloud API oficial de WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md p-4">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-gray-300">Progreso de configuración</span>
          <span className={`font-bold ${isComplete ? "text-whatsapp" : "text-slate-900 dark:text-white"}`}>{progress}%</span>
        </div>
        <div className="h-2 w-full bg-white dark:bg-[#1a1a1a] rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {isComplete && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-whatsapp font-medium bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90/10 border border-whatsapp/20 w-fit px-3 py-1.5 rounded-sm">
            <CheckCircle2 className="h-4 w-4" />
            ¡Todos los pasos completados! Ya puedes ir a probar la conexión.
          </div>
        )}
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {STEPS.map((step) => {
          const isDone = completedSteps[step.id];
          return (
            <div 
              key={step.id} 
              className={`bg-white dark:bg-[#111111] border rounded-md p-5 transition-colors duration-300 ${
                isDone ? "border-whatsapp/30" : "border-[#ffffff0d]"
              }`}
            >
              <div className="flex items-start gap-4">
                <input 
                  type="checkbox"
                  id={`step-${step.id}`} 
                  checked={!!isDone} 
                  onChange={() => toggleStep(step.id)}
                  className="mt-1.5 h-4 w-4 rounded border-white/20 bg-white dark:bg-[#1a1a1a] text-whatsapp focus:ring-whatsapp focus:ring-offset-[#111111]"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor={`step-${step.id}`}
                      className={`font-semibold cursor-pointer select-none transition-colors ${
                        isDone ? "text-whatsapp line-through decoration-whatsapp/50" : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {step.title}
                    </label>
                    <a 
                      href={step.docUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-500 hover:text-slate-900 dark:text-white flex items-center gap-1 uppercase font-bold tracking-wider"
                    >
                      Docs <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  <p className={`text-sm transition-colors ${isDone ? "text-gray-600" : "text-slate-500 dark:text-gray-400"}`}>
                    {step.description}
                  </p>

                  {/* Special hint for Webhook step */}
                  {step.id === "webhook" && !isDone && (
                    <div className="mt-4 bg-slate-50 dark:bg-[#0a0a0a] border border-white/5 rounded-md p-3">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Tu URL de Webhook</span>
                      <code className="text-xs text-slate-600 dark:text-gray-300 font-mono select-all">
                        {webhookUrl}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <Link href="/settings/whatsapp">
          <Button className="bg-white hover:bg-gray-200 text-black font-semibold h-9 text-xs px-5 rounded-md flex items-center gap-1.5">
            Ir a Configuración
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
