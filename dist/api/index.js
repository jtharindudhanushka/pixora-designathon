import express from 'express';
import { createAccessRouter } from '../src/gateway/routes/accessRoutes.js';
import { createTelemetryRouter } from '../src/gateway/routes/telemetryRoutes.js';
import { createDeviceRouter } from '../src/gateway/routes/deviceRoutes.js';
import { createEnergyRouter } from '../src/gateway/routes/energyRoutes.js';
import { AnomalyDetector } from '../src/ai/anomalyDetector.js';
import { EnergyOptimizer } from '../src/ai/energyOptimizer.js';
import { LockTelemetryEmitter } from '../src/emulator/lockTelemetryEmitter.js';
import { HardwareDaemon } from '../src/emulator/hardwareDaemon.js';
const app = express();
app.use(express.json());
// Serverless singletons
const anomalyDetector = new AnomalyDetector();
const energyOptimizer = new EnergyOptimizer();
const hardwareDaemon = new HardwareDaemon();
const lockEmitter = new LockTelemetryEmitter('tower-1', '1402', 'LOCK-1402-YALE', () => { });
const noopMqtt = () => { };
const noopWs = () => { };
const executeAction = (target, action, payload) => {
    if (target === 'device' && action === 'UPDATE_DEVICE') {
        const { deviceId, state, temp } = payload;
        if (deviceId === 'living-ac') {
            if (state)
                hardwareDaemon.unitDevices.livingRoomAc.state = state;
            if (temp)
                hardwareDaemon.unitDevices.livingRoomAc.temp = temp;
        }
        else if (deviceId === 'front-door') {
            if (state)
                hardwareDaemon.unitDevices.frontDoor.state = state;
        }
        else if (deviceId === 'guest-lights') {
            if (state)
                hardwareDaemon.unitDevices.guestRoomLights.state = state;
        }
        else if (deviceId === 'guest-ac') {
            if (state)
                hardwareDaemon.unitDevices.guestRoomAc.state = state;
        }
    }
};
app.use('/api/passes', createAccessRouter(noopMqtt, noopWs));
app.use('/api/telemetry', createTelemetryRouter(anomalyDetector, lockEmitter, executeAction, noopWs));
app.use('/api/devices', createDeviceRouter(hardwareDaemon, noopWs));
app.use('/api/energy', createEnergyRouter(energyOptimizer, hardwareDaemon));
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'HEALTHY',
        platform: 'TRI-ZEN OS',
        deployment: 'VERCEL_SERVERLESS',
        timestamp: new Date().toISOString(),
    });
});
export default app;
