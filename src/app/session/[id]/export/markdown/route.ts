import { getCurrentUser } from '@/lib/auth'
import { loadSession } from '@/lib/session'
import { sessionToMarkdown } from '@/lib/session-markdown'

/**
 * Per-session Markdown export — the human-readable, portable view of a day.
 * Self-authorizes like the JSON export: route handlers are plain HTTP
 * endpoints, and the ownership scoping inside loadSession is what actually
 * protects the data (foreign ids are 404s).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId) || sessionId <= 0) return new Response('Not found', { status: 404 })

  const data = await loadSession(sessionId, user.id) // foreign ids behave as 404
  if (!data) return new Response('Not found', { status: 404 })

  const markdown = sessionToMarkdown(data)

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="voice-debrief-session-${data.id}.md"`,
    },
  })
}
