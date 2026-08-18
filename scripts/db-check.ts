import { db } from '../src/db/client'
import { users } from '../src/db/schema'
import { sql, eq } from 'drizzle-orm'

async function main() {
  const res = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `)
  const rows = (res as any).rows ?? res
  console.log('tables:\n' + rows.map((r: any) => `  ${r.table_name}`).join('\n'))

  const u = await db.select().from(users).where(eq(users.id, 1))
  console.log('\nseeded user (id=1):', u[0] ?? 'NOT FOUND ❌')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
