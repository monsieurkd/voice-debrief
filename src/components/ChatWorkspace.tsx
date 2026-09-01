'use client'

import { useCallback, useState } from 'react'
import { getConversationAction } from '@/actions/chat'
import { ChatApp, type ChatRow } from '@/components/ChatApp'
import { IconPlus } from '@/components/ui'

export interface ConversationSummary {
  id: number
  title: string | null
}

/**
 * Composes the persistent sidebar of past chats with the main ChatApp window.
 * Selecting a conversation loads its transcript; "New chat" clears the window.
 */
export function ChatWorkspace({ initialConversations }: { initialConversations: ConversationSummary[] }) {
  const [conversations] = useState<ConversationSummary[]>(initialConversations)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(false)

  const openConversation = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await getConversationAction(id)
      if (res.ok) {
        setActiveId(id)
        setMessages(res.messages)
      }
    } catch {
      // ignore — an unloadable old conversation just doesn't open
    } finally {
      setLoading(false)
    }
  }, [])

  const newChat = useCallback(() => {
    setActiveId(null)
    setMessages([])
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-outline-variant/50 bg-surface/60 backdrop-blur sm:flex">
        <div className="p-3">
          <button
            type="button"
            onClick={newChat}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/80 ${
              activeId === null ? 'bg-white/90 text-on-surface shadow-sm' : 'text-on-surface-muted'
            }`}
          >
            <IconPlus className="h-4 w-4" />
            New chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Past conversations">
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-on-surface-muted">No past chats yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void openConversation(c.id)}
              className={`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/80 ${
                activeId === c.id ? 'bg-white/90 text-on-surface shadow-sm' : 'text-on-surface-muted'
              }`}
            >
              {c.title ?? `Chat ${c.id}`}
            </button>
          ))}
        </nav>
      </aside>

      {/* Chat window */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-on-surface-muted">Loading…</div>
        ) : (
          <ChatApp
            initialMessages={messages}
            conversationId={activeId ?? undefined}
            key={activeId ?? 'new'}
          />
        )}
      </div>
    </div>
  )
}
