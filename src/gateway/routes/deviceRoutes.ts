import { Router, Request, Response } from 'express';
import { HardwareDaemon } from '../../emulator/hardwareDaemon.js';

export function createDeviceRouter(
  hardwareDaemon: HardwareDaemon,
  broadcastWs: (type: string, data: any) => void
) {
  const router = Router();

  /**
   * GET /api/devices
   * Fetch state of all in-unit devices for the 2x2 Quick Controls grid
   */
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      devices: hardwareDaemon.unitDevices,
    });
  });

  /**
   * POST /api/devices/:id/toggle
   * Toggle state or adjust setpoint (stepper +/- for AC)
   */
  router.post('/:id/control', (req: Request, res: Response) => {
    const { id } = req.params;
    const { state, temp } = req.body;

    if (id === 'living-ac') {
      if (state !== undefined) hardwareDaemon.unitDevices.livingRoomAc.state = state;
      if (temp !== undefined) hardwareDaemon.unitDevices.livingRoomAc.temp = Math.max(18, Math.min(28, temp));
      hardwareDaemon.broadcastUnitDeviceState('living-ac', hardwareDaemon.unitDevices.livingRoomAc);
      broadcastWs('DEVICE_STATE_CHANGED', { ...hardwareDaemon.unitDevices.livingRoomAc });
      return res.json({ success: true, device: hardwareDaemon.unitDevices.livingRoomAc });
    }

    if (id === 'front-door') {
      if (state !== undefined) {
        hardwareDaemon.unitDevices.frontDoor.state = state;
        hardwareDaemon.lockTelemetry.setLockState(state);
      }
      hardwareDaemon.broadcastUnitDeviceState('front-door', hardwareDaemon.unitDevices.frontDoor);
      broadcastWs('DEVICE_STATE_CHANGED', { ...hardwareDaemon.unitDevices.frontDoor });
      return res.json({ success: true, device: hardwareDaemon.unitDevices.frontDoor });
    }

    if (id === 'guest-lights') {
      if (state !== undefined) hardwareDaemon.unitDevices.guestRoomLights.state = state;
      hardwareDaemon.broadcastUnitDeviceState('guest-lights', hardwareDaemon.unitDevices.guestRoomLights);
      broadcastWs('DEVICE_STATE_CHANGED', { ...hardwareDaemon.unitDevices.guestRoomLights });
      return res.json({ success: true, device: hardwareDaemon.unitDevices.guestRoomLights });
    }

    if (id === 'guest-ac') {
      if (state !== undefined) hardwareDaemon.unitDevices.guestRoomAc.state = state;
      if (temp !== undefined) hardwareDaemon.unitDevices.guestRoomAc.temp = Math.max(18, Math.min(28, temp));
      hardwareDaemon.broadcastUnitDeviceState('guest-ac', hardwareDaemon.unitDevices.guestRoomAc);
      broadcastWs('DEVICE_STATE_CHANGED', { ...hardwareDaemon.unitDevices.guestRoomAc });
      return res.json({ success: true, device: hardwareDaemon.unitDevices.guestRoomAc });
    }

    return res.status(404).json({ success: false, error: `Device ${id} not found.` });
  });

  return router;
}
