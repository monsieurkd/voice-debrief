'use client'

import Link from 'next/link'
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Shared Digital Sanctuary primitives.
   Every component page-agnostic; keeps the look consistent without
   hand-rolled class strings that fight the design system in globals.css.
   ────────────────────────────────────────────────────────────────────── */

/** Base pill button styles shared by all clickable pill primitives. */
const PILL_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 min-h-11 ' +
  'text-sm font-medium cursor-pointer select-none ' +
  'transition-[background-color,box-shadow,transform,opacity] ' +
  'duration-[var(--dur-base)] ease-[var(--ease-standard)] active:scale-[0.97] '

/* ──────────────────────────────────────────────────────────────────────
   Inline-SVG icon primitives — hand-rolled, no icon dep. Match the
   SectionIcon visual language (24x24, stroke 2, round caps/joins) so they
   nest the same way DeBriefDoc's SECTION_ICONS do.
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

/** The `✕` delete-glyph replacement — an X. */
export function IconClose({ className }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/** The `↻` refresh replacement — circular arrows. */
export function IconRefresh({ className }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

/** The mood/energy `●` replacement — a small filled dot (fills via currentColor). */
export function IconEnergyDot({ className }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden>
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Primary pill button (the "act" button — debrief, send, save). */
export function Button({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${PILL_BASE} text-on-primary font-semibold
        shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)] bg-primary
        hover:bg-primary-focus
        focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        active:bg-primary-active
        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

/** Secondary pill — glassmorphic, for "login" / "save to journal".
    Styled intentionally quiet so login stays secondary to the debrief. */
export function GhostButton({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${PILL_BASE} text-on-secondary-container
        bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm
        hover:bg-white/95 hover:border-white/80
        focus-visible:ring-2 focus-visible:ring-secondary-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        active:bg-white
        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

/** A pill link (login stands out as the gentler option, not a gate). */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  const look =
    variant === 'primary'
      ? `text-on-primary font-semibold shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)] bg-primary
         hover:bg-primary-focus active:bg-primary-active
         focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${className}`
      : `bg-white/60 backdrop-blur-xl border border-white/60 text-on-secondary-container shadow-sm
         hover:bg-white/95 hover:border-white/80 active:bg-white
         focus-visible:ring-2 focus-visible:ring-secondary-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${className}`
  return (
    <Link href={href} className={`${PILL_BASE} ${look}`}>
      {children}
    </Link>
  )
}

/** The app title/wordmark — script face, journal-like. */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`font-display text-on-surface ${
        small ? 'text-lg' : 'text-[length:var(--text-display-xl)] leading-[var(--leading-display)]'
      } tracking-tight`}
    >
      Voice Debrief
    </span>
  )
}

/** Floating card container. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`float-card ${className}`}>{children}</div>
}

/** Section label — small caps with a soft rule, journal heading style. */
export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-muted ${className}`}
    >
      <span className="h-px flex-1 bg-outline-variant" aria-hidden />
      {children}
      <span className="h-px flex-1 bg-outline-variant" aria-hidden />
    </h2>
  )
}

/** Pill chip, meditative-lavender for tags. */
export function Pill({
  children,
  active = false,
  className = '',
}: {
  children: ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-secondary-container text-on-secondary-container' : 'bg-meditative-lavender text-on-surface-muted'
      } ${className}`}
    >
      {children}
    </span>
  )
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

/** Ghost loader — breathing lines replacing spinner icons. */
export function GhostLoader({ bars = 3, className = '' }: { bars?: number; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-1 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="ghost" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}

/**
 * "Save your day to your journal" — appears for guests who just completed a
 * debrief (session page) or have entries (Home). Keeps the debrief-first
 * promise: a gentle, branching nudge to adopt — Create an account OR Log in —
 * and both paths carry `next` so the guest lands back on the debrief they were
 * looking at after signing in (their guest data is adopted onto the account).
 */
export function SaveToJournalPrompt({
  next,
  shown,
}: {
  /** Where to send the user after they create/log in (e.g. `/session/123`). */
  next: string
  shown: boolean
}) {
  if (!shown) return null
  const nextQ = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <div
      role="status"
      className="float-card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-medium text-on-surface">Your day is saved here.</p>
        <p className="text-sm text-on-surface-muted">
          Create a free account (or log in) and it&apos;s adopted onto your journal — nothing gets
          lost, and you&apos;ll land right back here.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={`/login${nextQ}`} variant="secondary">
          Log in
        </ButtonLink>
        <ButtonLink href={`/signup${nextQ}`}>Create an account</ButtonLink>
      </div>
    </div>
  )
}

/** A row-level Textarea with ambient styling used by the debrief composer. */
export function AmbientTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`ambient-field w-full resize-y py-3 text-[16px] leading-7 text-on-surface placeholder:text-on-surface-muted/70 focus:outline-none ${
        props.className ?? ''
      }`}
    />
  )
}
