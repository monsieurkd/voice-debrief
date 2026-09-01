// The guided interview lives only in React state — an accidental refresh or a
// closed window used to destroy the whole conversation. This module
// (de)serializes the chat to localStorage so a reload — or reopening the
// page later — resumes where the user left off. Pure functions for
// encode/parse (unit-testable in node), thin guarded accessors for the
// browser API. Best-effort by design: quota errors or private modes must never
// break the chat itself.

export type DraftMessage = { role: 'user' | 'assistant'; content: string }
export type InterviewChecklist = { events: boolean; decisions: boolean; next_steps: boolean }

export interface InterviewDraft {
  messages: DraftMessage[]
  checklist: InterviewChecklist
}

const KEY = 'voice-debrief:interview-draft:v1'
// Bounds on restore. 60 mirrors the server's turn-args cap (history.max(60) in
// actions/interview.ts): a longer draft would be rejected on every future send,
// bricking the conversation. Content is capped vs. the server's 4000/msg —
// keep the newest turns when slicing.
const MAX_MESSAGES = 60
const MAX_CONTENT = 8000

export function encodeDraft(messages: DraftMessage[], checklist: InterviewChecklist): string {
  return JSON.stringify({ messages, checklist })
}

/** Corrupt, truncated, or foreign payloads → null (start fresh, never throw). */
export function parseDraft(raw: string | null): InterviewDraft | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { messages, checklist } = data as Record<string, unknown>
  if (!Array.isArray(messages)) return null

  const parsed: DraftMessage[] = []
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) continue
    const { role, content } = m as Record<string, unknown>
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.length <= MAX_CONTENT) {
      parsed.push({ role, content })
    }
  }
  if (parsed.length === 0) return null
  const bounded = parsed.length > MAX_MESSAGES ? parsed.slice(-MAX_MESSAGES) : parsed

  const cl = (typeof checklist === 'object' && checklist !== null ? checklist : {}) as Record<string, unknown>
  const flag = (v: unknown) => v === true
  return {
    messages: bounded,
    checklist: { events: flag(cl.events), decisions: flag(cl.decisions), next_steps: flag(cl.next_steps) },
  }
}

export function saveDraft(messages: DraftMessage[], checklist: InterviewChecklist): void {
  try {
    localStorage.setItem(KEY, encodeDraft(messages, checklist))
  } catch {
    // quota exceeded / private mode — persistence is best-effort
  }
}

export function loadDraft(): InterviewDraft | null {
  try {
    return parseDraft(localStorage.getItem(KEY))
  } catch {
    return null // no localStorage (SSR, tests) — same as "nothing saved"
  }
}

export function clearDraft(): void {
  cached = null // a later mount must not restore what was just finished
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to do — a stale draft just gets overwritten next visit
  }
}

// Stable snapshot for useSyncExternalStore: parse once per tab (cached — the
// hook re-renders forever if getSnapshot returns a fresh object every call).
// `undefined` = never read; `null` = read, nothing valid stored.
let cached: InterviewDraft | null | undefined
export function getInitialDraft(): InterviewDraft | null {
  if (cached === undefined) cached = loadDraft()
  return cached
}
