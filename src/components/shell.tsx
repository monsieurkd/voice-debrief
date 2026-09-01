import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { Wordmark } from '@/components/ui'
import { LogoutButton } from '@/components/LogoutButton'
import { LoginPill } from '@/components/LoginPill'

/**
 * App-wide frame for the chat-first product. The landing page IS the chat, so
 * the frame stays out of the way: a slim glass header + a quiet login pill
 * for guests, logout for signed-in users. No nav bar — there's one surface.
 *
 * The frame is height-locked (h-dvh + overflow-hidden): it's an app shell,
 * not a scrolling document — each page region owns its own scrolling.
 */
export async function SanctuaryShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="glass z-40 shrink-0">
        {/* Flush-left logo, flush-right auth actions, vertically centered. */}
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <Link href="/about" aria-label="Voyo — about and mission" className="flex shrink-0 items-center self-center leading-none">
            <Wordmark small />
          </Link>
          <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-4">
            {user ? <LogoutButton /> : <LoginPill />}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
