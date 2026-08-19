import {
  pgTable,
  bigint,
  text,
  smallint,
  integer,
  timestamp,
  date,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// Postgres tsvector has no first-class drizzle column — declare the type so a
// generated search column can live in the schema. Search-only: never selected
// into app code, always written by the database itself.
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

// Spec §5 uses `text` with documented allowed values (no PG enum types), so we
// keep text columns and layer TS unions on top via .$type<>().
export type Mood = 'low' | 'neutral' | 'high'
export type Pace = 'rushed' | 'measured' | 'detailed'
export type Source = 'ai' | 'user'
export type NextStepStatus = 'open' | 'done' | 'skipped'
export type GoalStatus = 'active' | 'done' | 'dropped'
export type Horizon = 'short' | 'long'
export type TagKind = 'person' | 'project' | 'topic'
export type EntityType = 'event' | 'reflection' | 'decision' | 'next_step'

// ── users ──────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── sessions — the atomic unit; one per debrief ────────────────
export const sessions = pgTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    mood: text('mood').$type<Mood>(),
    energy: smallint('energy'),
    pace: text('pace').$type<Pace>(),
    engagement: smallint('engagement'),
    tone: text('tone'),
    overview: text('overview'),
    transcript: text('transcript'),
    // embedding vector(1536) — DEFERRED (pgvector). Uncomment when enabled.
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Archive full-text search source: overview + transcript, English config.
    // STORED generated → always in sync with the row (no trigger), computed
    // for existing rows by the migration's table rewrite; the GIN index below
    // makes `search_tsv @@ websearch_to_tsquery(...)` index-backed.
    search_tsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(overview, '') || ' ' || coalesce(transcript, ''))`,
    ),
  },
  (t) => [
    index('sessions_user_id_started_at_idx').on(t.user_id, t.started_at.desc()),
    index('sessions_search_tsv_idx').using('gin', t.search_tsv),
  ],
)

// ── goals — long-lived; next_steps roll up to them ─────────────
export const goals = pgTable('goals', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  horizon: text('horizon').$type<Horizon>(),
  status: text('status').notNull().$type<GoalStatus>().default('active'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── events ─────────────────────────────────────────────────────
export const events = pgTable('events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  what: text('what').notNull(),
  occurred_at: timestamp('occurred_at', { withTimezone: true }),
  source: text('source').notNull().$type<Source>().default('ai'),
  was_corrected: boolean('was_corrected').notNull().default(false),
})

// ── reflections — a thought / worry / idea (NOT an action) ─────
export const reflections = pgTable('reflections', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  kind: text('kind'),
  source: text('source').notNull().$type<Source>().default('ai'),
  was_corrected: boolean('was_corrected').notNull().default(false),
})

// ── decisions ──────────────────────────────────────────────────
export const decisions = pgTable('decisions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  rationale: text('rationale'),
  resolved: boolean('resolved').notNull().default(false),
  source: text('source').notNull().$type<Source>().default('ai'),
  was_corrected: boolean('was_corrected').notNull().default(false),
})

// ── next_steps ─────────────────────────────────────────────────
export const nextSteps = pgTable(
  'next_steps',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    session_id: bigint('session_id', { mode: 'number' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    goal_id: bigint('goal_id', { mode: 'number' }).references(() => goals.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    status: text('status').notNull().$type<NextStepStatus>().default('open'),
    due_on: date('due_on'),
    source: text('source').notNull().$type<Source>().default('ai'),
    was_corrected: boolean('was_corrected').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('next_steps_status_idx').on(t.status), index('next_steps_goal_id_idx').on(t.goal_id)],
)

// ── tags + tag_links (polymorphic; app-enforced, NO FK on entity_id) ──
export const tags = pgTable(
  'tags',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<TagKind>(),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('tags_user_id_kind_name_uniq').on(t.user_id, t.kind, t.name)],
)

export const tagLinks = pgTable(
  'tag_links',
  {
    tag_id: bigint('tag_id', { mode: 'number' }).notNull().references(() => tags.id, { onDelete: 'cascade' }),
    entity_type: text('entity_type').notNull().$type<EntityType>(),
    entity_id: bigint('entity_id', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tag_id, t.entity_type, t.entity_id] }),
    index('tag_links_entity_idx').on(t.entity_type, t.entity_id),
  ],
)

// ── user_state — single row per user; overwritten each session ──
export const userState = pgTable('user_state', {
  user_id: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  last_session_id: bigint('last_session_id', { mode: 'number' }).references(() => sessions.id),
  last_mood: text('last_mood').$type<Mood>(),
  last_engagement: smallint('last_engagement'),
  preferred_pace: text('preferred_pace').$type<Pace>(),
  sessions_count: integer('sessions_count').notNull().default(0),
  open_threads: jsonb('open_threads').notNull().default(sql`'[]'::jsonb`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── rate_limits — fixed-window counters for the public demo (per IP + action).
// Pre-auth abuse control: DB-backed so all serverless instances share state.
// Phase 1 replaces this with per-user limits.
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

// ── insights — conditional; stored so the most-recent is preloadable ──
export const insights = pgTable(
  'insights',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    source_session_id: bigint('source_session_id', { mode: 'number' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    related: jsonb('related'),
    shown: boolean('shown').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('insights_user_id_created_at_idx').on(t.user_id, t.created_at.desc())],
)

// ── relations (for drizzle's relational query API) ─────────────
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.user_id], references: [users.id] }),
  events: many(events),
  reflections: many(reflections),
  decisions: many(decisions),
  nextSteps: many(nextSteps),
}))

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.user_id], references: [users.id] }),
  nextSteps: many(nextSteps),
}))

export const nextStepsRelations = relations(nextSteps, ({ one }) => ({
  session: one(sessions, { fields: [nextSteps.session_id], references: [sessions.id] }),
  goal: one(goals, { fields: [nextSteps.goal_id], references: [goals.id] }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  goals: many(goals),
}))
