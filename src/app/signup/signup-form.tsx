'use client'

import { useActionState } from 'react'
import { signupAction, type AuthFormState } from '@/actions/auth'
import { Field, Button } from '@/components/ui'

export function SignupForm({ next = '/' }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, {})

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
      <Field
        id="password"
        name="password"
        type="password"
        label="Password (8+ characters)"
        autoComplete="new-password"
        required
        minLength={8}
      />
      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Sign up'}
      </Button>
    </form>
  )
}
