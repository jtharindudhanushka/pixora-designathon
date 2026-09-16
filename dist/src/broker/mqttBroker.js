import { createServer } from 'net';
import aedes from 'aedes';
import { CONFIG } from '../config/index.js';
export class MqttBrokerService {
    aedesInstance;
    server;
    packetListeners = [];
    constructor() {
        this.aedesInstance = new aedes();
        this.server = createServer(this.aedesInstance.handle);
        this.setupListeners();
    }
    setupListeners() {
        this.aedesInstance.on('client', (client) => {
            console.log(`[MQTT Broker] Client connected: ${client.id}`);
        });
        this.aedesInstance.on('clientDisconnect', (client) => {
            console.log(`[MQTT Broker] Client disconnected: ${client.id}`);
        });
        this.aedesInstance.on('publish', (packet, client) => {
            // Ignore internal $SYS topics
            if (packet.topic.startsWith('$SYS'))
                return;
            const clientId = client ? client.id : 'INTERNAL_BROKER';
            let payloadStr = '';
            let parsedPayload = null;
            try {
                payloadStr = packet.payload.toString('utf-8');
                parsedPayload = JSON.parse(payloadStr);
            }
            catch {
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
                }
                catch (err) {
                    console.error('[MQTT Broker] Error in packet listener:', err);
                }
            }
        });
    }
    onPacket(callback) {
        this.packetListeners.push(callback);
    }
    publish(topic, message, qos = 1) {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.aedesInstance.publish({
            cmd: 'publish',
            qos,
            dup: false,
            retain: false,
            topic,
            payload: Buffer.from(payload),
        }, (err) => {
            if (err)
                console.error(`[MQTT Broker] Publish error on ${topic}:`, err);
        });
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(CONFIG.MQTT_PORT, () => {
                console.log(`[MQTT Broker] Aedes running on port ${CONFIG.MQTT_PORT} (Zero external broker required)`);
                resolve();
            });
            this.server.on('error', (err) => {
                console.error('[MQTT Broker] Failed to start:', err);
                reject(err);
            });
        });
    }
    close() {
        return new Promise((resolve) => {
            this.aedesInstance.close(() => {
                this.server.close(() => {
                    resolve();
                });
            });
        });
    }
}
