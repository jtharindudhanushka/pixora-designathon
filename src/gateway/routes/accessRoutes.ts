import { Router, Request, Response } from 'express';
import { issueToken, verifyToken, consumeSingleUseToken } from '../../auth/rbac.js';
import { CONFIG } from '../../config/index.js';
import { TOPICS } from '../../broker/topics.js';

export interface ActivePassRecord {
  passId: string;
  token: string;
  name: string;
  partner: string;
  unit: string;
  route: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  issuedAt: number;
  expiresAt: number;
  consumedAt?: string;
}

export function createAccessRouter(
  publishMqtt: (topic: string, message: any) => void,
  broadcastWs: (type: string, data: any) => void
) {
  const router = Router();
  const passesDb: Map<string, ActivePassRecord> = new Map();

  // Seed with an expected delivery pass for Maya (Unit 1402) matching DESIGN_SYSTEM.md
  const initialIssue = issueToken('COURIER_PASS', 'Keells Super Express', CONFIG.DEFAULT_UNIT, 15, {
    partner: 'Keells Super Express',
    route: ['Lobby Turnstile 1', 'Elevator Bank A', 'Floor 14 Corridor'],
  });

  passesDb.set(initialIssue.payload.jti, {
    passId: initialIssue.payload.jti,
    token: initialIssue.token,
    name: 'Keells Super Express',
    partner: 'Keells Super Express',
    unit: CONFIG.DEFAULT_UNIT,
    route: 'Main gate · Lift · Unit 1402',
    status: 'ACTIVE',
    issuedAt: Date.now(),
    expiresAt: initialIssue.payload.expiresAt * 1000,
  });

  /**
   * POST /api/passes/issue
   * Issue a time-bounded cryptographic pass (15 min single-use)
   */
  router.post('/issue', (req: Request, res: Response) => {
    const { partner, residentName, unit, ttlMinutes } = req.body;

    const partnerName = partner || 'Keells Super Express';
    const residentUnit = unit || CONFIG.DEFAULT_UNIT;
    const ttl = ttlMinutes || CONFIG.PASS_TTL_MINUTES;

    const { token, payload } = issueToken('COURIER_PASS', partnerName, residentUnit, ttl, {
      partner: partnerName,
      resident: residentName || CONFIG.DEFAULT_RESIDENT,
      route: ['Lobby Turnstile 1', 'Elevator Bank A', `Floor ${residentUnit.substring(0, 2)}`],
    });

    const passRecord: ActivePassRecord = {
      passId: payload.jti,
      token,
      name: partnerName,
      partner: partnerName,
      unit: residentUnit,
      route: `Main gate · Lift · Unit ${residentUnit}`,
      status: 'ACTIVE',
      issuedAt: Date.now(),
      expiresAt: payload.expiresAt * 1000,
    };

    passesDb.set(payload.jti, passRecord);

    // Broadcast update to Resident App
    broadcastWs('PASS_ISSUED', passRecord);

    res.status(201).json({
      success: true,
      message: `Issued single-use delivery pass for ${partnerName}`,
      pass: passRecord,
      jwt: token,
      claims: payload,
    });
  });

  /**
   * GET /api/passes/active
   * Fetch active passes for display in Resident App & Console
   */
  router.get('/active', (_req: Request, res: Response) => {
    const now = Date.now();
    const passes = Array.from(passesDb.values()).map((p) => {
      if (p.status === 'ACTIVE' && now > p.expiresAt) {
        p.status = 'EXPIRED';
      }
      return p;
    });

    res.json({ success: true, passes });
  });

  /**
   * POST /api/passes/validate-entry
   * Physical turnstile reader scan:
   * Validates JWT, invalidates single-use token, triggers turnstile relay & elevator dispatch
   */
  router.post('/validate-entry', (req: Request, res: Response) => {
    const { token, passId } = req.body;

    let targetToken = token;
    if (!targetToken && passId && passesDb.has(passId)) {
      targetToken = passesDb.get(passId)?.token;
    }

    if (!targetToken) {
      return res.status(400).json({
        success: false,
        error: 'Pass token or valid passId is required for physical entry handshake.',
      });
    }

    // 1. Cryptographic Verification
    const verification = verifyToken(targetToken);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({
        success: false,
        error: verification.error,
        code: 'TOKEN_INVALID_OR_CONSUMED',
      });
    }

    const payload = verification.payload;
    const jti = payload.jti;

    // 2. Atomic Single-Use Nonce Consumption (Prevents Replay Attacks)
    const consumedSuccessfully = consumeSingleUseToken(jti);
    if (!consumedSuccessfully) {
      return res.status(409).json({
        success: false,
        error: 'Security Alert: Pass token has already been consumed. Replay rejected.',
        code: 'REPLAY_ATTACK_PREVENTED',
      });
    }

    // Update database record
    if (passesDb.has(jti)) {
      const record = passesDb.get(jti)!;
      record.status = 'USED';
      record.consumedAt = new Date().toISOString();
    }

    // 3. Publish MQTT hardware commands
    // Command A: Energize Turnstile 1 relay
    const turnstileCommand = {
      action: 'UNLOCK_ENTRY',
      passId: jti,
      unit: payload.unit,
      courier: payload.name,
      durationMs: 8000,
    };
    publishMqtt(TOPICS.TURNSTILE_COMMAND(payload.tower, '1'), turnstileCommand);

    // Command B: Dispatch Mitsubishi elevator to Ground for courier boarding to resident floor
    const targetFloor = parseInt(payload.unit.substring(0, 2), 10) || 14;
    const elevatorCommand = {
      action: 'DISPATCH_CABIN',
      passId: jti,
      targetFloor,
      courier: payload.name,
    };
    publishMqtt(TOPICS.ELEVATOR_COMMAND(payload.tower, 'bank-a'), elevatorCommand);

    // 4. Real-time push to resident app
    const eventData = {
      event: 'COURIER_ENTERED_LOBBY',
      passId: jti,
      courier: payload.name,
      unit: payload.unit,
      timestamp: new Date().toISOString(),
      message: `${payload.name} verified at Lobby Gate. Turnstile unlocked & Elevator Bank A dispatched to Floor ${targetFloor}.`,
    };

    broadcastWs('DELIVERY_ENTRY_HANDSHAKE', eventData);

    return res.json({
      success: true,
      message: 'Frictionless handshake complete. Turnstile unlocked & elevator reserved.',
      details: {
        passId: jti,
        courier: payload.name,
        targetFloor,
        status: 'RELAY_ENERGIZED_AND_ELEVATOR_DISPATCHED',
      },
    });
  });

  return router;
}
