import { db } from './client'
import { sql } from 'drizzle-orm'
import { hashPassword } from '../lib/passwd'

// Local-dev credential for the seeded single-user account. Override with
// SEED_PASSWORD for deploys that keep the seeded account around.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'devpassword'

async function main() {
  // `generated always as identity` columns reject explicit ids, so we override
  // the system value to pin the single-user row to id=1.
  await db.execute(sql`
    INSERT INTO users (id, email, password_hash) OVERRIDING SYSTEM VALUE
    VALUES (1, 'you@example.com', ${await hashPassword(SEED_PASSWORD)})
    ON CONFLICT (id) DO NOTHING
  `)
  // OVERRIDING does NOT advance the identity sequence — left alone, the first
  // real signup would generate id=1 and collide with the pinned row. Re-sync
  // the sequence to the table's max id.
  await db.execute(sql`SELECT setval('users_id_seq', (SELECT max(id) FROM users))`)
  // Only backfill a missing hash — re-seeding must never clobber a changed one.
  await db.execute(sql`
    UPDATE users SET password_hash = ${await hashPassword(SEED_PASSWORD)}
    WHERE id = 1 AND password_hash IS NULL
  `)

  console.log('✓ Seeded user id=1 (login: you@example.com / SEED_PASSWORD, default "devpassword")')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
