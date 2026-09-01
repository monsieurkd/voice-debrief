'use client'

import { logoutAction } from '@/actions/auth'

/** Quiet sign-out glass pill, wired as a form so it works without JS. The
 *  wrapping form is display:flex so the pill centers and never introduces a
 *  stray block-level margin that pushes the corner layout around. */
export function LogoutButton() {
  return (
    <form action={logoutAction} className="m-0 flex items-center p-0">
      <button
        type="submit"
        title="Sign out"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-glass-border bg-glass px-4 py-2 text-sm font-medium text-on-surface-variant backdrop-blur-xl transition hover:bg-glass-strong hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Sign out
      </button>
    </form>
  )
}
