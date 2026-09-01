import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

/**
 * Add a `search_path` pin to the connection string's startup options.
 *
 * Managed Postgres (in particular Neon's pooled "session/bind" endpoint) does
 * not reliably default search_path to `public`: unqualified table references
 * like `users` can intermittently fail with `relation "users" does not exist`
 * even though the table is really there, depending on which pooled backend the
 * session is attached to. Passed as a Postgres startup parameter (`-c
 * search_path=public`), every connection this pool opens starts with `public`
 * in scope, so unqualified queries behave identically on local Postgres and
 * Neon — with no per-connect setup query or race.
 *
 * We preserve any pre-existing startup options already in the URL and append
 * ours only if `search_path` isn't already being set.
 */
function withPublicSearchPath(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const existing = url.searchParams.get('options') ?? ''
    if (/search_path/.test(existing)) {
      // search_path already pinned via options — leave it untouched.
      return connectionString
    }
    const piece = `-c search_path=public`
    const merged = existing ? `${existing} ${piece}` : piece
    url.searchParams.set('options', merged)
    return url.toString()
  } catch {
    // Not a URL we can parse (e.g. a bare DSN); return unchanged rather than
    // break the connection. Unqualified queries may then rely on the server
    // default, which is fine on local Postgres.
    return connectionString
  }
}

// node-postgres pool; one connection pool per process. Each connection starts
// with `public` on its search_path (see withPublicSearchPath).
const pool = new Pool({ connectionString: withPublicSearchPath(env.DATABASE_URL) })

pool.on('error', (err) => {
  // Connection-level errors (not per-query) surface here; log so a failing
  // pool is observable instead of silently dropping requests.
  console.error('[db] unexpected pool error:', err.message)
})

export const db = drizzle(pool, { schema })
export { schema }
