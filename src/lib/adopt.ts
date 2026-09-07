import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { conversations, users } from '@/db/schema'

/**
 * Deferred attribution for the chat product: fold a guest's conversations
 * (minted the first time they chatted anonymously) onto a real account they
 * just signed up / logged into, then delete the now-empty guest row.
 *
 * Called by the signup/login actions after the account is created. Safe to
 * re-run: no guest row → no-op. Adoption is best-effort and must never block
 * a successful login, so the auth action catches any throw here.
 */
export async function adoptGuestData(guestId: number, userId: number): Promise<void> {
  // Repoint every conversation the guest created to the real user. Both rows
  // share the `users` table, so this is a single owner flip in one update.
  await db.update(conversations).set({ user_id: userId }).where(eq(conversations.user_id, guestId))

  // The guest is now an empty shell, so drop it. Its FKs cascade nothing relevant:
  // conversations already moved to the real user.
  await db.delete(users).where(eq(users.id, guestId))
}
