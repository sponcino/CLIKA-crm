"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useInboxStore } from "@/stores/inbox.store"
import { useInboxStream } from "@/hooks/useInboxStream"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Search, Send, AlertTriangle, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export default function InboxPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId
  const queryClient = useQueryClient()

  // Store
  const { 
    conversations, setConversations, 
    activeConversationId, setActiveConversation,
    messages, setMessages
  } = useInboxStore()

  // SSE Stream
  useInboxStream(workspaceId)

  const [text, setText] = useState("")

  // Fetch Conversations
  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { data: [] }
      const res = await fetch(`/api/conversations?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!workspaceId
  })

  // Sync with store
  useEffect(() => {
    if (convData?.data) {
      setConversations(convData.data)
    }
  }, [convData, setConversations])

  // Fetch active conversation messages
  const { data: activeConvData } = useQuery({
    queryKey: ['conversation', activeConversationId, workspaceId],
    queryFn: async () => {
      if (!activeConversationId || !workspaceId) return null
      const res = await fetch(`/api/conversations/${activeConversationId}?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch messages")
      return res.json()
    },
    enabled: !!activeConversationId && !!workspaceId
  })

  useEffect(() => {
    if (activeConvData?.messages && activeConversationId) {
      setMessages(activeConversationId, activeConvData.messages)
    }
  }, [activeConvData, activeConversationId, setMessages])

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId, text: content, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to send")
      return res.json()
    },
    onSuccess: () => {
      setText("")
      queryClient.invalidateQueries({ queryKey: ['conversation', activeConversationId] })
    }
  })

  const handleSend = () => {
    if (!text.trim() || !activeConversationId) return
    sendMutation.mutate(text)
  }

  const activeConversation = conversations.find(c => c.id === activeConversationId)
  const activeMessages = activeConversationId ? (messages[activeConversationId] || []) : []

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-sm text-gray-200">
      {/* LEFT: Conversation List */}
      <div className="w-80 border-r border-[#ffffff10] flex flex-col bg-[#0a0a0a] shrink-0">
        <div className="p-4 border-b border-[#ffffff10] space-y-3">
          <h2 className="font-bold text-lg tracking-tight text-white">Mensajes</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar contacto..." 
              className="pl-8 bg-[#111111] border-[#ffffff10] text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all duration-150"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="divide-y divide-[#ffffff08]">
            {isLoadingConvs ? (
              <div className="p-6 text-center text-gray-500 animate-pulse">Cargando...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No hay conversaciones</div>
            ) : conversations.map(conv => (
              <div 
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`p-4 cursor-pointer hover:bg-[#ffffff06] transition-all duration-150 relative ${
                  activeConversationId === conv.id ? 'bg-[#ffffff10]' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-semibold text-white truncate">{conv.contact.whatsappName || conv.contact.whatsappPhone}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.contact.aiEnabled && (
                      <span className="bg-[#6366f1] text-[10px] text-white font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0">
                        IA
                      </span>
                    )}
                    {conv.requiresTemplate ? (
                      <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Requiere Plantilla" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-whatsapp shrink-0" title="Activo" />
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span className="truncate max-w-[170px] text-gray-500">
                    {conv.contact.whatsappPhone}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {conv.updatedAt ? formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false, locale: es }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* CENTER: Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f0f]">
        {activeConversation ? (
          <>
            {/* Active Header */}
            <div className="h-12 border-b border-[#ffffff10] flex items-center justify-between px-6 bg-[#0a0a0a] shrink-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-7 w-7 border border-[#ffffff15]">
                  <AvatarFallback className="bg-whatsapp/10 text-whatsapp text-xs font-semibold">
                    {activeConversation.contact.whatsappName?.charAt(0) || "C"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-white leading-none">{activeConversation.contact.whatsappName || activeConversation.contact.whatsappPhone}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activeConversation.aiActive ? (
                      <span className="text-xs text-[#6366f1] font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1] animate-pulse" /> IA Activa
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Humano
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs bg-transparent border-[#ffffff15] text-gray-300 hover:bg-white/5 hover:text-white rounded-md">
                  Cerrar
                </Button>
              </div>
            </div>

            {/* Requires Template Alert */}
            {activeConversation.requiresTemplate && (
              <div className="bg-amber-950/40 text-amber-300 px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-[#ffffff08] shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                La ventana de 24 horas ha cerrado. Debes usar una plantilla para iniciar la conversación.
              </div>
            )}

            {/* Messages Scroll Area */}
            <ScrollArea className="flex-1 p-6 bg-[#0f0f0f] scrollbar-thin">
              <div className="space-y-4 max-w-4xl mx-auto pb-4">
                {activeMessages.length === 0 ? (
                  <div className="text-center text-gray-600 my-10">Sin mensajes anteriores</div>
                ) : activeMessages.map((msg) => {
                  const isOutbound = msg.direction === "OUTBOUND"
                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-md p-3 relative shadow-md transition-all duration-150 ${
                        isOutbound 
                          ? 'bg-[#1a3a2a] text-[#dcfce7] border border-whatsapp/15' 
                          : 'bg-[#1a1a1a] text-white border border-[#ffffff10]'
                      }`}>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                        <div className="text-[10px] text-gray-500 mt-1.5 text-right font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            {/* Message Input bar */}
            <div className="p-4 bg-[#111111] shrink-0 border-t border-[#ffffff10] flex items-center gap-2">
              <Input 
                placeholder="Escribe un mensaje..." 
                className="flex-1 bg-[#1a1a1a] border-0 text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md px-4 h-10 transition-all duration-150"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <Button 
                onClick={handleSend} 
                disabled={sendMutation.isPending || !text.trim()} 
                className="rounded-md h-10 w-10 p-0 bg-whatsapp hover:bg-whatsappHover text-black shrink-0 transition-all duration-150"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0f0f] text-gray-500 gap-3">
            <MessageSquare className="h-10 w-10 opacity-20 text-whatsapp" />
            <span className="font-medium text-sm">Selecciona una conversación para comenzar</span>
          </div>
        )}
      </div>

      {/* RIGHT: Contact Info */}
      {activeConversation && (
        <div className="w-80 border-l border-[#ffffff10] bg-[#111111] flex flex-col shrink-0">
          <div className="p-6 border-b border-[#ffffff10] text-center space-y-3 bg-[#0d0d0d]">
            <Avatar className="h-16 w-16 mx-auto border border-[#ffffff15]">
              <AvatarFallback className="text-xl bg-whatsapp/10 text-whatsapp font-bold">
                {activeConversation.contact.whatsappName?.charAt(0) || "C"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-base text-white">{activeConversation.contact.whatsappName || "Desconocido"}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{activeConversation.contact.whatsappPhone}</p>
            </div>
            <div className="inline-flex">
              <Badge className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                activeConversation.contact.status === 'NEW'
                  ? 'bg-whatsapp/10 text-whatsapp border border-whatsapp/20'
                  : 'bg-indigo-950 text-indigo-300 border border-indigo-500/20'
              }`}>
                {activeConversation.contact.status}
              </Badge>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-6 scrollbar-thin">
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Detalles del Lead</h4>
                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white truncate font-medium">{activeConversation.contact.email || "-"}</span>
                  
                  <span className="text-gray-400">Compañía:</span>
                  <span className="text-white truncate font-medium">{activeConversation.contact.company || "-"}</span>
                  
                  <span className="text-gray-400">Score de Lead:</span>
                  <span className="text-white font-medium">{activeConversation.contact.leadScore}</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-[#ffffff08]">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas Internas</h4>
                <div className="p-3 bg-[#1a1a1a] rounded-md text-xs text-gray-400 italic border border-[#ffffff08]">
                  Sin notas disponibles.
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
