import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { Wordmark } from '@/components/ui'
import { LogoutButton } from '@/components/LogoutButton'

/**
 * App-wide frame. Debrief-first: the primary action (debrief) is always one
 * tap away; login appears only when you're a guest, and only as a quiet pill.
 * Signed-in users instead get a gentle link to archive (their journal).
 */
export async function SanctuaryShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="Voice Debrief home">
            <Wordmark small />
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/archive"
                  className="text-sm text-on-surface-muted transition hover:text-on-surface"
                >
                  Journal
                </Link>
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white/60 px-4 py-2 text-sm font-medium text-on-surface-muted backdrop-blur-xl transition hover:bg-white hover:text-on-surface"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
        {/* The primary action rides the frame for both guests and users. */}
        <nav className="border-t border-outline-variant/60 bg-white/40 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-6 py-2">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary shadow-[0_10px_30px_-12px_rgba(87,95,101,0.5)] transition hover:opacity-90"
            >
              ＋ Debrief now
            </Link>
            <Link
              href="/interview"
              className="inline-flex items-center gap-2 rounded-full bg-white/70 px-5 py-2 text-sm font-medium text-on-secondary-container backdrop-blur-xl transition hover:bg-white"
            >
              Guided
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  )
}
