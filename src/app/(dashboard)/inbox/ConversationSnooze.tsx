"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Clock } from "lucide-react"

export function ConversationSnooze({ conversationId, snoozedUntil, workspaceId }: { conversationId: string, snoozedUntil: string | null | undefined, workspaceId: string }) {
  const queryClient = useQueryClient()

  const snoozeMutation = useMutation({
    mutationFn: async (minutes: number | null) => {
      const res = await fetch(`/api/conversations/${conversationId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to snooze")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const isSnoozed = snoozedUntil && new Date(snoozedUntil) > new Date()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`h-7 px-3 text-xs border-[#ffffff15] hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white rounded-md flex items-center gap-1.5 ${isSnoozed ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-transparent text-slate-600 dark:text-gray-300'}`}
        >
          <Clock className="h-3.5 w-3.5" />
          {isSnoozed ? 'Pausado' : 'Pausar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2 bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white" align="end">
        <div className="space-y-1">
          <h5 className="text-xs font-semibold px-2 pb-1 text-slate-500 dark:text-gray-400">Pausar conversación</h5>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => snoozeMutation.mutate(15)}>
            15 minutos
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => snoozeMutation.mutate(60)}>
            1 hora
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => snoozeMutation.mutate(24 * 60)}>
            Mañana (24h)
          </Button>
          {isSnoozed && (
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-1" onClick={() => snoozeMutation.mutate(null)}>
              Reanudar ahora
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
