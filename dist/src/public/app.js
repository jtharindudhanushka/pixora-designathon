// ==========================================================================
// TRI-ZEN OS — 3D Documentary Digital Twin Coordination Engine
// Synchronizes Rider QR, Cinematic Architectural Canvas, and Maya's Living App
// ==========================================================================

let ws;
let currentPassId = null;
let activePasses = [];
let unitDevices = {};
let isSequencePlaying = false;
let sequenceTimer = null;
let currentPlaybackStage = 1;

document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchInitialData();
  startPassCountdownTimer();
});

// --------------------------------------------------------------------------
// WebSocket Real-Time Event Bus
// --------------------------------------------------------------------------
function initWebSocket() {
  let reconnectAttempts = 0;
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected to TRI-ZEN real-time hardware stream.');
      const rate = document.getElementById('mqttRate');
      if (rate) rate.innerText = 'PORT 1883 · REALTIME';
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        handleLiveHardwareEvent(packet);
      } catch (err) {
        console.error('[WebSocket] Event parse error:', err);
      }
    };

    ws.onerror = () => {
      // Graceful serverless fallback
      console.log('[Platform] Serverless mode active. Running client-side simulation bridge.');
    };

    ws.onclose = () => {
      reconnectAttempts++;
      if (reconnectAttempts < 3) {
        setTimeout(initWebSocket, 3000);
      } else {
        const rate = document.getElementById('mqttRate');
        if (rate) rate.innerText = 'CLOUD SERVERLESS · ACTIVE';
      }
    };
  } catch {
    console.log('[Platform] WebSocket unavailable in current environment. Using serverless mode.');
  }
}

function handleLiveHardwareEvent(packet) {
  const { type, data } = packet;

  switch (type) {
    case 'PASS_ISSUED':
      renderActivePass(data);
      break;
    case 'DELIVERY_ENTRY_HANDSHAKE': {
      const courierStatus = document.getElementById('courierPassStatus');
      if (courierStatus) {
        courierStatus.innerText = 'CONSUMED';
        courierStatus.className = 'token-status-pill';
        courierStatus.style.background = 'rgba(59, 130, 246, 0.2)';
        courierStatus.style.color = 'var(--accent-blue)';
      }
      jumpToStage(2);
      setTimeout(() => {
        jumpToStage(3);
        setTimeout(() => jumpToStage(4), 3800);
      }, 3000);
      break;
    }
    case 'TURNSTILE_STATE':
      if (data.relayClosed && window.twinRenderer) {
        window.twinRenderer.targetTurnstileOpen = 1.0;
      }
      break;
    case 'ELEVATOR_STATE':
      if (window.twinRenderer) {
        if (data.status === 'TRANSIT_ASCENDING') {
          window.twinRenderer.targetCabinY = 0.6;
        } else if (data.status === 'ARRIVED_DESTINATION') {
          window.twinRenderer.targetCabinY = 1.0;
        }
      }
      break;
    case 'LOCK_TELEMETRY':
      updateAiTelemetryUI(data);
      break;
    case 'AI_ALERT':
      updateAiAlertUI(data);
      break;
    case 'DEVICE_STATE_CHANGED':
      fetchDevices();
      break;
    case 'RAW_MQTT_PACKET':
      appendMqttHudEntry(data);
      break;
  }
}

// --------------------------------------------------------------------------
// Data Fetching
// --------------------------------------------------------------------------
async function fetchInitialData() {
  await fetchPasses();
  await fetchDevices();
  await fetchTelemetry();
  await fetchEnergyStatus();
  // Re-poll every 20s so the pre-cool/eco-float state, chart "now" marker,
  // and cycle-saving figure stay live without needing a page refresh —
  // the same "simulation keeps running" pattern as the lock telemetry.
  setInterval(fetchEnergyStatus, 20000);
}

async function fetchPasses() {
  try {
    const res = await fetch('/api/passes/active');
    const data = await res.json();
    if (data.success && data.passes && data.passes.length > 0) {
      activePasses = data.passes;
      const primary = activePasses.find((p) => p.status === 'ACTIVE');
      if (primary) {
        renderActivePass(primary);
        return;
      }
    }
    renderIdleState();
  } catch (err) {
    console.error('Pass fetch error:', err);
    renderIdleState();
  }
}

function renderActivePass(pass) {
  currentPassId = pass.passId;
  activePasses = [pass];

  const statusEl = document.getElementById('courierPassStatus');
  if (statusEl) {
    statusEl.innerText = 'VALID';
    statusEl.className = 'token-status-pill';
    statusEl.style.background = '';
    statusEl.style.color = '';
  }

  const brandName = pass.name || pass.partner || 'Keells Super Express';
  const brandEl = document.getElementById('courierBrandTitle');
  if (brandEl) brandEl.innerText = brandName;

  const resTitle = document.getElementById('resDeliveryTitle');
  if (resTitle) resTitle.innerText = brandName;

  const orderEl = document.getElementById('courierOrderId');
  if (orderEl) orderEl.innerText = 'Order #JKH-5021 · Grocery';

  const pinEl = document.getElementById('courierPinVal');
  if (pinEl) pinEl.innerText = '749 · 102';

  const scanBtn = document.getElementById('btnScanPass');
  if (scanBtn) scanBtn.disabled = false;

  const qrBox = document.getElementById('courierQrBox');
  if (qrBox) qrBox.style.opacity = '1';

  // In simulation: Bring resident mobile app to home screen immediately
  goToScreen('screenHome');

  // Resident App UI: Switch from Empty State to Active Delivery Tracker
  const emptyCard = document.getElementById('mEmptyArrivals');
  if (emptyCard) emptyCard.classList.add('hidden');

  const countPill = document.getElementById('mPassCountPill');
  if (countPill) countPill.innerText = '1 active';

  const deliverySection = document.getElementById('deliverySection');
  if (deliverySection) {
    deliverySection.classList.remove('hidden');
    deliverySection.style.display = 'block';
  }

  const trackerCard = document.getElementById('deliveryTrackerCard');
  if (trackerCard) trackerCard.classList.remove('hidden');

  const successCard = document.getElementById('deliverySuccessCard');
  if (successCard) successCard.classList.add('hidden');

  jumpToStage(1);
}

function renderIdleState() {
  currentPassId = null;
  activePasses = [];

  const statusEl = document.getElementById('courierPassStatus');
  if (statusEl) {
    statusEl.innerText = 'VALID';
    statusEl.className = 'token-status-pill';
    statusEl.style.background = '';
    statusEl.style.color = '';
  }

  const brandEl = document.getElementById('courierBrandTitle');
  if (brandEl) brandEl.innerText = 'Keells Super Express';

  const orderEl = document.getElementById('courierOrderId');
  if (orderEl) orderEl.innerText = 'Main gate · Lift · Unit 1402';

  const countdownEl = document.getElementById('passCountdownVal');
  if (countdownEl) countdownEl.innerText = '14m 59s';

  const pinEl = document.getElementById('courierPinVal');
  if (pinEl) pinEl.innerText = '749 · 102';

  const scanBtn = document.getElementById('btnScanPass');
  if (scanBtn) scanBtn.disabled = false;

  const qrBox = document.getElementById('courierQrBox');
  if (qrBox) qrBox.style.opacity = '1';

  const alertBox = document.getElementById('scanResultAlert');
  if (alertBox) alertBox.classList.add('hidden');

  goToScreen('screenHome');

  const countPill = document.getElementById('mPassCountPill');
  if (countPill) countPill.innerText = '1 active';

  const trackerCard = document.getElementById('deliveryTrackerCard');
  if (trackerCard) trackerCard.classList.remove('hidden');

  const emptyCard = document.getElementById('mEmptyArrivals');
  if (emptyCard) emptyCard.classList.add('hidden');

  const successCard = document.getElementById('deliverySuccessCard');
  if (successCard) successCard.classList.add('hidden');

  jumpToStage(1);
}

async function fetchDevices() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    if (data.success) {
      unitDevices = data.devices;
      renderResidentDevices();
    }
  } catch (err) {
    console.error('Device fetch error:', err);
  }
}

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry/latest');
    const data = await res.json();
    if (data.success) {
      updateAiTelemetryUI(data.telemetry);
      updateAiAlertUI(data.aiAnalysis);
    }
  } catch (err) {
    console.error('Telemetry fetch error:', err);
  }
}

// --------------------------------------------------------------------------
// Cinematic Documentary Playback Controller
// --------------------------------------------------------------------------
function togglePlaySequence() {
  if (isSequencePlaying) {
    stopSequencePlayback();
  } else {
    startSequencePlayback();
  }
}

