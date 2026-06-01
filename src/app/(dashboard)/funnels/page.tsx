"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GitFork, Plus, Trash2, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Pencil, Check, X, Layers,
} from "lucide-react"

// ─── Preset templates ─────────────────────────────────────────────────────────
const PRESET_TEMPLATES = [
  {
    label: "🏠 Inmobiliaria",
    steps: [
      { name: "Nuevo",              stepId: "nuevo",     nextStepId: "contactado" },
      { name: "Contactado",         stepId: "contactado", nextStepId: "visita" },
      { name: "Visita agendada",    stepId: "visita",    nextStepId: "propuesta" },
      { name: "Propuesta enviada",  stepId: "propuesta", nextStepId: "cerrado" },
      { name: "Cerrado",            stepId: "cerrado",   nextStepId: null },
    ],
  },
  {
    label: "🛒 Ecommerce",
    steps: [
      { name: "Nuevo",       stepId: "nuevo",     nextStepId: "interesado" },
      { name: "Interesado",  stepId: "interesado", nextStepId: "carrito" },
      { name: "Carrito",     stepId: "carrito",   nextStepId: "compra" },
      { name: "Compra",      stepId: "compra",    nextStepId: "postventa" },
      { name: "Post-venta",  stepId: "postventa", nextStepId: null },
    ],
  },
  {
    label: "💼 Profesionales",
    steps: [
      { name: "Nuevo",     stepId: "nuevo",     nextStepId: "consulta" },
      { name: "Consulta",  stepId: "consulta",  nextStepId: "propuesta" },
      { name: "Propuesta", stepId: "propuesta", nextStepId: "contrato" },
      { name: "Contrato",  stepId: "contrato",  nextStepId: "entrega" },
      { name: "Entrega",   stepId: "entrega",   nextStepId: null },
    ],
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface FunnelStep {
  id: string
  stepId: string
  name: string
  nextStepId: string | null
  order: number
  description?: string | null
}

interface Funnel {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  steps: FunnelStep[]
}

// ─── Step row ─────────────────────────────────────────────────────────────────
function StepRow({
  step, steps, funnelId,
  onDelete, onUpdate,
}: {
  step: FunnelStep
  steps: FunnelStep[]
  funnelId: string
  onDelete: (stepDbId: string) => void
  onUpdate: (stepDbId: string, data: Partial<FunnelStep>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(step.name)
  const [desc, setDesc] = useState(step.description ?? "")
  const [nextStepId, setNextStepId] = useState(step.nextStepId ?? "")

  const save = () => {
    onUpdate(step.id, { name, description: desc || null, nextStepId: nextStepId || null })
    setEditing(false)
  }

  return (
    <div className="group border border-[#ffffff10] rounded-lg bg-[#111111] overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-whatsapp/10 border border-whatsapp/20 text-whatsapp text-[10px] font-bold shrink-0">
          {step.order + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{step.name}</p>
          <p className="text-[10px] text-gray-500 font-mono">{step.stepId}</p>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing((v) => !v)}
            className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(step.id)}
            className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {step.nextStepId && (
          <ChevronDown className="h-3.5 w-3.5 text-gray-600 shrink-0" />
        )}
      </div>

      {/* Inline editor */}
      {editing && (
        <div className="border-t border-[#ffffff08] px-4 py-3 space-y-3 bg-[#0d0d0d]">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Siguiente paso</label>
              <select
                value={nextStepId}
                onChange={(e) => setNextStepId(e.target.value)}
                className="w-full h-7 text-xs bg-[#1a1a1a] border border-[#ffffff10] rounded-md px-2 text-white focus:outline-none focus:ring-1 focus:ring-whatsapp"
              >
                <option value="">— Ninguno (paso final) —</option>
                {steps.filter((s) => s.id !== step.id).map((s) => (
                  <option key={s.stepId} value={s.stepId}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Descripción</label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Opcional..."
              className="h-7 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-whatsapp/10 text-whatsapp border border-whatsapp/20 hover:bg-whatsapp/20 transition-all"
            >
              <Check className="h-3 w-3" /> Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FunnelsPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  // New step form
  const [newStepName, setNewStepName] = useState("")
  const [newStepId, setNewStepId] = useState("")
  const [newStepNext, setNewStepNext] = useState("")
  const [newStepDesc, setNewStepDesc] = useState("")

  // Funnel name inline edit
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState("")

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: funnels = [], isLoading } = useQuery<Funnel[]>({
    queryKey: ["funnels", workspaceId],
    queryFn: async () => {
      const res = await fetch("/api/funnels")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!workspaceId,
  })

  const selected = funnels.find((f) => f.id === selectedId) ?? null

  // ── Mutations ────────────────────────────────────────────────────────────────
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
    onSuccess: (f) => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setSelectedId(f.id)
      setNewName("")
      setShowCreate(false)
    },
  })

  const updateFunnel = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Funnel> }) => {
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
    },
  })

  const createStep = useMutation({
    mutationFn: async (data: Partial<FunnelStep>) => {
      const res = await fetch(`/api/funnels/${selectedId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
      setNewStepName("")
      setNewStepId("")
      setNewStepNext("")
      setNewStepDesc("")
    },
  })

  const updateStep = useMutation({
    mutationFn: async ({ stepDbId, data }: { stepDbId: string; data: Partial<FunnelStep> }) => {
      const res = await fetch(`/api/funnels/${selectedId}/steps/${stepDbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] }),
  })

  const deleteStep = useMutation({
    mutationFn: async (stepDbId: string) => {
      await fetch(`/api/funnels/${selectedId}/steps/${stepDbId}`, { method: "DELETE" })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] }),
  })

  // ── Apply preset ─────────────────────────────────────────────────────────────
  const applyPreset = async (template: typeof PRESET_TEMPLATES[0]) => {
    if (!selectedId) return
    for (let i = 0; i < template.steps.length; i++) {
      const s = template.steps[i]
      await fetch(`/api/funnels/${selectedId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, order: i }),
      })
    }
    queryClient.invalidateQueries({ queryKey: ["funnels", workspaceId] })
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAddStep = () => {
    if (!newStepName.trim() || !newStepId.trim() || !selectedId) return
    createStep.mutate({
      name: newStepName,
      stepId: newStepId,
      nextStepId: newStepNext || null,
      order: (selected?.steps.length ?? 0),
      description: newStepDesc || null,
    })
  }

  const handleSaveName = () => {
    if (!selectedId || !editName.trim()) return
    updateFunnel.mutate({ id: selectedId, data: { name: editName } })
    setEditingName(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-white overflow-hidden">

      {/* ══ LEFT PANEL: Funnel list ══ */}
      <div className="w-72 border-r border-[#ffffff10] flex flex-col bg-[#0a0a0a] shrink-0">
        <div className="p-4 border-b border-[#ffffff10] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-whatsapp" />
            <h2 className="font-bold text-sm tracking-tight text-white">Funnels</h2>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="p-3 border-b border-[#ffffff08] bg-[#0d0d0d] space-y-2">
            <Input
              autoFocus
              placeholder="Nombre del funnel..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && createFunnel.mutate(newName)}
              className="h-7 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => newName.trim() && createFunnel.mutate(newName)}
                disabled={createFunnel.isPending || !newName.trim()}
                className="flex-1 text-xs py-1 bg-whatsapp/10 text-whatsapp border border-whatsapp/20 rounded hover:bg-whatsapp/20 transition-all disabled:opacity-50"
              >
                Crear
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName("") }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-white rounded hover:bg-white/5 transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-xs animate-pulse">Cargando...</div>
          ) : funnels.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-600 text-xs">
              <GitFork className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>Sin funnels. Crea el primero.</p>
            </div>
          ) : (
            funnels.map((funnel) => (
              <button
                key={funnel.id}
                onClick={() => setSelectedId(funnel.id)}
                className={`w-full text-left px-4 py-3 transition-all flex items-center gap-3 group ${
                  selectedId === funnel.id
                    ? "bg-[#ffffff10] text-white"
                    : "text-gray-400 hover:bg-[#ffffff06] hover:text-white"
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${funnel.isActive ? "bg-whatsapp" : "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{funnel.name}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{funnel.steps.length} pasos</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL: Editor ══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
            <GitFork className="h-12 w-12 opacity-15" />
            <p className="text-sm font-medium">Selecciona o crea un funnel</p>
          </div>
        ) : (
          <>
            {/* Editor header */}
            <div className="px-6 py-4 border-b border-[#ffffff10] bg-[#0a0a0a] shrink-0 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                      className="h-8 text-base font-bold bg-[#1a1a1a] border-[#ffffff15] text-white max-w-xs"
                    />
                    <button onClick={handleSaveName} className="text-whatsapp hover:text-whatsapp/80">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingName(false)} className="text-gray-500 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                    <button
                      onClick={() => { setEditName(selected.name); setEditingName(true) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{selected.steps.length} pasos configurados</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Active toggle */}
                <button
                  onClick={() => updateFunnel.mutate({ id: selected.id, data: { isActive: !selected.isActive } })}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                    selected.isActive
                      ? "bg-whatsapp/10 text-whatsapp border-whatsapp/20 hover:bg-whatsapp/20"
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                  }`}
                >
                  {selected.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  {selected.isActive ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar funnel "${selected.name}"?`)) deleteFunnel.mutate(selected.id)
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              </div>
            </div>

            {/* Body: steps + presets */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6 space-y-6">

                {/* Presets */}
                {selected.steps.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-gray-500" />
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                        Plantillas prediseñadas
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {PRESET_TEMPLATES.map((t) => (
                        <button
                          key={t.label}
                          onClick={() => applyPreset(t)}
                          className="p-3 border border-[#ffffff10] rounded-lg bg-[#111111] hover:border-whatsapp/30 hover:bg-whatsapp/5 transition-all text-left space-y-2 group"
                        >
                          <p className="text-sm font-semibold text-white">{t.label}</p>
                          <div className="space-y-1">
                            {t.steps.map((s) => (
                              <div key={s.stepId} className="flex items-center gap-1.5">
                                <div className="h-1 w-1 rounded-full bg-gray-600 group-hover:bg-whatsapp/50 transition-colors" />
                                <span className="text-[10px] text-gray-500">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step list */}
                {selected.steps.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Pasos del funnel</p>
                    <div className="space-y-1">
                      {selected.steps.map((step) => (
                        <StepRow
                          key={step.id}
                          step={step}
                          steps={selected.steps}
                          funnelId={selected.id}
                          onDelete={(id) => deleteStep.mutate(id)}
                          onUpdate={(id, data) => updateStep.mutate({ stepDbId: id, data })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new step */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="h-3 w-3" /> Agregar paso
                  </p>
                  <div className="border border-[#ffffff10] rounded-lg p-4 bg-[#111111] space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Nombre *</label>
                        <Input
                          value={newStepName}
                          onChange={(e) => {
                            setNewStepName(e.target.value)
                            // Auto-generate stepId from name
                            if (!newStepId) {
                              setNewStepId(
                                e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
                              )
                            }
                          }}
                          placeholder="ej: Contactado"
                          className="h-8 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Step ID *</label>
                        <Input
                          value={newStepId}
                          onChange={(e) => setNewStepId(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
                          placeholder="ej: contactado"
                          className="h-8 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Siguiente paso</label>
                        <select
                          value={newStepNext}
                          onChange={(e) => setNewStepNext(e.target.value)}
                          className="w-full h-8 text-xs bg-[#1a1a1a] border border-[#ffffff10] rounded-md px-2 text-white focus:outline-none focus:ring-1 focus:ring-whatsapp"
                        >
                          <option value="">— Ninguno (final) —</option>
                          {selected.steps.map((s) => (
                            <option key={s.stepId} value={s.stepId}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Descripción</label>
                        <Input
                          value={newStepDesc}
                          onChange={(e) => setNewStepDesc(e.target.value)}
                          placeholder="Opcional..."
                          className="h-8 text-xs bg-[#1a1a1a] border-[#ffffff10] text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAddStep}
                        disabled={createStep.isPending || !newStepName.trim() || !newStepId.trim()}
                        size="sm"
                        className="h-8 text-xs bg-whatsapp hover:bg-whatsapp/90 text-black font-semibold gap-1.5 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar paso
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Presets when steps already exist */}
                {selected.steps.length > 0 && (
                  <div className="space-y-3 border-t border-[#ffffff08] pt-6">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Layers className="h-3 w-3" /> Aplicar plantilla (reemplaza los pasos actuales)
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {PRESET_TEMPLATES.map((t) => (
                        <button
                          key={t.label}
                          onClick={async () => {
                            // Delete all existing steps first
                            for (const s of selected.steps) {
                              await fetch(`/api/funnels/${selected.id}/steps/${s.id}`, { method: "DELETE" })
                            }
                            await applyPreset(t)
                          }}
                          className="p-3 border border-[#ffffff10] rounded-lg bg-[#111111] hover:border-whatsapp/30 hover:bg-whatsapp/5 transition-all text-left"
                        >
                          <p className="text-xs font-semibold text-white">{t.label}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{t.steps.length} pasos</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
