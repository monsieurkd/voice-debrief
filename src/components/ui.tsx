'use client'

import type { ReactNode, InputHTMLAttributes } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Voyo primitives — the deep-blue glass canvas design system.
   Every component page-agnostic; keeps the look consistent without
   hand-rolled class strings that fight the design system in globals.css.
   ────────────────────────────────────────────────────────────────────── */

/** Base pill button styles shared by all clickable pill primitives. */
const PILL_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 min-h-11 ' +
  'text-sm font-medium cursor-pointer select-none ' +
  'transition-[background-color,background-image,box-shadow,transform,opacity] ' +
  'duration-[var(--dur-base)] ease-[var(--ease-standard)] active:scale-[0.97] '

/* ──────────────────────────────────────────────────────────────────────
   Inline-SVG icon primitives — hand-rolled, no icon dep. 24x24, stroke 2,
   round caps/joins so they nest cleanly at any size.
   ────────────────────────────────────────────────────────────────────── */

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** The `＋` replacement — a proper SVG plus. */
export function IconPlus({ className }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Primary pill button (the "act" button — send, save, continue).
    Carries the same azure gradient as the user chat bubble so the two
    "you act" affordances read as one voice; the glow lifts on hover. */
export function Button({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${PILL_BASE} text-on-primary font-semibold
        bg-[linear-gradient(135deg,#2757c9,#3670f0)]
        shadow-[0_10px_30px_-12px_rgba(61,123,255,0.45)]
        hover:bg-[linear-gradient(135deg,#2757c9,#2e63e0)]
        hover:shadow-[0_14px_38px_-12px_rgba(61,123,255,0.7)]
        active:bg-[linear-gradient(135deg,#2757c9,#2e63e0)]
        focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

/** The app wordmark — "Voyo" beside a gradient orb (pure CSS, no image). */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-on-surface ${
        small
          ? 'gap-2 text-lg leading-none'
          : 'gap-2.5 text-[30px] leading-[1.15]'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block shrink-0 rounded-full bg-[radial-gradient(circle_at_32%_30%,#a9e3ff_0%,#5c90ff_45%,#2e63e0_100%)] shadow-[0_0_10px_rgba(61,123,255,0.55)] ${
          small ? 'h-2 w-2' : 'h-2.5 w-2.5'
        }`}
      />
      <span className="font-display font-semibold tracking-wide">Voyo</span>
    </span>
  )
}

/** Floating vibrancy card (glass panel over the canvas — see .float-card). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`float-card ${className}`}>{children}</div>
}

/** Ambient (borderless, focus-glow) text field. */
export function Field({
  label,
  ...rest
}: { label?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={rest.id} className="text-xs font-medium text-on-surface-muted">
          {label}
        </label>
      )}
      <input {...rest} className={`ambient-field w-full py-2 text-sm text-on-surface placeholder:text-on-surface-muted/70 ${rest.className ?? ''}`} />
    </div>
  )
}

/** Ghost loader — breathing azure lines replacing spinner icons. */
export function GhostLoader({ bars = 3, className = '' }: { bars?: number; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-1 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="ghost" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}
