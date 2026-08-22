import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { loadSession } from '@/lib/session'
import { formatDate } from '@/lib/dates'
import { DebriefDoc } from '@/components/DebriefDoc'
import { MoodStrip } from '@/components/MoodStrip'
import { DeleteSessionButton } from '@/components/DeleteSessionButton'
import { SectionTitle, Pill, SaveToJournalPrompt } from '@/components/ui'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const guestId = await getGuestId()
  const uid = user?.id ?? guestId
  const isGuest = !user && guestId != null
  if (uid == null) return notFound()
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound()
  const data = await loadSession(sessionId, uid)
  if (!data) notFound()

  return (
    <main className="mx-auto w-full max-w-[920px] px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-4 py-2 text-sm font-medium text-on-surface-muted backdrop-blur-xl transition hover:bg-white hover:text-on-surface"
          >
            ← New debrief
          </Link>
          <Link href="/" className="text-sm text-on-surface-muted transition hover:text-on-surface">
            Journal
          </Link>
        </div>
        <MoodStrip mood={data.mood} energy={data.energy} />
      </header>

      <h1 className="font-display text-2xl text-on-surface">
        {formatDate(data.startedAt, { weekday: 'long', month: 'long', day: 'numeric' })}
      </h1>

      {data.overview && (
        <p className="mt-3 max-w-2xl text-base leading-8 text-on-surface-muted">{data.overview}</p>
      )}

      <div className="mt-8">
        <DebriefDoc initial={data} />
      </div>

      {data.goals.length > 0 && (
        <section className="mt-10">
          <SectionTitle>Goals in play</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.goals.map((g) => (
              <Pill key={g.title}>
                {g.title}
                <span className="ml-1 text-on-surface-muted/60">
                  {g.horizon ? `· ${g.horizon}` : ''} · {g.status}
                </span>
              </Pill>
            ))}
          </div>
        </section>
      )}

      {data.transcript && (
        <details className="mt-10">
          <summary className="cursor-pointer text-xs font-medium text-on-surface-muted">
            Show raw transcript
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-on-surface-muted">{data.transcript}</p>
        </details>
      )}

      <SaveToJournalPrompt href={`/signup?next=/session/${data.id}`} shown={isGuest} />

      <div className="mt-10 flex items-center justify-between border-t border-outline-variant/60 pt-6">
        <Link href="/" className="text-sm text-on-surface-muted transition hover:text-on-surface">
          ← Home
        </Link>
        <div className="flex items-center gap-4">
          <a
            href={`/session/${data.id}/export`}
            className="text-xs text-on-surface-muted transition hover:text-on-surface"
          >
            export JSON
          </a>
          <DeleteSessionButton sessionId={data.id} />
        </div>
      </div>
    </main>
  )
}
