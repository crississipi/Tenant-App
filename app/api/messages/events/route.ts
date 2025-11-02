import { NextRequest } from 'next/server';

// Store connected clients
const clients = new Set<{
  userId: string;
  send: (data: string) => void;
  controller: ReadableStreamDefaultController;
}>();

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

      clients.add(client);
      console.log(`Client connected: ${userId}. Total clients: ${clients.size}`);

      // Remove client when connection closes
      request.signal.addEventListener('abort', () => {
        clients.delete(client);
        console.log(`Client disconnected: ${userId}. Total clients: ${clients.size}`);
      });
    },
    cancel() {
      // Clean up when stream is cancelled
      clients.forEach(client => {
        if (client.userId === userId) {
          clients.delete(client);
        }
      });
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

// Function to broadcast messages to specific users
export function broadcastToUser(userId: string, message: any) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  clients.forEach(client => {
    if (client.userId === userId) {
      try {
        client.send(messageString);
        sentCount++;
      } catch (error) {
        console.error('Error broadcasting to user:', error);
        // Remove broken client connections
        clients.delete(client);
      }
    }
  });
  
  console.log(`Broadcasted to ${sentCount} client(s) for user ${userId}`);
  return sentCount > 0;
}

// Function to broadcast to multiple users
export function broadcastToUsers(userIds: string[], message: any) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  clients.forEach(client => {
    if (userIds.includes(client.userId)) {
      try {
        client.send(messageString);
        sentCount++;
      } catch (error) {
        console.error('Error broadcasting to user:', error);
        clients.delete(client);
      }
    }
  });
  
  console.log(`Broadcasted to ${sentCount} client(s) for users: ${userIds.join(', ')}`);
  return sentCount > 0;
}

// Get connected clients count (for debugging)
export function getConnectedClients() {
  return clients.size;
}