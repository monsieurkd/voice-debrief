/**
 * App-wide Digital Sanctuary frame. Pages own their identity and controls;
 * the shared shell deliberately adds no navigation chrome.
 *
 * A faint ambient wash (lavender / sky / sage) sits behind every page so the
 * translucent `glass` panels actually read as glass — without it, translucent
 * panels over a perfectly flat lavender-white canvas just look like flat white.
 * The wash is decorative and never intercepts pointer events; page content
 * renders above it in its own relative layer.
 */
export function SanctuaryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(221,201,246,0.5),transparent_68%)]" />
        <span className="absolute -right-28 top-[8%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(205,238,218,0.38),transparent_68%)]" />
        <span className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(196,222,237,0.42),transparent_68%)]" />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
