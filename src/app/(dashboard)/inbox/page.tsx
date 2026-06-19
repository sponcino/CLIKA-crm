"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useInboxStore } from "@/stores/inbox.store"
import { useInboxStream } from "@/hooks/useInboxStream"
import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Search, Send, AlertTriangle, MessageSquare, Bot,
  Clock, Tag, X, Plus, StickyNote, PanelRightClose, PanelRightOpen,
  Paperclip, Image as ImageIcon, Headphones, FileText, Loader2,
  ChevronDown, ChevronUp, Pencil, Archive, Trash2, Check,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

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
  LABEL_COLORS[c ?? ""] ?? "bg-gray-500/10 text-slate-500 dark:text-gray-400 border-gray-500/20"

// ─── lead status helpers ───────────────────────────────────────────────────────
const LEAD_STATUS_OPTIONS = [
  { value: "NEW",                   label: "Nuevo",               color: "text-slate-500 dark:text-gray-400" },
  { value: "CONTACTED",             label: "Contactado",          color: "text-blue-400" },
  { value: "QUALIFIED",             label: "Calificado",          color: "text-indigo-400" },
  { value: "INTERESTED",            label: "Interesado",          color: "text-purple-400" },
  { value: "APPOINTMENT_SCHEDULED", label: "Cita agendada",       color: "text-yellow-400" },
  { value: "PROPOSAL_SENT",         label: "Propuesta enviada",   color: "text-orange-400" },
  { value: "WON",                   label: "Ganado",              color: "text-green-400" },
  { value: "LOST",                  label: "Perdido",             color: "text-red-400" },
]
const statusOption = (v?: string | null) =>
  LEAD_STATUS_OPTIONS.find((o) => o.value === v) ?? LEAD_STATUS_OPTIONS[0]

