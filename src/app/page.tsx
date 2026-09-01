import { ChatWorkspace, type ConversationSummary } from '@/components/ChatWorkspace'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { listConversations } from '@/lib/chat'

// The landing page IS the chat. force-dynamic: conversations are per-request,
// never prerendered at build time.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Debrief-first: a visitor can chat as an anonymous guest (the chat mints
  // the guest on first turn). We resolve identity here only to load their past
  // conversations for the sidebar.
  const real = await getCurrentUser()
  const guestId = await getGuestId()
  const userId = real?.id ?? guestId

  let conversations: ConversationSummary[] = []
  if (userId != null) {
    try {
      const rows = await listConversations(userId)
      conversations = rows.map((c) => ({ id: c.id, title: c.title, persona: c.persona }))
    } catch {
      conversations = []
    }
  }

  return <ChatWorkspace initialConversations={conversations} />
}
