import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { listSessions, listOpenNextSteps } from '@/lib/queries'
import { formatDate } from '@/lib/dates'
import { PlanList } from '@/components/PlanList'
import { MoodStrip } from '@/components/MoodStrip'
import { LoadSampleButton } from '@/components/LoadSampleButton'
import { LogoutButton } from '@/components/LogoutButton'

// Home reads live journal data on every request. With the default 'auto',
// this page is eligible for build-time prerendering: `next build` would
// execute the queries during the build and serve a stale snapshot — new
// sessions wouldn't appear until an unrelated revalidation.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Page-level check (the proxy gate is optimistic only); userId scopes every query below.
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const [entries, plan] = await Promise.all([listSessions(20), listOpenNextSteps(30)])

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Voice Debrief</h1>
        <div className="flex items-center gap-4">
          <Link href="/new" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            quick type
          </Link>
          <Link
            href="/interview"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            ＋ Guided debrief
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
          Tomorrow&apos;s plan
        </h2>
        <PlanList items={plan} />
      </section>

      <section>
        <h2 className="mb-3 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
          Recent entries
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No entries yet.{' '}
            <Link href="/new" className="underline">
              Write your first debrief
            </Link>{' '}
            — or{' '}
            <LoadSampleButton className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
              load a sample
            </LoadSampleButton>{' '}
            to see how a day becomes a plan.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/session/${e.id}`}
                  className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <time className="text-xs text-zinc-400">
                      {formatDate(e.startedAt, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </time>
                    <MoodStrip mood={e.mood} energy={e.energy} />
                  </div>
                  <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{e.overview ?? '(no overview)'}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
