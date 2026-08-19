'use client'

import { useActionState } from 'react'
import { signupAction, type AuthFormState } from '@/actions/auth'

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, {})

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Password (8+ characters)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? 'Creating account…' : 'Sign up'}
      </button>
    </form>
  )
}
