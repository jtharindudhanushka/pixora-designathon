import { TOPICS } from '../broker/topics.js';

export type ElevatorStatus =
  | 'IDLE'
  | 'HOMING_GROUND'
  | 'BOARDING_GROUND'
  | 'TRANSIT_ASCENDING'
  | 'ARRIVED_DESTINATION';

export interface ElevatorEvent {
  bankId: string;
  cabinId: string;
  currentFloor: number;
  targetFloor: number;
  status: ElevatorStatus;
  doorsOpen: boolean;
  transitProgressPercent: number;
  courier?: string;
  passId?: string;
  timestamp: string;
  message: string;
}

export class ElevatorControllerEmulator {
  private currentFloor: number = 4;
  private targetFloor: number = 0;
  private status: ElevatorStatus = 'IDLE';
  private doorsOpen: boolean = false;
  private progressPercent: number = 0;
  private motionTimer: NodeJS.Timeout | null = null;

  constructor(
    private towerId: string = 'tower-1',
    private bankId: string = 'bank-a',
    private cabinId: string = 'CABIN-A1',
    private publishMqtt: (topic: string, message: any) => void
  ) {}

  public getState(): ElevatorEvent {
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

  private getStatusMessage(): string {
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

  public handleCommand(command: {
    action: string;
    targetFloor?: number;
    passId?: string;
    courier?: string;
  }) {
    if (command.action === 'DISPATCH_CABIN') {
      const destination = command.targetFloor ?? 14;
      this.runDeliveryCycle(destination, command.passId, command.courier);
    }
  }

  private runDeliveryCycle(destinationFloor: number, passId?: string, courier?: string) {
    if (this.motionTimer) clearTimeout(this.motionTimer);

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

  private broadcastState(passId?: string, courier?: string) {
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
