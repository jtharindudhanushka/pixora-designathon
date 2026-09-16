import { createServer } from 'net';
import aedes from 'aedes';
import { CONFIG } from '../config/index.js';

export class MqttBrokerService {
  private aedesInstance: any;
  private server: any;
  private packetListeners: Array<(topic: string, payload: any) => void> = [];

  constructor() {
    this.aedesInstance = new (aedes as any)();
    this.server = createServer(this.aedesInstance.handle);

    this.setupListeners();
  }

  private setupListeners() {
    this.aedesInstance.on('client', (client: any) => {
      console.log(`[MQTT Broker] Client connected: ${client.id}`);
    });

    this.aedesInstance.on('clientDisconnect', (client: any) => {
      console.log(`[MQTT Broker] Client disconnected: ${client.id}`);
    });

    this.aedesInstance.on('publish', (packet: any, client: any) => {
      // Ignore internal $SYS topics
      if (packet.topic.startsWith('$SYS')) return;

      const clientId = client ? client.id : 'INTERNAL_BROKER';
      let payloadStr = '';
      let parsedPayload: any = null;

      try {
        payloadStr = packet.payload.toString('utf-8');
        parsedPayload = JSON.parse(payloadStr);
      } catch {
        payloadStr = packet.payload.toString('utf-8');
        parsedPayload = payloadStr;
      }

      // Notify packet listeners (for WebSocket inspector)
      for (const listener of this.packetListeners) {
        try {
          listener(packet.topic, {
            topic: packet.topic,
            payload: parsedPayload,
            rawPayload: payloadStr,
            qos: packet.qos,
            retain: packet.retain,
            clientId,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[MQTT Broker] Error in packet listener:', err);
        }
      }
    });
  }

  public onPacket(callback: (topic: string, payload: any) => void) {
    this.packetListeners.push(callback);
  }

  public publish(topic: string, message: any, qos: 0 | 1 | 2 = 1) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.aedesInstance.publish(
      {
        cmd: 'publish',
        qos,
        dup: false,
        retain: false,
        topic,
        payload: Buffer.from(payload),
      },
      (err: any) => {
        if (err) console.error(`[MQTT Broker] Publish error on ${topic}:`, err);
      }
    );
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(CONFIG.MQTT_PORT, () => {
        console.log(`[MQTT Broker] Aedes running on port ${CONFIG.MQTT_PORT} (Zero external broker required)`);
        resolve();
      });

      this.server.on('error', (err: any) => {
        console.error('[MQTT Broker] Failed to start:', err);
        reject(err);
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.aedesInstance.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}
