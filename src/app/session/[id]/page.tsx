import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadSession } from '@/lib/session'
import { formatDate } from '@/lib/dates'
import { DebriefDoc } from '@/components/DebriefDoc'
import { MoodStrip } from '@/components/MoodStrip'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  // Non-numeric ids must 404, not reach Postgres as 'NaN' (a 500 on the DB bind).
  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound()
  const data = await loadSession(sessionId)
  if (!data) notFound()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      {/* date + mood/energy strip */}
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          {formatDate(data.startedAt, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h1>
        <MoodStrip mood={data.mood} energy={data.energy} />
      </header>

      {/* overview 2-liner */}
      {data.overview && <p className="mb-8 text-base leading-7 text-zinc-700 dark:text-zinc-300">{data.overview}</p>}

      {/* editable sections (client) */}
      <DebriefDoc initial={data} />

      {/* goals in play */}
      {data.goals.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
            Goals in play
          </h2>
          <ul className="flex flex-wrap gap-2">
            {data.goals.map((g) => (
              <li key={g.title} className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                {g.title}
                <span className="ml-1 text-xs text-zinc-400">
                  {g.horizon ? `· ${g.horizon}` : ''} · {g.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* raw transcript disclosure */}
      {data.transcript && (
        <details className="mt-8">
          <summary className="cursor-pointer text-xs text-zinc-400">Show raw transcript</summary>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500">{data.transcript}</p>
        </details>
      )}

      <div className="mt-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
      </div>
    </main>
  )
}
