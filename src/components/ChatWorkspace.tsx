'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getConversationAction, listConversationsAction, setConversationPersonaAction } from '@/actions/chat'
import { ChatApp, type ChatRow } from '@/components/ChatApp'
import { IconPlus } from '@/components/ui'
import { personaById, type PersonaId } from '@/lib/personas'

export interface ConversationSummary {
  id: number
  title: string | null
  persona: string | null
}

const COLLAPSE_KEY = 'wim:sidebarCollapsed'

/**
 * Composes the persistent sidebar of past chats with the main ChatApp window.
 * Selecting a conversation loads its transcript; "New chat" clears the window.
 *
 * The sidebar collapses to a narrow icon rail (Linear-style) so the conversation
 * can take the full width when you want to just be present in it; the preference
 * is remembered across visits. Below `sm` the rail is hidden entirely (a side
 * rail is not usable at phone width).
 *
 * The past-chat list is fetched AFTER mount (listConversationsAction) rather
 * than during the server render, so the chat window (the LCP content) paints
 * without waiting on a database round-trip.
 *
 * New chat opens a brand-new, unsaved draft. It is keyed by a monotonically
 * increasing session counter so every click forces a fresh ChatApp mount. The
 * previous window's in-memory messages/conversation are thrown away.
 */
export function ChatWorkspace() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activePersona, setActivePersona] = useState<PersonaId>('warm')
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  // Bumped on every "New chat" so the ChatApp key changes and it truly remounts
  // a fresh draft. State (not a ref) because it is read during render for the key.
  const [sessionId, setSessionId] = useState(0)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        window.sessionStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // ignore storage errors; the in-memory state still applies this page
      }
      return next
    })
  }, [])

  // Load the past-chat sidebar lazily, keeping it off the critical first-paint path.
  useEffect(() => {
    let alive = true
    listConversationsAction().then((res) => {
      if (!alive) return
      if (res.ok) {
        setConversations(
          (res.conversations as ConversationSummary[]).map((c) => ({
            id: c.id,
            title: c.title,
            persona: c.persona,
          })),
        )
      }
    })
    return () => {
      alive = false
    }
  }, [])

  const openConversation = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await getConversationAction(id)
      if (res.ok) {
        setActiveId(id)
        setActivePersona(res.persona)
        setMessages(res.messages)
      }
    } catch {
      // Ignore an unloadable old conversation instead of opening it.
    } finally {
      setLoading(false)
    }
  }, [])

  const newChat = useCallback(() => {
    setSessionId((s) => s + 1)
    setActiveId(null)
    setActivePersona('warm')
    setMessages([])
  }, [])

  const changePersona = useCallback(
    async (persona: PersonaId, conversationId?: number | null) => {
      // Only persisted for an already-saved conversation; a fresh (unsaved)
      // draft just remembers it locally for the next first turn.
      setActivePersona(persona)
      const targetId = conversationId ?? activeId
      if (targetId == null) return
      const res = await setConversationPersonaAction({ conversationId: targetId, persona })
      if (res.ok) {
        setConversations((cs) =>
          cs.map((c) => (c.id === targetId ? { ...c, persona } : c)),
        )
      }
    },
    [activeId],
  )

  const chevron = collapsed ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-glass-border bg-surface/50 transition-[width] duration-300 ease-[var(--ease-standard)] sm:flex ${
          collapsed ? 'items-center' : ''
        }`}
        style={{ width: collapsed ? '3.5rem' : '14rem' }}
      >
        {/* Collapse toggle (always reachable at the top of the rail) */}
        <div className={collapsed ? 'py-3' : 'flex items-center justify-end border-b border-glass-border px-2 py-1.5'}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="grid h-8 w-8 place-items-center rounded-lg text-on-surface-muted transition hover:bg-glass-strong hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary-focus-ring"
          >
            {chevron}
          </button>
        </div>

        {/* New chat */}
        <div className={collapsed ? 'py-1' : 'px-3 pb-1 pt-3'}>
          <button
            type="button"
            onClick={newChat}
            aria-label="New voice chat"
            title={collapsed ? 'New voice chat' : undefined}
            className={`items-center gap-2 rounded-xl border border-glass-border text-sm font-medium transition hover:bg-glass-strong focus-visible:ring-2 focus-visible:ring-secondary-focus-ring ${
              collapsed
                ? 'flex h-9 w-9 justify-center text-on-surface-muted'
                : `flex w-full px-3 py-2 ${
                    activeId === null ? 'bg-glass text-on-surface shadow-[0_8px_18px_-12px_rgba(2,8,24,0.5)]' : 'border-transparent text-on-surface-muted hover:text-on-surface'
                  }`
            }`}
          >
            <IconPlus className="h-4 w-4" />
            {!collapsed && 'New voice chat'}
          </button>
        </div>

        <nav
          className={`flex-1 overflow-y-auto ${collapsed ? 'w-full px-1.5 pb-2' : 'px-2 pb-3 pt-1'}`}
          aria-label={collapsed ? 'Conversations' : 'Past conversations'}
        >
          {!collapsed && (
            <p className="px-1 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-muted">
              Journal
            </p>
          )}
          {conversations.length === 0 ? (
            !collapsed && <p className="px-3 py-2 text-xs text-on-surface-muted">No past chats yet.</p>
          ) : (
            conversations.map((c) => {
              const active = activeId === c.id
              const p = personaById(c.persona)
              if (collapsed) {
                return (
                  <div key={c.id} className="mb-2">
                    <Link
                      href={`/conversations/${c.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        void openConversation(c.id)
                      }}
                      aria-label={c.title ?? p.label}
                      title={c.title ?? p.label}
                      className={`grid h-9 w-9 place-items-center rounded-full transition ${
                        active ? 'ring-2 ring-primary-ring/50 ring-offset-1 ring-offset-surface' : 'hover:opacity-90'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="grid h-6 w-6 place-items-center rounded-full"
                        style={{ background: p.aura }}
                      >
                        <span className="flex items-center gap-[1.5px]">
                          <span className="h-[3px] w-[3px] rounded-full bg-white/95" />
                          <span className="h-[3px] w-[3px] rounded-full bg-white/95" />
                        </span>
                      </span>
                    </Link>
                  </div>
                )
              }
              return (
                <div
                  key={c.id}
                  className={`group mb-1 flex items-center gap-1 rounded-xl px-1 transition ${
                    active ? 'bg-glass shadow-[0_6px_18px_-12px_rgba(2,8,24,0.7)]' : 'hover:bg-glass-strong'
                  }`}
                >
                  <Link
                    href={`/conversations/${c.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      void openConversation(c.id)
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg px-2 py-2 text-left text-sm ${
                      active ? 'text-on-surface' : 'text-on-surface-muted hover:text-on-surface'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                      style={{ background: p.aura }}
                    >
                      <span className="flex items-center gap-[1.5px]">
                        <span className="h-[3px] w-[3px] rounded-full bg-white/95" />
                        <span className="h-[3px] w-[3px] rounded-full bg-white/95" />
                      </span>
                    </span>
                    <span className="truncate">{c.title ?? p.label}</span>
                  </Link>
                  {/* Export downloads this conversation as JSON. */}
                  <a
                    href={`/conversations/${c.id}/export`}
                    title="Export this conversation as JSON"
                    aria-label="Export this conversation as JSON"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-muted opacity-0 transition hover:bg-glass-strong hover:text-on-surface group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <IconDownload className="h-4 w-4" />
                  </a>
                </div>
              )
            })
          )}
        </nav>
        <div className={collapsed ? 'invisible p-4' : 'p-3'} />
      </aside>

      {/* Chat window */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-on-surface-muted">
            Loading…
          </div>
        ) : (
          <ChatApp
            initialMessages={messages}
            conversationId={activeId ?? undefined}
            initialPersona={activePersona}
            onPersonaChange={changePersona}
            // Force a true remount whenever a fresh draft starts.
            key={activeId ?? `new-${sessionId}`}
          />
        )}
      </div>
    </div>
  )
}

function IconDownload({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

function IconChevronLeft({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

function IconChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
