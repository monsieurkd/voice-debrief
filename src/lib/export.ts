import { personaById } from './personas'

/**
 * Pure JSON-export builder — no DB, no request types, so it stays trivially
 * unit-testable. The route handler owns auth/ownership; this only shapes data:
 * plain types, ISO-8601 dates, messages in chronological order.
 */

export interface ExportConversationInput {
  id: number
  title: string | null
  persona: string | null
  createdAt: Date | string
}

export interface ExportMessageInput {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date | string
}

export interface ExportPayload {
  app: 'voyo'
  version: 1
  exportedAt: string
  conversation: {
    id: number
    title: string | null
    persona: string
    createdAt: string
    messageCount: number
    messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>
  }
}

export function buildExportPayload(
  conversation: ExportConversationInput,
  messages: ExportMessageInput[],
  exportedAt: Date,
): ExportPayload {
  // Sort defensively so the file is chronological even if a caller hands us
  // rows in arbitrary order; Array#sort is stable for equal timestamps.
  const chronological = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  return {
    app: 'voyo',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    conversation: {
      id: conversation.id,
      title: conversation.title,
      // Resolve to the display label ('warm' → 'Warm listener') — unknown/null
      // ids export as the default persona, matching how chat renders them.
      persona: personaById(conversation.persona).label,
      createdAt: new Date(conversation.createdAt).toISOString(),
      messageCount: chronological.length,
      messages: chronological.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
    },
  }
}
