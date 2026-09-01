'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { currentUserOrGuest } from '@/lib/auth'
import { parseArgs } from '@/lib/action-args'
import { checkRateLimit } from '@/lib/rate-limit'
import { DEMO_LIMITS, RATE_WINDOW_MS } from '@/lib/constants'
import {
  appendMessage,
  createConversation,
  getConversationMessages,
  listConversations,
  touchConversation,
  titleFromText,
} from '@/lib/chat'
import { generateChatReply } from '@/lib/chat-driver'
import { summarizeLlmError } from '@/lib/llm-errors'
import { synthesizeSpeech, ttsConfigured } from '@/lib/tts'

export type ChatTurnResult =
  | { ok: true; reply: string; audio: string | null; conversationId: number }
  | { ok: false; error: string }
  | { ok: false; error: string; code: 'rate-limit' }

/**
 * One chat turn. Self-authorizes (guest or user), rate-limits, persists both
 * sides of the exchange, and returns the assistant's reply plus — when TTS is
 * configured — the spoken audio as WAV base64 so the client can play it aloud.
 *
 * The transcript is never lost: the user turn is persisted BEFORE the model
 * call, so even a model failure keeps their words.
 */
export async function chatTurnAction(input: {
  message: string
  conversationId?: number
}): Promise<ChatTurnResult> {
  const actor = await currentUserOrGuest()
  const { message, conversationId } = parseArgs(
    z.object({ message: z.string().trim().min(1).max(4000), conversationId: z.number().int().positive().optional() }),
    { message: input.message, conversationId: input.conversationId },
    'chatTurn',
  )

  if (!(await checkRateLimit(`chat:u:${actor.id}`, DEMO_LIMITS.chatTurnsPerHour, RATE_WINDOW_MS))) {
    return {
      ok: false,
      error: `Chat turns are capped at ${DEMO_LIMITS.chatTurnsPerHour}/hour. Come back in a bit.`,
      code: 'rate-limit',
    }
  }

  // Resolve which conversation this turn belongs to (create on first turn).
  let conv = conversationId
  try {
    if (conv == null) {
      conv = await createConversation(actor.id)
      // First turn also sets the sidebar title.
      await touchConversation(conv, titleFromText(message))
      revalidatePath('/')
    } else {
      // Must own the conversation; a foreign id behaves like not-found.
      const history = await getConversationMessages(actor.id, conv)
      if (history == null) return { ok: false, error: 'That conversation was not found.' }
    }
  } catch (e) {
    console.error('[chatTurn] conversation resolve/store failed:', e)
    return { ok: false, error: 'Could not save the message — try again in a moment.' }
  }

  // Persist the user turn first — never lose their words.
  try {
    await appendMessage(conv, 'user', message)
  } catch (e) {
    console.error('[chatTurn] append user failed:', e)
    return { ok: false, error: 'Could not save your message — try again.' }
  }

  // Build history INCLUDING the just-saved user turn, then get the reply.
  const fullHistory = await getConversationMessages(actor.id, conv)
  const history = (fullHistory ?? []).map((m) => ({ role: m.role, content: m.content }))

  let reply: string
  try {
    reply = await generateChatReply(history)
  } catch (e) {
    console.error('[chatTurn] model failed:', e)
    // The user's words are already saved; surface a friendly cause.
    return { ok: false, error: summarizeLlmError(e) }
  }

  // Persist the assistant reply + bump the sidebar timestamp.
  try {
    await appendMessage(conv, 'assistant', reply)
    await touchConversation(conv)
  } catch (e) {
    console.error('[chatTurn] append assistant failed:', e)
    // The reply still reaches the client even if persistence hiccuped.
  }
  revalidatePath('/')

  // Optional voice out — never blocks the text reply.
  let audio: string | null = null
  if (ttsConfigured()) {
    try {
      audio = await synthesizeSpeech(reply)
    } catch {
      audio = null
    }
  }

  return { ok: true, reply, audio, conversationId: conv }
}

/** A list of the acting user's conversations for the chat sidebar. */
export async function listConversationsAction(): Promise<{ ok: true; conversations: unknown[] } | { ok: false; error: string }> {
  const actor = await currentUserOrGuest()
  try {
    const rows = await listConversations(actor.id)
    return { ok: true, conversations: rows }
  } catch (e) {
    console.error('[listConversations] failed:', e)
    return { ok: false, error: 'Could not load conversations.' }
  }
}

/** Load a single past conversation's messages (self-authorizing). */
export async function getConversationAction(conversationIdInput: number): Promise<
  | { ok: true; id: number; messages: { role: 'user' | 'assistant'; content: string }[] }
  | { ok: false; error: string }
> {
  const actor = await currentUserOrGuest()
  const { conversationId } = parseArgs(
    z.object({ conversationId: z.number().int().positive() }),
    { conversationId: conversationIdInput },
    'getConversation',
  )
  try {
    const history = await getConversationMessages(actor.id, conversationId)
    if (history == null) return { ok: false, error: 'That conversation was not found.' }
    return { ok: true, id: conversationId, messages: history.map((m) => ({ role: m.role, content: m.content })) }
  } catch (e) {
    console.error('[getConversation] failed:', e)
    return { ok: false, error: 'Could not load that conversation.' }
  }
}
