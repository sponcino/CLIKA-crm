"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Tag, X, Plus } from "lucide-react"

export function ConversationLabels({ conversationId, workspaceId }: { conversationId: string, workspaceId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")

  const { data: labels = [] } = useQuery({
    queryKey: ['workspace-labels', workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/labels?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!workspaceId
  })

  const { data: convLabels = [] } = useQuery({
    queryKey: ['conversation-labels', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/labels?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!conversationId
  })

  const addLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to add label")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-labels', conversationId] })
  })

  const removeLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/labels`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to remove label")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversation-labels', conversationId] })
  })

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']
      const color = colors[Math.floor(Math.random() * colors.length)]
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName, color, workspaceId })
      })
      if (!res.ok) throw new Error("Failed to create label")
      return res.json()
    },
    onSuccess: (newLabel) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-labels', workspaceId] })
      setNewLabelName("")
      addLabelMutation.mutate(newLabel.id)
    }
  })

  const handleCreateLabel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabelName.trim()) return
    createLabelMutation.mutate()
  }

  const getColorClass = (color: string) => {
    const map: Record<string, string> = {
      red: "bg-red-500/10 text-red-500 border-red-500/20",
      orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      green: "bg-green-500/10 text-green-500 border-green-500/20",
      blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      pink: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    }
    return map[color] || "bg-gray-500/10 text-gray-500 border-gray-500/20"
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Etiquetas
        </h4>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white rounded-sm">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white" align="end">
            <div className="space-y-3">
              <h5 className="text-xs font-semibold">Etiquetas disponibles</h5>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label: any) => {
                  const isApplied = convLabels.some((cl: any) => cl.labelId === label.id)
                  return (
                    <Badge 
                      key={label.id}
                      variant="outline"
                      className={`cursor-pointer text-[10px] transition-all hover:opacity-80 ${getColorClass(label.color)} ${isApplied ? 'opacity-50 line-through' : ''}`}
                      onClick={() => !isApplied && addLabelMutation.mutate(label.id)}
                    >
                      {label.name}
                    </Badge>
                  )
                })}
              </div>
              <form onSubmit={handleCreateLabel} className="pt-2 border-t border-[#ffffff10] flex gap-2">
                <Input 
                  placeholder="Nueva etiqueta..." 
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="h-7 text-xs bg-white dark:bg-[#111111] border-[#ffffff10]"
                />
                <Button type="submit" size="sm" className="h-7 w-7 p-0 bg-whatsapp hover:bg-whatsapp/90 text-black shrink-0" disabled={createLabelMutation.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {convLabels.length === 0 ? (
        <div className="text-xs text-gray-500 italic">Sin etiquetas</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {convLabels.map((cl: any) => (
            <Badge 
              key={cl.id} 
              variant="outline" 
              className={`text-[10px] flex items-center gap-1 pr-1 ${getColorClass(cl.label.color)}`}
            >
              {cl.label.name}
              <button 
                onClick={() => removeLabelMutation.mutate(cl.labelId)}
                className="hover:bg-black/20 rounded-full p-0.5"
                disabled={removeLabelMutation.isPending}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
