import { useEffect, useRef } from 'react'
import { useInboxStore } from '@/stores/inbox.store'
import { useQueryClient } from '@tanstack/react-query'

export function useInboxStream(workspaceId: string | undefined) {
  const { addMessage } = useInboxStore()
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let reconnectTimeout: NodeJS.Timeout
    let retryCount = 0

    const connect = () => {
      esRef.current = new EventSource(`/api/conversations/stream?workspaceId=${workspaceId}`)

      esRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'new_message') {
            const { message, conversationId } = data.payload
            
            // Append message to store immediately
            addMessage(conversationId, message)
            
            // Invalidate React Query cache
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
          }
        } catch {
          // ignore keep-alive or parsing errors
        }
      }

      esRef.current.onerror = () => {
        if (esRef.current) {
          esRef.current.close()
        }
        
        // Exponential backoff reconnect
        const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000)
        retryCount++
        reconnectTimeout = setTimeout(connect, timeout)
      }

      esRef.current.onopen = () => {
        retryCount = 0
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (esRef.current) esRef.current.close()
    }
  }, [workspaceId, addMessage, queryClient])
}
