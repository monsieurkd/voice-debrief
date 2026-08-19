import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SignupForm } from './signup-form'

export default async function SignupPage() {
  // Already signed in → straight to the journal.
  if (await getCurrentUser()) redirect('/')
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Start your debrief</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        An account keeps your journal private to you — sessions, plans and all.
      </p>
      <SignupForm />
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
          Log in
        </Link>
      </p>
    </main>
  )
}
