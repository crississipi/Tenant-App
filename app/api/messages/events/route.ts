import { NextRequest } from 'next/server';
import { addClient, removeClient, removeClientsByUserId } from '@/lib/message-events';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('User ID required', { status: 400 });
  }

  // Set up SSE response
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      const initialMessage = JSON.stringify({
        type: 'connected',
        message: 'Connected to message events',
        timestamp: new Date().toISOString()
      });
      controller.enqueue(encoder.encode(`data: ${initialMessage}\n\n`));

      // Add client to the set
      const client = {
        userId,
        send: (data: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (error) {
            console.error('Error sending to client:', error);
          }
        },
        controller
      };

      addClient(client);

      // Remove client when connection closes
      request.signal.addEventListener('abort', () => {
        removeClient(client);
      });
    },
    cancel() {
      // Clean up when stream is cancelled
      removeClientsByUserId(userId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}