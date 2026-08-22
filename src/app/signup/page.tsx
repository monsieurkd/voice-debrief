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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Wordmark />
        <p className="mt-2 text-sm text-on-surface-muted">
          {hasGuest
            ? 'Create an account and your saved debriefs fold straight into your journal.'
            : 'Turn your debriefs into a compounding, private journal.'}
        </p>
      </div>
      <Card className="p-8">
        <SignupForm next={safeNext} />
      </Card>
      <p className="mt-6 text-center text-sm text-on-surface-muted">
        Already have an account?{' '}
        <Link
          href={safeNext !== '/' ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'}
          className="font-medium text-on-secondary-container underline underline-offset-2 hover:text-on-surface"
        >
          Log in
        </Link>
      </p>
    </main>
  )
}