// ─── collapsible section ───────────────────────────────────────────────────────
function Section({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 dark:border-[#ffffff08]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white/60 transition-colors"
      >
        {title}
        {open
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

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
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const snoozeRef = useRef<HTMLDivElement>(null)
  const labelRef  = useRef<HTMLDivElement>(null)
  const attachmentRef = useRef<HTMLDivElement>(null)

  // ── right panel state ──────────────────────────────────────────────────────
  const [sections, setSections] = useState({
    status: true, score: true, funnel: false, datos: true, etiquetas: true, info: true,
  })
  const toggleSection = (key: keyof typeof sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }))

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [flashField, setFlashField] = useState<string | null>(null)
  const [contactRefreshedAgo, setContactRefreshedAgo] = useState<string | null>(null)
  const [panelLabelOpen, setPanelLabelOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [windowCountdown, setWindowCountdown] = useState("")

  const prevLeadScoreRef = useRef<number | null>(null)
  const contactRefreshTimeRef = useRef<Date | null>(null)
  const panelLabelRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) setSnoozeOpen(false)
      if (labelRef.current  && !labelRef.current.contains(e.target as Node))  setLabelOpen(false)
      if (attachmentRef.current && !attachmentRef.current.contains(e.target as Node)) setAttachmentOpen(false)
      if (panelLabelRef.current && !panelLabelRef.current.contains(e.target as Node)) setPanelLabelOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Hide right panel when no conversation selected
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

  // ── active conversation full data ──────────────────────────────────────────
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

  // ── contact detail (live, every 10s) ──────────────────────────────────────
  const { data: contactDetail } = useQuery({
    queryKey: ["contact-detail", activeConvData?.contactId],
    queryFn: async () => {
      const contactId = activeConvData?.contactId
      if (!contactId || !workspaceId) return null
      const res = await fetch(`/api/contacts/${contactId}?workspaceId=${workspaceId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!activeConvData?.contactId && !!workspaceId && rightPanelOpen,
    refetchInterval: 10000,
  })

  // Lead score change detection + refresh label
  useEffect(() => {
    if (!contactDetail) return
    contactRefreshTimeRef.current = new Date()
    setContactRefreshedAgo("ahora")

    const prev = prevLeadScoreRef.current
    if (prev !== null && contactDetail.leadScore !== prev) {
      toast.success(`Lead score actualizado: ${prev} → ${contactDetail.leadScore}`)
      setFlashField("leadScore")
      setTimeout(() => setFlashField(null), 1500)
    }
    prevLeadScoreRef.current = contactDetail.leadScore ?? 0
  }, [contactDetail])

  // "actualizado hace X" counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (!contactRefreshTimeRef.current) return
      const secs = Math.floor((Date.now() - contactRefreshTimeRef.current.getTime()) / 1000)
      if (secs < 60) setContactRefreshedAgo(`${secs}s`)
      else setContactRefreshedAgo(`${Math.floor(secs / 60)}m`)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // ── 24h window countdown ───────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const lastMsgAt =
        activeConvData?.contact?.lastMessageAt ??
        conversations.find((c) => c.id === activeConversationId)?.contact?.lastMessageAt
      if (!lastMsgAt) { setWindowCountdown(""); return }
      const remaining = 24 * 60 * 60 * 1000 - (Date.now() - new Date(lastMsgAt).getTime())
      if (remaining <= 0) { setWindowCountdown("cerrada"); return }
      const h = Math.floor(remaining / (1000 * 60 * 60))
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      setWindowCountdown(`${h}h ${m}m`)
    }
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [activeConvData, activeConversationId, conversations])

  // ── labels ─────────────────────────────────────────────────────────────────
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convLabels = (rawConvLabels as any[]).filter((cl) => cl?.label != null)

  const { data: workspaceLabels = [] } = useQuery({
    queryKey: ["workspace-labels", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/labels?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!workspaceId && (labelOpen || panelLabelOpen),
  })

  // ── notes ──────────────────────────────────────────────────────────────────
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

  const updateContactMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: Record<string, any>) => {
      const contactId = activeConvData?.contactId ?? activeConvData?.contact?.id
      const res = await fetch(`/api/contacts/${contactId}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-detail"] })
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
      setEditingField(null)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Conversación archivada")
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] })
      setActiveConversation(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
    },
    onSuccess: () => {
      toast.success("Conversación eliminada")
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] })
      setActiveConversation(null)
      setShowDeleteConfirm(false)
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
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) throw new Error("Upload failed")
      const { mediaId, type: mediaType } = await uploadRes.json()
      const sendRes = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          type: mediaType || type,
          mediaId,
          workspaceId,
        }),
      })
      if (!sendRes.ok) throw new Error("Send failed")
      queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] })
    } catch (err) {
      console.error(err)
      toast.error("Error al enviar archivo")
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ""
    }
  }

  const startEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }, [])

  const commitEdit = useCallback(
    (field: string) => {
      if (editValue.trim() === "") { setEditingField(null); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = { [field]: editValue.trim() }
      updateContactMutation.mutate(payload)
    },
    [editValue, updateContactMutation]
  )

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeMessages = activeConversationId ? messages[activeConversationId] ?? [] : []
  const snoozedUntil: string | null = activeConvData?.snoozedUntil ?? null
  const isSnoozed = !!snoozedUntil && new Date(snoozedUntil) > new Date()

  // Merged contact: prefer live-polled data
  const contact = contactDetail ?? activeConvData?.contact ?? activeConversation?.contact
  const leadScore = contact?.leadScore ?? 0

  // Inline edit field renderer
  const EditableField = ({
    field, label, value,
  }: { field: string; label: string; value?: string | null }) => {
    const isEditing = editingField === field
    return (
      <div className="flex items-start justify-between gap-2 py-1.5">
        <span className="text-[11px] text-white/40 shrink-0 w-20">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit(field)
                if (e.key === "Escape") setEditingField(null)
              }}
              className="flex-1 bg-slate-50 dark:bg-white/5 border border-white/15 rounded px-2 py-0.5 text-xs text-slate-900 dark:text-white outline-none focus:border-white/30"
            />
            <button onClick={() => commitEdit(field)} className="text-green-400 hover:text-green-300">
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEdit(field, value ?? "")}
            className="flex items-center gap-1 group flex-1 text-right justify-end"
          >
            <span className={`text-[11px] font-medium truncate ${value ? "text-slate-900 dark:text-white" : "text-white/25"}`}>
              {value || "—"}
            </span>
            <Pencil className="h-2.5 w-2.5 text-white/0 group-hover:text-white/30 transition-colors shrink-0" />
          </button>
        )}
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0a] text-sm text-slate-900 dark:text-white">

      {/* ══════════ LEFT: Conversation List ══════════ */}
      <div className="w-80 border-r border-slate-200 dark:border-white/10 flex flex-col bg-slate-50 dark:bg-[#0a0a0a] shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
          <h2 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Mensajes</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar contacto..."
              className="pl-8 bg-[var(--bg-surface)] border-slate-200 dark:border-[#ffffff10] text-slate-900 dark:text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all"
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
                className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#ffffff06] transition-all relative ${
                  activeConversationId === conv.id ? "bg-green-50 dark:bg-[#ffffff10]" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                    {conv.contact?.whatsappName || conv.contact?.whatsappPhone}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.contact?.aiEnabled && (
                      <span className="bg-[#6366f1] text-[10px] text-slate-900 dark:text-white font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                        IA
                      </span>
                    )}
                    {conv.requiresTemplate ? (
                      <div className="h-2 w-2 rounded-full bg-amber-500" title="Requiere Plantilla" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-whatsapp" title="Activo" />
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-gray-400">
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-surface)]">
        {activeConversation ? (
          <>
            {/* ── Header ── */}
            <div className="h-14 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 bg-slate-50 dark:bg-[#0a0a0a] shrink-0 gap-2">

              {/* Left: avatar + name */}
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-7 w-7 border border-slate-200 dark:border-[#ffffff15] shrink-0">
                  <AvatarFallback className="bg-green-500 dark:bg-whatsapp/10 text-whatsapp text-xs font-semibold">
                    {activeConversation.contact?.whatsappName?.charAt(0) ?? "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white leading-none truncate text-sm">
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
                      : "bg-gray-500/10 text-slate-500 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
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
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-slate-200 dark:border-[#ffffff15] bg-transparent text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white transition-all"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Etiqueta</span>
                  </button>

                  {labelOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-lg border border-slate-200 dark:border-[#ffffff15] bg-[var(--bg-surface)] shadow-2xl p-3 space-y-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Etiquetas</p>

                      {convLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {convLabels.map((cl: any) => (
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

                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(workspaceLabels as any[]).filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(workspaceLabels as any[])
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id))
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .map((label: any) => (
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

                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (newLabelName.trim()) createLabelMutation.mutate()
                        }}
                        className="flex gap-2 pt-2 border-t border-slate-200 dark:border-[#ffffff10]"
                      >
                        <input
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          placeholder="Nueva etiqueta..."
                          className="flex-1 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#ffffff10] rounded px-2 py-1 text-xs text-slate-900 dark:text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-whatsapp"
                        />
                        <button
                          type="submit"
                          disabled={createLabelMutation.isPending || !newLabelName.trim()}
                          className="px-2 py-1 bg-green-500 dark:bg-whatsapp hover:bg-green-500 dark:bg-whatsapp/90 text-black text-xs rounded font-bold disabled:opacity-50 transition-all"
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
                        : "bg-transparent text-slate-600 dark:text-gray-300 border-slate-200 dark:border-[#ffffff15] hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isSnoozed ? "Pausado" : "Pausar"}</span>
                  </button>

                  {snoozeOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-slate-200 dark:border-[#ffffff15] bg-[var(--bg-surface)] shadow-2xl py-1">
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
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                      {isSnoozed && (
                        <>
                          <div className="border-t border-slate-200 dark:border-[#ffffff10] my-1" />
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
                  className="flex items-center justify-center h-7 w-7 rounded border border-slate-200 dark:border-[#ffffff15] text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white transition-all"
                >
                  {rightPanelOpen
                    ? <PanelRightClose className="h-3.5 w-3.5" />
                    : <PanelRightOpen className="h-3.5 w-3.5" />}
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs bg-transparent border-slate-200 dark:border-[#ffffff15] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white rounded"
                >
                  Cerrar
                </Button>
              </div>
            </div>

            {/* Applied labels bar */}
            {convLabels.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-slate-200 dark:border-[#ffffff08] bg-slate-50 dark:bg-[#0a0a0a] flex-wrap shrink-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {convLabels.map((cl: any) => (
                  <span
                    key={cl.id}
                    className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-medium ${labelColor(cl.label?.color)}`}
                  >
                    {cl.label?.name}
                  </span>
                ))}
              </div>
            )}

            {/* 24h window banner — live countdown */}
            {activeConversation.requiresTemplate && (
              <div className="bg-amber-950/40 text-amber-300 px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-slate-200 dark:border-[#ffffff08] shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                {windowCountdown === "cerrada"
                  ? "Ventana cerrada — usá una plantilla para reiniciar la conversación"
                  : windowCountdown
                    ? `Ventana cierra en: ${windowCountdown} — respondé antes para no perderla`
                    : "Ventana de 24h activa — calculando tiempo restante..."}
              </div>
            )}

            {/* Messages */}
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
                            : "bg-white dark:bg-[#111111] text-slate-900 dark:text-white border border-slate-200 dark:border-[#ffffff10]"
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
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="truncate text-xs">Ver Archivo Adjunto</span>
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

            {/* Input area */}
            <div className="shrink-0 border-t border-slate-200 dark:border-[#ffffff10] bg-[var(--bg-surface)]">
              <div className="flex border-b border-slate-200 dark:border-[#ffffff08]">
                <button
                  onClick={() => setInputMode("message")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    inputMode === "message"
                      ? "border-whatsapp text-whatsapp"
                      : "border-transparent text-gray-500 hover:text-slate-600 dark:text-gray-300"
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
                      : "border-transparent text-gray-500 hover:text-slate-600 dark:text-gray-300"
                  }`}
                >
                  <StickyNote className="h-3 w-3" />
                  Nota interna
                </button>
              </div>

              <div className={`p-3 flex items-end gap-2 ${inputMode === "note" ? "bg-yellow-950/10" : ""}`}>
                {inputMode === "note" ? (
                  <textarea
                    placeholder="Escribe una nota interna... (solo visible para el equipo)"
                    className="flex-1 bg-yellow-950/30 border border-yellow-500/20 text-slate-900 dark:text-white placeholder-yellow-900/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/40 rounded-md px-3 py-2 text-sm resize-none min-h-[56px] max-h-32"
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
                        className="h-10 w-10 p-0 shrink-0 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#ffffff10] hover:bg-[#ffffff10] text-slate-500 dark:text-gray-400"
                        variant="outline"
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      </Button>
                      {attachmentOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-slate-200 dark:border-[#ffffff15] bg-[var(--bg-surface)] shadow-2xl py-1 z-50">
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white cursor-pointer transition-colors">
                            <ImageIcon className="h-4 w-4" /> Imagen
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                          </label>
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white cursor-pointer transition-colors">
                            <Headphones className="h-4 w-4" /> Audio
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, "audio")} />
                          </label>
                          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white cursor-pointer transition-colors">
                            <FileText className="h-4 w-4" /> Documento
                            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileUpload(e, "document")} />
                          </label>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Escribe un mensaje..."
                      className="flex-1 bg-white dark:bg-[#111111] border-0 text-slate-900 dark:text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp rounded-md px-4 h-10"
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
                      : "bg-green-500 dark:bg-whatsapp hover:bg-green-500 dark:bg-whatsappHover text-black"
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

      {/* ══════════ RIGHT: Contact panel (320px, slide-in) ══════════ */}
      <div
        className={`border-l border-slate-200 dark:border-[#ffffff10] bg-[var(--bg-surface)] flex flex-col shrink-0 overflow-hidden transition-all duration-200 ease-in-out ${
          activeConversation && rightPanelOpen ? "w-80 opacity-100" : "w-0 opacity-0"
        }`}
      >
        {activeConversation && rightPanelOpen && (
          <>
            {/* ── Panel header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#ffffff10] bg-[#0d0d0d] shrink-0">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Contacto</span>
              <div className="flex items-center gap-2">
                {contactRefreshedAgo && (
                  <span className="text-[9px] text-white/20">actualizado hace {contactRefreshedAgo}</span>
                )}
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="text-white/20 hover:text-white/50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {/* ── Avatar + name ── */}
              <div className="px-4 py-5 border-b border-slate-200 dark:border-[#ffffff08] text-center space-y-3 bg-[#0d0d0d]">
                <div className="relative inline-block">
                  <Avatar className="h-16 w-16 mx-auto border-2 border-slate-200 dark:border-[#ffffff15]">
                    <AvatarFallback className="text-2xl bg-green-500 dark:bg-whatsapp/10 text-whatsapp font-bold">
                      {contact?.whatsappName?.charAt(0) ?? contact?.fullName?.charAt(0) ?? "C"}
                    </AvatarFallback>
                  </Avatar>
                  {/* Bot indicator */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center ${
                      contact?.aiEnabled ? "bg-[#6366f1]" : "bg-gray-600"
                    }`}
                    title={contact?.aiEnabled ? "IA activa" : "IA pausada"}
                  >
                    <Bot className="h-2 w-2 text-slate-900 dark:text-white" />
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
                    {contact?.fullName || contact?.whatsappName || "Desconocido"}
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">{contact?.whatsappPhone}</p>
                </div>
              </div>

              {/* ── Estado del Lead ── */}
              <Section
                title="Estado del Lead"
                open={sections.status}
                onToggle={() => toggleSection("status")}
              >
                <select
                  value={contact?.status ?? "NEW"}
                  onChange={(e) => updateContactMutation.mutate({ status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-white/25 cursor-pointer"
                >
                  {LEAD_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-white dark:bg-[#111111]">
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${statusOption(contact?.status).color}`}>
                    {statusOption(contact?.status).label}
                  </span>
                </div>
              </Section>

              {/* ── Puntuación ── */}
              <Section
                title="Puntuación"
                open={sections.score}
                onToggle={() => toggleSection("score")}
              >
                <div
                  className={`space-y-2 transition-all duration-700 ${
                    flashField === "leadScore" ? "ring-1 ring-green-400/40 rounded-md p-1" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40">Lead Score</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      leadScore >= 70 ? "text-green-400"
                      : leadScore >= 40 ? "text-yellow-400"
                      : "text-white/60"
                    }`}>
                      {leadScore}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-50 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        leadScore >= 70 ? "bg-green-500"
                        : leadScore >= 40 ? "bg-yellow-500"
                        : "bg-white/20"
                      }`}
                      style={{ width: `${Math.min(leadScore, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/20">
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>
              </Section>

              {/* ── Progreso del Paso ── */}
              <Section
                title="Progreso del Paso"
                open={sections.funnel}
                onToggle={() => toggleSection("funnel")}
              >
                <p className="text-[11px] text-white/25 italic">Sin funnel asignado</p>
              </Section>

              {/* ── Datos Capturados ── */}
              <Section
                title="Datos Capturados"
                open={sections.datos}
                onToggle={() => toggleSection("datos")}
              >
                <div className="space-y-0.5">
                  <EditableField field="fullName"     label="Nombre"    value={contact?.fullName} />
                  <EditableField field="email"        label="Email"     value={contact?.email} />
                  <EditableField field="whatsappPhone" label="Teléfono" value={contact?.whatsappPhone} />
                  <EditableField field="company"      label="Empresa"   value={contact?.company} />
                  <EditableField field="businessType" label="Tipo neg." value={contact?.businessType} />
                </div>
              </Section>

              {/* ── Etiquetas ── */}
              <Section
                title="Etiquetas"
                open={sections.etiquetas}
                onToggle={() => toggleSection("etiquetas")}
              >
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {convLabels.map((cl: any) => (
                    <span
                      key={cl.id}
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${labelColor(cl.label?.color)}`}
                    >
                      {cl.label?.name}
                      <button
                        onClick={() => removeLabelMutation.mutate(cl.labelId)}
                        className="hover:opacity-70 ml-0.5"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative" ref={panelLabelRef}>
                  <button
                    onClick={() => setPanelLabelOpen((o) => !o)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors border border-slate-200 dark:border-white/10 rounded px-2 py-1"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Agregar etiqueta...
                  </button>
                  {panelLabelOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-slate-200 dark:border-[#ffffff15] bg-[var(--bg-surface)] shadow-2xl p-2 space-y-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(workspaceLabels as any[])
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id))
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((label: any) => (
                          <button
                            key={label.id}
                            onClick={() => { addLabelMutation.mutate(label.id); setPanelLabelOpen(false) }}
                            className={`w-full text-left inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded hover:bg-slate-50 dark:bg-white/5 ${labelColor(label?.color)}`}
                          >
                            {label.name}
                          </button>
                        ))}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(workspaceLabels as any[]).filter((l) => !convLabels.some((cl: any) => cl.labelId === l.id)).length === 0 && (
                        <p className="text-[10px] text-white/25 px-2 py-1">No hay etiquetas disponibles</p>
                      )}
                    </div>
                  )}
                </div>
              </Section>

              {/* ── WhatsApp ID ── */}
              <Section
                title="WhatsApp"
                open={sections.info}
                onToggle={() => toggleSection("info")}
              >
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Número</span>
                    <span className="text-white/70 font-mono">{contact?.whatsappPhone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Registrado</span>
                    <span className="text-white/50">
                      {contact?.createdAt
                        ? new Date(contact.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Último msj</span>
                    <span className="text-white/50">
                      {contact?.lastMessageAt
                        ? formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: true, locale: es })
                        : "—"}
                    </span>
                  </div>
                </div>
              </Section>

              {/* ── Internal Notes ── */}
              <div className="px-4 py-4 border-b border-slate-200 dark:border-[#ffffff08]">
                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <StickyNote className="h-3 w-3" /> Notas Internas
                </h4>
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(convNotes as any[]).length === 0 ? (
                    <p className="text-[11px] text-white/20 italic">Sin notas.</p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (convNotes as any[]).map((note: any) => (
                      <div key={note.id} className="p-2.5 bg-yellow-950/20 rounded-md border border-yellow-500/10 space-y-1">
                        <p className="text-[11px] text-yellow-200/80 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-[9px] text-white/25">
                          {note.user?.name ?? "Usuario"} ·{" "}
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Bottom actions ── */}
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                  className="w-full h-8 text-xs border-slate-200 dark:border-white/10 bg-transparent text-white/50 hover:bg-slate-50 dark:bg-white/5 hover:text-white/80 transition-colors gap-1.5"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {archiveMutation.isPending ? "Archivando..." : "Archivar conversación"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full h-8 text-xs border-red-500/20 bg-transparent text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar conversación
                </Button>
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#111] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              Eliminar conversación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/50">
            Esta acción eliminará permanentemente la conversación y todos sus mensajes. No se puede deshacer.
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border-slate-200 dark:border-white/10 bg-transparent text-white/60 hover:bg-slate-50 dark:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-500/90 hover:bg-red-500 text-slate-900 dark:text-white border-0"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
