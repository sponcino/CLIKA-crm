import { create } from 'zustand'
import { Conversation, Contact, Message } from '@prisma/client'

export type ConversationWithContact = Conversation & { contact: Contact }

interface InboxState {
  conversations: ConversationWithContact[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  
  setConversations: (conversations: ConversationWithContact[]) => void
  setActiveConversation: (id: string | null) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  addMessage: (conversationId: string, message: Message) => void
  updateConversation: (id: string, partial: Partial<ConversationWithContact>) => void
}

export const useInboxStore = create<InboxState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},

  setConversations: (conversations) => set({ conversations }),
  
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  setMessages: (conversationId, messages) => set((state) => ({
    messages: { ...state.messages, [conversationId]: messages }
  })),

  addMessage: (conversationId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: [...(state.messages[conversationId] || []), message]
    }
  })),

  updateConversation: (id, partial) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === id ? { ...c, ...partial } : c
    )
  })),
}))
