'use client'

import { logoutAction } from '@/actions/auth'

/** Quiet sign-out pill, wired as a form so it works without JS. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        title="Sign out"
        className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white/60 px-4 py-2 text-sm font-medium text-on-surface-muted backdrop-blur-xl transition hover:bg-white hover:text-on-surface"
      >
        Sign out
      </button>
    </form>
  )
}
