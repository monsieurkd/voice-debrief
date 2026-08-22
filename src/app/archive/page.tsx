import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { listArchiveSessions, listUserTagNames } from '@/lib/queries'
import { formatDate } from '@/lib/dates'
import { MoodStrip } from '@/components/MoodStrip'

// Same freshness rule as Home: the archive reads live data per request.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  // Page-level auth (the proxy gate is optimistic only); scopes every query below.
  const user = await getCurrentUser()
  const guestId = await getGuestId()
  const uid = user?.id ?? guestId
  if (uid == null) return notFound() // no identity to own an archive
  // Untrusted query params: bounded before they reach the query layer.
  const q = first(sp.q).trim().slice(0, 200)
  const tag = first(sp.tag).trim().slice(0, 100)
  const parsedPage = Number.parseInt(first(sp.page), 10)
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const [{ rows, total }, tagNames] = await Promise.all([
    listArchiveSessions({ q, tag, page, pageSize: PAGE_SIZE }, uid),
    listUserTagNames(uid),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtering = q !== '' || tag !== ''

  /** Filter-preserving href; any override resets pagination to page 1. */
  const href = (over: { page?: number; tag?: string | null; q?: string | null } = {}) => {
    const usp = new URLSearchParams()
    const nq = over.q !== undefined ? over.q : q
    const ntag = over.tag !== undefined ? over.tag : tag
    const npage = over.page ?? 1
    if (nq) usp.set('q', nq)
    if (ntag) usp.set('tag', ntag)
    if (npage > 1) usp.set('page', String(npage))
    const s = usp.toString()
    return s ? `/archive?${s}` : '/archive'
  }

  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
      active
        ? 'bg-secondary-container text-on-secondary-container'
        : 'bg-meditative-lavender text-on-surface-muted hover:text-on-surface'
    }`

  return (
    <main className="mx-auto w-full max-w-[920px] px-6 py-12">
      <header className="mb-10">
        <Link href="/" className="text-sm text-on-surface-muted transition hover:text-on-surface">
          ← Home
        </Link>
        <div className="mt-3 flex items-baseline justify-between">
          <h1 className="font-display text-3xl text-on-surface">Archive</h1>
          <p className="text-xs text-on-surface-muted">
            {total} {total === 1 ? 'entry' : 'entries'}
            {q && ` matching “${q}”`}
            {tag && !q && ` tagged ${tag}`}
          </p>
        </div>
      </header>

      {/* Plain GET form — works without JS, keeps the tag filter when searching. */}
      <form action="/archive" method="get" className="mb-4 flex gap-2">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search your entries…"
          aria-label="Search entries"
          className="ambient-field min-w-0 flex-1 py-2 text-sm text-on-surface placeholder:text-on-surface-muted/70"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
        >
          Search
        </button>
      </form>

      {tagNames.length > 0 && (
        <nav className="mb-6 flex flex-wrap items-center gap-2" aria-label="Filter by tag">
          <Link href={href({ tag: null })} className={chip(!tag)}>
            all
          </Link>
          {tagNames.map((name) => (
            <Link key={name} href={href({ tag: name })} className={chip(tag === name)}>
              #{name}
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        filtering ? (
          <p className="py-8 text-sm text-on-surface-muted">
            Nothing matches {q && <>“{q}”</>}
            {q && tag && ' and '}
            {tag && <>#{tag}</>} —{' '}
            <Link href={href({ tag: null, q: null })} className="font-medium text-on-secondary-container underline underline-offset-2">
              clear the filter
            </Link>
            .
          </p>
        ) : page > 1 ? (
          <p className="py-8 text-sm text-on-surface-muted">
            That page is past the end —{' '}
            <Link href={href({ page: 1 })} className="font-medium text-on-secondary-container underline underline-offset-2">
              back to page 1
            </Link>
            .
          </p>
        ) : (
          <p className="py-8 text-sm text-on-surface-muted">
            No entries yet.{' '}
            <Link href="/new" className="font-medium text-on-secondary-container underline underline-offset-2">
              Write your first debrief
            </Link>
            .
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                href={`/session/${e.id}`}
                className="block rounded-lg bg-surface-container-low p-5 transition hover:bg-surface-container"
              >
                <div className="mb-1 flex items-center justify-between">
                  <time className="text-xs text-on-surface-muted">
                    {formatDate(e.startedAt, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </time>
                  <MoodStrip mood={e.mood} energy={e.energy} />
                </div>
                <p className="text-sm leading-6 text-on-surface">{e.overview ?? '(no overview)'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="text-on-secondary-container hover:text-on-surface">
              ← Newer
            </Link>
          ) : (
            <span className="text-on-surface-muted/50">← Newer</span>
          )}
          <span className="text-xs text-on-surface-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} className="text-on-secondary-container hover:text-on-surface">
              Older →
            </Link>
          ) : (
            <span className="text-on-surface-muted/50">Older →</span>
          )}
        </nav>
      )}
    </main>
  )
}
