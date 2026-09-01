'use client'

import { logoutAction } from '@/actions/auth'

/** Quiet sign-out glass chip, wired as a form so it works without JS. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        title="Sign out"
        className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-sm font-medium text-on-surface-variant backdrop-blur-xl transition hover:bg-glass-strong hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Sign out
      </button>
    </form>
  )
}
