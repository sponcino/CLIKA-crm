"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  GitFork, Plus, Trash2, Pencil, X, Check, Info,
  ArrowRight, ExternalLink, Loader2,
} from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────
interface FunnelStep {
  id: string
  stepId: string
  name: string
  nextStepId: string | null
  order: number
  description: string | null
  instructions: string | null
  transitionCriteria: string | null
}

interface Funnel {
  id: string
  name: string
  description: string | null
  isActive: boolean
  adAttributionEnabled: boolean
  steps: FunnelStep[]
}

// ─── Template data ─────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "inmobiliaria",
    label: "Inmobiliaria / Bienes Raíces",
    icon: "🏠",
    description: "Captación, visitas y cierre de propiedades",
    steps: [
      { name: "Bienvenida",         stepId: "bienvenida",  nextStepId: "calificacion",  order: 0, description: "Recibir al lead y entender su búsqueda",       instructions: "Saluda y pregunta si busca comprar, vender o alquilar. Identifica zona de interés, rango de precio y urgencia.",       transitionCriteria: "intencion_identificada, zona_definida" },
      { name: "Calificación",       stepId: "calificacion", nextStepId: "visita",        order: 1, description: "Evaluar capacidad y seriedad del interesado",   instructions: "Pregunta sobre financiamiento, plazos y si ya tiene pre-aprobación crediticia. Evalúa urgencia de compra.",                transitionCriteria: "capacidad_evaluada, urgencia_conocida" },
      { name: "Visita Agendada",    stepId: "visita",       nextStepId: "propuesta",     order: 2, description: "Coordinar visita a la propiedad",               instructions: "Ofrece 2-3 opciones de horario para visita. Confirmar dirección y datos de contacto del interesado.",                     transitionCriteria: "visita_confirmada" },
      { name: "Propuesta Enviada",  stepId: "propuesta",    nextStepId: "cerrado",       order: 3, description: "Presentar oferta formal",                       instructions: "Resume la propiedad vista, presenta el precio final y condiciones. Pregunta si tiene dudas o requiere negociación.",     transitionCriteria: "propuesta_enviada, respuesta_recibida" },
      { name: "Cierre",             stepId: "cerrado",      nextStepId: null,            order: 4, description: "Finalizar la operación",                        instructions: "Felicita al cliente. Coordina firma de documentos y próximos pasos con el área legal.",                                 transitionCriteria: "operacion_cerrada" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce / Tienda Online",
    icon: "🛒",
    description: "Captación, interés y conversión de ventas",
    steps: [
      { name: "Bienvenida",   stepId: "bienvenida", nextStepId: "interes",    order: 0, description: "Recibir al visitante y entender qué busca",    instructions: "Saluda y pregunta por qué producto o categoría está interesado. Ofrece orientación.",                                    transitionCriteria: "categoria_identificada" },
      { name: "Interés",      stepId: "interes",    nextStepId: "carrito",    order: 1, description: "Profundizar en el producto de interés",        instructions: "Presenta características del producto. Responde dudas. Ofrece comparativa si hay variantes.",                           transitionCriteria: "producto_seleccionado" },
      { name: "Carrito",      stepId: "carrito",    nextStepId: "compra",     order: 2, description: "Guiar al cliente hacia la compra",             instructions: "Confirma qué quiere comprar. Informa métodos de pago y envío. Ofrece descuento si hay hesitación.",                    transitionCriteria: "intención_de_compra_confirmada" },
      { name: "Compra",       stepId: "compra",     nextStepId: "post_venta", order: 3, description: "Acompañar el proceso de pago",                 instructions: "Guía paso a paso el checkout. Resuelve problemas de pago. Confirma la orden una vez realizada.",                        transitionCriteria: "compra_realizada" },
      { name: "Post-venta",   stepId: "post_venta", nextStepId: null,         order: 4, description: "Seguimiento y fidelización",                   instructions: "Confirma recepción del pedido. Ofrece asistencia post-compra. Invita a dejar reseña o compartir con amigos.",         transitionCriteria: "satisfaccion_confirmada" },
    ],
  },
  {
    id: "servicios",
    label: "Servicios Profesionales",
    icon: "💼",
    description: "Diagnóstico, propuesta y contratación",
    steps: [
      { name: "Bienvenida",    stepId: "bienvenida",  nextStepId: "diagnostico",   order: 0, description: "Recibir al prospecto y entender su negocio",  instructions: "Saluda profesionalmente. Pregunta sobre la empresa, industria y el problema principal que quieren resolver.",        transitionCriteria: "empresa_identificada, problema_descrito" },
      { name: "Diagnóstico",   stepId: "diagnostico", nextStepId: "presentacion",  order: 1, description: "Profundizar en el dolor y necesidades",       instructions: "Haz preguntas de diagnóstico: ¿Cuánto tiempo tiene este problema? ¿Qué soluciones intentaron antes? ¿Cuál es el impacto?", transitionCriteria: "dolor_cuantificado, presupuesto_estimado" },
      { name: "Presentación",  stepId: "presentacion", nextStepId: "demo",         order: 2, description: "Presentar la solución y casos de éxito",      instructions: "Describe cómo el servicio resuelve exactamente su problema. Menciona 1-2 casos similares con resultados.",           transitionCriteria: "solucion_presentada, interes_confirmado" },
      { name: "Demo / Prueba", stepId: "demo",        nextStepId: "confirmacion",  order: 3, description: "Oferta concreta y propuesta económica",       instructions: "Presenta propuesta económica. Ofrece período de prueba o garantía. Maneja objeciones de precio con valor.",          transitionCriteria: "propuesta_enviada, objeciones_manejadas" },
      { name: "Confirmación",  stepId: "confirmacion", nextStepId: null,           order: 4, description: "Cerrar el contrato y onboarding",            instructions: "Felicita por la decisión. Coordina firma de contrato y fecha de inicio. Presenta al equipo de onboarding.",           transitionCriteria: "contrato_firmado" },
    ],
  },
  {
    id: "educacion",
    label: "Educación / Cursos",
    icon: "📚",
    description: "Captación, inscripción y retención",
    steps: [
      { name: "Bienvenida",    stepId: "bienvenida",  nextStepId: "interes",       order: 0, description: "Recibir al interesado en formación",          instructions: "Saluda y pregunta qué área quiere desarrollar. Identifica nivel actual y objetivos profesionales.",                    transitionCriteria: "objetivo_identificado" },
      { name: "Interés",       stepId: "interes",     nextStepId: "inscripcion",   order: 1, description: "Presentar el programa educativo",             instructions: "Describe el programa, duración, modalidad y certificación. Comparte casos de alumnos exitosos.",                      transitionCriteria: "programa_presentado, dudas_resueltas" },
      { name: "Inscripción",   stepId: "inscripcion", nextStepId: "bienvenida_al", order: 2, description: "Facilitar el proceso de matrícula",           instructions: "Guía el proceso de inscripción. Informa métodos de pago y posibilidad de cuotas. Resuelve requisitos.",              transitionCriteria: "pago_realizado, datos_completos" },
      { name: "Bienvenida AL", stepId: "bienvenida_al", nextStepId: null,          order: 3, description: "Onboarding del nuevo alumno",                 instructions: "Felicita al nuevo alumno. Envía accesos a la plataforma. Presenta grupos de estudio y recursos disponibles.",         transitionCriteria: "acceso_confirmado" },
    ],
  },
  {
    id: "salud",
    label: "Salud / Clínica",
    icon: "🏥",
    description: "Triage, disponibilidad y agendamiento de citas",
    steps: [
      { name: "Bienvenida",               stepId: "bienvenida",    nextStepId: "triage",          order: 0, description: "Recibir al paciente y detectar motivo de contacto",    instructions: "Saluda al paciente con empatía y profesionalismo. Pregunta: ¿En qué podemos ayudarte hoy? Identifica si es urgencia médica, consulta de rutina o solicitud de información sobre servicios.",                                   transitionCriteria: "motivo_identificado, urgencia_evaluada" },
      { name: "Identificación de Necesidad", stepId: "triage",     nextStepId: "disponibilidad",  order: 1, description: "Entender qué especialidad o servicio necesita",        instructions: "Pregunta por los síntomas o motivo de consulta. Identifica la especialidad médica requerida. Determina si necesita médico general o especialista. Sé empático y no des diagnósticos.",                                         transitionCriteria: "especialidad_identificada, tipo_consulta_claro" },
      { name: "Disponibilidad",           stepId: "disponibilidad", nextStepId: "datos_paciente", order: 2, description: "Ofrecer horarios y opciones disponibles",              instructions: "Consulta la agenda y ofrece 2-3 opciones de horario disponibles. Pregunta preferencia de día (mañana/tarde) y si tiene obra social o es particular. Confirma la preferencia del paciente.",                                   transitionCriteria: "horario_preferido_definido, modalidad_confirmada" },
      { name: "Datos del Paciente",       stepId: "datos_paciente", nextStepId: "confirmacion",   order: 3, description: "Recopilar información para la cita",                   instructions: "Solicita: nombre completo, DNI/documento de identidad, obra social (si tiene) y número de afiliado, teléfono de contacto alternativo, correo electrónico. Confirma todos los datos antes de avanzar.",                        transitionCriteria: "nombre_capturado, dni_capturado, contacto_completo" },
      { name: "Confirmación de Cita",     stepId: "confirmacion",   nextStepId: null,             order: 4, description: "Confirmar la cita y dar instrucciones finales",        instructions: "Resume la cita: especialidad, médico (si aplica), fecha, hora y dirección. Informa qué documentación debe traer. Envía recordatorio 24 hs antes. Pregunta si tiene más dudas antes de cerrar.",                                transitionCriteria: "cita_confirmada, instrucciones_enviadas" },
    ],
  },
  {
    id: "restaurante",
    label: "Restaurante / Comida",
    icon: "🍽️",
    description: "Reservas, pedidos y fidelización",
    steps: [
      { name: "Bienvenida",  stepId: "bienvenida", nextStepId: "pedido",      order: 0, description: "Recibir y detectar intención", instructions: "Saluda y pregunta si quiere hacer una reserva, pedir delivery o consultar el menú.", transitionCriteria: "intencion_identificada" },
      { name: "Pedido",      stepId: "pedido",     nextStepId: "confirmacion", order: 1, description: "Tomar el pedido o gestionar reserva", instructions: "Toma el pedido completo o datos para la reserva (fecha, hora, cantidad de personas). Confirma el menú disponible.", transitionCriteria: "pedido_completo" },
      { name: "Confirmación",stepId: "confirmacion",nextStepId: null,          order: 2, description: "Confirmar y dar seguimiento", instructions: "Confirma el pedido/reserva con tiempo estimado. Informa método de pago disponible. Ofrece fidelización.", transitionCriteria: "confirmacion_enviada" },
    ],
  },
  {
    id: "automotriz",
    label: "Automotriz",
    icon: "🚗",
    description: "Leads de vehículos, test drive y cierre",
    steps: [
      { name: "Bienvenida",    stepId: "bienvenida",  nextStepId: "calificacion",  order: 0, description: "Recibir interesado en vehículo", instructions: "Saluda y pregunta qué tipo de vehículo busca: nuevo o usado, marca/modelo de interés, presupuesto aproximado.", transitionCriteria: "tipo_vehiculo_identificado" },
      { name: "Calificación",  stepId: "calificacion", nextStepId: "test_drive",   order: 1, description: "Evaluar necesidades y capacidad", instructions: "Pregunta: ¿Para qué uso necesita el vehículo? ¿Paga de contado o financia? ¿Tiene auto para entregar como parte de pago?", transitionCriteria: "necesidades_evaluadas, capacidad_financiera" },
      { name: "Test Drive",    stepId: "test_drive",  nextStepId: "propuesta",     order: 2, description: "Coordinar prueba de manejo", instructions: "Ofrece disponibilidad para test drive. Confirma fecha, hora y sucursal. Solicita datos de contacto para confirmar.", transitionCriteria: "test_drive_confirmado" },
      { name: "Propuesta",     stepId: "propuesta",   nextStepId: "cerrado",       order: 3, description: "Presentar precio y condiciones", instructions: "Presenta precio del vehículo de interés. Ofrece opciones de financiamiento. Maneja objeciones de precio.", transitionCriteria: "propuesta_presentada" },
      { name: "Cierre",        stepId: "cerrado",     nextStepId: null,            order: 4, description: "Concretar la venta", instructions: "Felicita al cliente. Coordina trámites de transferencia, seguro y entrega del vehículo.", transitionCriteria: "venta_cerrada" },
    ],
  },
]