async function startSequencePlayback() {
  selectCameraPreset('auto');
  if (!currentPassId) {
    await confirmIssuePass({ silent: true });
  }

  isSequencePlaying = true;
  document.getElementById('playIcon').innerText = '⏸';
  document.getElementById('playLabel').innerText = 'Pause Sequence';

  // Step 1: Gate Arrival
  jumpToStage(1);

  // Step 2: Handshake at Gate (after 2.5s)
  sequenceTimer = setTimeout(() => {
    triggerHandshakeScan();

    // Step 3: Elevator Transit (after 4s)
    sequenceTimer = setTimeout(() => {
      jumpToStage(3);

      // Step 4: Residence 1402 Delivery (after 4.5s)
      sequenceTimer = setTimeout(() => {
        jumpToStage(4);
        stopSequencePlayback();
      }, 4500);
    }, 4000);
  }, 2500);
}

function stopSequencePlayback() {
  isSequencePlaying = false;
  if (sequenceTimer) clearTimeout(sequenceTimer);
  document.getElementById('playIcon').innerText = '▶';
  document.getElementById('playLabel').innerText = 'Play Simulation';
}

function jumpToStage(stage) {
  currentPlaybackStage = stage;

  // 1. Update Timeline Stepper Buttons
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`tNode${i}`);
    if (btn) {
      if (stage > 0 && i <= stage) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  // 2. Update Maya's App Delivery Stepper
  if (stage > 0) {
    updateResidentStepper(stage);
  }

  // 3. Update 3D Architectural Canvas
  if (window.twinRenderer) {
    window.twinRenderer.setStage(stage);
  }
}

// Stage copy mirrors the Figma "Delivery in progress" live tracking card
// (On way / Gate / Unlock / Door), driven by the same 1-4 stage the 3D twin
// and courier timeline already use — see jumpToStage().
const DELIVERY_STAGE_COPY = {
  1: { sub: 'Heading to Tower 1 · Grocery order', badge: 'Active' },
  2: { sub: 'Courier arrived · verifying pass at Gate 1', badge: 'Active' },
  3: { sub: 'Access granted · lift dispatched to Floor 14', badge: 'Active' },
  4: { sub: 'Courier at Unit 1402 door', badge: 'Active' },
};

let deliverySuccessTimer = null;

function updateResidentStepper(stage) {
  const badge = document.getElementById('dtBadge');
  const sub = document.getElementById('dtSubtext');
  const copy = DELIVERY_STAGE_COPY[stage] || DELIVERY_STAGE_COPY[1];

  for (let i = 1; i <= 4; i++) {
    const node = document.getElementById(`stNode${i}`);
    if (!node) continue;
    node.className = 'st-node';
    if (i < stage) node.classList.add('state-done');
    else if (i === stage) node.classList.add('state-current');
  }
  for (let i = 1; i <= 3; i++) {
    const bar = document.getElementById(`stBar${i}`);
    if (!bar) continue;
    bar.className = i < stage ? 'st-bar completed' : 'st-bar';
  }

  if (badge) {
    badge.innerHTML = '<span class="badge-live-dot"></span> Active';
  }
  if (sub) sub.innerText = copy.sub;

  if (stage >= 4) {
    scheduleDeliverySuccess();
  }
}

function scheduleDeliverySuccess() {
  if (deliverySuccessTimer) return; // already scheduled for this delivery
  deliverySuccessTimer = setTimeout(() => {
    const tracker = document.getElementById('deliveryTrackerCard');
    const success = document.getElementById('deliverySuccessCard');
    const dsSub = document.getElementById('dsSubtext');
    if (dsSub) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      dsSub.innerText = `Keells Super Express arrived at ${timeStr} · Pass consumed`;
    }
    if (tracker) tracker.classList.add('hidden');
    if (success) success.classList.remove('hidden');

    setTimeout(() => {
      renderIdleState();
      deliverySuccessTimer = null;
    }, 4000);
  }, 1200);
}

// --------------------------------------------------------------------------
// Cryptographic Pass Scan Action
// --------------------------------------------------------------------------
async function triggerHandshakeScan() {
  if (!currentPassId) {
    alert('No active delivery pass. Please issue a pass from Maya\'s phone app first.');
    openPassModal();
    return;
  }

  const alertBox = document.getElementById('scanResultAlert');
  const title = document.getElementById('scanAlertTitle');
  const sub = document.getElementById('scanAlertSub');

  try {
    const res = await fetch('/api/passes/validate-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId: currentPassId }),
    });

    const data = await res.json();
    alertBox.classList.remove('hidden');

    if (data.success) {
      alertBox.className = 'scan-result-box';
      title.innerText = 'Access Granted (Gate 1)';
      sub.innerText = 'Turnstile 1 relay energized. Solenoid released for 8s.';

      jumpToStage(2);

      // Auto-transition to lift and doorstep
      setTimeout(() => {
        jumpToStage(3);
        setTimeout(() => jumpToStage(4), 3800);
      }, 3000);

      const courierStatus = document.getElementById('courierPassStatus');
      if (courierStatus) {
        courierStatus.innerText = 'CONSUMED';
        courierStatus.className = 'token-status-pill';
        courierStatus.style.background = 'rgba(59, 130, 246, 0.2)';
        courierStatus.style.color = 'var(--accent-blue)';
      }
    } else {
      alertBox.className = 'scan-result-box danger';
      title.innerText = 'Access Denied (Replay Defense)';
      sub.innerText = data.error || 'Token already consumed. Replay rejected.';
    }
  } catch (err) {
    console.error('Scan error:', err);
  }
}

// --------------------------------------------------------------------------
// Maya's Resident Device Controls
// --------------------------------------------------------------------------
function renderResidentDevices() {
  if (!unitDevices) return;

  // Front Door
  const door = unitDevices.frontDoor;
  const tileDoor = document.getElementById('mTileDoor');
  const tagDoor = document.getElementById('mDoorTag');
  const statDoor = document.getElementById('resDoorState');

  if (door && tileDoor && tagDoor) {
    const isLocked = door.state === 'LOCKED';
    tileDoor.className = `m-tile ${isLocked ? 'tile-dark' : 'tile-light'}`;
    tagDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
    tagDoor.style.color = isLocked ? 'var(--accent-green)' : 'var(--accent-red)';
    if (statDoor) statDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
  }

  // Living Room AC
  const ac = unitDevices.livingRoomAc;
  const tileAc = document.getElementById('mTileAc');
  const valAc = document.getElementById('mAcVal');
  const subAc = document.getElementById('mAcSub');
  const statTemp = document.getElementById('resInsideTemp');

  if (ac && tileAc && valAc) {
    const isOn = ac.state === 'ON';
    tileAc.className = `m-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    valAc.innerText = `${ac.temp}°C`;
    subAc.innerText = isOn ? 'Cool · Eco' : 'Off';
    if (statTemp) statTemp.innerText = `${ac.temp}°C`;
  }

  // Guest Lights
  const lights = unitDevices.guestRoomLights;
  const switchLights = document.getElementById('mSwitchLights');
  const tileLights = document.getElementById('mTileLights');
  const subLights = document.getElementById('mLightsSub');

  if (lights && switchLights && tileLights) {
    const isOn = lights.state === 'ON';
    switchLights.checked = isOn;
    tileLights.className = `m-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    subLights.innerText = isOn ? 'On · 80%' : 'Off';
  }

  // Guest AC
  const guestAc = unitDevices.guestRoomAc;
  const switchGuestAc = document.getElementById('mSwitchGuestAc');
  const tileGuestAc = document.getElementById('mTileGuestAc');
  const subGuestAc = document.getElementById('mGuestAcSub');

  if (guestAc && switchGuestAc && tileGuestAc) {
    const isOn = guestAc.state === 'ON';
    switchGuestAc.checked = isOn;
    tileGuestAc.className = `m-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    subGuestAc.innerText = isOn ? `On · ${guestAc.temp}°C` : 'Off';
  }

  // Active count
  let count = 0;
  if (door?.state === 'LOCKED') count++;
  if (ac?.state === 'ON') count++;
  if (lights?.state === 'ON') count++;
  if (guestAc?.state === 'ON') count++;
  document.getElementById('resActiveCount').innerText = `${count} Devices`;
}

async function toggleFrontDoor() {
  const state = unitDevices.frontDoor?.state === 'LOCKED' ? 'UNLOCKED' : 'LOCKED';
  await fetch('/api/devices/front-door/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function stepAcTemp(delta) {
  const cur = unitDevices.livingRoomAc?.temp || 23;
  const temp = Math.max(18, Math.min(28, cur + delta));
  await fetch('/api/devices/living-ac/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp, state: 'ON' }),
  });
  fetchDevices();
}

async function toggleAc() {
  const state = unitDevices.livingRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/living-ac/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function toggleLights() {
  const state = unitDevices.guestRoomLights?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/guest-lights/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function toggleGuestAc() {
  const state = unitDevices.guestRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/guest-ac/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

// --------------------------------------------------------------------------
// Natural Language AI Input
// --------------------------------------------------------------------------
function handleAiInputKey(e) {
  if (e.key === 'Enter') sendAiCommand();
}

async function sendAiCommand() {
  const input = document.getElementById('mAiInput');
  const query = input.value.trim();
  if (!query) return;

  try {
    const res = await fetch('/api/telemetry/assistant/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✦ ${data.result.responseMessage}`);
      input.value = '';
      fetchDevices();
      fetchPasses();
    }
  } catch (err) {
    console.error('Assistant error:', err);
  }
}

