// Store connected clients for Server-Sent Events
const clients = new Set<{
  userId: string;
  send: (data: string) => void;
  controller: ReadableStreamDefaultController;
}>();

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

// Add a client to the connected clients set
export function addClient(client: {
  userId: string;
  send: (data: string) => void;
  controller: ReadableStreamDefaultController;
}) {
  clients.add(client);
  console.log(`Client connected: ${client.userId}. Total clients: ${clients.size}`);
}

// Remove a client from the connected clients set
export function removeClient(client: {
  userId: string;
  send: (data: string) => void;
  controller: ReadableStreamDefaultController;
}) {
  clients.delete(client);
  console.log(`Client disconnected: ${client.userId}. Total clients: ${clients.size}`);
}

// Remove clients by userId
export function removeClientsByUserId(userId: string) {
  clients.forEach(client => {
    if (client.userId === userId) {
      clients.delete(client);
    }
  });
}
