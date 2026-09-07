import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { SignupForm } from './signup-form'
import { Card, Wordmark } from '@/components/ui'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await getCurrentUser()) redirect('/')
  const { next } = await searchParams
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const hasGuest = (await getGuestId()) != null

  // The shell is height-locked, so this page scrolls itself on short screens.
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <Wordmark />
          <p className="mt-2 text-sm text-on-surface-muted">
            {hasGuest
              ? 'Create an account and your saved conversations fold straight into your journal.'
              : 'Start somewhere new — a quiet, private place to think.'}
          </p>
        </div>
        <Card className="p-8">
          <SignupForm next={safeNext} />
        </Card>
        <p className="mt-6 text-center text-sm text-on-surface-muted">
          Already have an account?{' '}
          <Link
            href={safeNext !== '/' ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'}
            className="font-medium text-primary underline-offset-2 hover:text-on-surface"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
