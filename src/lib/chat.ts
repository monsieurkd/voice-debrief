import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { conversations, messages, users } from '@/db/schema'
import type { PersonaId } from '@/lib/personas'

/**
 * Chat data layer for the pivot: conversations + messages per user. This is the
 * whole persistence layer of the product now that the structured journal is gone.
 */

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface Conversation {
  id: number
  title: string | null
  persona: string | null
  updatedAt: Date
}

/** Create a conversation (usually the first message too, via createMessage). */
export async function createConversation(userId: number, persona?: PersonaId): Promise<number> {
  const [row] = await db
    .insert(conversations)
    // Undefined persona stores NULL → resolved to the default 'warm' later.
    .values({ user_id: userId, ...(persona ? { persona } : {}) })
    .returning({ id: conversations.id })
  return row!.id
}

/** The user's conversations for the sidebar, newest first. */
export async function listConversations(userId: number): Promise<Conversation[]> {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      persona: conversations.persona,
      updatedAt: conversations.updated_at,
    })
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.updated_at))
  return rows
}

/**
 * One owned conversation row, or null if it does not exist or belongs to
 * someone else (same semantics as getConversationMessages: foreign id → null).
 */
export async function getConversation(
  userId: number,
  conversationId: number,
): Promise<{ id: number; title: string | null; persona: string | null; createdAt: Date } | null> {
  const [row] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      persona: conversations.persona,
      createdAt: conversations.created_at,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
  return row ?? null
}

/** A single conversation's messages, oldest first. Returns null if not owned. */
export async function getConversationMessages(
  userId: number,
  conversationId: number,
): Promise<ChatMessage[] | null> {
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
  if (!conv) return null
  const [owner] = await db
    .select({ user_id: conversations.user_id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
  if (!owner || owner.user_id !== userId) return null // foreign id → treated as not found

  const rows = await db
    .select({ id: messages.id, role: messages.role, content: messages.content, createdAt: messages.created_at })
    .from(messages)
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(asc(messages.created_at))
  return rows
}

/** Persist one message (user turn) and return its id. */
export async function appendMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
): Promise<number> {
  const [row] = await db
    .insert(messages)
    .values({ conversation_id: conversationId, role, content })
    .returning({ id: messages.id })
  return row!.id
}

/** Bump the sidebar order + (on first user turn) set a short title. */
export async function touchConversation(conversationId: number, title?: string): Promise<void> {
  await db
    .update(conversations)
    .set({ updated_at: new Date(), ...(title ? { title } : {}) })
    .where(eq(conversations.id, conversationId))
}

/**
 * Switch a conversation's persona. The UPDATE itself is unscoped by id (like
 * appendMessage/touchConversation), so ownership is verified FIRST via the
 * getConversation gate: a foreign conversation id returns false instead of
 * writing. Returns true when the persona was stored.
 */
export async function setConversationPersona(
  userId: number,
  conversationId: number,
  persona: PersonaId,
): Promise<boolean> {
  const conv = await getConversation(userId, conversationId)
  if (conv == null) return false // foreign id → treated as not found
  await db.update(conversations).set({ persona }).where(eq(conversations.id, conversationId))
  return true
}

/** Auto-title from the first user turn: first ~40 chars, one line. */
export function titleFromText(text: string): string {
  const oneLine = text.trim().replace(/\s+/g, ' ')
  return oneLine.length > 48 ? `${oneLine.slice(0, 45)}…` : oneLine
}

/**
 * Resolve "who owns this conversation": a signed-in user OR an existing guest.
 * Returns the acting user id (reusing the auth guest-mint seam is the caller's
 * job). Kept here so the chat action stays thin.
 */
export async function ownerExists(userId: number): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
  return row != null
}