function showToast(msg) {
  const toast = document.getElementById('mAiToast');
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 5000);
}

function focusAiInput() {
  const input = document.getElementById('mAiInput');
  input.focus();
  input.placeholder = 'e.g. Issue Keells pass or Turn off all ACs...';
}

// --------------------------------------------------------------------------
// Pass Countdown Ticker
// --------------------------------------------------------------------------
function startPassCountdownTimer() {
  setInterval(() => {
    if (activePasses.length === 0 || !currentPassId) {
      const el = document.getElementById('passCountdownVal');
      if (el && el.innerText !== 'No active pass') el.innerText = 'No active pass';
      return;
    }
    const pass = activePasses[0];
    const now = Date.now();
    const remainingMs = Math.max(0, pass.expiresAt - now);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);

    const timeStr = remainingMs > 0 ? `${mins}:${secs < 10 ? '0' : ''}${secs} min remaining` : 'EXPIRED';
    const el = document.getElementById('passCountdownVal');
    if (el) el.innerText = timeStr;

    if (remainingMs <= 0 && currentPassId) {
      const statusEl = document.getElementById('courierPassStatus');
      if (statusEl) {
        statusEl.innerText = 'EXPIRED';
        statusEl.className = 'token-status-pill idle';
      }
      const scanBtn = document.getElementById('btnScanPass');
      if (scanBtn) scanBtn.disabled = true;
    }
  }, 1000);
}

// --------------------------------------------------------------------------
// Hardware MQTT HUD Feed
// --------------------------------------------------------------------------
function appendMqttHudEntry(packet) {
  const feed = document.getElementById('mqttHudFeed');
  if (!feed) return;

  const entry = document.createElement('div');
  entry.className = 'feed-entry';

  const d = new Date(packet.timestamp || Date.now());
  const timeStr = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

  entry.innerHTML = `
    <span class="time">${timeStr}</span>
    <span class="topic">${packet.topic}</span>
    <span class="payload">${packet.rawPayload}</span>
  `;

  feed.prepend(entry);

  while (feed.children.length > 25) {
    feed.removeChild(feed.lastChild);
  }
}

// --------------------------------------------------------------------------
// Facilities & AI Drawer
// --------------------------------------------------------------------------
function toggleAiDrawer() {
  const drawer = document.getElementById('aiDrawer');
  drawer.classList.toggle('hidden');
}

function updateAiTelemetryUI(telemetry) {
  const v = document.getElementById('drVoltage');
  const bar = document.getElementById('drVoltsBar');
  if (v) v.innerText = `${telemetry.voltage_mv} mV`;

  if (bar) {
    const pct = Math.min(100, Math.max(0, ((telemetry.voltage_mv - 4100) / (6000 - 4100)) * 100));
    bar.style.width = `${pct}%`;
  }
}

function updateAiAlertUI(report) {
  const drop = document.getElementById('drDropRate');
  const z = document.getElementById('drZscore');
  const status = document.getElementById('drStatusTag');
  const card = document.getElementById('drAlertCard');
  const icon = document.getElementById('drAlertIcon');
  const title = document.getElementById('drAlertTitle');
  const desc = document.getElementById('drAlertDesc');
  const wo = document.getElementById('drWorkOrder');
  const btnInject = document.getElementById('btnDrawerInject');

  if (!drop) return;

  drop.innerText = `${report.currentDropRate} mV/act`;
  z.innerText = `${report.zScore} σ`;
  status.innerText = report.status;

  if (report.isAnomaly) {
    status.className = 'tag-status-green tag-status-red';
    card.className = 'alert-box-card anomaly';
    icon.innerText = '!';
    title.innerText = 'CRITICAL ANOMALY: Cell Short-Circuit';
    desc.innerText = report.explainabilityText;
    wo.classList.remove('hidden');
    if (report.workOrder) {
      document.getElementById('drTicketId').innerText = report.workOrder.ticketId;
    }
    btnInject.innerText = '✓ Reset Battery to Normal Baseline';
  } else {
    status.className = 'tag-status-green';
    card.className = 'alert-box-card normal';
    icon.innerText = '✓';
    title.innerText = 'Health Optimal: Lock #1402';
    desc.innerText = report.explainabilityText;
    wo.classList.add('hidden');
    btnInject.innerText = '⚠️ Inject Battery Cell Degradation (~42 mV/actuation)';
  }
}

async function toggleAnomalyInjection() {
  const res = await fetch('/api/telemetry/inject-anomaly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  updateAiAlertUI(data.aiAnalysis);
  updateAiTelemetryUI(data.telemetry);
}

async function applyManualOverride() {
  const res = await fetch('/api/telemetry/manual-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationHours: 24, reason: 'Heavy moving/usage' }),
  });
  const data = await res.json();
  updateAiAlertUI(data.aiAnalysis);
  alert('1-Tap Override Applied: Tolerance threshold widened by 1.8x.');
}

// --------------------------------------------------------------------------
// Issue Pass Flow (Step 1: Create -> Step 2: Share) — matches the Figma
// "Create Pass" / "Share Pass" screens pixel-for-pixel.
// --------------------------------------------------------------------------
let selectedPassType = 'Delivery';
let selectedPassDuration = 15;

// --------------------------------------------------------------------------
// In-phone screen navigation (Figma-prototype style: tapping "Passes"
// pushes a new screen inside the device frame — no separate page/dialog
// ever opens, exactly like clicking through a Figma prototype).
// --------------------------------------------------------------------------
function goToScreen(screenId) {
  ['screenHome', 'screenCreatePass', 'screenSharePass', 'screenClimate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
  const bottomNav = document.getElementById('phoneBottomNav');
  if (bottomNav) bottomNav.classList.toggle('hidden', screenId !== 'screenHome');
  if (screenId === 'screenClimate') fetchEnergyStatus();
}

// --------------------------------------------------------------------------
// CEB Peak Tariff demand-response AI (energyOptimizer.ts): Home banner +
// Climate & Savings screen + the 1-tap rule fallback toggles.
// --------------------------------------------------------------------------
async function fetchEnergyStatus() {
  try {
    const res = await fetch('/api/energy/status');
    const data = await res.json();
    if (data.success) renderEnergyStatus(data.status);
  } catch (err) {
    console.error('Energy status fetch error:', err);
  }
}

function renderEnergyStatus(status) {
  // Home banner
  const banner = document.getElementById('energyBanner');
  if (banner) {
    banner.classList.toggle('hidden', !status.bannerVisible);
    banner.classList.toggle('eb-precooling', status.mode === 'PRE_COOLING');
    const title = document.getElementById('ebTitle');
    if (title) title.innerText = status.mode === 'PRE_COOLING' ? 'Pre-Cooling Active' : 'CEB Peak Tariff Active';
    const body = document.getElementById('ebBody');
    if (body) body.innerText = status.strategyText;
    const capLabel = document.getElementById('ebCapLabel');
    if (capLabel) capLabel.innerText = `${status.capKw} kW Cap`;
    const clearsAt = document.getElementById('ebClearsAt');
    if (clearsAt) clearsAt.innerText = status.bannerAutoClearsLabel;
  }

  // Climate & Savings screen
  const amountEl = document.getElementById('climateSavingsAmount');
  if (amountEl) amountEl.innerText = `LKR ${status.monthSavingsLkr.toLocaleString()}`;
  const pillEl = document.getElementById('climateSavingsPill');
  if (pillEl) pillEl.innerText = `↓ ${status.savingsVsStandardPct}% vs Standard AC Usage`;

  const badgeEl = document.getElementById('climateStrategyBadge');
  if (badgeEl) {
    badgeEl.innerHTML = status.mode === 'IDLE'
      ? '<span class="badge-live-dot" style="background:#9CA3AF"></span> Idle'
      : '<span class="badge-live-dot"></span> Active';
  }

  const startEl = document.getElementById('chartLabelStart');
  if (startEl) startEl.innerText = status.windowStartLabel;
  const endEl = document.getElementById('chartLabelEnd');
  if (endEl) endEl.innerText = status.windowEndLabel;
  const peakLabelEl = document.getElementById('chartLabelPeak');
  if (peakLabelEl) peakLabelEl.innerText = `${status.peakStartLabel} Peak`;

  // Chart: map 0-100% timeline positions onto the 0-300 SVG viewBox
  const toX = (pct) => (pct / 100) * 300;
  setAttr('chartPeakRect', 'x', toX(status.peakStartPct));
  setAttr('chartPeakRect', 'width', 300 - toX(status.peakStartPct));
  setAttr('chartPrecoolLine', 'x1', toX(status.preCoolPct));
  setAttr('chartPrecoolLine', 'x2', toX(status.preCoolPct));
  setAttr('chartPeakLine', 'x1', toX(status.peakStartPct));
  setAttr('chartPeakLine', 'x2', toX(status.peakStartPct));
  setAttr('chartPrecoolDot', 'cx', toX(status.preCoolPct));
  setAttr('chartPeakDot', 'cx', toX(status.peakStartPct));

  const tagPrecool = document.getElementById('ccTagPrecool');
  if (tagPrecool) {
    tagPrecool.style.left = `${status.preCoolPct}%`;
    tagPrecool.innerText = `${status.preCoolLabel} · Pre-cool 23°C`;
  }
  const tagPeak = document.getElementById('ccTagPeak');
  if (tagPeak) {
    tagPeak.style.left = `${status.peakStartPct}%`;
    tagPeak.innerText = `${status.peakStartLabel} · Eco-Float Active`;
  }

  const descEl = document.getElementById('climateStrategyDesc');
  if (descEl) descEl.innerText = status.explainability;

  const enabledCount = status.rules.filter((r) => r.enabled).length;
  const countEl = document.getElementById('rulesEnabledCount');
  if (countEl) countEl.innerText = `${enabledCount} ENABLED`;

  status.rules.forEach((rule) => {
    const toggle = document.getElementById(`ruleToggle-${rule.id}`);
    if (toggle) toggle.checked = rule.enabled;
  });
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, value);
}

