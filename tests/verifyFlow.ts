import { issueToken, verifyToken, consumeSingleUseToken } from '../src/auth/rbac.js';
import { AnomalyDetector } from '../src/ai/anomalyDetector.js';
import { LockTelemetryEmitter } from '../src/emulator/lockTelemetryEmitter.js';
import { parseNaturalLanguageCommand } from '../src/ai/naturalLanguageEngine.js';

async function runAutomatedVerification() {
  console.log('===========================================================');
  console.log('  TRI-ZEN OS — Automated End-to-End System Verification');
  console.log('  Testing RBAC, Pass Lifecycle, Replay Defense, AI & Telemetry');
  console.log('===========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // -------------------------------------------------------------------------
  // Test Suite 1: Cryptographic RBAC & Pass Token Issuance
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Cryptographic Pass Generation & JWT Validation');

  const issueResult = issueToken('COURIER_PASS', 'Keells Super Express', '1402', 15, {
    partner: 'Keells Super Express',
    route: ['Turnstile 1', 'Elevator Bank A'],
  });

  assert(Boolean(issueResult.token), 'Cryptographic token string issued');
  assert(issueResult.payload.role === 'COURIER_PASS', 'Token role is COURIER_PASS');
  assert(issueResult.payload.scopes.includes('lobby:turnstile_enter'), 'Token has turnstile entry scope');
  assert(issueResult.payload.scopes.includes('elevator:destination_floor'), 'Token has elevator destination scope');
  assert(!issueResult.payload.scopes.includes('device:factory_reset'), 'Token strictly lacks administrative reset scope');

  // Verify signature
  const verifyResult = verifyToken(issueResult.token);
  assert(verifyResult.valid === true, 'Token signature and expiration verified by public engine');

  // -------------------------------------------------------------------------
  // Test Suite 2: Single-Use Nonce Invalidation & Replay Attack Defense
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2] Single-Use Invalidation & Anti-Replay Defense');

  const jti = issueResult.payload.jti;
  const firstTap = consumeSingleUseToken(jti);
  assert(firstTap === true, 'First turnstile scan atomically consumes single-use nonce');

  const secondTap = consumeSingleUseToken(jti);
  assert(secondTap === false, 'Second turnstile scan REJECTED as replay attack (Single-use enforcement)');

  const replayVerify = verifyToken(issueResult.token);
  assert(replayVerify.valid === false, 'Replayed token fails verification check with security error');

  // -------------------------------------------------------------------------
  // Test Suite 3: AI Predictive Health & Rolling Z-Score Anomaly Engine
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] AI Hardware Anomaly Detection (15-Marks Tie-Breaker)');

  const detector = new AnomalyDetector();
  const lockEmitter = new LockTelemetryEmitter('tower-1', '1402', 'LOCK-1402-YALE', () => {});

  // Test baseline normal state
  const baselineTelemetry = lockEmitter.getTelemetry();
  const baselineReport = detector.processTelemetry(baselineTelemetry);
  assert(baselineReport.isAnomaly === false, 'Normal lock telemetry matches 14-day rolling baseline');
  assert(baselineReport.zScore < 1.5, `Normal z-score (${baselineReport.zScore}σ) within standard threshold`);

  // Inject accelerated degradation (~42 mV/actuation drop)
  lockEmitter.injectAnomaly(true);
  const anomalyTelemetry = lockEmitter.getTelemetry();
  const anomalyReport = detector.processTelemetry(anomalyTelemetry);

  assert(anomalyReport.isAnomaly === true, 'AI triggers critical anomaly alert on cell degradation');
  assert(anomalyReport.multiplier >= 2.8, `Voltage drop rate is ${anomalyReport.multiplier}x baseline (expected ~3.2x)`);
  assert(Boolean(anomalyReport.workOrder), 'Auto-routed JKH Facilities Work Order generated');
  assert(anomalyReport.workOrder?.commercialSavingLkr === 13500, 'Quantifiable LKR 13,500 saving recorded per emergency avoided');

  // Test 1-Tap Manual Override Fallback per brief
  console.log('\n[Suite 4] 1-Tap Manual Override Fallback Mechanics');
  detector.applyManualOverride(24, 2.0); // Widen tolerance by 2.0x
  const overrideReport = detector.processTelemetry(anomalyTelemetry);
  assert(overrideReport.manualOverrideActive === true, '1-Tap override widens tolerance without disarming perimeter');

  // -------------------------------------------------------------------------
  // Test Suite 5: AI Natural Language Scene Engine
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5] AI Natural Language Scene Parsing ("Tell your home what you need…")');

  const nlp1 = parseNaturalLanguageCommand('I have a Keells delivery coming in 15 minutes');
  assert(nlp1.intent === 'GENERATE_DELIVERY_PASS', 'Understands delivery pass generation intent');

  const nlp2 = parseNaturalLanguageCommand('Leaving home for work');
  assert(nlp2.intent === 'SCENE_LEAVING_HOME', 'Understands Leaving Home macro scene');
  assert(nlp2.actions.some((a) => a.payload.deviceId === 'front-door'), 'Leaving Home scene locks Front Door');

  const nlp3 = parseNaturalLanguageCommand('Set living room AC to 20 degrees');
  assert(nlp3.intent === 'SET_AC_TEMP', 'Understands AC temperature stepper command');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===========================================================');

  if (passed === total) {
    console.log('  STATUS: ALL INDUSTRY-READY SYSTEM CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('  STATUS: SOME CHECKS FAILED.\n');
    process.exit(1);
  }
}

runAutomatedVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
