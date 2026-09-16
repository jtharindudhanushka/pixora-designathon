import mqtt, { MqttClient } from 'mqtt';
import { CONFIG } from '../config/index.js';
import { TOPICS } from '../broker/topics.js';
import { TurnstileRelayEmulator } from './turnstileRelay.js';
import { ElevatorControllerEmulator } from './elevatorController.js';
import { LockTelemetryEmitter } from './lockTelemetryEmitter.js';

export class HardwareDaemon {
  private client: MqttClient | null = null;
  public turnstile: TurnstileRelayEmulator;
  public elevator: ElevatorControllerEmulator;
  public lockTelemetry: LockTelemetryEmitter;

  // In-unit devices state (Living AC, Guest AC, Balcony Lights)
  public unitDevices = {
    frontDoor: { id: 'front-door', name: 'Front Door', type: 'lock', state: 'LOCKED', battery: 84 },
    livingRoomAc: { id: 'living-ac', name: 'Living Room AC', type: 'thermostat', state: 'ON', temp: 23, min: 18, max: 28 },
    guestRoomLights: { id: 'guest-lights', name: 'Guest Room Lights', type: 'switch', state: 'OFF' },
    guestRoomAc: { id: 'guest-ac', name: 'Guest Room AC', type: 'thermostat', state: 'OFF', temp: 24, min: 18, max: 28 },
  };

  constructor() {
    this.turnstile = new TurnstileRelayEmulator(CONFIG.TOWER_ID, '1', (topic, msg) =>
      this.publish(topic, msg)
    );

    this.elevator = new ElevatorControllerEmulator(CONFIG.TOWER_ID, 'bank-a', 'CABIN-A1', (topic, msg) =>
      this.publish(topic, msg)
    );

    this.lockTelemetry = new LockTelemetryEmitter(CONFIG.TOWER_ID, CONFIG.DEFAULT_UNIT, 'LOCK-1402-YALE', (topic, msg) =>
      this.publish(topic, msg)
    );
  }

  public connect(): Promise<void> {
    return new Promise((resolve) => {
      this.client = mqtt.connect(`mqtt://127.0.0.1:${CONFIG.MQTT_PORT}`, {
        clientId: `trizen-hardware-daemon-${Math.random().toString(16).substring(2, 8)}`,
      });

      this.client.on('connect', () => {
        console.log('[Hardware Daemon] Connected to local MQTT broker.');

        // Subscribe to relevant commands
        this.client?.subscribe([
          TOPICS.TURNSTILE_COMMAND(CONFIG.TOWER_ID, '1'),
          TOPICS.ELEVATOR_COMMAND(CONFIG.TOWER_ID, 'bank-a'),
          `trizen/${CONFIG.TOWER_ID}/unit-${CONFIG.DEFAULT_UNIT}/devices/+/command`,
        ]);

        // Start edge lock telemetry emission
        this.lockTelemetry.startPeriodicEmission(5000);
        resolve();
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        try {
          const parsed = JSON.parse(payload.toString());
          this.handleIncomingMqttMessage(topic, parsed);
        } catch (err) {
          console.error('[Hardware Daemon] Failed to parse message on topic:', topic, err);
        }
      });
    });
  }

  private handleIncomingMqttMessage(topic: string, message: any) {
    if (topic === TOPICS.TURNSTILE_COMMAND(CONFIG.TOWER_ID, '1')) {
      this.turnstile.handleCommand(message);
    } else if (topic === TOPICS.ELEVATOR_COMMAND(CONFIG.TOWER_ID, 'bank-a')) {
      this.elevator.handleCommand(message);
    } else if (topic.includes('/devices/')) {
      this.handleUnitDeviceCommand(topic, message);
    }
  }

  private handleUnitDeviceCommand(topic: string, command: any) {
    const parts = topic.split('/');
    const deviceId = parts[parts.length - 2];

    if (deviceId === 'living-ac' && this.unitDevices.livingRoomAc) {
      if (command.temp !== undefined) {
        this.unitDevices.livingRoomAc.temp = Math.max(18, Math.min(28, command.temp));
      }
      if (command.state) {
        this.unitDevices.livingRoomAc.state = command.state;
      }
      this.broadcastUnitDeviceState('living-ac', this.unitDevices.livingRoomAc);
    } else if (deviceId === 'front-door' && this.unitDevices.frontDoor) {
      if (command.state) {
        this.unitDevices.frontDoor.state = command.state;
        this.lockTelemetry.setLockState(command.state);
      }
      this.broadcastUnitDeviceState('front-door', this.unitDevices.frontDoor);
    } else if (deviceId === 'guest-lights' && this.unitDevices.guestRoomLights) {
      if (command.state) {
        this.unitDevices.guestRoomLights.state = command.state;
      }
      this.broadcastUnitDeviceState('guest-lights', this.unitDevices.guestRoomLights);
    } else if (deviceId === 'guest-ac' && this.unitDevices.guestRoomAc) {
      if (command.state) {
        this.unitDevices.guestRoomAc.state = command.state;
      }
      if (command.temp !== undefined) {
        this.unitDevices.guestRoomAc.temp = command.temp;
      }
      this.broadcastUnitDeviceState('guest-ac', this.unitDevices.guestRoomAc);
    }
  }

  public broadcastUnitDeviceState(deviceId: string, state: any) {
    const topic = `trizen/${CONFIG.TOWER_ID}/unit-${CONFIG.DEFAULT_UNIT}/devices/${deviceId}/state`;
    this.publish(topic, state);
  }

  private publish(topic: string, message: any) {
    if (this.client && this.client.connected) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.client.publish(topic, payload, { qos: 1 });
    }
  }

  public stop() {
    this.lockTelemetry.stop();
    if (this.client) this.client.end();
  }
}
