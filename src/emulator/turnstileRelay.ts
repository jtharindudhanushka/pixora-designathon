import { TOPICS } from '../broker/topics.js';

export type TurnstileState = 'LOCKED' | 'ENERGIZED' | 'PASSAGE_DETECTED';

export interface TurnstileEvent {
  turnstileId: string;
  state: TurnstileState;
  relayClosed: boolean;
  solenoidActive: boolean;
  opticalSensorTriggered: boolean;
  passId?: string;
  unit?: string;
  timestamp: string;
  message: string;
}

export class TurnstileRelayEmulator {
  private currentState: TurnstileState = 'LOCKED';
  private relayTimer: NodeJS.Timeout | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(
    private towerId: string = 'tower-1',
    private turnstileId: string = '1',
    private publishMqtt: (topic: string, message: any) => void
  ) {}

  public getState(): TurnstileEvent {
    return {
      turnstileId: this.turnstileId,
      state: this.currentState,
      relayClosed: this.currentState !== 'LOCKED',
      solenoidActive: this.currentState === 'ENERGIZED',
      opticalSensorTriggered: this.currentState === 'PASSAGE_DETECTED',
      timestamp: new Date().toISOString(),
      message:
        this.currentState === 'LOCKED'
          ? 'Turnstile locked. Awaiting valid cryptographic pass.'
          : this.currentState === 'ENERGIZED'
          ? 'Relay energized (12V pulse). Solenoid retracted. Courier passage authorized.'
          : 'Optical barrier beam break detected. Courier rotating arm.',
    };
  }

  public handleCommand(command: {
    action: string;
    passId?: string;
    unit?: string;
    durationMs?: number;
  }) {
    if (command.action === 'UNLOCK_ENTRY' || command.action === 'PULSE_RELAY') {
      this.energizeRelay(command.passId, command.unit, command.durationMs || 8000);
    }
  }

  private energizeRelay(passId?: string, unit?: string, durationMs: number = 8000) {
    if (this.relayTimer) clearTimeout(this.relayTimer);
    if (this.rotationTimer) clearTimeout(this.rotationTimer);

    // Step 1: Energize coil
    this.currentState = 'ENERGIZED';
    this.broadcastState(passId, unit, 'Turnstile 1 relay energized. 12V lock released for 8 seconds.');

    // Step 2: Optical sensor registers passage after 3 seconds
    this.rotationTimer = setTimeout(() => {
      this.currentState = 'PASSAGE_DETECTED';
      this.broadcastState(passId, unit, 'Optical rotation sensor triggered. Courier entered lobby.');

      // Step 3: De-energize and relock
      this.relayTimer = setTimeout(() => {
        this.currentState = 'LOCKED';
        this.broadcastState(passId, unit, 'Relay de-energized. Turnstile 1 returned to LOCKED state.');
      }, 5000);
    }, 3000);
  }

  private broadcastState(passId?: string, unit?: string, customMessage?: string) {
    const event = {
      ...this.getState(),
      passId,
      unit,
      message: customMessage || this.getState().message,
    };

    const topic = TOPICS.TURNSTILE_STATE(this.towerId, this.turnstileId);
    this.publishMqtt(topic, event);
  }
}
