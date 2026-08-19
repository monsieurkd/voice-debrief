import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './login-form'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Already signed in → straight to the journal.
  if (await getCurrentUser()) redirect('/')
  const { next } = await searchParams
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">Log in to continue your debriefs.</p>
      <LoginForm next={safeNext} />
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        No account yet?{' '}
        <Link href="/signup" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
          Sign up
        </Link>
      </p>
    </main>
  )
}
