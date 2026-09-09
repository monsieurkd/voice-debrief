/** The shared VietBrosInAus signature shown across the app. */
export function VietBrosFooter() {
  return (
    <footer className="shrink-0 border-t border-glass-border bg-surface/80 px-5 py-3 backdrop-blur-xl">
      <p className="flex items-center justify-center gap-1.5 text-[11px] tracking-wide text-on-surface-muted">
        <span>Made with</span>
        <svg
          viewBox="38 55 190 161"
          aria-hidden="true"
          className="h-3.5 w-4 shrink-0"
        >
          <defs>
            <linearGradient id="v-heart-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2757c9" />
              <stop offset="100%" stopColor="#3670f0" />
            </linearGradient>
          </defs>
          <path
            fill="url(#v-heart-gradient)"
            d="M132.8 214 45.6 107.2A30.3 30.3 0 0 1 40.5 90c0-18.2 13.8-33 30.8-33 17.4 0 30.8 13.2 30.8 30.6v29.1c0 18.7 11.8 30.3 30.7 30.3 19 0 31.2-11.6 31.2-30.3V87.6C164 70.2 177.7 57 195 57c17 0 30.8 14.8 30.8 33a30.3 30.3 0 0 1-5.1 17.2L132.8 214Z"
          />
        </svg>
        <span className="sr-only">love</span>
        <span>by</span>
        <a
          href="https://vietbrosinaus.com"
          className="font-semibold text-on-secondary-container underline decoration-outline-variant underline-offset-2 transition hover:text-on-surface"
        >
          vietbrosinaus
        </a>
      </p>
    </footer>
  )
}
