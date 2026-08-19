// The habit loop's feedback number: how many consecutive calendar days (in
// the app timezone) have at least one debrief. Pure calendar-day math on
// 'YYYY-MM-DD' strings — no instants, no timezone ambiguity at the edges.

import { todayInAppTz, isoMinusDays } from './dates'

/**
 * Current streak over a set of 'YYYY-MM-DD' journaling days.
 *
 * The window ends today; if today has no entry yet the streak counts from
 * yesterday instead — the day isn't over, so the streak stays alive until
 * the app-timezone midnight actually passes. Missing both today and
 * yesterday means the streak is broken (0).
 */
export function computeStreak(daySet: Iterable<string>, now: Date = new Date()): number {
  const days = new Set(daySet)
  let cursor = todayInAppTz(now)
  if (!days.has(cursor)) {
    cursor = isoMinusDays(cursor, 1)
    if (!days.has(cursor)) return 0
  }
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = isoMinusDays(cursor, 1)
  }
  return streak
}
