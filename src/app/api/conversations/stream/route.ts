import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return new Response('Missing workspaceId', { status: 400 });
  }

  if (session.user.workspaceId !== workspaceId) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  const channel = `workspace:${workspaceId}:inbox`;
  
  // Create a new redis instance for the subscriber to avoid blocking the main client
  const subscriber = redis.duplicate();

  const stream = new ReadableStream({
    async start(controller) {
      await subscriber.subscribe(channel);
      
      subscriber.on('message', (chan, message) => {
        if (chan === channel) {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        }
      });

      // Keep-alive every 30s
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 30000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        subscriber.unsubscribe(channel);
        subscriber.quit();
        controller.close();
      });
    },
    cancel() {
      subscriber.unsubscribe(channel);
      subscriber.quit();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
