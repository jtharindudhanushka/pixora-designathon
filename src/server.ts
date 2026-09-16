import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config/index.js';
import { MqttBrokerService } from './broker/mqttBroker.js';
import { RealtimeEventHub } from './gateway/websocketServer.js';
import { HardwareDaemon } from './emulator/hardwareDaemon.js';
import { AnomalyDetector } from './ai/anomalyDetector.js';
import { createAccessRouter } from './gateway/routes/accessRoutes.js';
import { createTelemetryRouter } from './gateway/routes/telemetryRoutes.js';
import { createDeviceRouter } from './gateway/routes/deviceRoutes.js';
import { TOPICS } from './broker/topics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  console.log('===========================================================');
  console.log('  TRI-ZEN OS — Integrated Smart Living Platform');
  console.log('  John Keells Properties | Colombo 02');
  console.log('  Engineered by Team Pixora');
  console.log('===========================================================');

  // 1. Initialize Embedded MQTT Broker (Zero external dependencies)
  const mqttBroker = new MqttBrokerService();
  await mqttBroker.start();

  // 2. Initialize Express Application & HTTP Server
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use(express.static(path.join(__dirname, 'public')));

  // 3. Initialize Realtime WebSocket Hub
  const wsHub = new RealtimeEventHub(httpServer);

  // Forward raw MQTT packets directly to WebSocket inspector
  mqttBroker.onPacket((topic, packet) => {
    wsHub.broadcast('RAW_MQTT_PACKET', packet);
  });

  // 4. Initialize Hardware Daemon (Turnstile, Elevator, Yale Lock)
  const hardwareDaemon = new HardwareDaemon();
  await hardwareDaemon.connect();

  // 5. Initialize AI Anomaly Detection Engine
  const anomalyDetector = new AnomalyDetector();

  // Bridge hardware daemon states to WebSocket
  setInterval(() => {
    const turnstileState = hardwareDaemon.turnstile.getState();
    const elevatorState = hardwareDaemon.elevator.getState();
    const lockPacket = hardwareDaemon.lockTelemetry.getTelemetry();
    const aiReport = anomalyDetector.processTelemetry(lockPacket);

    wsHub.broadcast('TURNSTILE_STATE', turnstileState);
    wsHub.broadcast('ELEVATOR_STATE', elevatorState);
    wsHub.broadcast('LOCK_TELEMETRY', lockPacket);
    wsHub.broadcast('AI_ALERT', aiReport);
  }, 2000);

  // Action executor helper for assistant commands
  const executeAction = (target: string, action: string, payload: any) => {
    if (target === 'device' && action === 'UPDATE_DEVICE') {
      const { deviceId, state, temp } = payload;
      if (deviceId === 'living-ac') {
        if (state) hardwareDaemon.unitDevices.livingRoomAc.state = state;
        if (temp) hardwareDaemon.unitDevices.livingRoomAc.temp = temp;
        hardwareDaemon.broadcastUnitDeviceState('living-ac', hardwareDaemon.unitDevices.livingRoomAc);
      } else if (deviceId === 'front-door') {
        if (state) {
          hardwareDaemon.unitDevices.frontDoor.state = state;
          hardwareDaemon.lockTelemetry.setLockState(state);
        }
        hardwareDaemon.broadcastUnitDeviceState('front-door', hardwareDaemon.unitDevices.frontDoor);
      } else if (deviceId === 'guest-lights') {
        if (state) hardwareDaemon.unitDevices.guestRoomLights.state = state;
        hardwareDaemon.broadcastUnitDeviceState('guest-lights', hardwareDaemon.unitDevices.guestRoomLights);
      } else if (deviceId === 'guest-ac') {
        if (state) hardwareDaemon.unitDevices.guestRoomAc.state = state;
        if (temp) hardwareDaemon.unitDevices.guestRoomAc.temp = temp;
        hardwareDaemon.broadcastUnitDeviceState('guest-ac', hardwareDaemon.unitDevices.guestRoomAc);
      }
      wsHub.broadcast('DEVICE_STATE_CHANGED', hardwareDaemon.unitDevices);
    }
  };

  // 6. Mount REST API Gateways
  const publishToMqtt = (topic: string, msg: any) => mqttBroker.publish(topic, msg);
  const broadcastToWs = (type: string, data: any) => wsHub.broadcast(type, data);

  app.use('/api/passes', createAccessRouter(publishToMqtt, broadcastToWs));
  app.use('/api/telemetry', createTelemetryRouter(anomalyDetector, hardwareDaemon.lockTelemetry, executeAction, broadcastToWs));
  app.use('/api/devices', createDeviceRouter(hardwareDaemon, broadcastToWs));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'HEALTHY',
      platform: 'TRI-ZEN OS',
      client: CONFIG.CLIENT,
      tower: CONFIG.TOWER_ID,
      mqttBroker: 'RUNNING_EMBEDDED',
      webSocketClients: wsHub.getConnectedClientsCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // 7. Start HTTP listening
  httpServer.listen(CONFIG.PORT, () => {
    console.log(`[TRI-ZEN Gateway] API & Web Console listening at: http://localhost:${CONFIG.PORT}`);
    console.log(`[TRI-ZEN Gateway] MQTT Broker active on port: ${CONFIG.MQTT_PORT}`);
    console.log(`[TRI-ZEN Gateway] WebSocket Event Bus: ws://localhost:${CONFIG.PORT}/ws`);
    console.log('Ready for judge evaluation and live testing.');
  });
}

bootstrap().catch((err) => {
  console.error('[TRI-ZEN OS] Fatal bootstrap error:', err);
  process.exit(1);
});
