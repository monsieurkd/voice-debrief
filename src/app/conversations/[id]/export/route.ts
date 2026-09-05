import { currentUserOrGuest } from '@/lib/auth'
import { getConversation, getConversationMessages } from '@/lib/chat'
import { buildExportPayload } from '@/lib/export'

/**
 * GET /conversations/:id/export — download a conversation as JSON.
 *
 * Self-authorizes like every server action: the proxy gate is optimistic only.
 * currentUserOrGuest covers guests too (guests own their conversations until
 * adoption). A foreign id is indistinguishable from a missing one → 404, so
 * the response leaks nothing about other users' data.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // params is a Promise in this Next version
  // Strict ASCII-digit check — Number() alone would accept '0x1f', '1e2', ' 7'.
  const conversationId = Number(id)
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(conversationId) || conversationId <= 0) {
    return Response.json({ error: 'Invalid conversation id.' }, { status: 400 })
  }

  const actor = await currentUserOrGuest()
  try {
    const conversation = await getConversation(actor.id, conversationId)
    if (conversation == null) return Response.json({ error: 'Not found' }, { status: 404 })

    const messages = await getConversationMessages(actor.id, conversationId)
    if (messages == null) return Response.json({ error: 'Not found' }, { status: 404 })

    const payload = buildExportPayload(conversation, messages, new Date())
    // Pretty-printed so the downloaded file is readable by humans too.
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="what-i-mean-conversation-${conversationId}.json"`,
      },
    })
  } catch (e) {
    console.error('[conversationExport] failed:', e)
    return Response.json({ error: 'Could not export that conversation.' }, { status: 500 })
  }
}
