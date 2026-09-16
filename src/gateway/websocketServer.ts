import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

export class RealtimeEventHub {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial handshake confirmation
      ws.send(
        JSON.stringify({
          type: 'SYSTEM_HANDSHAKE',
          timestamp: new Date().toISOString(),
          status: 'CONNECTED',
          message: 'Connected to TRI-ZEN Real-Time Event Stream (Zero-Latency Bridge)',
        })
      );

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket Hub] Client error:', err);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket Hub] Initialized on /ws path');
  }

  public broadcast(type: string, data: any) {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
