import { TOPICS } from '../broker/topics.js';

export interface LockTelemetryPacket {
  deviceId: string;
  unit: string;
  tower: string;
  timestamp: string;
  voltage_mv: number;
  daily_actuations: number;
  packet_retry_rate: number;
  ambient_temp_c: number;
  lock_state: 'LOCKED' | 'UNLOCKED';
  firmware_version: string;
  is_anomaly_injected: boolean;
}

export class LockTelemetryEmitter {
  private currentVoltage: number = 5480; // 5.48V
  private dailyActuations: number = 14;
  private isAnomalyInjected: boolean = false;
  private lockState: 'LOCKED' | 'UNLOCKED' = 'LOCKED';
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private towerId: string = 'tower-1',
    private unit: string = '1402',
    private deviceId: string = 'LOCK-1402-YALE',
    private publishMqtt: (topic: string, message: any) => void
  ) {}

  public getTelemetry(): LockTelemetryPacket {
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

  public setLockState(state: 'LOCKED' | 'UNLOCKED') {
    this.lockState = state;
    this.dailyActuations += 1;
    // Normal actuation causes ~12mV drop; Anomaly causes ~42mV drop
    const voltageDrop = this.isAnomalyInjected ? 42 : 12;
    this.currentVoltage = Math.max(4100, this.currentVoltage - voltageDrop);
    this.emitTelemetry();
  }

  public injectAnomaly(injected: boolean) {
    this.isAnomalyInjected = injected;
    if (injected) {
      // Rapidly simulate several accelerated drops
      this.currentVoltage = Math.max(4400, this.currentVoltage - 120);
    } else {
      // Reset back to healthy
      this.currentVoltage = 5480;
    }
    this.emitTelemetry();
  }

  public isAnomaly(): boolean {
    return this.isAnomalyInjected;
  }

  public startPeriodicEmission(intervalMs: number = 6000) {
    if (this.timer) clearInterval(this.timer);
    this.emitTelemetry();

    this.timer = setInterval(() => {
      // Periodic micro-decay
      const microDrop = this.isAnomalyInjected ? 25 : 3;
      this.currentVoltage = Math.max(4100, this.currentVoltage - microDrop);
      this.emitTelemetry();
    }, intervalMs);
  }

  public stop() {
    if (this.timer) clearInterval(this.timer);
  }

  public emitTelemetry() {
    const packet = this.getTelemetry();
    const topic = TOPICS.LOCK_TELEMETRY(this.towerId, this.unit);
    this.publishMqtt(topic, packet);
  }
}
