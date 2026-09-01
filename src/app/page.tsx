import { ChatApp, type ChatRow } from '@/components/ChatApp'
import { getCurrentUser, getGuestId } from '@/lib/auth'

// The landing page IS the chat. force-dynamic: the conversation is per-request,
// never prerendered at build time.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Resolve identity so we know whether to show login vs logout (the frame does
  // this); ChatApp is a client component that mints/uses the guest itself.
  await getCurrentUser()
  await getGuestId()

  const initialMessages: ChatRow[] = []

  return <ChatApp initialMessages={initialMessages} />
}
