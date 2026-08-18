import { db } from './client'
import { userState } from './schema'
import { sql } from 'drizzle-orm'

async function main() {
  // `generated always as identity` columns reject explicit ids, so we override
  // the system value to pin the single-user row to id=1 (spec: single-user v1).
  await db.execute(sql`
    INSERT INTO users (id, email) OVERRIDING SYSTEM VALUE
    VALUES (1, 'you@example.com')
    ON CONFLICT (id) DO NOTHING
  `)

  // ensure a user_state row exists (PK = user_id → at most one)
  await db.insert(userState).values({ user_id: 1 }).onConflictDoNothing()

  console.log('✓ Seeded user id=1 + user_state row')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
