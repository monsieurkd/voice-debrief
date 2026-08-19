import { getCurrentUser } from '@/lib/auth'
import { loadSession } from '@/lib/session'

/**
 * Per-session JSON export (GDPR portability, and the only backup of a day).
 * Self-authorizes: route handlers are plain HTTP endpoints — the ownership
 * scoping inside loadSession is what actually protects the data.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId) || sessionId <= 0) return new Response('Not found', { status: 404 })

  const data = await loadSession(sessionId, user.id) // foreign ids behave as 404
  if (!data) return new Response('Not found', { status: 404 })

  const body = JSON.stringify(
    {
      format: 'voice-debrief/session/1',
      exportedAt: new Date().toISOString(),
      session: {
        id: data.id,
        startedAt: data.startedAt.toISOString(),
        overview: data.overview,
        mood: data.mood,
        energy: data.energy,
        pace: data.pace,
        engagement: data.engagement,
        tone: data.tone,
        transcript: data.transcript,
      },
      goals: data.goals,
      blocks: data.blocks.map((b) => ({
        type: b.entityType,
        text: b.text,
        tags: b.tags,
        ...(b.rationale != null && { rationale: b.rationale }),
        ...(b.resolved !== undefined && { resolved: b.resolved }),
        ...(b.status != null && { status: b.status }),
        ...(b.dueOn != null && { dueOn: b.dueOn }),
        ...(b.goalTitle != null && { goal: b.goalTitle }),
        ...(b.kind != null && { kind: b.kind }),
        ...(b.occurredAt != null && { occurredAt: b.occurredAt.toISOString() }),
      })),
    },
    null,
    2,
  )
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="voice-debrief-session-${data.id}.json"`,
    },
  })
}
