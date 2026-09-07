import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

/**
 * Keep every connection's `search_path` pinned to `public`.
 *
 * Managed Postgres (in particular Neon's pooled "session" endpoint) does not
 * reliably default search_path to `public`: unqualified table references like
 * `users` can intermittently fail with `relation "users" does not exist` even
 * though the table is really there, depending on which pooled backend the
 * session is attached to.
 *
 * We pin it per-connection with a `SET search_path TO public`, run via the
 * pool's awaited `onConnect` hook. `onConnect` is resolved before the client
 * is ever handed to a query, so the SET always applies first. There is no
 * race and no concurrent-query deprecation warning. A runtime `SET` is a
 * normal query, which both Neon pooled/unpooled and local Postgres accept.
 *
 * Why NOT the URL `options` startup parameter (`-c search_path=public`)? Neon's
 * pooled endpoints explicitly REJECT such startup parameters from the startup
 * packet (error 08P01: "unsupported startup parameter in options: search_path").
 * The per-connection SET achieves the same guarantee without that limitation.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  async onConnect(client) {
    await client.query('SET search_path TO public, pg_catalog')
  },
})

pool.on('error', (err) => {
  // Connection-level errors (not per-query) surface here; log so a failing
  // pool is observable instead of silently dropping requests.
  console.error('[db] unexpected pool error:', err.message)
})

export const db = drizzle(pool, { schema })
export { schema }
