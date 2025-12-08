class WebSocketService {
  private eventSource: EventSource | null = null;
  private messageCallbacks: ((message: any) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];

  connect(userId: string) {
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    try {
      const eventSourceUrl = `/api/messages/events?userId=${userId}`;
      
      this.eventSource = new EventSource(eventSourceUrl);

      this.eventSource.onopen = () => {
        console.log('SSE connected');
        this.connectionCallbacks.forEach(callback => callback(true));
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.messageCallbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.connectionCallbacks.forEach(callback => callback(false));
      };

    } catch (error) {
      console.error('SSE connection failed:', error);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.messageCallbacks = [];
    this.connectionCallbacks = [];
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionCallbacks.push(callback);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
    };
  }

  get isConnected() {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

export const webSocketService = new WebSocketService();