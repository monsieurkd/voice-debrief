import Link from 'next/link'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { listSessions, listOpenNextSteps, listSessionDays } from '@/lib/queries'
import { listThreads } from '@/lib/threads'
import { env } from '@/lib/env'
import { formatDate } from '@/lib/dates'
import { computeStreak } from '@/lib/streak'
import { PlanList } from '@/components/PlanList'
import { MoodStrip } from '@/components/MoodStrip'
import { ThreadsPanel } from '@/components/ThreadsPanel'
import { DemoButton } from '@/components/DemoButton'
import { ButtonLink, Card, SectionTitle, SaveToJournalPrompt, Pill } from '@/components/ui'
import { runSampleDebrief, runDemoWeek } from '@/actions/debrief'

// Home reads live journal data on every request. With the default 'auto',
// this page is eligible for build-time prerendering: `next build` would
// execute the queries during the build and serve a stale snapshot — new
// sessions wouldn't appear until an unrelated revalidation.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Debrief-first: don't mint an account (even a guest) just for viewing —
  // the guest is created only when someone actually starts a debrief. A
  // visitor with no identity yet sees the invitational empty state.
  const real = await getCurrentUser()
  const guestId = await getGuestId()
  const userId = real?.id ?? guestId ?? null
  const isGuest = !real && guestId != null
  const hasIdentity = userId != null

  const [entries, plan, threads, days] = userId
    ? await Promise.all([
        listSessions(userId, 20),
        listOpenNextSteps(userId, 30),
        listThreads(userId),
        listSessionDays(userId),
      ])
    : await Promise.all([[], [], [], []])
  const streak = computeStreak(days)

  return (
    <main className="mx-auto w-full max-w-[920px] px-6 py-14 sm:py-20">
      {/* Opening: the invitation + primary action first. */}
      <section className="mb-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-muted">
          A quiet place to untangle your day
        </p>
        <h1 className="font-display text-4xl leading-tight text-on-surface sm:text-5xl">
          Talk it out. Keep what matters.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-on-surface-muted">
          Debrief your day, and let it come back as something you can act on —{" "}
          a plan, patterns that connect the days, and a record that compounds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/new">＋ Debrief now</ButtonLink>
          <ButtonLink href="/interview" variant="secondary">
            Guided debrief
          </ButtonLink>
        </div>
      </section>

      {/* Guest prompt: gently adopt onto an account. */}
      <SaveToJournalPrompt href="/signup" shown={isGuest && entries.length > 0} />

      {!hasIdentity && (entries.length === 0) && (
        <section className="mb-16">
          <div className="float-card p-8 text-center">
            <p className="text-sm text-on-surface-muted">
              No journal yet. Load a sample week to feel the compounding — or just write your first debrief above.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <DemoButton
                action={runDemoWeek}
                dest="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
              >
                Load a demo week
              </DemoButton>
              <DemoButton
                action={runSampleDebrief.bind(null, 0)}
                className="text-sm font-medium text-on-secondary-container underline underline-offset-2 hover:text-on-surface"
              >
                or just one sample
              </DemoButton>
            </div>
          </div>
        </section>
      )}

      {(hasIdentity || entries.length > 0) && (
        <>
          <section className="mb-16">
            <SectionTitle>Tomorrow&apos;s plan</SectionTitle>
            <Card className="p-6">
              <PlanList items={plan} />
            </Card>
          </section>

          <section className="mb-16">
            <ThreadsPanel threads={threads} canRefresh={!!env.LLM_API_KEY} />
          </section>

          <section>
            <SectionTitle>
              <span className="flex w-full items-center justify-between">
                <span>Recent entries</span>
                {entries.length > 0 && (
                  <Link
                    href="/archive"
                    className="text-xs font-medium normal-case tracking-normal text-on-surface-muted hover:text-on-surface"
                  >
                    All entries →
                  </Link>
                )}
              </span>
            </SectionTitle>
            {entries.length === 0 ? (
              <p className="text-sm text-on-surface-muted">
                No entries yet.{' '}
                <Link href="/new" className="font-medium text-on-secondary-container underline underline-offset-2">
                  Write your first debrief
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {entries.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/session/${e.id}`}
                      className="group flex flex-col gap-2 rounded-lg bg-surface-container-low p-5 transition hover:bg-surface-container"
                    >
                      <div className="flex items-center justify-between">
                        <time className="text-xs font-medium text-on-surface-muted">
                          {formatDate(e.startedAt, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </time>
                        <MoodStrip mood={e.mood} energy={e.energy} />
                      </div>
                      <p className="text-sm leading-6 text-on-surface">{e.overview ?? '(no overview)'}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Streak badge — subtle, grows quieter for the first day. */}
      {streak >= 2 && entries.length > 0 && (
        <div className="mt-12 flex justify-center">
          <Pill>{streak}-day streak</Pill>
        </div>
      )}
    </main>
  )
}
