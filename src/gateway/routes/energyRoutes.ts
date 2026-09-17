import { Router, Request, Response } from 'express';
import { EnergyOptimizer } from '../../ai/energyOptimizer.js';
import { HardwareDaemon } from '../../emulator/hardwareDaemon.js';

export function createEnergyRouter(energyOptimizer: EnergyOptimizer, hardwareDaemon: HardwareDaemon) {
  const router = Router();

  /**
   * GET /api/energy/status
   * Live CEB Peak Tariff demand-response status for the Home AI card and
   * the Climate & Savings screen: current mode, chart timing, savings,
   * and the resident-controlled AI rule toggles (the fallback mechanism).
   */
  router.get('/status', (_req: Request, res: Response) => {
    const status = energyOptimizer.getStatus(hardwareDaemon.unitDevices.livingRoomAc);
    res.json({ success: true, status });
  });

  /**
   * POST /api/energy/rules/:ruleId
   * 1-tap fallback: resident enables/disables a rule (e.g. "CEB Peak
   * Defender") to instantly stop the AI adjusting their AC, same pattern
   * as the lock-anomaly AI's manual override.
   */
  router.post('/rules/:ruleId', (req: Request, res: Response) => {
    const ruleId = String(req.params.ruleId);
    const { enabled } = req.body;

    const rule = energyOptimizer.setRule(ruleId, Boolean(enabled));
    if (!rule) {
      return res.status(404).json({ success: false, error: `Unknown rule: ${ruleId}` });
    }

    const status = energyOptimizer.getStatus(hardwareDaemon.unitDevices.livingRoomAc);
    res.json({ success: true, rule, status });
  });

  return router;
}
