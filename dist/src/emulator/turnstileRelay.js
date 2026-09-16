import { TOPICS } from '../broker/topics.js';
export class TurnstileRelayEmulator {
    towerId;
    turnstileId;
    publishMqtt;
    currentState = 'LOCKED';
    relayTimer = null;
    rotationTimer = null;
    constructor(towerId = 'tower-1', turnstileId = '1', publishMqtt) {
        this.towerId = towerId;
        this.turnstileId = turnstileId;
        this.publishMqtt = publishMqtt;
    }
    getState() {
        return {
            turnstileId: this.turnstileId,
            state: this.currentState,
            relayClosed: this.currentState !== 'LOCKED',
            solenoidActive: this.currentState === 'ENERGIZED',
            opticalSensorTriggered: this.currentState === 'PASSAGE_DETECTED',
            timestamp: new Date().toISOString(),
            message: this.currentState === 'LOCKED'
                ? 'Turnstile locked. Awaiting valid cryptographic pass.'
                : this.currentState === 'ENERGIZED'
                    ? 'Relay energized (12V pulse). Solenoid retracted. Courier passage authorized.'
                    : 'Optical barrier beam break detected. Courier rotating arm.',
        };
    }
    handleCommand(command) {
        if (command.action === 'UNLOCK_ENTRY' || command.action === 'PULSE_RELAY') {
            this.energizeRelay(command.passId, command.unit, command.durationMs || 8000);
        }
    }
    energizeRelay(passId, unit, durationMs = 8000) {
        if (this.relayTimer)
            clearTimeout(this.relayTimer);
        if (this.rotationTimer)
            clearTimeout(this.rotationTimer);
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
    broadcastState(passId, unit, customMessage) {
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
