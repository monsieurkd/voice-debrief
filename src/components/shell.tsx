import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { Wordmark } from '@/components/ui'
import { LogoutButton } from '@/components/LogoutButton'
import { LoginPill } from '@/components/LoginPill'

/**
 * App-wide frame for the chat-first product. The landing page IS the chat, so
 * the frame stays out of the way: a slim wordmark header + a quiet login pill
 * for guests, logout for signed-in users. No nav bar — there's one surface.
 */
export async function SanctuaryShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Voice chat home">
            <Wordmark small />
          </Link>
          <div className="flex items-center gap-4">
            {user ? <LogoutButton /> : <LoginPill />}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
