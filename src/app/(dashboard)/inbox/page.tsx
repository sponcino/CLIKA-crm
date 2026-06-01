"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useInboxStore } from "@/stores/inbox.store"
import { useInboxStream } from "@/hooks/useInboxStream"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Search, Send, AlertTriangle, MessageSquare, Bot,
  Clock, Tag, X, Plus, StickyNote, PanelRightClose, PanelRightOpen,
  Paperclip, Image as ImageIcon, Headphones, FileText, Loader2
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

// ─── colour helpers for labels ─────────────────────────────────────────────────
const LABEL_COLORS: Record<string, string> = {
  red:    "bg-red-500/10 text-red-400 border-red-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  green:  "bg-green-500/10 text-green-400 border-green-500/20",
  blue:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  pink:   "bg-pink-500/10 text-pink-400 border-pink-500/20",
}
const COLOR_KEYS = Object.keys(LABEL_COLORS)
const labelColor = (c?: string | null) =>
  LABEL_COLORS[c ?? ""] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"

// ─── Main Component ────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId
  const queryClient = useQueryClient()

  const {
    conversations, setConversations,
    activeConversationId, setActiveConversation,
    messages, setMessages,
  } = useInboxStore()

  useInboxStream(workspaceId)

  // ── local UI state ─────────────────────────────────────────────────────────
  const [text, setText] = useState("")
  const [inputMode, setInputMode] = useState<"message" | "note">("message")
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [rightPanelOpen, setRightPanelOpen] = useState(false)   // hidden by default
  const snoozeRef = useRef<HTMLDivElement>(null)
  const labelRef  = useRef<HTMLDivElement>(null)
  const attachmentRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) setSnoozeOpen(false)
      if (labelRef.current  && !labelRef.current.contains(e.target as Node))  setLabelOpen(false)
      if (attachmentRef.current && !attachmentRef.current.contains(e.target as Node)) setAttachmentOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Hide right panel when no conversation is selected
  useEffect(() => {
    if (!activeConversationId) setRightPanelOpen(false)
  }, [activeConversationId])

  // ── conversations list ─────────────────────────────────────────────────────
  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { data: [] }
      const res = await fetch(`/api/conversations?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (convData?.data) setConversations(convData.data)
  }, [convData, setConversations])

  // ── active conversation full data (messages, snoozedUntil, labels) ─────────
  const { data: activeConvData } = useQuery({
    queryKey: ["conversation", activeConversationId, workspaceId],
    queryFn: async () => {
      if (!activeConversationId || !workspaceId) return null
      const res = await fetch(`/api/conversations/${activeConversationId}?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch messages")
      return res.json()
    },
    enabled: !!activeConversationId && !!workspaceId,
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (activeConvData?.messages && activeConversationId) {
      setMessages(activeConversationId, activeConvData.messages)
    }
  }, [activeConvData, activeConversationId, setMessages])

  // ── labels for active conversation ────────────────────────────────────────
  const { data: rawConvLabels = [] } = useQuery({
    queryKey: ["conversation-labels", activeConversationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/conversations/${activeConversationId}/labels?workspaceId=${workspaceId}`
      )
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!activeConversationId && !!workspaceId,
  })
  // Defensive: filter out any ConversationLabel where the nested label is missing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convLabels = (rawConvLabels as any[]).filter((cl) => cl?.label != null)

  const { data: workspaceLabels = [] } = useQuery({
    queryKey: ["workspace-labels", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/labels?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!workspaceId && labelOpen,
  })

  // ── notes for active conversation ──────────────────────────────────────────
  const { data: convNotes = [] } = useQuery({
    queryKey: ["conversation-notes", activeConversationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/conversations/${activeConversationId}/notes?workspaceId=${workspaceId}`
      )
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!activeConversationId && !!workspaceId,
  })

  // ── mutations ──────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId, text: content, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed to send")
      return res.json()
    },
    onSuccess: () => {
      setText("")
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
    },
  })

  const noteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/conversations/${activeConversationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed to save note")
      return res.json()
    },
    onSuccess: () => {
      setText("")
      queryClient.invalidateQueries({ queryKey: ["conversation-notes", activeConversationId] })
    },
  })

  const toggleAiMutation = useMutation({
    mutationFn: async (aiEnabled: boolean) => {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled }),
      })
      if (!res.ok) throw new Error("Failed to toggle AI")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] })
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: async (minutes: number | null) => {
      const res = await fetch(`/api/conversations/${activeConversationId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed to snooze")
      return res.json()
    },
    onSuccess: () => {
      setSnoozeOpen(false)
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] })
    },
  })

  const addLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/conversations/${activeConversationId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["conversation-labels", activeConversationId] }),
  })

  const removeLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/conversations/${activeConversationId}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["conversation-labels", activeConversationId] }),
  })

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      const color = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLabelName.trim(), color, workspaceId }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: (newLabel) => {
      setNewLabelName("")
      queryClient.invalidateQueries({ queryKey: ["workspace-labels", workspaceId] })
      addLabelMutation.mutate(newLabel.id)
    },
  })

  // ── helpers ────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!text.trim() || !activeConversationId) return
    if (inputMode === "note") noteMutation.mutate(text)
    else sendMutation.mutate(text)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "audio" | "document") => {
    const file = e.target.files?.[0]
    if (!file || !activeConversationId || !workspaceId) return
    setAttachmentOpen(false)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("workspaceId", workspaceId)
      
      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })
      
      if (!uploadRes.ok) throw new Error("Upload failed")
      const { mediaId, type: mediaType } = await uploadRes.json()

      const sendRes = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          type: mediaType || type,
          mediaId,
          workspaceId
        }),
      })
      if (!sendRes.ok) throw new Error("Send failed")
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
    } catch (err) {
      console.error(err)
      alert("Error al enviar archivo")
    } finally {
      setUploading(false)
      if (e.target) e.target.value = "" // Reset file input
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeMessages = activeConversationId ? messages[activeConversationId] ?? [] : []

  // snoozedUntil comes from the detailed fetch
  const snoozedUntil: string | null = activeConvData?.snoozedUntil ?? null
  const isSnoozed = !!snoozedUntil && new Date(snoozedUntil) > new Date()

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0a0a0a] text-sm text-gray-200">

      {/* ══════════ LEFT: Conversation List ══════════ */}
      <div className="w-80 border-r border-[#ffffff10] flex flex-col bg-[#0a0a0a] shrink-0 overflow-hidden">
        <div className="p-4 border-b border-[#ffffff10] space-y-3">
          <h2 className="font-bold text-lg tracking-tight text-white">Mensajes</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar contacto..."
              className="pl-8 bg-[#111111] border-[#ffffff10] text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-[#ffffff08]">
            {isLoadingConvs ? (
              <div className="p-6 text-center text-gray-500 animate-pulse">Cargando...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No hay conversaciones</div>
            ) : conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`p-4 cursor-pointer hover:bg-[#ffffff06] transition-all relative ${
                  activeConversationId === conv.id ? "bg-[#ffffff10]" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-semibold text-white truncate">
                    {conv.contact?.whatsappName || conv.contact?.whatsappPhone}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.contact?.aiEnabled && (
                      <span className="bg-[#6366f1] text-[10px] text-white font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                        IA
                      </span>
                    )}
                    {conv.requiresTemplate ? (
                      <div className="h-2 w-2 rounded-full bg-amber-500" title="Requiere Plantilla" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-whatsapp" title="Activo" />
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span className="truncate max-w-[170px] text-gray-500">{conv.contact?.whatsappPhone}</span>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {conv.updatedAt
                      ? formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false, locale: es })
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ══════════ CENTER: Chat Panel ══════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0f0f0f]">
        {activeConversation ? (
          <>
            {/* ── Header ── */}
            <div className="h-14 border-b border-[#ffffff10] flex items-center justify-between px-4 bg-[#0a0a0a] shrink-0 gap-2">

              {/* Left: avatar + name */}
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-7 w-7 border border-[#ffffff15] shrink-0">
                  <AvatarFallback className="bg-whatsapp/10 text-whatsapp text-xs font-semibold">
                    {activeConversation.contact?.whatsappName?.charAt(0) ?? "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white leading-none truncate text-sm">
                    {activeConversation.contact?.whatsappName || activeConversation.contact?.whatsappPhone}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {activeConversation.contact?.whatsappPhone}
                  </p>
                </div>
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">

                {/* AI Toggle */}
                <button
                  onClick={() => toggleAiMutation.mutate(!activeConversation.aiActive)}
                  disabled={toggleAiMutation.isPending}
                  title={activeConversation.aiActive ? "Pausar IA" : "Reanudar IA"}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border transition-all disabled:opacity-50 ${
                    activeConversation.aiActive
                      ? "bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20 hover:bg-[#6366f1]/20"
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {activeConversation.aiActive ? "Pausar IA" : "Reanudar IA"}
                  </span>
                </button>

                {/* Label dropdown */}
                <div className="relative" ref={labelRef}>
                  <button
                    onClick={() => setLabelOpen((o) => !o)}
                    title="Etiquetas"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-[#ffffff15] bg-transparent text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Etiqueta</span>
                  </button>

                  {labelOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-lg border border-[#ffffff15] bg-[#111111] shadow-2xl p-3 space-y-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Etiquetas</p>

                      {/* Applied labels */}
                      {convLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {convLabels.map((cl: any) => ( // eslint-disable-line
                            <span
                              key={cl.id}
                              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${labelColor(cl.label?.color)}`}
                            >
                              {cl.label?.name}
                              <button
                                onClick={() => removeLabelMutation.mutate(cl.labelId)}
                                className="hover:opacity-70 transition-opacity ml-0.5"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Available workspace labels not yet applied */}
                      {(workspaceLabels as any[]).filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id)).length > 0 && ( // eslint-disable-line
                        <div className="flex flex-wrap gap-1.5">
                          {(workspaceLabels as any[]) // eslint-disable-line
                            .filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id)) // eslint-disable-line
                            .map((label: any) => ( // eslint-disable-line
                              <button
                                key={label.id}
                                onClick={() => addLabelMutation.mutate(label.id)}
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80 ${labelColor(label?.color)}`}
                              >
                                <Plus className="h-2.5 w-2.5" />
                                {label.name}
                              </button>
                            ))}
                        </div>
                      )}

                      {/* Create new label */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (newLabelName.trim()) createLabelMutation.mutate()
                        }}
                        className="flex gap-2 pt-2 border-t border-[#ffffff10]"
                      >
                        <input
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          placeholder="Nueva etiqueta..."
                          className="flex-1 bg-[#1a1a1a] border border-[#ffffff10] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-whatsapp"
                        />
                        <button
                          type="submit"
                          disabled={createLabelMutation.isPending || !newLabelName.trim()}
                          className="px-2 py-1 bg-whatsapp hover:bg-whatsapp/90 text-black text-xs rounded font-bold disabled:opacity-50 transition-all"
                        >
                          +
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Snooze dropdown */}
                <div className="relative" ref={snoozeRef}>
                  <button
                    onClick={() => setSnoozeOpen((o) => !o)}
                    title="Pausar conversación"
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border transition-all ${
                      isSnoozed
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                        : "bg-transparent text-gray-300 border-[#ffffff15] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isSnoozed ? "Pausado" : "Pausar"}</span>
                  </button>

                  {snoozeOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-[#ffffff15] bg-[#111111] shadow-2xl py-1">
                      <p className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Pausar por
                      </p>
                      {[
                        { label: "15 minutos", minutes: 15 },
                        { label: "1 hora",     minutes: 60 },
                        { label: "3 horas",    minutes: 180 },
                        { label: "Mañana (24h)", minutes: 1440 },
                      ].map(({ label, minutes }) => (
                        <button
                          key={minutes}
                          onClick={() => snoozeMutation.mutate(minutes)}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                      {isSnoozed && (
                        <>
                          <div className="border-t border-[#ffffff10] my-1" />
                          <button
                            onClick={() => snoozeMutation.mutate(null)}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            Reanudar ahora
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right panel toggle */}
                <button
                  onClick={() => setRightPanelOpen((o) => !o)}
                  title={rightPanelOpen ? "Ocultar panel" : "Ver detalles"}
                  className="flex items-center justify-center h-7 w-7 rounded border border-[#ffffff15] text-gray-400 hover:bg-white/5 hover:text-white transition-all"
                >
                  {rightPanelOpen
                    ? <PanelRightClose className="h-3.5 w-3.5" />
                    : <PanelRightOpen className="h-3.5 w-3.5" />}
                </button>

                {/* Close */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs bg-transparent border-[#ffffff15] text-gray-300 hover:bg-white/5 hover:text-white rounded"
                >
                  Cerrar
                </Button>
              </div>
            </div>

            {/* Applied labels bar */}
            {convLabels.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-[#ffffff08] bg-[#0a0a0a] flex-wrap shrink-0">
                {convLabels.map((cl: any) => ( // eslint-disable-line
                  <span
                    key={cl.id}
                    className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-medium ${labelColor(cl.label?.color)}`}
                  >
                    {cl.label?.name}
                  </span>
                ))}
              </div>
            )}

            {/* Requires template alert */}
            {activeConversation.requiresTemplate && (
              <div className="bg-amber-950/40 text-amber-300 px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-[#ffffff08] shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                La ventana de 24 horas ha cerrado. Debes usar una plantilla para iniciar la conversación.
              </div>
            )}

            {/* Messages — flex-1 so it fills all remaining vertical space */}
            <ScrollArea className="flex-1 min-h-0 bg-[#0f0f0f]">
              <div className="p-6 space-y-4 max-w-4xl mx-auto pb-4">
                {activeMessages.length === 0 ? (
                  <div className="text-center text-gray-600 my-10">Sin mensajes anteriores</div>
                ) : (
                  activeMessages.map((msg) => {
                    const isOutbound = msg.direction === "OUTBOUND"
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-md p-3 shadow-md ${
                          isOutbound
                            ? "bg-[#1a3a2a] text-[#dcfce7] border border-whatsapp/15"
                            : "bg-[#1a1a1a] text-white border border-[#ffffff10]"
                        }`}>
                          {msg.mediaUrl ? (
                            <div className="mb-1">
                              {msg.content?.includes("image") || msg.content?.includes("sticker") ? (
                                <img src={msg.mediaUrl} alt="media" className="max-w-[240px] rounded-md" />
                              ) : msg.content?.includes("video") ? (
                                <video src={msg.mediaUrl} controls className="max-w-[240px] rounded-md" />
                              ) : msg.content?.includes("audio") ? (
                                <audio src={msg.mediaUrl} controls className="max-w-[240px]" />
                              ) : (
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline p-2 bg-black/20 rounded">
                                  <FileText className="h-4 w-4 shrink-0" /> <span className="truncate text-xs">Ver Archivo Adjunto</span>
                                </a>
                              )}
                              {msg.content && !msg.content.startsWith("[Media:") && (
                                <div className="whitespace-pre-wrap text-sm leading-relaxed mt-2">{msg.content}</div>
                              )}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                          )}
                          <div className="text-[10px] text-gray-500 mt-1.5 text-right font-medium">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>

            {/* Input area — always pinned to bottom */}
            <div className="shrink-0 border-t border-[#ffffff10] bg-[#111111]">
              {/* Tabs */}
              <div className="flex border-b border-[#ffffff08]">
                <button
                  onClick={() => setInputMode("message")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    inputMode === "message"
                      ? "border-whatsapp text-whatsapp"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Send className="h-3 w-3" />
                  Mensaje
                </button>
                <button
                  onClick={() => setInputMode("note")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    inputMode === "note"
                      ? "border-yellow-400 text-yellow-400"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <StickyNote className="h-3 w-3" />
                  Nota interna
                </button>
              </div>

              {/* Text input row */}
              <div className={`p-3 flex items-end gap-2 ${inputMode === "note" ? "bg-yellow-950/10" : ""}`}>
                {inputMode === "note" ? (
                  <textarea
                    placeholder="Escribe una nota interna... (solo visible para el equipo)"
                    className="flex-1 bg-yellow-950/30 border border-yellow-500/20 text-white placeholder-yellow-900/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/40 rounded-md px-3 py-2 text-sm resize-none min-h-[56px] max-h-32"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend()
                    }}
                  />
                ) : (
                  <div className="flex-1 flex gap-2">
                    <div className="relative" ref={attachmentRef}>
                      <Button
                        onClick={() => setAttachmentOpen(!attachmentOpen)}
                        className="h-10 w-10 p-0 shrink-0 bg-[#1a1a1a] border border-[#ffffff10] hover:bg-[#ffffff10] text-gray-400"
                        variant="outline"
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      </Button>
                      
                      {attachmentOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-[#ffffff15] bg-[#111111] shadow-2xl py-1 z-50">
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer transition-colors">
                            <ImageIcon className="h-4 w-4" /> Imagen
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                          </label>
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer transition-colors">
                            <Headphones className="h-4 w-4" /> Audio
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, "audio")} />
                          </label>
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer transition-colors">
                            <FileText className="h-4 w-4" /> Documento
                            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileUpload(e, "document")} />
                          </label>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Escribe un mensaje..."
                      className="flex-1 bg-[#1a1a1a] border-0 text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp rounded-md px-4 h-10"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                  </div>
                )}
                <Button
                  onClick={handleSend}
                  disabled={(sendMutation.isPending || noteMutation.isPending) || !text.trim()}
                  className={`rounded-md h-10 w-10 p-0 shrink-0 transition-all ${
                    inputMode === "note"
                      ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                      : "bg-whatsapp hover:bg-whatsappHover text-black"
                  }`}
                >
                  {inputMode === "note" ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {inputMode === "note" && (
                <p className="px-3 pb-2 text-[10px] text-yellow-600/60">
                  Ctrl+Enter para guardar · Solo visible para el equipo
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0f0f] text-gray-500 gap-3">
            <MessageSquare className="h-10 w-10 opacity-20 text-whatsapp" />
            <span className="font-medium text-sm">Selecciona una conversación para comenzar</span>
          </div>
        )}
      </div>

      {/* ══════════ RIGHT: Contact + Notes panel (collapsible) ══════════ */}
      {activeConversation && rightPanelOpen && (
        <div className="w-72 border-l border-[#ffffff10] bg-[#111111] flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ffffff10] bg-[#0d0d0d] shrink-0">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Detalles</span>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="text-gray-600 hover:text-gray-300 transition-colors"
              title="Cerrar panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contact card */}
          <div className="p-5 border-b border-[#ffffff10] text-center space-y-3 bg-[#0d0d0d] shrink-0">
            <Avatar className="h-14 w-14 mx-auto border border-[#ffffff15]">
              <AvatarFallback className="text-xl bg-whatsapp/10 text-whatsapp font-bold">
                {activeConversation.contact?.whatsappName?.charAt(0) ?? "C"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-sm text-white">
                {activeConversation.contact?.whatsappName ?? "Desconocido"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{activeConversation.contact?.whatsappPhone}</p>
            </div>
            <div className="inline-flex">
              <Badge className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                activeConversation.contact?.status === "NEW"
                  ? "bg-whatsapp/10 text-whatsapp border border-whatsapp/20"
                  : "bg-indigo-950 text-indigo-300 border border-indigo-500/20"
              }`}>
                {activeConversation.contact?.status}
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-5">

              {/* Lead details */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Detalles del Lead</h4>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-white truncate font-medium">{activeConversation.contact?.email ?? "—"}</span>
                  <span className="text-gray-500">Compañía:</span>
                  <span className="text-white truncate font-medium">{activeConversation.contact?.company ?? "—"}</span>
                  <span className="text-gray-500">Score:</span>
                  <span className="text-white font-medium">{activeConversation.contact?.leadScore ?? 0}</span>
                </div>
              </div>

              {/* Internal notes */}
              <div className="space-y-2 pt-4 border-t border-[#ffffff08]">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <StickyNote className="h-3 w-3" /> Notas Internas
                </h4>
                <div className="space-y-2">
                  {(convNotes as any[]).length === 0 ? ( // eslint-disable-line
                    <p className="text-xs text-gray-600 italic">Sin notas.</p>
                  ) : (
                    (convNotes as any[]).map((note: any) => ( // eslint-disable-line
                      <div key={note.id} className="p-2 bg-yellow-950/20 rounded border border-yellow-500/10 space-y-1">
                        <p className="text-xs text-yellow-200/80 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-[9px] text-gray-600">
                          {note.user?.name ?? "Usuario"} ·{" "}
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
