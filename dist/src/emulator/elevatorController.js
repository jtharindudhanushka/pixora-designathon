import { TOPICS } from '../broker/topics.js';
export class ElevatorControllerEmulator {
    towerId;
    bankId;
    cabinId;
    publishMqtt;
    currentFloor = 4;
    targetFloor = 0;
    status = 'IDLE';
    doorsOpen = false;
    progressPercent = 0;
    motionTimer = null;
    constructor(towerId = 'tower-1', bankId = 'bank-a', cabinId = 'CABIN-A1', publishMqtt) {
        this.towerId = towerId;
        this.bankId = bankId;
        this.cabinId = cabinId;
        this.publishMqtt = publishMqtt;
    }
    getState() {
        return {
            bankId: this.bankId,
            cabinId: this.cabinId,
            currentFloor: this.currentFloor,
            targetFloor: this.targetFloor,
            status: this.status,
            doorsOpen: this.doorsOpen,
            transitProgressPercent: this.progressPercent,
            timestamp: new Date().toISOString(),
            message: this.getStatusMessage(),
        };
    }
    getStatusMessage() {
        switch (this.status) {
            case 'IDLE':
                return `Elevator ${this.cabinId} parked at Floor ${this.currentFloor}. System standby.`;
            case 'HOMING_GROUND':
                return `Elevator ${this.cabinId} auto-dispatched to Ground Lobby for courier pickup.`;
            case 'BOARDING_GROUND':
                return `Elevator ${this.cabinId} doors OPEN at Ground Lobby. Courier boarding (Floors restricted to Unit 1402).`;
            case 'TRANSIT_ASCENDING':
                return `Elevator ${this.cabinId} ascending to Floor ${this.targetFloor}. Passing Floor ${this.currentFloor}...`;
            case 'ARRIVED_DESTINATION':
                return `Elevator ${this.cabinId} arrived at Floor ${this.targetFloor}. Doors OPEN. Courier exiting to Unit Corridor.`;
        }
    }
    handleCommand(command) {
        if (command.action === 'DISPATCH_CABIN') {
            const destination = command.targetFloor ?? 14;
            this.runDeliveryCycle(destination, command.passId, command.courier);
        }
    }
    runDeliveryCycle(destinationFloor, passId, courier) {
        if (this.motionTimer)
            clearTimeout(this.motionTimer);
        // Step 1: Cabin dispatched to Ground
        this.status = 'HOMING_GROUND';
        this.targetFloor = 0;
        this.doorsOpen = false;
        this.progressPercent = 10;
        this.broadcastState(passId, courier);
        // Step 2: Cabin reaches Ground, doors open
        this.motionTimer = setTimeout(() => {
            this.currentFloor = 0;
            this.status = 'BOARDING_GROUND';
            this.doorsOpen = true;
            this.progressPercent = 25;
            this.broadcastState(passId, courier);
            // Step 3: Doors close, transit begins to destination floor
            this.motionTimer = setTimeout(() => {
                this.doorsOpen = false;
                this.status = 'TRANSIT_ASCENDING';
                this.targetFloor = destinationFloor;
                this.progressPercent = 50;
                this.currentFloor = Math.floor(destinationFloor / 2);
                this.broadcastState(passId, courier);
                // Step 4: Arrives at Floor 14
                this.motionTimer = setTimeout(() => {
                    this.currentFloor = destinationFloor;
                    this.status = 'ARRIVED_DESTINATION';
                    this.doorsOpen = true;
                    this.progressPercent = 100;
                    this.broadcastState(passId, courier);
                    // Step 5: Doors close, return to IDLE after 8 seconds
                    this.motionTimer = setTimeout(() => {
                        this.doorsOpen = false;
                        this.status = 'IDLE';
                        this.broadcastState(passId, courier);
                    }, 8000);
                }, 4000);
            }, 3500);
        }, 2500);
    }
    broadcastState(passId, courier) {
        const event = {
            ...this.getState(),
            passId,
            courier,
            message: this.getStatusMessage(),
        };
        const topic = TOPICS.ELEVATOR_STATE(this.towerId, this.bankId);
        this.publishMqtt(topic, event);
    }
}
