export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Forbidden', { status: 403 })
  }
  const body = await request.json()
  const { message, workspaceId } = body
  try {
    const { runAgent } = await import('@/lib/ai/agent')
    const result = await runAgent({
      workspaceId,
      contactId: 'test-contact',
      conversationId: 'test-conversation',
      messageText: message,
      messageHistory: []
    })
    return Response.json(result)
  } catch (error: unknown) {
    const err = error as Error;
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
