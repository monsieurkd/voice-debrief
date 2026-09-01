import { eq, desc, asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { conversations, messages, users } from '@/db/schema'

/**
 * Chat data layer for the pivot: conversations + messages per user. This is the
 * whole persistence of the product now — the structured journal is gone.
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
  updatedAt: Date
}

/** Create a conversation (usually the first message too, via createMessage). */
export async function createConversation(userId: number): Promise<number> {
  const [row] = await db
    .insert(conversations)
    .values({ user_id: userId })
    .returning({ id: conversations.id })
  return row!.id
}

/** The user's conversations, newest first — for the sidebar. */
export async function listConversations(userId: number): Promise<Conversation[]> {
  const rows = await db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updated_at })
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.updated_at))
  return rows
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
