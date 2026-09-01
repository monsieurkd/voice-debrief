import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { LoginForm } from './login-form'
import { Card, Wordmark } from '@/components/ui'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Already signed in → straight to the journal. A signed-in user with an
  // unattached guest is rare (adoption runs on the way in) but bounce anyway.
  if (await getCurrentUser()) redirect('/')
  const { next } = await searchParams
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const hasGuest = (await getGuestId()) != null
  void hasGuest // login adopts guest data regardless; no need to branch the copy yet

  // The shell is height-locked, so this page scrolls itself on short screens.
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <Wordmark />
          <p className="mt-2 text-sm text-on-surface-muted">
            {hasGuest ? 'Sign in to fold your saved debriefs into your journal.' : 'Log in to continue your debriefs.'}
          </p>
        </div>
        <Card className="p-8">
          <LoginForm next={safeNext} />
        </Card>
        <p className="mt-6 text-center text-sm text-on-surface-muted">
          New here?{' '}
          <Link href={`/signup${safeNext !== '/' ? `?next=${encodeURIComponent(safeNext)}` : ''}`} className="font-medium text-on-secondary-container underline underline-offset-2 hover:text-on-surface">
            Create an account
          </Link>{' '}
          — your saved debriefs come with you.
        </p>
      </div>
    </main>
  )
}
