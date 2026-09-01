import {
  pgTable,
  bigint,
  text,
  timestamp,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ── users ──────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').unique(),
  // scrypt:<salt>:<hash> — null only for the pre-auth seeded user until a
  // password is set (npm run db:seed assigns one). Login refuses null hashes.
  password_hash: text('password_hash'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── conversations — one per chat session ──────────────────────
export const conversations = pgTable(
  'conversations',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    // Short auto-generated label shown in the sidebar (first user turn).
    title: text('title'),
    // Which persona steers this conversation's tone — one of the PERSONAS ids
    // in src/lib/personas.ts. NULL = the default 'warm' persona (pre-feature
    // rows and callers that don't care).
    persona: text('persona'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conversations_user_id_updated_at_idx').on(t.user_id, t.updated_at.desc())],
)

// ── messages — the chat transcript ─────────────────────────────
export const messages = pgTable(
  'messages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    conversation_id: bigint('conversation_id', { mode: 'number' })
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull().$type<'user' | 'assistant'>(),
    content: text('content').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_conversation_id_created_at_idx').on(t.conversation_id, t.created_at)],
)

// ── rate_limits — fixed-window counters (DB-backed, shared across instances) ──
export const rateLimits = pgTable(
  'rate_limits',
  {
    bucket: text('bucket').notNull(),
    window_start: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.window_start] }), index('rate_limits_bucket_idx').on(t.bucket)],
)
