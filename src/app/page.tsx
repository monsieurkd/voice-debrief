import { ChatWorkspace } from '@/components/ChatWorkspace'

// The landing page IS the chat. force-dynamic: never prerendered at build time.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Debrief-first: a visitor can chat as an anonymous guest (the chat mints
  // the guest on first turn). The past-conversation sidebar is loaded
  // client-side after mount (listConversationsAction), so the chat window —
  // the above-the-fold LCP content — never waits on a database round-trip
  // here. Nothing in the server render blocks on storage.
  return <ChatWorkspace />
}
