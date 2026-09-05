import Link from 'next/link'
import type { ReactNode, InputHTMLAttributes } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Digital Sanctuary primitives.
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
      className={`${PILL_BASE} bg-primary text-on-primary font-semibold
        shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)]
        hover:bg-primary-focus active:bg-primary-active
        focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

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
  const look = variant === 'primary'
    ? 'bg-primary text-on-primary font-semibold shadow-[0_10px_30px_-12px_rgba(87,95,101,0.45)] hover:bg-primary-focus active:bg-primary-active'
    : 'border border-white/80 bg-white/60 text-on-secondary-container shadow-sm backdrop-blur-xl hover:bg-white/95'
  return <Link href={href} className={`${PILL_BASE} ${look} ${className}`}>{children}</Link>
}

/**
 * The meaning mark: a conversational container holding a continuous lowercase
 * m. It stays deliberately monochrome so it reads at favicon size and does not
 * compete with the listener orb inside the product.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect x="4" y="4" width="56" height="56" rx="18" fill="currentColor" />
      <path
        d="M18 17.5h28a6.5 6.5 0 0 1 6.5 6.5v13A6.5 6.5 0 0 1 46 43.5H31L21.5 51l2.2-7.5H18a6.5 6.5 0 0 1-6.5-6.5V24a6.5 6.5 0 0 1 6.5-6.5Z"
        fill="none"
        stroke="var(--color-sanctuary-white)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 36V27a4 4 0 0 1 8 0v9-9a4 4 0 0 1 8 0v9"
        fill="none"
        stroke="var(--color-sanctuary-white)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The journal-like What I Mean wordmark and meaning mark lockup. */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center text-primary ${small ? 'gap-2' : 'gap-3'}`}>
      <BrandMark className={small ? 'h-7 w-7' : 'h-11 w-11'} />
      <span className={`font-display tracking-tight text-on-surface ${small ? 'text-lg' : 'text-3xl leading-tight'}`}>
        What I Mean
      </span>
    </span>
  )
}

/** Floating vibrancy card (glass panel over the canvas — see .float-card). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`float-card ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-muted">
      <span className="h-px flex-1 bg-outline-variant" aria-hidden />
      {children}
      <span className="h-px flex-1 bg-outline-variant" aria-hidden />
    </h2>
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
