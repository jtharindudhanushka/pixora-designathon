import { TOPICS } from '../broker/topics.js';
export class LockTelemetryEmitter {
    towerId;
    unit;
    deviceId;
    publishMqtt;
    currentVoltage = 5480; // 5.48V
    dailyActuations = 14;
    isAnomalyInjected = false;
    lockState = 'LOCKED';
    timer = null;
    constructor(towerId = 'tower-1', unit = '1402', deviceId = 'LOCK-1402-YALE', publishMqtt) {
        this.towerId = towerId;
        this.unit = unit;
        this.deviceId = deviceId;
        this.publishMqtt = publishMqtt;
    }
    getTelemetry() {
        return {
            deviceId: this.deviceId,
            unit: this.unit,
            tower: this.towerId,
            timestamp: new Date().toISOString(),
            voltage_mv: Math.round(this.currentVoltage),
            daily_actuations: this.dailyActuations,
            packet_retry_rate: this.isAnomalyInjected ? 0.082 : 0.018,
            ambient_temp_c: 27.2 + (Math.random() * 0.8 - 0.4),
            lock_state: this.lockState,
            firmware_version: 'v3.8.4-jkh',
            is_anomaly_injected: this.isAnomalyInjected,
        };
    }
    setLockState(state) {
        this.lockState = state;
        this.dailyActuations += 1;
        // Normal actuation causes ~12mV drop; Anomaly causes ~42mV drop
        const voltageDrop = this.isAnomalyInjected ? 42 : 12;
        this.currentVoltage = Math.max(4100, this.currentVoltage - voltageDrop);
        this.emitTelemetry();
    }
    injectAnomaly(injected) {
        this.isAnomalyInjected = injected;
        if (injected) {
            // Rapidly simulate several accelerated drops
            this.currentVoltage = Math.max(4400, this.currentVoltage - 120);
        }
        else {
            // Reset back to healthy
            this.currentVoltage = 5480;
        }
        this.emitTelemetry();
    }
    isAnomaly() {
        return this.isAnomalyInjected;
    }
    startPeriodicEmission(intervalMs = 6000) {
        if (this.timer)
            clearInterval(this.timer);
        this.emitTelemetry();
        this.timer = setInterval(() => {
            // Periodic micro-decay
            const microDrop = this.isAnomalyInjected ? 25 : 3;
            this.currentVoltage = Math.max(4100, this.currentVoltage - microDrop);
            this.emitTelemetry();
        }, intervalMs);
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
    }
    emitTelemetry() {
        const packet = this.getTelemetry();
        const topic = TOPICS.LOCK_TELEMETRY(this.towerId, this.unit);
        this.publishMqtt(topic, packet);
    }
}
