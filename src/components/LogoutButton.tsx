'use client'

import { logoutAction } from '@/actions/auth'

/** Small header sign-out — form-wrapped so it works without JS. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        title="Sign out"
        className="text-xs text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        log out
      </button>
    </form>
  )
}
