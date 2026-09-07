import Link from 'next/link'
import { ButtonLink, Wordmark } from '@/components/ui'

/**
 * About and mission: the pitch behind What I Mean. Reachable from the logo in the
 * header. This page owns its own scrolling (the shell is height-locked).
 */
export default function AboutPage() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            aria-label="Go to home"
            className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
          >
            <Wordmark />
          </Link>
          <p className="max-w-lg text-base leading-relaxed text-on-surface-muted">
            Talk your way to what you really mean.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-3 font-display text-2xl text-on-surface">Say it until it makes sense.</h2>
            <p className="text-[15px] leading-7 text-on-surface-muted">
              Most of us wouldn&apos;t dream of skipping leg day. But your mind? We pour a
              hundred thoughts into it every day and never take the time to sort through them.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-on-surface-muted">
              What I Mean turns thinking out loud into a simple habit: a short, honest
              conversation that clears the noise, catches what matters, and builds
              resilience one check-in at a time. Consistency is the goal, not perfection.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-2xl text-on-surface">How it works</h2>
            <ul className="flex flex-col gap-3">
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Speak or type your day</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  A warm voice listens and asks what matters. Just talk. No forms, no
                  screens full of fields.
                </p>
              </li>
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Pick a voice that fits</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  Choose a warm listener, curious friend, or sharp coach to match the energy you need
                  that day.
                </p>
              </li>
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Back tomorrow</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  Your conversations stay private in your journal. Coming back is the whole
                  point. That&apos;s how the compounding happens.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-display text-2xl text-on-surface">Your data belongs to you</h2>
            <p className="text-[15px] leading-7 text-on-surface-muted">
              Everything you say is private to you. Export any conversation as JSON any time.
              No ads, no selling your words.
            </p>
          </section>

          <div className="mt-2 flex flex-col items-center justify-center gap-4 border-t border-glass-border pt-8 sm:flex-row">
            <ButtonLink href="/chat" className="w-full px-7 sm:w-auto">
              Start talking
            </ButtonLink>
            <Link
              href="/login"
              className="text-sm font-medium text-on-surface-muted underline decoration-outline-variant underline-offset-4 transition hover:text-on-surface"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
