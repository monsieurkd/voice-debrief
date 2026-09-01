import Link from 'next/link'
import { Wordmark } from '@/components/ui'

/**
 * About & mission — the pitch behind Voyo. Reachable from the logo in the
 * header. This page owns its own scrolling (the shell is height-locked).
 */
export default function AboutPage() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <Wordmark />
          <p className="max-w-lg text-base leading-relaxed text-on-surface-muted">
            Talk through your day, every day — like giving your mind a workout.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-3 font-display text-2xl text-on-surface">Debrief like you train.</h2>
            <p className="text-[15px] leading-7 text-on-surface-muted">
              Most of us wouldn&apos;t dream of skipping leg day. But your mind? We pour a
              hundred thoughts into it every day and never take the time to sort through them.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-on-surface-muted">
              Voyo turns mental debriefing into the same kind of habit: a short, honest,
              daily conversation that clears the noise, catches what matters, and builds
              resilience one check-in at a time. Consistency is the goal — not perfection.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-2xl text-on-surface">How it works</h2>
            <ul className="flex flex-col gap-3">
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Speak or type your day</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  A warm voice listens and asks what matters. Just talk — no forms, no
                  screens full of fields.
                </p>
              </li>
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Pick a voice that fits</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  Warm listener, curious friend, or sharp coach — pick the energy you need
                  that day.
                </p>
              </li>
              <li className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
                <p className="font-medium text-on-surface">Back tomorrow</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-muted">
                  Your conversations stay private in your journal. Coming back is the whole
                  point — that&apos;s how the compounding happens.
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

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2757c9,#3670f0)] px-6 py-2.5 text-sm font-semibold text-on-primary shadow-[0_10px_30px_-12px_rgba(61,123,255,0.45)] transition hover:opacity-90"
            >
              Start your debrief
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 py-2.5 text-sm font-medium text-on-surface-variant backdrop-blur-xl transition hover:bg-glass-strong hover:text-on-surface"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
