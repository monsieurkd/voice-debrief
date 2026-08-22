'use client'

import Link from 'next/link'
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Shared Digital Sanctuary primitives.
   Every component page-agnostic; keeps the look consistent without
   hand-rolled class strings that fight the design system in globals.css.
   ────────────────────────────────────────────────────────────────────── */

/** Primary pill button (the "act" button — debrief, send, save). */
export function Button({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary transition
        shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)] bg-primary hover:opacity-90 active:scale-[0.98]
        disabled:pointer-events-none disabled:opacity-40 ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-on-secondary-container
        bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm hover:bg-white/80 transition active:scale-[0.98]
        disabled:pointer-events-none disabled:opacity-40 ${className}`}
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-[0.98]'
  const look =
    variant === 'primary'
      ? `bg-primary text-on-primary font-semibold shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)] hover:opacity-90 ${className}`
      : `bg-white/60 backdrop-blur-xl border border-white/60 text-on-secondary-container shadow-sm hover:bg-white/80 ${className}`
  return (
    <Link href={href} className={`${base} ${look}`}>
      {children}
    </Link>
  )
}

/** The app title/wordmark — script face, journal-like. */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`font-display text-on-surface ${small ? 'text-lg' : 'text-2xl'} tracking-tight`}>
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
 * "Save to your journal" — appears only for guests with at least one debrief.
 * Keeps the debrief-first promise: a gentle nudge to adopt, not a wall.
 */
export function SaveToJournalPrompt({ href, shown }: { href: string; shown: boolean }) {
  if (!shown) return null
  return (
    <div
      role="status"
      className="float-card mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-medium text-on-surface">Your day is saved here.</p>
        <p className="text-sm text-on-surface-muted">
          Create a free account and it&apos;s adopted onto your journal — nothing gets lost.
        </p>
      </div>
      <ButtonLink href={href}>Save to your journal</ButtonLink>
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
