import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { LoginPill } from '@/components/LoginPill'
import { LogoutButton } from '@/components/LogoutButton'
import { Wordmark } from '@/components/ui'

/** The conversation workspace keeps a compact way home and account action. */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="glass z-40 shrink-0">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="What I Mean home" className="flex shrink-0 items-center leading-none">
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
