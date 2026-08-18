// Dev helper: reset the demo DB to just session 1. Removes throwaway sessions
// left by test scripts and points user_state back at the demo session.
import { db } from '../src/db/client'
import { sessions, userState } from '../src/db/schema'
import { ne, eq } from 'drizzle-orm'

async function main() {
  await db.update(userState).set({ last_session_id: 1, sessions_count: 1 }).where(eq(userState.user_id, 1))
  const deleted = await db.delete(sessions).where(ne(sessions.id, 1))
  console.log('reset user_state → session 1; removed non-demo sessions:', deleted.rowCount ?? '?')
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