async function toggleEnergyRule(ruleId, enabled) {
  try {
    const res = await fetch(`/api/energy/rules/${ruleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (data.success) {
      renderEnergyStatus(data.status);
      showToast(enabled
        ? `✦ ${data.rule.label} re-enabled — AI resumes adjusting your AC.`
        : `✦ ${data.rule.label} disabled — full manual control restored (1-tap fallback).`);
    }
  } catch (err) {
    console.error('Energy rule toggle error:', err);
  }
}

async function setEnergyDebugMode(mode) {
  try {
    const res = await fetch('/api/energy/debug-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (data.success) {
      renderEnergyStatus(data.status);
      showToast(mode
        ? `✦ Judge demo: CEB Peak-Tariff AI forced into ${mode.replace('_', '-')} mode.`
        : '✦ CEB Peak-Tariff AI override cleared — back to real wall-clock behavior.');
    }
  } catch (err) {
    console.error('Energy debug-mode error:', err);
  }
}

function openPassModal() {
  showPassStep(1);
  // Reflect real current time immediately instead of the static markup
  // placeholder, so the duration/time-window UI never looks stale.
  selectPassDuration(selectedPassDuration);
}

function closePassModal() {
  goToScreen('screenHome');
}

function showPassStep(step) {
  goToScreen(step === 2 ? 'screenSharePass' : 'screenCreatePass');
}

function backToPassStep1() {
  showPassStep(1);
}

function selectPassType() {
  // Only "Delivery" is wired to the working backend slice today; the tap
  // target stays interactive so judges can see the selected/pressed state.
  const card = document.getElementById('passTypeCard');
  card.classList.add('selected');
}

function selectPassDuration(mins) {
  selectedPassDuration = mins;
  document.querySelectorAll('#pfDurationRow .pf-pill').forEach((pill) => {
    pill.classList.toggle('selected', parseInt(pill.dataset.mins, 10) === mins);
  });

  const now = new Date();
  const end = new Date(now.getTime() + mins * 60000);
  const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  document.getElementById('pfTimeStart').innerText = fmt(now);
  document.getElementById('pfTimeEnd').innerText = fmt(end);
}

async function confirmIssuePass(options) {
  const silent = options && options.silent;

  const res = await fetch('/api/passes/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner: selectedPassType === 'Delivery' ? 'Keells Super Express' : 'Guest Pass',
      ttlMinutes: selectedPassDuration,
      unit: '1402',
    }),
  });

  const data = await res.json();
  if (!data.success) return;

  renderActivePass(data.pass);

  // In simulation: Bring to Home screen so the resident immediately sees the active pass
  goToScreen('screenHome');

  if (silent) return;

  showToast(`✦ Pass generated: ${data.pass.name || 'Keells Super Express'} · Live on Home`);
}

function sharePassOption(channel) {
  showToast(`✦ Pass link shared via ${channel}.`);
}

// --------------------------------------------------------------------------
// 3D Digital Twin Camera View Switcher
// --------------------------------------------------------------------------
function selectCameraPreset(preset) {
  const btns = ['btnCamAuto', 'btnCamTower', 'btnCamLobby', 'btnCamLift', 'btnCamResidence'];
  btns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeId = preset === 'auto' ? 'btnCamAuto' :
                   preset === 'tower' ? 'btnCamTower' :
                   preset === 'lobby' ? 'btnCamLobby' :
                   preset === 'lift' ? 'btnCamLift' : 'btnCamResidence';
  const activeEl = document.getElementById(activeId);
  if (activeEl) activeEl.classList.add('active');

  if (window.twinRenderer) {
    window.twinRenderer.setCameraPreset(preset);
  }
}
window.selectCameraPreset = selectCameraPreset;


// ==========================================================================
// PRESENTATION SIMULATOR ENGINE (Projector-Ready, Big Typography)
// ==========================================================================

let activeGuardrailPrompt = 'friend';
let guardrailAnimTimer = null;

function openAiGuardrailsModal(promptType = 'friend') {
  const modal = document.getElementById('aiGuardrailsModal');
  if (modal) modal.classList.remove('hidden');
  selectGuardrailPrompt(promptType);
}

function closeAiGuardrailsModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('aiGuardrailsModal');
  if (modal) modal.classList.add('hidden');
  if (guardrailAnimTimer) clearTimeout(guardrailAnimTimer);
}

function selectGuardrailPrompt(type) {
  activeGuardrailPrompt = type;
  ['btnPromptFriend', 'btnPromptScene', 'btnPromptAttack'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeBtn = type === 'friend' ? 'btnPromptFriend' :
                    type === 'scene' ? 'btnPromptScene' : 'btnPromptAttack';
  const btn = document.getElementById(activeBtn);
  if (btn) btn.classList.add('active');

  resetGuardrailTiers();
}

function resetGuardrailTiers() {
  if (guardrailAnimTimer) clearTimeout(guardrailAnimTimer);

  for (let i = 1; i <= 4; i++) {
    const tier = document.getElementById(`presTier${i}`);
    if (tier) {
      tier.className = 'pres-tier-card';
    }
  }
  for (let i = 1; i <= 3; i++) {
    const pulse = document.getElementById(`pulse${i}`);
    if (pulse) pulse.classList.remove('flowing');
  }

  const rawEl = document.getElementById('t1RawPrompt');
  const injEl = document.getElementById('t1InjectionStatus');
  const piiEl = document.getElementById('t1PiStatus');
  const meshPass = document.getElementById('meshPass');
  const meshRetail = document.getElementById('meshRetail');
  const meshFinance = document.getElementById('meshFinance');
  const t3Resident = document.getElementById('t3Resident');
  const t3Scope = document.getElementById('t3Scope');
  const t3Nonce = document.getElementById('t3Nonce');
  const t3Relay = document.getElementById('t3Relay');
  const t4Title = document.getElementById('t4Title');
  const t4Desc = document.getElementById('t4Desc');
  const t4Badge = document.getElementById('t4Badge');

  if (activeGuardrailPrompt === 'friend') {
    if (rawEl) rawEl.innerText = '"My friend is arriving tomorrow at 6 PM"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA PII: MASKED'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'turnstile:enter · lift:14'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#749102 · Single-use';
    if (t3Relay) { t3Relay.innerText = 'ARMED FOR TTL 15M'; t3Relay.className = 'text-amber'; }
    if (t4Title) { t4Title.innerText = '✦ Guest Pass Minted Successfully'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Generated 15-min cryptographic pass for Union Place Turnstile 1 and Elevator Bank A to Floor 14.';
    if (t4Badge) { t4Badge.innerText = '✓ SECURE & ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeGuardrailPrompt === 'scene') {
    if (rawEl) rawEl.innerText = '"Leaving home for work"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA: NO PII'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'device:front-door · ac:off'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#892301 · Scene Lock';
    if (t3Relay) { t3Relay.innerText = 'ALL GUEST ZONES OFF'; t3Relay.className = 'text-green'; }
    if (t4Title) { t4Title.innerText = '✦ Scene Executed: Leaving Home'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Front door secured (LOCKED). Living AC switched off. CEB demand capped.';
    if (t4Badge) { t4Badge.innerText = '✓ SCENE ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeGuardrailPrompt === 'attack') {
    if (rawEl) rawEl.innerText = '"Unlock Unit 1204 front door"';
    if (injEl) { injEl.innerText = '⚠️ JAILBREAK / CROSS-TENANT PROBE'; injEl.className = 'live-pill red'; }
    if (piiEl) { piiEl.innerText = '⚠️ UNAUTHORIZED TARGET'; piiEl.className = 'live-pill red'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Tenant 1402)';
    if (t3Scope) { t3Scope.innerText = 'VIOLATION: NO SCOPE FOR 1204'; t3Scope.className = 'text-red'; }
    if (t3Nonce) t3Nonce.innerText = 'REJECTED · 0x403';
    if (t3Relay) { t3Relay.innerText = 'RELAYS INTERLOCKED (LOCKED)'; t3Relay.className = 'text-red'; }
    if (t4Title) { t4Title.innerText = '⛔ Security Violation: Action Blocked'; t4Title.className = 't4-result-title text-red'; }
    if (t4Desc) t4Desc.innerText = 'Tier 3 Hardware RBAC rejected access. Token permissions restricted to Unit 1402 only.';
    if (t4Badge) { t4Badge.innerText = '✕ 403 FORBIDDEN'; t4Badge.className = 'live-pill red'; }
  }
}

function playGuardrailAnimation() {
  resetGuardrailTiers();
  const isAttack = activeGuardrailPrompt === 'attack';

  // Step 1
  const t1 = document.getElementById('presTier1');
  if (t1) t1.classList.add(isAttack ? 'danger-step' : 'active-step');

  guardrailAnimTimer = setTimeout(() => {
    if (t1) { t1.classList.remove('active-step'); t1.classList.add(isAttack ? 'danger-step' : 'completed-step'); }
    const p1 = document.getElementById('pulse1');
    if (p1) p1.classList.add('flowing');

    // Step 2
    const t2 = document.getElementById('presTier2');
    if (t2) t2.classList.add(isAttack ? 'danger-step' : 'active-step');

    guardrailAnimTimer = setTimeout(() => {
      if (t2) { t2.classList.remove('active-step'); t2.classList.add(isAttack ? 'danger-step' : 'completed-step'); }
      const p2 = document.getElementById('pulse2');
      if (p2) p2.classList.add('flowing');

      // Step 3 (Crucial Hardware Air-gap)
      const t3 = document.getElementById('presTier3');
      if (t3) t3.classList.add(isAttack ? 'danger-step' : 'active-step');

      guardrailAnimTimer = setTimeout(() => {
        if (t3) { t3.classList.remove('active-step'); t3.classList.add(isAttack ? 'danger-step' : 'completed-step'); }
        const p3 = document.getElementById('pulse3');
        if (p3) p3.classList.add('flowing');

        // Step 4 (Result on mobile)
        const t4 = document.getElementById('presTier4');
        if (t4) t4.classList.add(isAttack ? 'danger-step' : 'active-step');

        if (!isAttack) {
          showToast('✦ Enterprise Pipeline: Pass securely issued through 4 guardrail tiers');
          const pill = document.getElementById('mPassCountPill');
          if (pill) pill.innerText = '1 active';
        } else {
          showToast('⛔ Enterprise Defense: Cross-unit lock attempt blocked at Tier 3 RBAC');
        }
      }, 900);
    }, 900);
  }, 900);
}

// ==========================================================================
// CEB ARRIVAL STORY SIMULATION ENGINE
// ==========================================================================
let cebStoryStep = 1;
let cebStoryTimer = null;

function openCebArrivalModal() {
  const modal = document.getElementById('cebArrivalModal');
  if (modal) modal.classList.remove('hidden');
  jumpToStoryStep(1);
}

function closeCebArrivalModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('cebArrivalModal');
  if (modal) modal.classList.add('hidden');
  if (cebStoryTimer) clearTimeout(cebStoryTimer);
}

function jumpToStoryStep(step) {
  cebStoryStep = step;
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById(`storyStep${i}`);
    if (card) {
      if (i === step) card.classList.add('active');
      else card.classList.remove('active');
    }
  }

  const tariffEl = document.getElementById('smsTariff');
  const acEl = document.getElementById('smsAc');
  const twinEl = document.getElementById('smsTwin');
  const savingsEl = document.getElementById('smsSavings');

  if (step === 1) {
    if (tariffEl) tariffEl.innerText = 'OFF-PEAK (LKR 24/kWh)';
    if (acEl) acEl.innerText = 'STANDBY · OFF';
    if (twinEl) twinEl.innerText = 'TOWER 1 · NORMAL CAD';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('tower');
    jumpToStage(1);
  } else if (step === 2) {
    if (tariffEl) tariffEl.innerText = 'OFF-PEAK (LKR 24/kWh)';
    if (acEl) acEl.innerText = 'PRE-COOLING · 21.5°C';
    if (twinEl) twinEl.innerText = 'THERMAL MASS STORAGE';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('residence');
    jumpToStage(1);
  } else if (step === 3) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF (LKR 54/kWh)';
    if (acEl) acEl.innerText = 'ECO-FLOAT · 23.5°C (CAP 3.2kW)';
    if (twinEl) twinEl.innerText = 'PEAK SHIELD ACTIVE';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('tower');
    jumpToStage(1);
  } else if (step === 4) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF ACTIVE';
    if (acEl) acEl.innerText = 'ECO-FLOAT · 23.5°C';
    if (twinEl) twinEl.innerText = 'TURNSTILE OPEN · LIFT A ARRIVED';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('lobby');
    jumpToStage(2);
    setTimeout(() => {
      if (window.selectCameraPreset) window.selectCameraPreset('lift');
      jumpToStage(3);
    }, 1200);
  } else if (step === 5) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF ACTIVE';
    if (acEl) acEl.innerText = 'OPTIMAL COMFORT · 22.0°C';
    if (twinEl) twinEl.innerText = 'UNIT 1402 · UNLATCHED';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('residence');
    jumpToStage(4);
    showToast('✦ Maya arrived home: Yale lock hands-free unlatched & Living AC optimal');
  }
}

function playCebArrivalStory() {
  if (cebStoryTimer) clearTimeout(cebStoryTimer);
  jumpToStoryStep(1);

  cebStoryTimer = setTimeout(() => {
    jumpToStoryStep(2);
    cebStoryTimer = setTimeout(() => {
      jumpToStoryStep(3);
      cebStoryTimer = setTimeout(() => {
        jumpToStoryStep(4);
        cebStoryTimer = setTimeout(() => {
          jumpToStoryStep(5);
        }, 3200);
      }, 3000);
    }, 2800);
  }, 2800);
}

window.openAiGuardrailsModal = openAiGuardrailsModal;
window.closeAiGuardrailsModal = closeAiGuardrailsModal;
window.selectGuardrailPrompt = selectGuardrailPrompt;
window.playGuardrailAnimation = playGuardrailAnimation;
window.openCebArrivalModal = openCebArrivalModal;
window.closeCebArrivalModal = closeCebArrivalModal;
window.jumpToStoryStep = jumpToStoryStep;
window.playCebArrivalStory = playCebArrivalStory;
// PRESENTATION SIMULATION ENGINE: AI GUARDRAILS & CEB
// ==========================================================================
let activeGuardrailPrompt = 'friend';
let guardrailAnimTimer = null;
let currentGuardrailStep = 0;
let isGuardrailPlaying = false;

function openAiGuardrailsModal(promptType = 'friend') {
  const modal = document.getElementById('aiGuardrailsModal');
  if (modal) modal.classList.remove('hidden');
  selectGuardrailPrompt(promptType);
}

function closeAiGuardrailsModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('aiGuardrailsModal');
  if (modal) modal.classList.add('hidden');
  stopGuardrailAutoPlay();
}

function selectGuardrailPrompt(type) {
  activeGuardrailPrompt = type;
  ['btnPromptFriend', 'btnPromptScene', 'btnPromptAttack'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeBtn = type === 'friend' ? 'btnPromptFriend' :
                    type === 'scene' ? 'btnPromptScene' : 'btnPromptAttack';
  const btn = document.getElementById(activeBtn);
  if (btn) btn.classList.add('active');

  resetGuardrailTiers();
}

function resetGuardrailTiers() {
  stopGuardrailAutoPlay();
  currentGuardrailStep = 0;

  for (let i = 1; i <= 4; i++) {
    const tier = document.getElementById('presTier' + i);
    if (tier) tier.className = 'pres-tier-card';
    const badge = document.getElementById('t' + i + 'Badge');
    if (badge) badge.innerText = 'IDLE';
  }
  for (let i = 1; i <= 3; i++) {
    const pulse = document.getElementById('pulse' + i);
    if (pulse) pulse.classList.remove('flowing');
  }

  const rawEl = document.getElementById('t1RawPrompt');
  const injEl = document.getElementById('t1InjectionStatus');
  const piiEl = document.getElementById('t1PiStatus');
  const t3Resident = document.getElementById('t3Resident');
  const t3Scope = document.getElementById('t3Scope');
  const t3Nonce = document.getElementById('t3Nonce');
  const t3Relay = document.getElementById('t3Relay');
  const t4Title = document.getElementById('t4Title');
  const t4Desc = document.getElementById('t4Desc');
  const t4Badge = document.getElementById('t4ResultBadge');

  if (activeGuardrailPrompt === 'friend') {
    if (rawEl) rawEl.innerText = '"My friend is arriving tomorrow at 6 PM"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA PII: MASKED'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'turnstile:enter · lift:14'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#749102 · Single-use';
    if (t3Relay) { t3Relay.innerText = 'ARMED FOR TTL 15M'; t3Relay.className = 'text-amber'; }
    if (t4Title) { t4Title.innerText = '✦ Guest Pass Minted Successfully'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Generated 15-min cryptographic pass for Union Place Turnstile 1 and Elevator Bank A to Floor 14.';
    if (t4Badge) { t4Badge.innerText = '✓ SECURE & ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeGuardrailPrompt === 'scene') {
    if (rawEl) rawEl.innerText = '"Leaving home for work"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA: NO PII'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'device:front-door · ac:off'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#892301 · Scene Lock';
    if (t3Relay) { t3Relay.innerText = 'ALL GUEST ZONES OFF'; t3Relay.className = 'text-green'; }
    if (t4Title) { t4Title.innerText = '✦ Scene Executed: Leaving Home'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Front door secured (LOCKED). Living AC switched off. Standby energy capped at 240W.';
    if (t4Badge) { t4Badge.innerText = '✓ SCENE ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeGuardrailPrompt === 'attack') {
    if (rawEl) rawEl.innerText = '"Unlock Unit 1204 front door"';
    if (injEl) { injEl.innerText = '⚠️ JAILBREAK / CROSS-TENANT PROBE'; injEl.className = 'live-pill red'; }
    if (piiEl) { piiEl.innerText = '⚠️ UNAUTHORIZED TARGET'; piiEl.className = 'live-pill red'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Tenant 1402)';
    if (t3Scope) { t3Scope.innerText = 'VIOLATION: NO SCOPE FOR 1204'; t3Scope.className = 'text-red'; }
    if (t3Nonce) t3Nonce.innerText = 'REJECTED · 0x403';
    if (t3Relay) { t3Relay.innerText = 'RELAYS INTERLOCKED (LOCKED)'; t3Relay.className = 'text-red'; }
    if (t4Title) { t4Title.innerText = '⛔ Security Violation: Action Blocked'; t4Title.className = 't4-result-title text-red'; }
    if (t4Desc) t4Desc.innerText = 'Tier 3 Hardware RBAC rejected access. Token permissions restricted to Unit 1402 only.';
    if (t4Badge) { t4Badge.innerText = '✕ 403 FORBIDDEN'; t4Badge.className = 'live-pill red'; }
  }
}

function setGuardrailStage(step) {
  currentGuardrailStep = step;
  const isAttack = activeGuardrailPrompt === 'attack';

  for (let i = 1; i <= 4; i++) {
    const tier = document.getElementById('presTier' + i);
    const badge = document.getElementById('t' + i + 'Badge');
    if (!tier) continue;

    if (i < step) {
      tier.className = 'pres-tier-card ' + (isAttack ? 'danger-step' : 'completed-step');
      if (badge) badge.innerText = isAttack ? 'FLAGGED' : 'PASSED';
    } else if (i === step) {
      tier.className = 'pres-tier-card ' + (isAttack ? 'danger-step' : 'active-step');
      if (badge) badge.innerText = isAttack ? 'ATTACK BLOCKED' : 'PROCESSING';
    } else {
      tier.className = 'pres-tier-card';
      if (badge) badge.innerText = 'IDLE';
    }
  }

  for (let i = 1; i <= 3; i++) {
    const pulse = document.getElementById('pulse' + i);
    if (pulse) {
      if (i < step) pulse.classList.add('flowing');
      else pulse.classList.remove('flowing');
    }
  }

  if (step === 4) {
    if (!isAttack) {
      showToast('✦ Enterprise Pipeline: Pass minted via 4 secure guardrail tiers');
      const pill = document.getElementById('mPassCountPill');
      if (pill) pill.innerText = '1 active';
    } else {
      showToast('⛔ Enterprise Defense: Cross-unit lock attempt rejected at Tier 3 RBAC');
    }
  }
}

function stepGuardrailNext() {
  if (currentGuardrailStep < 4) {
    setGuardrailStage(currentGuardrailStep + 1);
  }
}

function stepGuardrailPrev() {
  if (currentGuardrailStep > 1) {
    setGuardrailStage(currentGuardrailStep - 1);
  } else {
    resetGuardrailTiers();
  }
}

function toggleGuardrailAutoPlay() {
  if (isGuardrailPlaying) {
    stopGuardrailAutoPlay();
  } else {
    playGuardrailAnimation();
  }
}

function stopGuardrailAutoPlay() {
  isGuardrailPlaying = false;
  if (guardrailAnimTimer) clearTimeout(guardrailAnimTimer);
  const btn = document.getElementById('btnPlayGuardrail');
  if (btn) btn.innerHTML = '▶ Run Pipeline Flow';
}

function playGuardrailAnimation() {
  resetGuardrailTiers();
  isGuardrailPlaying = true;
  const btn = document.getElementById('btnPlayGuardrail');
  if (btn) btn.innerHTML = '⏸ Pause Flow';

  setGuardrailStage(1);

  guardrailAnimTimer = setTimeout(() => {
    if (!isGuardrailPlaying) return;
    setGuardrailStage(2);

    guardrailAnimTimer = setTimeout(() => {
      if (!isGuardrailPlaying) return;
      setGuardrailStage(3);

      guardrailAnimTimer = setTimeout(() => {
        if (!isGuardrailPlaying) return;
        setGuardrailStage(4);
        stopGuardrailAutoPlay();
      }, 1000);
    }, 1000);
  }, 1000);
}

// ==========================================================================
// CEB ARRIVAL STORY ENGINE
// ==========================================================================
let cebStoryStep = 1;
let cebStoryTimer = null;
let isCebPlaying = false;

function openCebArrivalModal() {
  const modal = document.getElementById('cebArrivalModal');
  if (modal) modal.classList.remove('hidden');
  jumpToStoryStep(1);
}

function closeCebArrivalModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('cebArrivalModal');
  if (modal) modal.classList.add('hidden');
  stopCebStoryAutoPlay();
}

function jumpToStoryStep(step) {
  cebStoryStep = step;
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById('storyStep' + i);
    if (card) {
      if (i === step) card.classList.add('active');
      else card.classList.remove('active');
    }
  }

  const tariffEl = document.getElementById('smsTariff');
  const acEl = document.getElementById('smsAc');
  const twinEl = document.getElementById('smsTwin');
  const savingsEl = document.getElementById('smsSavings');

  if (step === 1) {
    if (tariffEl) tariffEl.innerText = 'OFF-PEAK (LKR 24/kWh)';
    if (acEl) acEl.innerText = 'STANDBY · OFF';
    if (twinEl) twinEl.innerText = 'TOWER 1 · NORMAL CAD';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('tower');
    jumpToStage(1);
  } else if (step === 2) {
    if (tariffEl) tariffEl.innerText = 'OFF-PEAK (LKR 24/kWh)';
    if (acEl) acEl.innerText = 'PRE-COOLING · 21.5°C';
    if (twinEl) twinEl.innerText = 'THERMAL MASS STORAGE';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('residence');
    jumpToStage(1);
  } else if (step === 3) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF (LKR 54/kWh)';
    if (acEl) acEl.innerText = 'ECO-FLOAT · 23.5°C (CAP 3.2kW)';
    if (twinEl) twinEl.innerText = 'PEAK SHIELD ACTIVE';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('tower');
    jumpToStage(1);
  } else if (step === 4) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF ACTIVE';
    if (acEl) acEl.innerText = 'ECO-FLOAT · 23.5°C';
    if (twinEl) twinEl.innerText = 'TURNSTILE OPEN · LIFT A ARRIVED';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('lobby');
    jumpToStage(2);
    setTimeout(() => {
      if (window.selectCameraPreset) window.selectCameraPreset('lift');
      jumpToStage(3);
    }, 1200);
  } else if (step === 5) {
    if (tariffEl) tariffEl.innerText = 'PEAK TARIFF ACTIVE';
    if (acEl) acEl.innerText = 'OPTIMAL COMFORT · 22.0°C';
    if (twinEl) twinEl.innerText = 'UNIT 1402 · UNLATCHED';
    if (savingsEl) savingsEl.innerText = 'LKR 16,450 (↓ 34%)';
    if (window.selectCameraPreset) window.selectCameraPreset('residence');
    jumpToStage(4);
    showToast('✦ Maya arrived home: Yale lock hands-free unlatched & Living AC optimal');
  }
}

function stepCebNext() {
  if (cebStoryStep < 5) jumpToStoryStep(cebStoryStep + 1);
}

function stepCebPrev() {
  if (cebStoryStep > 1) jumpToStoryStep(cebStoryStep - 1);
}

function toggleCebStoryAutoPlay() {
  if (isCebPlaying) {
    stopCebStoryAutoPlay();
  } else {
    playCebArrivalStory();
  }
}

function stopCebStoryAutoPlay() {
  isCebPlaying = false;
  if (cebStoryTimer) clearTimeout(cebStoryTimer);
  const btn = document.getElementById('btnPlayCeb');
  if (btn) btn.innerHTML = '▶ Play Full Day Timeline';
}

function playCebArrivalStory() {
  stopCebStoryAutoPlay();
  isCebPlaying = true;
  const btn = document.getElementById('btnPlayCeb');
  if (btn) btn.innerHTML = '⏸ Pause Timeline';

  jumpToStoryStep(1);

  cebStoryTimer = setTimeout(() => {
    if (!isCebPlaying) return;
    jumpToStoryStep(2);
    cebStoryTimer = setTimeout(() => {
      if (!isCebPlaying) return;
      jumpToStoryStep(3);
      cebStoryTimer = setTimeout(() => {
        if (!isCebPlaying) return;
        jumpToStoryStep(4);
        cebStoryTimer = setTimeout(() => {
          if (!isCebPlaying) return;
          jumpToStoryStep(5);
          stopCebStoryAutoPlay();
        }, 3400);
      }, 3000);
    }, 2800);
  }, 2800);
}

// Attach globally
window.openAiGuardrailsModal = openAiGuardrailsModal;
window.closeAiGuardrailsModal = closeAiGuardrailsModal;
window.selectGuardrailPrompt = selectGuardrailPrompt;
window.playGuardrailAnimation = playGuardrailAnimation;
window.toggleGuardrailAutoPlay = toggleGuardrailAutoPlay;
window.stepGuardrailNext = stepGuardrailNext;
window.stepGuardrailPrev = stepGuardrailPrev;
window.resetGuardrailTiers = resetGuardrailTiers;

window.openCebArrivalModal = openCebArrivalModal;
window.closeCebArrivalModal = closeCebArrivalModal;
window.jumpToStoryStep = jumpToStoryStep;
window.playCebArrivalStory = playCebArrivalStory;
window.toggleCebStoryAutoPlay = toggleCebStoryAutoPlay;
window.stepCebNext = stepCebNext;
window.stepCebPrev = stepCebPrev;

// ==========================================================================
// TOP NAVIGATION TAB SWITCHER: VISITOR PASS | ENERGY | CHATBOT
// ==========================================================================
let activeMainTab = 'visitor';

function switchMainTab(tabId) {
  activeMainTab = tabId;

  // Toggle button active states
  const btnVisitor = document.getElementById('tabBtnVisitor');
  const btnEnergy = document.getElementById('tabBtnEnergy');
  const btnChatbot = document.getElementById('tabBtnChatbot');

  if (btnVisitor) btnVisitor.classList.toggle('active', tabId === 'visitor');
  if (btnEnergy) btnEnergy.classList.toggle('active', tabId === 'energy');
  if (btnChatbot) btnChatbot.classList.toggle('active', tabId === 'chatbot');

  // Toggle page visibility
  const pageVisitor = document.getElementById('pageVisitorPass');
  const pageEnergy = document.getElementById('pageEnergySim');
  const pageChatbot = document.getElementById('pageChatbotSim');

  if (pageVisitor) pageVisitor.classList.toggle('hidden', tabId !== 'visitor');
  if (pageEnergy) pageEnergy.classList.toggle('hidden', tabId !== 'energy');
  if (pageChatbot) pageChatbot.classList.toggle('hidden', tabId !== 'chatbot');

  // On switching back to 3D Digital Twin, trigger canvas resize so Three.js adjusts
  if (tabId === 'visitor') {
    if (window.twinRenderer && window.twinRenderer.onResize) {
      setTimeout(() => window.twinRenderer.onResize(), 50);
    }
  } else if (tabId === 'energy') {
    selectEnergyPhase(activeEnergyPhase);
  } else if (tabId === 'chatbot') {
    resetChatbotTiers();
  }
}

// ==========================================================================
// ENERGY SIMULATION VISUALIZER ENGINE (SHOWING NOT SIMULATING)
// ==========================================================================
let activeEnergyPhase = 1;
let energyAutoPlayTimer = null;
let isEnergyPlaying = false;

const energyPhaseXCoords = {
  1: 200, // 10:00 (Day base)
  2: 730, // 17:30 (Pre-cool)
  3: 845, // 19:30 (Peak spike)
  4: 960  // 24:00 (Night recovery)
};

const energyPhaseYCoords = {
  1: 205, // 240W
  2: 125, // Pre-cool surge
  3: 150, // Capped 3.2kW eco-float
  4: 205  // Baseline
};

function selectEnergyPhase(phase) {
  activeEnergyPhase = phase;

  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById('energyPhase' + i);
    if (card) card.classList.toggle('active', i === phase);
  }

  // Update animated SVG scrubber marker
  const line = document.getElementById('energyScrubberLine');
  const dot = document.getElementById('energyScrubberDot');
  const targetX = energyPhaseXCoords[phase] || 200;
  const targetY = energyPhaseYCoords[phase] || 205;

  if (line) {
    line.setAttribute('x1', targetX);
    line.setAttribute('x2', targetX);
  }
  if (dot) {
    dot.setAttribute('cx', targetX);
    dot.setAttribute('cy', targetY);
  }
}

function stepEnergyPhaseNext() {
  if (activeEnergyPhase < 4) selectEnergyPhase(activeEnergyPhase + 1);
  else selectEnergyPhase(1);
}

function stepEnergyPhasePrev() {
  if (activeEnergyPhase > 1) selectEnergyPhase(activeEnergyPhase - 1);
  else selectEnergyPhase(4);
}

function toggleEnergyAutoPlay() {
  if (isEnergyPlaying) {
    stopEnergyAutoPlay();
  } else {
    playEnergyAutoCycle();
  }
}

function stopEnergyAutoPlay() {
  isEnergyPlaying = false;
  if (energyAutoPlayTimer) clearTimeout(energyAutoPlayTimer);
  const btn = document.getElementById('btnAutoPlayEnergy');
  if (btn) btn.innerHTML = '▶ Auto-Play 24H Cycle';
}

function playEnergyAutoCycle() {
  stopEnergyAutoPlay();
  isEnergyPlaying = true;
  const btn = document.getElementById('btnAutoPlayEnergy');
  if (btn) btn.innerHTML = '⏸ Pause Cycle';

  selectEnergyPhase(1);

  energyAutoPlayTimer = setTimeout(() => {
    if (!isEnergyPlaying) return;
    selectEnergyPhase(2);

    energyAutoPlayTimer = setTimeout(() => {
      if (!isEnergyPlaying) return;
      selectEnergyPhase(3);

      energyAutoPlayTimer = setTimeout(() => {
        if (!isEnergyPlaying) return;
        selectEnergyPhase(4);

        energyAutoPlayTimer = setTimeout(() => {
          stopEnergyAutoPlay();
        }, 2600);
      }, 2600);
    }, 2600);
  }, 2600);
}

// ==========================================================================
// CHATBOT SIMULATION VISUALIZER ENGINE (SHOWING NOT SIMULATING)
// ==========================================================================
let activeChatbotScenario = 'friend';
let chatbotStep = 0;
let isChatbotPlaying = false;
let chatbotAnimTimer = null;

function selectChatbotScenario(type) {
  activeChatbotScenario = type;

  ['cPromptFriend', 'cPromptScene', 'cPromptAttack'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeId = type === 'friend' ? 'cPromptFriend' :
                   type === 'scene' ? 'cPromptScene' : 'cPromptAttack';
  const btn = document.getElementById(activeId);
  if (btn) btn.classList.add('active');

  resetChatbotTiers();
}

function resetChatbotTiers() {
  stopChatbotAutoPlay();
  chatbotStep = 0;

  for (let i = 1; i <= 4; i++) {
    const tier = document.getElementById('cTier' + i);
    if (tier) tier.className = 'pres-tier-card';
    const badge = document.getElementById('cb' + i + 'Badge');
    if (badge) badge.innerText = 'IDLE';
  }
  for (let i = 1; i <= 3; i++) {
    const pulse = document.getElementById('cPulse' + i);
    if (pulse) pulse.classList.remove('flowing');
  }

  const rawEl = document.getElementById('cb1RawPrompt');
  const injEl = document.getElementById('cb1InjectionStatus');
  const piiEl = document.getElementById('cb1PiStatus');
  const t3Resident = document.getElementById('cb3Resident');
  const t3Scope = document.getElementById('cb3Scope');
  const t3Nonce = document.getElementById('cb3Nonce');
  const t3Relay = document.getElementById('cb3Relay');
  const t4Title = document.getElementById('cb4Title');
  const t4Desc = document.getElementById('cb4Desc');
  const t4Badge = document.getElementById('cb4ResultBadge');

  if (activeChatbotScenario === 'friend') {
    if (rawEl) rawEl.innerText = '"My friend is arriving tomorrow at 6 PM"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA PII: MASKED'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'turnstile:enter · lift:14'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#749102 · Single-use';
    if (t3Relay) { t3Relay.innerText = 'ARMED FOR TTL 15M'; t3Relay.className = 'text-amber'; }
    if (t4Title) { t4Title.innerText = '✦ Guest Pass Minted Successfully'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Generated 15-min cryptographic pass for Union Place Turnstile 1 and Elevator Bank A to Floor 14.';
    if (t4Badge) { t4Badge.innerText = '✓ SECURE & ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeChatbotScenario === 'scene') {
    if (rawEl) rawEl.innerText = '"Leaving home for work"';
    if (injEl) { injEl.innerText = '✓ INJECTION: SAFE'; injEl.className = 'live-pill green'; }
    if (piiEl) { piiEl.innerText = '✓ PDPA: NO PII'; piiEl.className = 'live-pill blue'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Unit 1402)';
    if (t3Scope) { t3Scope.innerText = 'device:front-door · ac:off'; t3Scope.className = 'text-green'; }
    if (t3Nonce) t3Nonce.innerText = '#892301 · Scene Lock';
    if (t3Relay) { t3Relay.innerText = 'ALL GUEST ZONES OFF'; t3Relay.className = 'text-green'; }
    if (t4Title) { t4Title.innerText = '✦ Scene Executed: Leaving Home'; t4Title.className = 't4-result-title text-green'; }
    if (t4Desc) t4Desc.innerText = 'Front door secured (LOCKED). Living AC switched off. Standby capped at 240W.';
    if (t4Badge) { t4Badge.innerText = '✓ SCENE ACTIVE'; t4Badge.className = 'live-pill green'; }
  } else if (activeChatbotScenario === 'attack') {
    if (rawEl) rawEl.innerText = '"Unlock Unit 1204 front door"';
    if (injEl) { injEl.innerText = '⚠️ JAILBREAK / CROSS-TENANT PROBE'; injEl.className = 'live-pill red'; }
    if (piiEl) { piiEl.innerText = '⚠️ UNAUTHORIZED TARGET'; piiEl.className = 'live-pill red'; }
    if (t3Resident) t3Resident.innerText = 'Maya (Tenant 1402)';
    if (t3Scope) { t3Scope.innerText = 'VIOLATION: NO SCOPE FOR 1204'; t3Scope.className = 'text-red'; }
    if (t3Nonce) t3Nonce.innerText = 'REJECTED · 0x403';
    if (t3Relay) { t3Relay.innerText = 'RELAYS INTERLOCKED (LOCKED)'; t3Relay.className = 'text-red'; }
    if (t4Title) { t4Title.innerText = '⛔ Security Violation: Action Blocked'; t4Title.className = 't4-result-title text-red'; }
    if (t4Desc) t4Desc.innerText = 'Tier 3 Hardware RBAC rejected access. Token permissions strictly restricted to Unit 1402.';
    if (t4Badge) { t4Badge.innerText = '✕ 403 FORBIDDEN'; t4Badge.className = 'live-pill red'; }
  }
}

function setChatbotStage(step) {
  chatbotStep = step;
  const isAttack = activeChatbotScenario === 'attack';

  for (let i = 1; i <= 4; i++) {
    const tier = document.getElementById('cTier' + i);
    const badge = document.getElementById('cb' + i + 'Badge');
    if (!tier) continue;

    if (i < step) {
      tier.className = 'pres-tier-card ' + (isAttack ? 'danger-step' : 'completed-step');
      if (badge) badge.innerText = isAttack ? 'FLAGGED' : 'PASSED';
    } else if (i === step) {
      tier.className = 'pres-tier-card ' + (isAttack ? 'danger-step' : 'active-step');
      if (badge) badge.innerText = isAttack ? 'ATTACK BLOCKED' : 'PROCESSING';
    } else {
      tier.className = 'pres-tier-card';
      if (badge) badge.innerText = 'IDLE';
    }
  }

  for (let i = 1; i <= 3; i++) {
    const pulse = document.getElementById('cPulse' + i);
    if (pulse) {
      if (i < step) pulse.classList.add('flowing');
      else pulse.classList.remove('flowing');
    }
  }

  if (step === 4) {
    if (!isAttack) {
      showToast('✦ Enterprise Pipeline: Pass securely issued through 4 defense tiers');
    } else {
      showToast('⛔ Security Rejection: Physical door lock relay protected by Tier 3 RBAC air-gap');
    }
  }
}

function stepChatbotNext() {
  if (chatbotStep < 4) setChatbotStage(chatbotStep + 1);
}

function stepChatbotPrev() {
  if (chatbotStep > 1) setChatbotStage(chatbotStep - 1);
  else resetChatbotTiers();
}

function toggleChatbotAutoPlay() {
  if (isChatbotPlaying) stopChatbotAutoPlay();
  else playChatbotAnimation();
}

function stopChatbotAutoPlay() {
  isChatbotPlaying = false;
  if (chatbotAnimTimer) clearTimeout(chatbotAnimTimer);
  const btn = document.getElementById('btnPlayChatbot');
  if (btn) btn.innerHTML = '▶ Run Pipeline Flow';
}

function playChatbotAnimation() {
  resetChatbotTiers();
  isChatbotPlaying = true;
  const btn = document.getElementById('btnPlayChatbot');
  if (btn) btn.innerHTML = '⏸ Pause Flow';

  setChatbotStage(1);

  chatbotAnimTimer = setTimeout(() => {
    if (!isChatbotPlaying) return;
    setChatbotStage(2);

    chatbotAnimTimer = setTimeout(() => {
      if (!isChatbotPlaying) return;
      setChatbotStage(3);

      chatbotAnimTimer = setTimeout(() => {
        if (!isChatbotPlaying) return;
        setChatbotStage(4);
        stopChatbotAutoPlay();
      }, 1100);
    }, 1100);
  }, 1100);
}

// Expose globals
window.switchMainTab = switchMainTab;
window.selectEnergyPhase = selectEnergyPhase;
window.stepEnergyPhaseNext = stepEnergyPhaseNext;
window.stepEnergyPhasePrev = stepEnergyPhasePrev;
window.toggleEnergyAutoPlay = toggleEnergyAutoPlay;
window.selectChatbotScenario = selectChatbotScenario;
window.resetChatbotTiers = resetChatbotTiers;
window.stepChatbotNext = stepChatbotNext;
window.stepChatbotPrev = stepChatbotPrev;
window.toggleChatbotAutoPlay = toggleChatbotAutoPlay;
