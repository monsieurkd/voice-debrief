import Link from 'next/link'
import { getCurrentUser, getGuestId } from '@/lib/auth'
import { listConversations } from '@/lib/chat'
import { ButtonLink, Card, Wordmark } from '@/components/ui'
import { LoginPill } from '@/components/LoginPill'
import { LogoutButton } from '@/components/LogoutButton'

// Home is an invitation and journal overview. The conversation itself lives at
// /chat so opening the app feels calm and intentional rather than dropping the
// visitor into a full chat client.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const real = await getCurrentUser()
  const guestId = await getGuestId()
  const userId = real?.id ?? guestId

  let recent: Awaited<ReturnType<typeof listConversations>> = []
  if (userId != null) {
    try {
      recent = (await listConversations(userId)).slice(0, 3)
    } catch {
      recent = []
    }
  }

  return (
    <main className="relative flex-1 overflow-y-auto">
      <div className="relative mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-center px-5 py-12 sm:py-16">
        <section className="text-center">
          <h1>
            <Wordmark />
          </h1>
          <p className="mt-3 text-sm font-medium text-on-surface-muted">
            A quiet place to think out loud.
          </p>

          <h2 className="mt-12 font-display text-3xl leading-tight text-on-surface sm:text-4xl">
            Say it messily.<br />Find what matters.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-on-surface-variant">
            Speak freely. A thoughtful voice will listen, ask one useful question at a time,
            and help you find what you really mean.
          </p>
        </section>

        <Card className="mt-9 p-1.5">
          <div className="px-6 py-5 text-center sm:px-7">
            <p className="mx-auto max-w-xs text-sm leading-6 text-on-surface-variant">
              No forms. No need to be polished. Start wherever you are.
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/chat" className="px-6">Start talking</ButtonLink>
            </div>
          </div>
        </Card>

        {recent.length > 0 && (
          <section className="mt-8" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-muted">
              Continue a conversation
            </h2>
            <div className="overflow-hidden rounded-2xl border border-glass-border bg-white/65 backdrop-blur-xl">
              {recent.map((conversation, index) => (
                <Link
                  key={conversation.id}
                  href="/chat"
                  className={`flex items-center justify-between gap-4 px-4 py-3 text-sm transition hover:bg-white/80 ${index > 0 ? 'border-t border-glass-border' : ''}`}
                >
                  <span className="truncate text-on-surface">
                    {conversation.title ?? 'Untitled conversation'}
                  </span>
                  <span className="shrink-0 text-on-secondary-container" aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-7 flex items-center justify-center gap-4 text-sm">
          <Link href="/about" className="text-on-surface-muted underline decoration-outline-variant underline-offset-4 transition hover:text-on-surface">
            How it works
          </Link>
          <span className="h-4 w-px bg-outline-variant" aria-hidden />
          {real ? <LogoutButton /> : <LoginPill />}
        </div>
      </div>
    </main>
  )
}
