import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
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
  if (!user) redirect('/login')
  // Untrusted query params: bounded before they reach the query layer.
  const q = first(sp.q).trim().slice(0, 200)
  const tag = first(sp.tag).trim().slice(0, 100)
  const parsedPage = Number.parseInt(first(sp.page), 10)
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const [{ rows, total }, tagNames] = await Promise.all([
    listArchiveSessions({ q, tag, page, pageSize: PAGE_SIZE }, user.id),
    listUserTagNames(user.id),
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
    `rounded-full px-2.5 py-1 text-xs transition ${
      active
        ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
        : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
    }`

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Archive</h1>
          <p className="text-xs text-zinc-400">
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
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
          <p className="py-8 text-sm text-zinc-400">
            Nothing matches {q && <>“{q}”</>}
            {q && tag && ' and '}
            {tag && <>#{tag}</>} —{' '}
            <Link href={href({ tag: null, q: null })} className="underline">
              clear the filter
            </Link>
            .
          </p>
        ) : page > 1 ? (
          <p className="py-8 text-sm text-zinc-400">
            That page is past the end —{' '}
            <Link href={href({ page: 1 })} className="underline">
              back to page 1
            </Link>
            .
          </p>
        ) : (
          <p className="py-8 text-sm text-zinc-400">
            No entries yet.{' '}
            <Link href="/new" className="underline">
              Write your first debrief
            </Link>
            .
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                href={`/session/${e.id}`}
                className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="mb-1 flex items-center justify-between">
                  <time className="text-xs text-zinc-400">
                    {formatDate(e.startedAt, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </time>
                  <MoodStrip mood={e.mood} energy={e.energy} />
                </div>
                <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{e.overview ?? '(no overview)'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← Newer
            </Link>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-700">← Newer</span>
          )}
          <span className="text-xs text-zinc-400">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Older →
            </Link>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-700">Older →</span>
          )}
        </nav>
      )}
    </main>
  )
}
