import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import pg from 'pg'

// DRY but explicit: the app tables the code reads/writes, mapped to the
// columns each query needs. If the live DB is missing any of these, chat turns
// and the sidebar fail at query time with code 42703 ("column ... does not
// exist"). This check surfaces that condition up front so you know to run
// `npm run db:migrate` instead of debugging a wall of query text.
const REQUIRED_COLUMNS: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'created_at'],
  conversations: ['id', 'user_id', 'title', 'persona', 'created_at', 'updated_at'],
  messages: ['id', 'conversation_id', 'role', 'content', 'created_at'],
  rate_limits: ['bucket', 'window_start', 'count', 'updated_at'],
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Run with: DATABASE_URL=\'<your-url>\' npm run db:verify')
    process.exit(2)
  }

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows: tables } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public'`,
    )
    const present = new Set(tables.map((r: { table_name: string }) => r.table_name))

    const missing: string[] = []
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      if (!present.has(table)) {
        missing.push(`table "${table}" is missing`)
        continue
      }
      const { rows: got } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      )
      const have = new Set(got.map((r: { column_name: string }) => r.column_name))
      for (const c of cols) {
        if (!have.has(c)) missing.push(`column "${table}"."${c}" is missing`)
      }
    }

    if (missing.length === 0) {
      console.log('✓ Schema OK: all app tables and columns are present.')
      process.exit(0)
    }

    console.error('✗ Schema is missing required columns/tables:')
    for (const m of missing) console.error('   -', m)
    console.error('\nFix: run migrations against this database:')
    console.error("   DATABASE_URL='<your-connection-url>' npm run db:migrate")
    process.exit(1)
  } finally {
    await client.end()
  }
}

void main()
