import { Router, Request, Response } from 'express';
import { AnomalyDetector } from '../../ai/anomalyDetector.js';
import { LockTelemetryEmitter } from '../../emulator/lockTelemetryEmitter.js';
import { parseNaturalLanguageCommand } from '../../ai/naturalLanguageEngine.js';

export function createTelemetryRouter(
  anomalyDetector: AnomalyDetector,
  lockTelemetry: LockTelemetryEmitter,
  executeAction: (target: string, action: string, payload: any) => void,
  broadcastWs: (type: string, data: any) => void
) {
  const router = Router();

  /**
   * GET /api/telemetry/latest
   * Returns current battery health, AI anomaly status, and work-order state
   */
  router.get('/latest', (_req: Request, res: Response) => {
    const telemetry = lockTelemetry.getTelemetry();
    const report = anomalyDetector.processTelemetry(telemetry);

    res.json({
      success: true,
      telemetry,
      aiAnalysis: report,
    });
  });

  /**
   * POST /api/telemetry/inject-anomaly
   * Enables or disables accelerated battery degradation to test AI triage live
   */
  router.post('/inject-anomaly', (req: Request, res: Response) => {
    const { enabled } = req.body;
    const isAnomaly = enabled !== undefined ? Boolean(enabled) : !lockTelemetry.isAnomaly();

    lockTelemetry.injectAnomaly(isAnomaly);
    const telemetry = lockTelemetry.getTelemetry();
    const report = anomalyDetector.processTelemetry(telemetry);

    broadcastWs('AI_ALERT', report);
    broadcastWs('LOCK_TELEMETRY', telemetry);

    res.json({
      success: true,
      anomalyInjected: isAnomaly,
      message: isAnomaly
        ? 'Injected accelerated cell short-circuit (~42 mV/cycle drop). AI anomaly triggered.'
        : 'Restored normal battery baseline (~12 mV/cycle drop).',
      telemetry,
      aiAnalysis: report,
    });
  });

  /**
   * POST /api/telemetry/manual-override
   * 1-Tap Manual Override Fallback per brief:
   * Resident or Operator taps [Dismiss / Heavy Usage] to widen tolerance window
   */
  router.post('/manual-override', (req: Request, res: Response) => {
    const { durationHours = 24, reason = 'Heavy moving/usage' } = req.body;

    anomalyDetector.applyManualOverride(durationHours, 1.8);
    const telemetry = lockTelemetry.getTelemetry();
    const report = anomalyDetector.processTelemetry(telemetry);

    broadcastWs('AI_ALERT', report);

    res.json({
      success: true,
      message: `Applied 1-tap manual override for ${durationHours}h (${reason}). Tolerance threshold widened by 1.8x without compromising critical security perimeter.`,
      aiAnalysis: report,
    });
  });

  /**
   * POST /api/assistant/command
   * Natural Language Assistant for the AI search input bar: "Tell your home what you need…"
   */
  router.post('/assistant/command', (req: Request, res: Response) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query text is required.' });
    }

    const result = parseNaturalLanguageCommand(query);

    // Execute parsed actions
    for (const act of result.actions) {
      executeAction(act.target, act.action, act.payload);
    }

    res.json({
      success: true,
      query,
      result,
    });
  });

  return router;
}