// ─── Style constants ──────────────────────────────────────────────────────────
const inputCls = "bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20"
const textareaCls = "bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus-visible:ring-1 focus-visible:ring-[#25D366] focus-visible:border-[#25D366] placeholder:text-white/20 resize-none"
const labelCls = "text-xs text-slate-500 dark:text-gray-400 font-medium"

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[#25D366]" : "bg-white/15"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  )
}

// ─── Step editor form (used in both add and edit modes) ───────────────────────
interface StepFormState {
  name: string
  stepId: string
  order: number
  nextStepId: string
  instructions: string
  transitionCriteria: string
}

const EMPTY_STEP: StepFormState = { name: "", stepId: "", order: 0, nextStepId: "", instructions: "", transitionCriteria: "" }

function StepFormFields({
  form, setForm, steps, editId,
}: {
  form: StepFormState
  setForm: (f: StepFormState) => void
  steps: FunnelStep[]
  editId?: string // db id being edited, to exclude from next-step list
}) {
  const set = <K extends keyof StepFormState>(k: K, v: StepFormState[K]) =>
    setForm({ ...form, [k]: v })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelCls}>Nombre del Paso *</Label>
          <Input
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value)
              if (!editId && !form.stepId) {
                set("stepId", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))
              }
            }}
            placeholder="ej: Bienvenida"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>ID del Paso *</Label>
          <Input
            value={form.stepId}
            onChange={(e) => set("stepId", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
            placeholder="bienvenida"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[10px] text-white/25">Identificador único (sin espacios)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelCls}>Orden</Label>
          <Input
            type="number"
            min={0}
            value={form.order}
            onChange={(e) => set("order", parseInt(e.target.value) || 0)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>Siguiente Paso</Label>
          <select
            value={form.nextStepId}
            onChange={(e) => set("nextStepId", e.target.value)}
            className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm h-9 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-[#25D366] appearance-none"
          >
            <option value="" className="bg-white dark:bg-[#111111]">— Fin del flujo —</option>
            {steps
              .filter((s) => s.id !== editId)
              .map((s) => (
                <option key={s.stepId} value={s.stepId} className="bg-white dark:bg-[#111111]">
                  {s.name} ({s.stepId})
                </option>
              ))}
          </select>
          <p className="text-[10px] text-white/25">Vacío si es el paso final</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className={labelCls}>Instrucciones para la IA *</Label>
        <Textarea
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          placeholder={"Describe qué debe hacer el agente IA en este paso:\n- Qué preguntar\n- Qué información capturar\n- Cómo responder objeciones\n- Cuándo avanzar al siguiente paso"}
          rows={6}
          className={`${textareaCls} font-mono text-xs`}
        />
      </div>

      <div className="space-y-1.5">
        <Label className={labelCls}>Criterios de Transición</Label>
        <Textarea
          value={form.transitionCriteria}
          onChange={(e) => set("transitionCriteria", e.target.value)}
          placeholder="ej: nombre_capturado, email_validado, intencion_confirmada"
          rows={2}
          className={textareaCls}
        />
        <p className="text-[10px] text-white/25">
          Condiciones que deben cumplirse para avanzar al siguiente paso. El agente las rastrea automáticamente.
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FunnelsPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId
  const queryClient = useQueryClient()

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateFunnel, setShowCreateFunnel] = useState(false)
  const [newFunnelName, setNewFunnelName] = useState("")
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [highlightedTemplate, setHighlightedTemplate] = useState("salud")
  const [showStepDialog, setShowStepDialog] = useState(false)
  const [editingStep, setEditingStep] = useState<FunnelStep | null>(null)
  const [stepForm, setStepForm] = useState<StepFormState>(EMPTY_STEP)
  const [editingFunnelName, setEditingFunnelName] = useState(false)
  const [editFunnelName, setEditFunnelName] = useState("")

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: funnels = [], isLoading } = useQuery<Funnel[]>({
    queryKey: ["funnels", workspaceId],
    queryFn: async () => {
      const res = await fetch("/api/funnels")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!workspaceId,
  })

  // WhatsApp config for status bar
  const { data: wpConfig } = useQuery({
    queryKey: ["wp-config-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/whatsapp")
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!workspaceId,
  })

  const selected = funnels.find((f) => f.id === selectedId) ?? null

  // Reset step form when dialog closes
  useEffect(() => {
    if (!showStepDialog) {
      setEditingStep(null)
      setStepForm(EMPTY_STEP)
    }
  }, [showStepDialog])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createFunnel = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: (f: Funnel) => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setSelectedId(f.id)
      setNewFunnelName("")
      setShowCreateFunnel(false)
    },
    onError: () => toast.error("Error al crear el funnel"),
  })

  const updateFunnel = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/funnels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] }),
  })

  const deleteFunnel = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/funnels/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setSelectedId(null)
      toast.success("Funnel eliminado")
    },
  })

  const createStep = useMutation({
    mutationFn: async (data: Omit<StepFormState, ""> & { funnelId?: string }) => {
      const res = await fetch(`/api/funnels/${selectedId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          stepId: data.stepId,
          nextStepId: data.nextStepId || null,
          order: data.order,
          instructions: data.instructions || null,
          transitionCriteria: data.transitionCriteria || null,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setShowStepDialog(false)
      toast.success("Paso agregado")
    },
    onError: () => toast.error("Error al agregar el paso"),
  })

  const updateStep = useMutation({
    mutationFn: async ({ stepDbId, data }: { stepDbId: string; data: Partial<StepFormState> }) => {
      const res = await fetch(`/api/funnels/${selectedId}/steps/${stepDbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          stepId: data.stepId,
          nextStepId: data.nextStepId || null,
          order: data.order,
          instructions: data.instructions || null,
          transitionCriteria: data.transitionCriteria || null,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setShowStepDialog(false)
      toast.success("Paso actualizado")
    },
    onError: () => toast.error("Error al actualizar el paso"),
  })

  const deleteStep = useMutation({
    mutationFn: async (stepDbId: string) => {
      const res = await fetch(`/api/funnels/${selectedId}/steps/${stepDbId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      toast.success("Paso eliminado")
    },
    onError: () => toast.error("Error al eliminar el paso"),
  })

  // ── Apply template ───────────────────────────────────────────────────────────
  const applyTemplate = async (templateId: string) => {
    if (!selectedId) return
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return

    setShowTemplateModal(false)

    // Clear existing steps
    if (selected?.steps.length) {
      for (const s of selected.steps) {
        await fetch(`/api/funnels/${selectedId}/steps/${s.id}`, { method: "DELETE" })
      }
    }

    // Create new steps sequentially
    for (const s of tpl.steps) {
      await fetch(`/api/funnels/${selectedId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      })
    }

    queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
    toast.success(`Plantilla "${tpl.label}" aplicada`)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openAddStep = () => {
    setEditingStep(null)
    setStepForm({ ...EMPTY_STEP, order: selected?.steps.length ?? 0 })
    setShowStepDialog(true)
  }

  const openEditStep = (step: FunnelStep) => {
    setEditingStep(step)
    setStepForm({
      name: step.name,
      stepId: step.stepId,
      order: step.order,
      nextStepId: step.nextStepId ?? "",
      instructions: step.instructions ?? "",
      transitionCriteria: step.transitionCriteria ?? "",
    })
    setShowStepDialog(true)
  }

  const handleSaveStep = () => {
    if (!stepForm.name.trim() || !stepForm.stepId.trim()) return
    if (editingStep) {
      updateStep.mutate({ stepDbId: editingStep.id, data: stepForm })
    } else {
      createStep.mutate(stepForm)
    }
  }

  const handleSaveFunnelName = () => {
    if (!selectedId || !editFunnelName.trim()) return
    updateFunnel.mutate({ id: selectedId, data: { name: editFunnelName } })
    setEditingFunnelName(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white overflow-hidden">

      {/* ══ LEFT PANEL: Funnel list ══ */}
      <div className="w-[260px] border-r border-[#ffffff10] flex flex-col bg-slate-50 dark:bg-[#0a0a0a] shrink-0">
        <div className="px-4 py-3.5 border-b border-[#ffffff10] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-[#25D366]" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">Funnels</h2>
          </div>
          <button
            onClick={() => setShowCreateFunnel((v) => !v)}
            className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Create funnel inline */}
        {showCreateFunnel && (
          <div className="p-3 border-b border-[#ffffff08] bg-[#0d0d0d] space-y-2">
            <Input
              autoFocus
              value={newFunnelName}
              onChange={(e) => setNewFunnelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newFunnelName.trim() && createFunnel.mutate(newFunnelName)}
              placeholder="Nombre del funnel..."
              className="h-7 text-xs bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => newFunnelName.trim() && createFunnel.mutate(newFunnelName)}
                disabled={!newFunnelName.trim() || createFunnel.isPending}
                className="flex-1 text-xs py-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded hover:bg-[#25D366]/20 transition-all disabled:opacity-50"
              >
                {createFunnel.isPending ? "Creando..." : "Crear"}
              </button>
              <button
                onClick={() => { setShowCreateFunnel(false); setNewFunnelName("") }}
                className="px-2 text-gray-500 hover:text-slate-900 dark:text-white rounded hover:bg-slate-50 dark:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-xs animate-pulse">Cargando...</div>
          ) : funnels.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-600 text-xs space-y-2">
              <GitFork className="h-7 w-7 mx-auto opacity-20" />
              <p>Sin funnels. Crea el primero.</p>
            </div>
          ) : (
            funnels.map((funnel) => (
              <button
                key={funnel.id}
                onClick={() => setSelectedId(funnel.id)}
                className={`w-full text-left px-4 py-3 transition-all flex items-center gap-3 ${
                  selectedId === funnel.id
                    ? "bg-[#ffffff0d] text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-gray-400 hover:bg-[#ffffff06] hover:text-slate-900 dark:text-white"
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${funnel.isActive ? "bg-[#25D366]" : "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{funnel.name}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{funnel.steps.length} pasos</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
            <GitFork className="h-10 w-10 opacity-15" />
            <p className="text-sm font-medium">Selecciona o crea un funnel</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingFunnelName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={editFunnelName}
                        onChange={(e) => setEditFunnelName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveFunnelName(); if (e.key === "Escape") setEditingFunnelName(false) }}
                        className="h-8 text-base font-bold bg-white dark:bg-[#111111] border-white/15 text-slate-900 dark:text-white max-w-xs"
                      />
                      <button onClick={handleSaveFunnelName} className="text-[#25D366] hover:opacity-80"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingFunnelName(false)} className="text-gray-500 hover:text-slate-900 dark:text-white"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Funnel de Ventas</h1>
                      <span className="text-gray-500 text-lg">/</span>
                      <span className="text-lg font-bold text-[#25D366]">{selected.name}</span>
                      <button
                        onClick={() => { setEditFunnelName(selected.name); setEditingFunnelName(true) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-slate-900 dark:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{selected.steps.length} pasos configurados</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateModal(true)}
                    className="h-8 px-3 text-xs bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-white/5"
                  >
                    Usar Plantilla
                  </Button>
                  <Button
                    size="sm"
                    onClick={openAddStep}
                    className="h-8 px-3 text-xs bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Paso
                  </Button>
                </div>
              </div>

              {/* ── Info callout ── */}
              <div className="flex gap-3 bg-amber-500/8 border border-amber-500/20 rounded-md p-4">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-300 mb-1">¿Cómo funciona?</p>
                  <p className="text-xs text-amber-200/60 leading-relaxed">
                    El agente IA sigue estos pasos y rastrea objetivos en cada fase.
                    Aunque el cliente se vaya por las ramas, el agente mantiene el enfoque
                    en los objetivos pendientes y avanza automáticamente cuando se cumplan.
                  </p>
                </div>
              </div>

              {/* ── WhatsApp Status ── */}
              <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md">
                <div className="p-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado de WhatsApp</p>
                  <a
                    href="https://business.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[#25D366] hover:opacity-80 transition-opacity"
                  >
                    Abrir en Meta <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="px-4 pb-4 flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">Número</p>
                    <p className="text-sm text-slate-900 dark:text-white font-mono">
                      {wpConfig?.displayPhoneNumber ?? "No configurado"}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-slate-50 dark:bg-white/5" />
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">Calidad</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      Desconocida
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-50 dark:bg-white/5" />
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">Verificación</p>
                    {wpConfig?.connectionStatus === "CONNECTED" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                        Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-slate-500 dark:text-gray-400 border border-gray-500/20">
                        No verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Ad Attribution ── */}
              <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Atribución de Anuncios</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Guarda metadatos de campañas cuando los contactos llegan desde anuncios de Facebook/Instagram
                  </p>
                </div>
                <Toggle
                  checked={selected.adAttributionEnabled}
                  onChange={(v) => updateFunnel.mutate({ id: selected.id, data: { adAttributionEnabled: v } })}
                />
              </div>

              {/* ── Steps table ── */}
              <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[48px_1fr_140px_160px_80px] gap-0 border-b border-[#ffffff08] px-4 py-2.5">
                  {["ORDEN", "PASO", "SIGUIENTE", "CRITERIO DE TRANSICIÓN", "ACCIONES"].map((h) => (
                    <span key={h} className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                      {h}
                    </span>
                  ))}
                </div>

                {selected.steps.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <GitFork className="h-7 w-7 mx-auto text-white/10" />
                    <p className="text-sm text-gray-600">Sin pasos configurados</p>
                    <p className="text-xs text-gray-700">
                      Usa una plantilla o agrega el primer paso manualmente
                    </p>
                  </div>
                ) : (
                  <div>
                    {selected.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className={`grid grid-cols-[48px_1fr_140px_160px_80px] gap-0 px-4 py-3 items-center border-b border-[#ffffff05] hover:bg-[#ffffff06] transition-colors ${idx % 2 === 1 ? "bg-[#ffffff02]" : ""}`}
                      >
                        {/* Orden */}
                        <div>
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-[10px] font-bold">
                            {step.order + 1}
                          </span>
                        </div>

                        {/* Paso */}
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{step.name}</p>
                          <p className="text-[10px] font-mono text-gray-600 mt-0.5">{step.stepId}</p>
                        </div>

                        {/* Siguiente */}
                        <div className="flex items-center gap-1.5 pr-3">
                          {step.nextStepId ? (
                            <>
                              <ArrowRight className="h-3 w-3 text-gray-600 shrink-0" />
                              <span className="text-xs text-slate-500 dark:text-gray-400 font-mono truncate">{step.nextStepId}</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-600 italic">Fin del flujo</span>
                          )}
                        </div>

                        {/* Criterio */}
                        <div className="pr-3">
                          {step.transitionCriteria ? (
                            <p className="text-[10px] text-gray-500 truncate" title={step.transitionCriteria}>
                              {step.transitionCriteria}
                            </p>
                          ) : (
                            <span className="text-[10px] text-gray-700 italic">—</span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditStep(step)}
                            className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                            title="Editar paso"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar paso "${step.name}"?`)) deleteStep.mutate(step.id)
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar paso"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Danger zone ── */}
              <div className="flex items-center justify-between pt-2 pb-4">
                <button
                  onClick={() => updateFunnel.mutate({ id: selected.id, data: { isActive: !selected.isActive } })}
                  className={`text-xs px-3 py-1.5 rounded border transition-all ${
                    selected.isActive
                      ? "border-[#25D366]/20 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
                      : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10"
                  }`}
                >
                  {selected.isActive ? "Funnel activo" : "Funnel inactivo"}
                </button>
                <button
                  onClick={() => { if (confirm(`¿Eliminar funnel "${selected.name}"?`)) deleteFunnel.mutate(selected.id) }}
                  className="text-xs px-3 py-1.5 rounded border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Eliminar funnel
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ══ Template Modal ══ */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="bg-[#111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-slate-900 dark:text-white text-base font-bold">Usar Plantilla</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Selecciona una plantilla para cargar pasos pre-configurados. Esto reemplazará los pasos actuales.
            </p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-2">
            <div className="grid grid-cols-2 gap-3 pr-1">
              {TEMPLATES.map((tpl) => {
                const isSelected = highlightedTemplate === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setHighlightedTemplate(tpl.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-[#25D366]/40 bg-[#25D366]/8"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-slate-50 dark:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tpl.icon}</span>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{tpl.label}</p>
                      </div>
                      {isSelected && (
                        <span className="h-5 w-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-black" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mb-2">{tpl.description}</p>
                    <div className="space-y-0.5">
                      {tpl.steps.map((s, i) => (
                        <div key={s.stepId} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <span className="text-gray-700">{i + 1}.</span>
                          <span>{s.name}</span>
                          {s.nextStepId && <ArrowRight className="h-2 w-2 text-gray-700" />}
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/8 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowTemplateModal(false)}
              className="flex-1 border-slate-200 dark:border-white/10 bg-transparent text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => applyTemplate(highlightedTemplate)}
              className="flex-1 bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold"
            >
              Usar plantilla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Add / Edit Step Dialog ══ */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="bg-[#111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white text-base font-bold">
              {editingStep ? "Editar Paso" : "Agregar Paso"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <StepFormFields
              form={stepForm}
              setForm={setStepForm}
              steps={selected?.steps ?? []}
              editId={editingStep?.id}
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button
              variant="outline"
              onClick={() => setShowStepDialog(false)}
              className="flex-1 border-slate-200 dark:border-white/10 bg-transparent text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveStep}
              disabled={!stepForm.name.trim() || !stepForm.stepId.trim() || createStep.isPending || updateStep.isPending}
              className="flex-1 bg-[#25D366] hover:bg-[#1fbd59] text-black font-semibold disabled:opacity-40"
            >
              {createStep.isPending || updateStep.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Guardando...</>
              ) : editingStep ? "Guardar cambios" : "Agregar paso"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
