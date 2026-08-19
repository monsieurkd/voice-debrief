import { db } from './client'
import { userState } from './schema'
import { sql } from 'drizzle-orm'
import { hashPassword } from '../lib/passwd'

// Local-dev credential for the seeded single-user account. Override with
// SEED_PASSWORD for deploys that keep the seeded account around.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'devpassword'

async function main() {
  // `generated always as identity` columns reject explicit ids, so we override
  // the system value to pin the single-user row to id=1 (spec: single-user v1).
  await db.execute(sql`
    INSERT INTO users (id, email, password_hash) OVERRIDING SYSTEM VALUE
    VALUES (1, 'you@example.com', ${await hashPassword(SEED_PASSWORD)})
    ON CONFLICT (id) DO NOTHING
  `)
  // Only backfill a missing hash — re-seeding must never clobber a changed one.
  await db.execute(sql`
    UPDATE users SET password_hash = ${await hashPassword(SEED_PASSWORD)}
    WHERE id = 1 AND password_hash IS NULL
  `)

  // ensure a user_state row exists (PK = user_id → at most one)
  await db.insert(userState).values({ user_id: 1 }).onConflictDoNothing()

  console.log('✓ Seeded user id=1 + user_state row (login: you@example.com / SEED_PASSWORD, default "devpassword")')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
