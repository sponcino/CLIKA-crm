"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export function ConversationNotes({ conversationId, workspaceId }: { conversationId: string, workspaceId: string }) {
  const queryClient = useQueryClient()
  const [newNote, setNewNote] = useState("")

  const { data: notes = [] } = useQuery({
    queryKey: ['conversation-notes', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/notes?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!conversationId
  })

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to add note")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId] })
      setNewNote("")
    }
  })

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addNoteMutation.mutate()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea 
          placeholder="Escribe una nota interna..." 
          className="min-h-[60px] text-xs bg-white dark:bg-[#111111] border-[#ffffff10] text-slate-900 dark:text-white resize-none"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <div className="flex justify-end">
          <Button 
            size="sm" 
            className="h-6 text-[10px] px-2 bg-white/10 hover:bg-white/20 text-slate-900 dark:text-white"
            onClick={handleAddNote}
            disabled={addNoteMutation.isPending || !newNote.trim()}
          >
            Agregar Nota
          </Button>
        </div>
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
        {notes.length === 0 ? (
          <div className="p-3 bg-white dark:bg-[#111111] rounded-md text-xs text-gray-500 italic border border-[#ffffff08]">
            Sin notas disponibles.
          </div>
        ) : (
          notes.map((note: any) => (
            <div key={note.id} className="p-2.5 bg-white dark:bg-[#111111] rounded-md border border-[#ffffff08] space-y-1">
              <p className="text-xs text-slate-600 dark:text-gray-300 whitespace-pre-wrap">{note.content}</p>
              <div className="flex justify-between items-center text-[9px] text-gray-500">
                <span>{note.user?.name || "Usuario"}</span>
                <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
