import { Router } from 'express';
export function createEnergyRouter(energyOptimizer, hardwareDaemon) {
    const router = Router();
    /**
     * GET /api/energy/status
     * Live CEB Peak Tariff demand-response status for the Home AI card and
     * the Climate & Savings screen: current mode, chart timing, savings,
     * and the resident-controlled AI rule toggles (the fallback mechanism).
     */
    router.get('/status', (_req, res) => {
        const status = energyOptimizer.getStatus(hardwareDaemon.unitDevices.livingRoomAc);
        res.json({ success: true, status });
    });
    /**
     * POST /api/energy/debug-mode
     * Judge/demo evaluation control: force IDLE/PRE_COOLING/ECO_FLOAT so the
     * behavior can be shown outside the real 17:35-20:00 window. Pass
     * { mode: null } to clear the override and return to real wall-clock
     * behavior. This only short-circuits the mode decision — every other
     * computation (chart timing, savings, explainability text) still runs
     * for real off whichever mode is active.
     */
    router.post('/debug-mode', (req, res) => {
        const { mode } = req.body;
        if (mode !== null && mode !== 'IDLE' && mode !== 'PRE_COOLING' && mode !== 'ECO_FLOAT') {
            return res.status(400).json({ success: false, error: 'mode must be null, IDLE, PRE_COOLING, or ECO_FLOAT' });
        }
        energyOptimizer.setDebugMode(mode);
        const status = energyOptimizer.getStatus(hardwareDaemon.unitDevices.livingRoomAc);
        res.json({ success: true, status });
    });
    /**
     * POST /api/energy/rules/:ruleId
     * 1-tap fallback: resident enables/disables a rule (e.g. "CEB Peak
     * Defender") to instantly stop the AI adjusting their AC, same pattern
     * as the lock-anomaly AI's manual override.
     */
    router.post('/rules/:ruleId', (req, res) => {
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
