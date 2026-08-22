import { db } from '@/db/client'
import { sessions, goals, insights, tags, tagLinks, userState, users, nextSteps } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'

/**
 * Deferred attribution: adopt a guest's accumulated data onto a real account.
 *
 * A guest is just a users row with email/password NULL. When they sign up or
 * log in, everything that anonymous user owns is re-parented to the real user,
 * so a debrief typed before logging in survives and lands on their journal.
 *
 * Tenancy notes:
 * - sessions carry user_id; their child rows (events/reflections/decisions/
 *   next_steps) are keyed by session_id ONLY, so re-pointing sessions moves
 *   them all for free.
 * - goals have a per-user uniqueness on (user_id, lower(title)); on a clash we
 *   remap the guest goal's next_steps to the target's existing goal and drop it.
 * - tags have (user_id, kind, name) uniqueness and are referenced by the
 *   polymorphic tag_links; remapped so links follow the surviving tag id.
 *
 * Always safe for a brand-new account (no clashes) and correct for an existing
 * account (clashes absorb into the target's rows).
 */
export async function adoptGuestData(guestId: number, targetId: number): Promise<void> {
  if (guestId === targetId) return

  await db.transaction(async (tx) => {
    // 1. Sessions (and, via them, all child rows).
    await tx.update(sessions).set({ user_id: targetId }).where(eq(sessions.user_id, guestId))

    // 2. Goals — remap clashes to the target's existing title, then move the rest.
    const guestGoals = await tx
      .select({ id: goals.id, title: goals.title, horizon: goals.horizon, status: goals.status })
      .from(goals)
      .where(eq(goals.user_id, guestId))
    const targetGoals = await tx
      .select({ id: goals.id, title: goals.title })
      .from(goals)
      .where(eq(goals.user_id, targetId))
    const targetByLower = new Map(targetGoals.map((g) => [g.title.toLowerCase(), g.id]))
    for (const g of guestGoals) {
      const existing = targetByLower.get(g.title.toLowerCase())
      if (existing != null) {
        // Move this guest goal's next_steps onto the target's goal, then drop the duplicate.
        await tx.update(nextSteps).set({ goal_id: existing }).where(and(eq(nextSteps.goal_id, g.id)))
        await tx.delete(goals).where(eq(goals.id, g.id))
      } else {
        await tx.update(goals).set({ user_id: targetId }).where(eq(goals.id, g.id))
        targetByLower.set(g.title.toLowerCase(), g.id)
      }
    }

    // 3. Insights (threads).
    await tx.update(insights).set({ user_id: targetId }).where(eq(insights.user_id, guestId))

    // 4. Tags — move or remap, and repoint tag_links at the surviving tag id.
    const guestTags = await tx.select().from(tags).where(eq(tags.user_id, guestId))
    const targetTags = await tx.select().from(tags).where(eq(tags.user_id, targetId))
    const targetTagBy = new Map(targetTags.map((t) => [`${t.kind}\u0000${t.name.toLowerCase()}`, t.id]))
    for (const t of guestTags) {
      const key = `${t.kind}\u0000${t.name.toLowerCase()}`
      const existing = targetTagBy.get(key)
      if (existing != null) {
        await tx.update(tagLinks).set({ tag_id: existing }).where(eq(tagLinks.tag_id, t.id))
        await tx.delete(tags).where(eq(tags.id, t.id))
      } else {
        await tx.update(tags).set({ user_id: targetId }).where(eq(tags.id, t.id))
        targetTagBy.set(key, t.id)
      }
    }

    // 5. user_state — merge into the target's single row (target wins, but we
    //    carry the guest's newest journal pointer and combined session count).
    const [guestState] = await tx.select().from(userState).where(eq(userState.user_id, guestId))
    const [targetState] = await tx.select().from(userState).where(eq(userState.user_id, targetId))
    const guestCount = guestState?.sessions_count ?? 0
    if (guestState) await tx.delete(userState).where(eq(userState.user_id, guestId))

    const merged = {
      user_id: targetId,
      last_session_id:
        (guestState?.last_session_id ?? null) ?? (targetState?.last_session_id ?? null) ?? null,
      last_mood: (guestState?.last_mood ?? null) ?? (targetState?.last_mood ?? null) ?? null,
      last_engagement: (guestState?.last_engagement ?? null) ?? (targetState?.last_engagement ?? null) ?? null,
      preferred_pace: (guestState?.preferred_pace ?? null) ?? (targetState?.preferred_pace ?? null) ?? null,
      sessions_count: (targetState?.sessions_count ?? 0) + guestCount,
      open_threads: targetState?.open_threads ?? guestState?.open_threads ?? [],
    }
    await tx
      .insert(userState)
      .values(merged)
      .onConflictDoUpdate({
        target: userState.user_id,
        set: {
          last_session_id: merged.last_session_id,
          last_mood: merged.last_mood,
          last_engagement: merged.last_engagement,
          preferred_pace: merged.preferred_pace,
          sessions_count: sql`${userState.sessions_count} + ${guestCount}`,
          updated_at: new Date(),
        },
      })

    // 6. Finally, the anonymous user row that made all of this possible.
    await tx.delete(users).where(eq(users.id, guestId))
  })
}

/** Number of sessions a guest currently owns (for the "save your debrief" prompt). */
export async function countGuestSessions(guestId: number): Promise<number> {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(sessions).where(eq(sessions.user_id, guestId))
  return r?.c ?? 0
}
