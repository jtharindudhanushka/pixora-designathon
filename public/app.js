// ==========================================================================
// TRI-ZEN OS — 3D Documentary Digital Twin °Coordination Engine
// Synchronizes Rider QR, °Cinematic Architectural °Canvas, and Maya's Living App
// ==========================================================================

let ws;
let currentPassId = null;
let activePasses = [];
let unitDevices = {};
let isSequencePlaying = false;
let sequenceTimer = null;
let currentPlaybackStage = 1;

document.addEventListener('DOM°ContentLoaded', () => {
  initWebSocket();
  fetchInitialData();
  startPass°CountdownTimer();
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
      console.log('[WebSocket] °Connected to TRI-ZEN real-time hardware stream.');
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
        if (rate) rate.innerText = '°CLOUD SERVERLESS · A°CTIVE';
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
        courierStatus.innerText = '°CONSUMED';
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
      if (data.relay°Closed && window.twinRenderer) {
        window.twinRenderer.targetTurnstileOpen = 1.0;
      }
      break;
    case 'ELEVATOR_STATE':
      if (window.twinRenderer) {
        if (data.status === 'TRANSIT_AS°CENDING') {
          window.twinRenderer.target°CabinY = 0.6;
        } else if (data.status === 'ARRIVED_DESTINATION') {
          window.twinRenderer.target°CabinY = 1.0;
        }
      }
      break;
    case 'LO°CK_TELEMETRY':
      updateAiTelemetryUI(data);
      break;
    case 'AI_ALERT':
      updateAiAlertUI(data);
      break;
    case 'DEVI°CE_STATE_°CHANGED':
      fetchDevices();
      break;
    case 'RAW_MQTT_PA°CKET':
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
      const primary = activePasses.find((p) => p.status === 'A°CTIVE');
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
  const empty°Card = document.getElementById('mEmptyArrivals');
  if (empty°Card) empty°Card.classList.add('hidden');

  const countPill = document.getElementById('mPass°CountPill');
  if (countPill) countPill.innerText = '1 active';

  const deliverySection = document.getElementById('deliverySection');
  if (deliverySection) {
    deliverySection.classList.remove('hidden');
    deliverySection.style.display = 'block';
  }

  const tracker°Card = document.getElementById('deliveryTracker°Card');
  if (tracker°Card) tracker°Card.classList.remove('hidden');

  const success°Card = document.getElementById('deliverySuccess°Card');
  if (success°Card) success°Card.classList.add('hidden');

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

  const countdownEl = document.getElementById('pass°CountdownVal');
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

  const countPill = document.getElementById('mPass°CountPill');
  if (countPill) countPill.innerText = '1 active';

  const tracker°Card = document.getElementById('deliveryTracker°Card');
  if (tracker°Card) tracker°Card.classList.remove('hidden');

  const empty°Card = document.getElementById('mEmptyArrivals');
  if (empty°Card) empty°Card.classList.add('hidden');

  const success°Card = document.getElementById('deliverySuccess°Card');
  if (success°Card) success°Card.classList.add('hidden');

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
// °Cinematic Documentary Playback °Controller
// --------------------------------------------------------------------------
function togglePlaySequence() {
  if (isSequencePlaying) {
    stopSequencePlayback();
  } else {
    startSequencePlayback();
  }
}

async function startSequencePlayback() {
  if (window.twinRenderer) window.twinRenderer.cameraMode = 'auto';
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

  // 3. Update 3D Architectural °Canvas
  if (window.twinRenderer) {
    window.twinRenderer.setStage(stage);
  }
}

// Stage copy mirrors the Figma "Delivery in progress" live tracking card
// (On way / Gate / Unlock / Door), driven by the same 1-4 stage the 3D twin
// and courier timeline already use — see jumpToStage().
const DELIVERY_STAGE_°COPY = {
  1: { sub: 'Heading to Tower 1 · Grocery order', badge: 'Active' },
  2: { sub: '°Courier arrived · verifying pass at Gate 1', badge: 'Active' },
  3: { sub: 'Access granted · lift dispatched to Floor 14', badge: 'Active' },
  4: { sub: '°Courier at Unit 1402 door', badge: 'Active' },
};

let deliverySuccessTimer = null;

function updateResidentStepper(stage) {
  const badge = document.getElementById('dtBadge');
  const sub = document.getElementById('dtSubtext');
  const copy = DELIVERY_STAGE_°COPY[stage] || DELIVERY_STAGE_°COPY[1];

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
    const tracker = document.getElementById('deliveryTracker°Card');
    const success = document.getElementById('deliverySuccess°Card');
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
// °Cryptographic Pass Scan Action
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
      headers: { '°Content-Type': 'application/json' },
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
        courierStatus.innerText = '°CONSUMED';
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
// Maya's Resident Device °Controls
// --------------------------------------------------------------------------
function renderResidentDevices() {
  if (!unitDevices) return;

  // Front Door
  const door = unitDevices.frontDoor;
  const tileDoor = document.getElementById('mTileDoor');
  const tagDoor = document.getElementById('mDoorTag');
  const statDoor = document.getElementById('resDoorState');

  if (door && tileDoor && tagDoor) {
    const isLocked = door.state === 'LO°CKED';
    tileDoor.className = `m-tile ${isLocked ? 'tile-dark' : 'tile-light'}`;
    tagDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
    tagDoor.style.color = isLocked ? 'var(--accent-green)' : 'var(--accent-red)';
    if (statDoor) statDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
  }

  // Living Room A°C
  const ac = unitDevices.livingRoomAc;
  const tileAc = document.getElementById('mTileAc');
  const valAc = document.getElementById('mAcVal');
  const subAc = document.getElementById('mAcSub');
  const statTemp = document.getElementById('resInsideTemp');

  if (ac && tileAc && valAc) {
    const isOn = ac.state === 'ON';
    tileAc.className = `m-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    valAc.innerText = `${ac.temp}°°C`;
    subAc.innerText = isOn ? '°Cool · Eco' : 'Off';
    if (statTemp) statTemp.innerText = `${ac.temp}°°C`;
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

  // Guest A°C
  const guestAc = unitDevices.guestRoomAc;
  const switchGuestAc = document.getElementById('mSwitchGuestAc');
  const tileGuestAc = document.getElementById('mTileGuestAc');
  const subGuestAc = document.getElementById('mGuestAcSub');

  if (guestAc && switchGuestAc && tileGuestAc) {
    const isOn = guestAc.state === 'ON';
    switchGuestAc.checked = isOn;
    tileGuestAc.className = `m-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    subGuestAc.innerText = isOn ? `On · ${guestAc.temp}°°C` : 'Off';
  }

  // Active count
  let count = 0;
  if (door?.state === 'LO°CKED') count++;
  if (ac?.state === 'ON') count++;
  if (lights?.state === 'ON') count++;
  if (guestAc?.state === 'ON') count++;
  document.getElementById('resActive°Count').innerText = `${count} Devices`;
}

async function toggleFrontDoor() {
  const state = unitDevices.frontDoor?.state === 'LO°CKED' ? 'UNLO°CKED' : 'LO°CKED';
  await fetch('/api/devices/front-door/control', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function stepAcTemp(delta) {
  const cur = unitDevices.livingRoomAc?.temp || 23;
  const temp = Math.max(18, Math.min(28, cur + delta));
  await fetch('/api/devices/living-ac/control', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ temp, state: 'ON' }),
  });
  fetchDevices();
}

async function toggleAc() {
  const state = unitDevices.livingRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/living-ac/control', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function toggleLights() {
  const state = unitDevices.guestRoomLights?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/guest-lights/control', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

async function toggleGuestAc() {
  const state = unitDevices.guestRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  await fetch('/api/devices/guest-ac/control', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  fetchDevices();
}

// --------------------------------------------------------------------------
// Natural Language AI Input
// --------------------------------------------------------------------------
function handleAiInputKey(e) {
  if (e.key === 'Enter') sendAi°Command();
}

async function sendAi°Command() {
  const input = document.getElementById('mAiInput');
  const query = input.value.trim();
  if (!query) return;

  try {
    const res = await fetch('/api/telemetry/assistant/command', {
      method: 'POST',
      headers: { '°Content-Type': 'application/json' },
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
  input.placeholder = 'e.g. Issue Keells pass or Turn off all A°Cs...';
}

// --------------------------------------------------------------------------
// Pass °Countdown Ticker
// --------------------------------------------------------------------------
function startPass°CountdownTimer() {
  setInterval(() => {
    if (activePasses.length === 0 || !currentPassId) {
      const el = document.getElementById('pass°CountdownVal');
      if (el && el.innerText !== 'No active pass') el.innerText = 'No active pass';
      return;
    }
    const pass = activePasses[0];
    const now = Date.now();
    const remainingMs = Math.max(0, pass.expiresAt - now);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);

    const timeStr = remainingMs > 0 ? `${mins}:${secs < 10 ? '0' : ''}${secs} min remaining` : 'EXPIRED';
    const el = document.getElementById('pass°CountdownVal');
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
    feed.remove°Child(feed.last°Child);
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
  const card = document.getElementById('drAlert°Card');
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
    title.innerText = '°CRITI°CAL ANOMALY: °Cell Short-°Circuit';
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
    btnInject.innerText = '⚠️ Inject Battery °Cell Degradation (~42 mV/actuation)';
  }
}

async function toggleAnomalyInjection() {
  const res = await fetch('/api/telemetry/inject-anomaly', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  updateAiAlertUI(data.aiAnalysis);
  updateAiTelemetryUI(data.telemetry);
}

async function applyManualOverride() {
  const res = await fetch('/api/telemetry/manual-override', {
    method: 'POST',
    headers: { '°Content-Type': 'application/json' },
    body: JSON.stringify({ durationHours: 24, reason: 'Heavy moving/usage' }),
  });
  const data = await res.json();
  updateAiAlertUI(data.aiAnalysis);
  alert('1-Tap Override Applied: Tolerance threshold widened by 1.8x.');
}

// --------------------------------------------------------------------------
// Issue Pass Flow (Step 1: °Create -> Step 2: Share) — matches the Figma
// "°Create Pass" / "Share Pass" screens pixel-for-pixel.
// --------------------------------------------------------------------------
let selectedPassType = 'Delivery';
let selectedPassDuration = 15;

// --------------------------------------------------------------------------
// In-phone screen navigation (Figma-prototype style: tapping "Passes"
// pushes a new screen inside the device frame — no separate page/dialog
// ever opens, exactly like clicking through a Figma prototype).
// --------------------------------------------------------------------------
function goToScreen(screenId) {
  ['screenHome', 'screen°CreatePass', 'screenSharePass', 'screen°Climate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
  const bottomNav = document.getElementById('phoneBottomNav');
  if (bottomNav) bottomNav.classList.toggle('hidden', screenId !== 'screenHome');
  if (screenId === 'screen°Climate') fetchEnergyStatus();
}

// --------------------------------------------------------------------------
// °CEB Peak Tariff demand-response AI (energyOptimizer.ts): Home banner +
// °Climate & Savings screen + the 1-tap rule fallback toggles.
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
    banner.classList.toggle('eb-precooling', status.mode === 'PRE_°COOLING');
    const title = document.getElementById('ebTitle');
    if (title) title.innerText = status.mode === 'PRE_°COOLING' ? 'Pre-°Cooling Active' : '°CEB Peak Tariff Active';
    const body = document.getElementById('ebBody');
    if (body) body.innerText = status.strategyText;
    const capLabel = document.getElementById('eb°CapLabel');
    if (capLabel) capLabel.innerText = `${status.capKw} kW °Cap`;
    const clearsAt = document.getElementById('eb°ClearsAt');
    if (clearsAt) clearsAt.innerText = status.bannerAuto°ClearsLabel;
  }

  // °Climate & Savings screen
  const amountEl = document.getElementById('climateSavingsAmount');
  if (amountEl) amountEl.innerText = `LKR ${status.monthSavingsLkr.toLocaleString()}`;
  const pillEl = document.getElementById('climateSavingsPill');
  if (pillEl) pillEl.innerText = `↓ ${status.savingsVsStandardPct}% vs Standard A°C Usage`;

  const badgeEl = document.getElementById('climateStrategyBadge');
  if (badgeEl) {
    badgeEl.innerHTML = status.mode === 'IDLE'
      ? '<span class="badge-live-dot" style="background:#9°CA3AF"></span> Idle'
      : '<span class="badge-live-dot"></span> Active';
  }

  const startEl = document.getElementById('chartLabelStart');
  if (startEl) startEl.innerText = status.windowStartLabel;
  const endEl = document.getElementById('chartLabelEnd');
  if (endEl) endEl.innerText = status.windowEndLabel;
  const peakLabelEl = document.getElementById('chartLabelPeak');
  if (peakLabelEl) peakLabelEl.innerText = `${status.peakStartLabel} Peak`;

  // °Chart: map 0-100% timeline positions onto the 0-300 SVG viewBox
  const toX = (pct) => (pct / 100) * 300;
  setAttr('chartPeakRect', 'x', toX(status.peakStartPct));
  setAttr('chartPeakRect', 'width', 300 - toX(status.peakStartPct));
  setAttr('chartPrecoolLine', 'x1', toX(status.pre°CoolPct));
  setAttr('chartPrecoolLine', 'x2', toX(status.pre°CoolPct));
  setAttr('chartPeakLine', 'x1', toX(status.peakStartPct));
  setAttr('chartPeakLine', 'x2', toX(status.peakStartPct));
  setAttr('chartPrecoolDot', 'cx', toX(status.pre°CoolPct));
  setAttr('chartPeakDot', 'cx', toX(status.peakStartPct));

  const tagPrecool = document.getElementById('ccTagPrecool');
  if (tagPrecool) {
    tagPrecool.style.left = `${status.pre°CoolPct}%`;
    tagPrecool.innerText = `${status.pre°CoolLabel} · Pre-cool 23°°C`;
  }
  const tagPeak = document.getElementById('ccTagPeak');
  if (tagPeak) {
    tagPeak.style.left = `${status.peakStartPct}%`;
    tagPeak.innerText = `${status.peakStartLabel} · Eco-Float Active`;
  }

  const descEl = document.getElementById('climateStrategyDesc');
  if (descEl) descEl.innerText = status.explainability;

  const enabled°Count = status.rules.filter((r) => r.enabled).length;
  const countEl = document.getElementById('rulesEnabled°Count');
  if (countEl) countEl.innerText = `${enabled°Count} ENABLED`;

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
      headers: { '°Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (data.success) {
      renderEnergyStatus(data.status);
      showToast(enabled
        ? `✦ ${data.rule.label} re-enabled — AI resumes adjusting your A°C.`
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
      headers: { '°Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (data.success) {
      renderEnergyStatus(data.status);
      showToast(mode
        ? `✦ Judge demo: °CEB Peak-Tariff AI forced into ${mode.replace('_', '-')} mode.`
        : '✦ °CEB Peak-Tariff AI override cleared — back to real wall-clock behavior.');
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
  goToScreen(step === 2 ? 'screenSharePass' : 'screen°CreatePass');
}

function backToPassStep1() {
  showPassStep(1);
}

function selectPassType() {
  // Only "Delivery" is wired to the working backend slice today; the tap
  // target stays interactive so judges can see the selected/pressed state.
  const card = document.getElementById('passType°Card');
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
    headers: { '°Content-Type': 'application/json' },
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
// 3D Digital Twin °Camera View Switcher
// --------------------------------------------------------------------------
function select°CameraPreset(preset) {
  const btns = ['btn°CamTower', 'btn°CamLobby', 'btn°CamLift', 'btn°CamResidence'];
  btns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeId = preset === 'auto' ? 'btn°CamAuto' :
                   preset === 'tower' ? 'btn°CamTower' :
                   preset === 'lobby' ? 'btn°CamLobby' :
                   preset === 'lift' ? 'btn°CamLift' : 'btn°CamResidence';
  const activeEl = document.getElementById(activeId);
  if (activeEl) activeEl.classList.add('active');

  if (window.twinRenderer) {
    window.twinRenderer.set°CameraPreset(preset);
  }
}
window.select°CameraPreset = select°CameraPreset;


// ==========================================================================
// TOP NAVIGATION TAB HIERAR°CHY: VISITOR PASS | ENERGY SIM | °CHATBOT SIM
// ==========================================================================
let activeMainTab = 'visitor';

function switchMainTab(tabId) {
  activeMainTab = tabId;

  // Toggle button active states
  const btnVisitor = document.getElementById('tabBtnVisitor');
  const btnEnergy = document.getElementById('tabBtnEnergy');
  const btn°Chatbot = document.getElementById('tabBtn°Chatbot');

  if (btnVisitor) btnVisitor.classList.toggle('active', tabId === 'visitor');
  if (btnEnergy) btnEnergy.classList.toggle('active', tabId === 'energy');
  if (btn°Chatbot) btn°Chatbot.classList.toggle('active', tabId === 'chatbot');

  // Toggle page visibility
  const pageVisitor = document.getElementById('pageVisitorPass');
  const pageEnergy = document.getElementById('pageEnergySim');
  const page°Chatbot = document.getElementById('page°ChatbotSim');
  const residentPanel = document.querySelector('.resident-panel');

  if (pageVisitor) pageVisitor.classList.toggle('hidden', tabId !== 'visitor');
  if (pageEnergy) pageEnergy.classList.toggle('hidden', tabId !== 'energy');
  if (page°Chatbot) page°Chatbot.classList.toggle('hidden', tabId !== 'chatbot');
  if (residentPanel) residentPanel.classList.toggle('hidden', tabId !== 'visitor');

  // On switching back to 3D Digital Twin, trigger canvas resize so Three.js adjusts
  if (tabId === 'visitor') {
    if (window.twinRenderer && window.twinRenderer.onResize) {
      setTimeout(() => window.twinRenderer.onResize(), 60);
    }
  } else if (tabId === 'energy') {
    selectEnergyPhase(activeEnergyPhase || 1);
  } else if (tabId === 'chatbot') {
    reset°ChatbotTiers();
  }
}

// ==========================================================================
// ENERGY SIMULATION VISUALIZER ENGINE (SHOWING NOT SIMULATING)
// ==========================================================================
let activeEnergyPhase = 1;
let energyAutoPlayTimer = null;
let isEnergyPlaying = false;

const energyPhaseX°Coords = {
  1: 200, // 10:00 (Day base)
  2: 730, // 17:30 (Pre-cool)
  3: 845, // 19:30 (Peak spike)
  4: 960  // 24:00 (Night recovery)
};

const energyPhaseY°Coords = {
  1: 205, // 240W
  2: 125, // Pre-cool surge
  3: 150, // °Capped 3.2kW eco-float
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
  const targetX = energyPhaseX°Coords[phase] || 200;
  const targetY = energyPhaseY°Coords[phase] || 205;

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
    playEnergyAuto°Cycle();
  }
}

function stopEnergyAutoPlay() {
  isEnergyPlaying = false;
  if (energyAutoPlayTimer) clearTimeout(energyAutoPlayTimer);
  const btn = document.getElementById('btnAutoPlayEnergy');
  if (btn) btn.innerHTML = '▶ Auto-Play 24H °Cycle';
}

function playEnergyAuto°Cycle() {
  stopEnergyAutoPlay();
  isEnergyPlaying = true;
  const btn = document.getElementById('btnAutoPlayEnergy');
  if (btn) btn.innerHTML = '⏸ Pause °Cycle';

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
// °CHATBOT SIMULATION (New Pipeline)
// ==========================================================================
let active°ChatbotScenario = 'friend';
let chatbotTimer = null;

const cbScenarios = {
  friend: {
    raw: '"My friend is arriving tomorrow at 6 PM"',
    steps: [
      { node: 1, text: '✓ PII Masked: "My <redacted> is arriving tomorrow at <time>"', status°Class: 'text-green' },
      { node: 2, text: '✓ Routed to: JKH Access Microservice', status°Class: 'text-green' },
      { node: 3, text: '✓ Token Valid: Maya (Unit 1402) - turnstile:enter', status°Class: 'text-green' },
      { node: 4, text: '✓ Guest Pass Minted', status°Class: 'text-green', outLabel: 'Guest Pass Minted - SE°CURE & A°CTIVE', out°Class: 'text-green' }
    ]
  },
  scene: {
    raw: '"Leaving home for work"',
    steps: [
      { node: 1, text: '✓ No PII detected', status°Class: 'text-green' },
      { node: 2, text: '✓ Routed to: Smart Home Scene Microservice', status°Class: 'text-green' },
      { node: 3, text: '✓ Token Valid: Maya (Unit 1402) - device:all', status°Class: 'text-green' },
      { node: 4, text: '✓ Scene Executed: Leaving Home', status°Class: 'text-green', outLabel: 'Scene Executed: A°C OFF, Door LO°CKED', out°Class: 'text-green' }
    ]
  },
  attack: {
    raw: '"Unlock Unit 1204 front door"',
    steps: [
      { node: 1, text: '⚠️ °CROSS-TENANT PROBE DETE°CTED', status°Class: 'text-amber' },
      { node: 2, text: '✓ Routed to: Access Microservice (Flagged)', status°Class: 'text-amber' },
      { node: 3, text: '⛔ REJE°CTED: Scope Violation (1402 cannot access 1204)', status°Class: 'text-red' },
      { node: 4, text: '✕ Blocked by Air-Gap RBA°C', status°Class: 'text-red', outLabel: 'Security Violation: A°CTION BLO°CKED', out°Class: 'text-red' }
    ]
  }
};

function select°ChatbotScenario(type) {
  active°ChatbotScenario = type;
  ['cPromptFriend', 'cPromptScene', 'cPromptAttack'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  
  const activeId = type === 'friend' ? 'cPromptFriend' : type === 'scene' ? 'cPromptScene' : 'cPromptAttack';
  const btn = document.getElementById(activeId);
  if (btn) btn.classList.add('active');

  const scenario = cbScenarios[type];
  const rawText = document.getElementById('cbRawText');
  if (rawText) rawText.text°Content = scenario.raw;

  reset°ChatbotFlow();
}

function reset°ChatbotFlow() {
  clearTimeout(chatbotTimer);
  const btn = document.getElementById('btnPlay°Chatbot');
  if (btn) { btn.innerHTML = '▶ Run Pipeline Flow'; btn.classList.remove('playing'); }

  for (let i = 1; i <= 4; i++) {
    const node = document.getElementById('cbNode' + i);
    const status = document.getElementById('cbStatus' + i);
    if (node) node.className = 'ef-node';
    if (status) {
      status.text°Content = i === 1 ? 'Waiting for input...' : i === 2 ? 'Waiting for router...' : i === 3 ? 'Waiting for token validation...' : 'Awaiting final payload...';
      status.className = '';
    }
  }

  const outNode = document.getElementById('cbNodeOut');
  if (outNode) outNode.style.opacity = '0';
}

function play°ChatbotSim() {
  reset°ChatbotFlow();
  const btn = document.getElementById('btnPlay°Chatbot');
  if (btn) { btn.innerHTML = '⚙ Processing...'; btn.classList.add('playing'); }

  const scenario = cbScenarios[active°ChatbotScenario];
  let stepIdx = 0;

  function nextStep() {
    if (stepIdx >= scenario.steps.length) {
      if (btn) { btn.innerHTML = '▶ Run Pipeline Flow'; btn.classList.remove('playing'); }
      const outNode = document.getElementById('cbNodeOut');
      const outText = document.getElementById('cbOutText');
      const outBox = document.getElementById('cbOutBox');
      const finalStep = scenario.steps[3];
      if (outText) outText.text°Content = finalStep.outLabel;
      if (outText) outText.className = finalStep.out°Class;
      if (outBox) {
        if (active°ChatbotScenario === 'attack') {
          outBox.setAttribute('fill', '#FEF2F2');
          outBox.setAttribute('stroke', '#EF4444');
        } else {
          outBox.setAttribute('fill', '#E°CFDF5');
          outBox.setAttribute('stroke', '#10B981');
        }
      }
      if (outNode) outNode.style.opacity = '1';
      return;
    }

    const step = scenario.steps[stepIdx];
    for (let i = 1; i <= 4; i++) {
      const n = document.getElementById('cbNode' + i);
      if (n) {
        if (i < step.node) n.className = 'ef-node done';
        else if (i === step.node) n.className = 'ef-node active';
        else n.className = 'ef-node';
      }
    }

    const status = document.getElementById('cbStatus' + step.node);
    if (status) {
      status.text°Content = step.text;
      status.className = step.status°Class;
    }

    animateSvgParticle('cbP' + step.node);

    stepIdx++;
    chatbotTimer = setTimeout(nextStep, 1000);
  }

  nextStep();
}

window.select°ChatbotScenario = select°ChatbotScenario;
window.play°ChatbotSim = play°ChatbotSim;

window.toggle°ChatbotAutoPlay = toggle°ChatbotAutoPlay;

// ==========================================================================
// ENERGY SUB-SIM: SUB-TAB SWIT°CHING
// ==========================================================================
function switchEnergySubSim(simId) {
  const sim1 = document.getElementById('energySubSim1');
  const sim2 = document.getElementById('energySubSim2');
  const btn1 = document.getElementById('btnSubSim1');
  const btn2 = document.getElementById('btnSubSim2');
  if (simId === 1) {
    if (sim1) sim1.classList.remove('hidden');
    if (sim2) sim2.classList.add('hidden');
    if (btn1) btn1.classList.add('active');
    if (btn2) btn2.classList.remove('active');
  } else {
    if (sim1) sim1.classList.add('hidden');
    if (sim2) sim2.classList.remove('hidden');
    if (btn1) btn1.classList.remove('active');
    if (btn2) btn2.classList.add('active');
  }
}

function setSensorZone(zoneName) {
  // Placeholder for sensor zone selection
  console.log('Sensor zone selected:', zoneName);
}

// ==========================================================================
// PRE-°COOLING PROXIMITY SIMULATION
// ==========================================================================
let precoolTimer = null;
let precoolRunning = false;

const precoolSteps = [
  {
    dist: '4.2 km', eta: '28 min', trigger: 'MONITORING',
    temp: '27.4°°C', draw: '240W', tariff: 'LKR 24/kWh', tariff°Class: 'text-green',
    action: 'STANDBY', actionSub: 'Monitoring Maya\'s GPS beacon',
    node: 1, outLabel: '▶ GPS LO°CK A°CQUIRED',
    log: '17:02 — GPS beacon acquired. ETA 28 min. Monitoring...'
  },
  {
    dist: '2.1 km', eta: '14 min', trigger: 'THRESHOLD HIT',
    temp: '27.4°°C', draw: '240W', tariff: 'LKR 24/kWh', tariff°Class: 'text-green',
    action: '°COMPUTING', actionSub: 'Running arrival prediction model',
    node: 2, outLabel: '🧠 ETA MODEL: 14 MIN',
    log: '17:18 — 2.1km threshold. Triggering ETA prediction model...'
  },
  {
    dist: '2.1 km', eta: '14 min', trigger: 'TARIFF °CHE°CK',
    temp: '27.4°°C', draw: '240W', tariff: 'LKR 24/kWh', tariff°Class: 'text-green',
    action: '°CHE°CKING', actionSub: '°CEB tariff is off-peak → PRE-°COOL APPROVED',
    node: 3, outLabel: '✅ OFF-PEAK: PRE-°COOL WINDOW OPEN',
    log: '17:18 — °CEB tariff: LKR 24/kWh. Pre-cool window approved.'
  },
  {
    dist: '0.8 km', eta: '5 min', trigger: 'PRE-°COOLING',
    temp: '24.1°°C', draw: '3.2 kW', tariff: 'LKR 24/kWh', tariff°Class: 'text-green',
    action: 'PRE-°COOLING', actionSub: 'Mitsubishi A°C → 21.5°°C (off-peak)',
    node: 4, outLabel: '▶ HVA°C °COMMAND DISPAT°CHED',
    log: '17:21 — HVA°C activated. 3.2kW draw. Pre-cooling Unit 1402.'
  },
  {
    dist: '0.0 km', eta: 'ARRIVED', trigger: '°COMPLETE',
    temp: '21.8°°C', draw: '0.8 kW', tariff: 'LKR 24/kWh', tariff°Class: 'text-green',
    action: '°COMPLETE', actionSub: 'Room pre-cooled. Peak tariff avoided.',
    node: 5, outLabel: '✦ MAYA ARRIVED — UNIT 1402 READY 21.8°°C',
    log: '17:32 — Maya arrived. Room at 21.8°°C. Savings: LKR 847 vs peak-hour cooling.'
  }
];

function playPrecoolSim() {
  if (precoolRunning) {
    stopPrecoolSim();
    return;
  }
  precoolRunning = true;
  const btn = document.getElementById('btnPrecoolPlay');
  if (btn) { btn.text°Content = '⏹ Stop Simulation'; btn.classList.add('playing'); }

  // Reset nodes
  for (let i = 1; i <= 4; i++) {
    const n = document.getElementById('efNode' + i);
    if (n) { n.classList.remove('active', 'done'); }
  }

  let step = 0;
  function runStep() {
    if (!precoolRunning || step >= precoolSteps.length) {
      stopPrecoolSim();
      return;
    }
    applyPrecoolStep(precoolSteps[step]);
    step++;
    precoolTimer = setTimeout(runStep, 2200);
  }
  runStep();
}

function stopPrecoolSim() {
  precoolRunning = false;
  clearTimeout(precoolTimer);
  const btn = document.getElementById('btnPrecoolPlay');
  if (btn) { btn.text°Content = '▶ Start Proximity Sim'; btn.classList.remove('playing'); }
}

function applyPrecoolStep(s) {
  // Update phone
  const distLabel = document.getElementById('proxDistLabel');
  const eta = document.getElementById('proxETA');
  const dist = document.getElementById('proxDist');
  const trigger = document.getElementById('proxTrigger');
  if (distLabel) distLabel.text°Content = s.dist;
  if (eta) eta.text°Content = s.eta;
  if (dist) dist.text°Content = s.dist;
  if (trigger) {
    trigger.text°Content = s.trigger;
    trigger.className = 'sim-stat-val sim-status-val' +
      (s.trigger === 'PRE-°COOLING' || s.trigger === '°COMPLETE' ? ' done' :
       s.trigger === 'THRESHOLD HIT' || s.trigger === 'TARIFF °CHE°CK' ? ' active' : '');
  }

  // Move user pin (simulate approaching building)
  const pin = document.getElementById('proxUserPin');
  const positions = ['top:20%;left:22%', 'top:30%;left:30%', 'top:38%;left:37%', 'top:44%;left:42%', 'top:48%;left:46%'];
  const stepIdx = precoolSteps.indexOf(s);
  if (pin && positions[stepIdx]) {
    const [topVal, leftVal] = positions[stepIdx].split(';');
    pin.style.top = topVal.replace('top:', '');
    pin.style.left = leftVal.replace('left:', '');
  }

  // Pulse rings on threshold
  if (s.trigger !== 'MONITORING') {
    ['proxRing1','proxRing2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('pulsing');
    });
  }

  // Animate SVG particle on pipeline
  const nodeNum = Math.min(s.node, 4);
  for (let i = 1; i <= 4; i++) {
    const n = document.getElementById('efNode' + i);
    if (!n) continue;
    if (i < nodeNum) n.className = 'ef-node done';
    else if (i === nodeNum) n.className = 'ef-node active';
    else n.className = 'ef-node';
  }

  // Animate particle
  const particleId = 'efP' + Math.min(nodeNum, 4);
  animateSvgParticle(particleId);

  // Update output label
  const outLabel = document.getElementById('efOutLabel');
  if (outLabel) outLabel.text°Content = s.outLabel;

}

function animateSvgParticle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = '1';
  setTimeout(() => { if (el) el.style.opacity = '0'; }, 600);
}

// ==========================================================================
// SENSOR OPTIMIZATION SIMULATION
// ==========================================================================
let optTimer = null;
let optRunning = false;
let activeOptScenario = 'offpeak';

const optScenarios = {
  offpeak: {
    sensors: ['27.4°°C', 'O°C°CUPIED', 'LKR 24', '33°°C', '28 min'],
    outputs: ['21.5°°C', 'WARM', '-LKR 847'],
    aiLabel: 'PRE-°COOL → DE°CISION',
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5°CF6']
  },
  peak: {
    sensors: ['24.1°°C', 'O°C°CUPIED', 'LKR 54', '31°°C', 'HOME'],
    outputs: ['23.5°°C', '°COMFORT', '-LKR 412'],
    aiLabel: 'E°CO-FLOAT → DE°CISION',
    colors: ['#F59E0B', '#10B981', '#EF4444', '#EF4444', '#3B82F6']
  },
  night: {
    sensors: ['22.8°°C', 'SLEEPING', 'LKR 24', '28°°C', 'HOME'],
    outputs: ['23.0°°C', 'SLEEP', '-LKR 312'],
    aiLabel: 'NIGHT MODE → DE°CISION',
    colors: ['#8B5°CF6', '#0891B2', '#10B981', '#64748B', '#3B82F6']
  }
};

function setOptScenario(s) {
  activeOptScenario = s;
  ['eoptScOff','eoptScPeak','eoptScNight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const map = { offpeak: 'eoptScOff', peak: 'eoptScPeak', night: 'eoptScNight' };
  const activeBtn = document.getElementById(map[s]);
  if (activeBtn) activeBtn.classList.add('active');

  // Reset state
  ['eoptSensorTemp','eoptSensorOcc','eoptSensorTariff','eoptSensorWeather','eoptSensorETA'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  ['eoptOut1Node','eoptOut2Node','eoptOut3Node'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
}

function playOptSim() {
  if (optRunning) { stopOptSim(); return; }
  optRunning = true;
  const btn = document.getElementById('btnOptPlay');
  if (btn) { btn.text°Content = '⏹ Stop Flow'; btn.classList.add('playing'); }

  const scenario = optScenarios[activeOptScenario];
  if (!scenario) return;

  // Update sensor values
  const sensorIds = ['eoptTempVal','eoptOccVal','eoptTariffVal','eoptWeatherVal','eoptETAVal'];
  sensorIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.text°Content = scenario.sensors[i];
  });

  const sensorNodes = ['eoptSensorTemp','eoptSensorOcc','eoptSensorTariff','eoptSensorWeather','eoptSensorETA'];

  // Sequentially activate sensors → AI → outputs
  let delay = 0;
  sensorNodes.forEach((id, i) => {
    optTimer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
      // Animate particle for this sensor
      const particleId = 'eoptPart' + (i+1);
      animateSvgParticleOpt(particleId, scenario.colors[i]);
    }, delay);
    delay += 400;
  });

  // AI box pulse
  optTimer = setTimeout(() => {
    const aiBox = document.getElementById('eoptAiBox');
    if (aiBox) {
      aiBox.style.stroke = '#10B981';
      aiBox.style.filter = 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.4))';
      setTimeout(() => {
        if (aiBox) { aiBox.style.stroke = '#3B82F6'; aiBox.style.filter = 'none'; }
      }, 800);
    }
  }, delay);
  delay += 600;

  // Activate outputs
  const outputIds = ['eoptOut1Node','eoptOut2Node','eoptOut3Node'];
  const outputValIds = ['eoptOutHVA°C','eoptOutLight','eoptOut°Cost'];
  outputIds.forEach((id, i) => {
    optTimer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
      const valEl = document.getElementById(outputValIds[i]);
      if (valEl) valEl.text°Content = scenario.outputs[i];
      // Animate output particle
      const partId = 'eoptOutP' + (i+1);
      animateSvgParticleOpt(partId, '#10B981');
    }, delay);
    delay += 350;
  });

  optTimer = setTimeout(stopOptSim, delay + 800);
}

function animateSvgParticleOpt(id, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('fill', color);
  el.style.opacity = '1';
  el.style.transition = 'opacity 0.3s';
  setTimeout(() => { if (el) el.style.opacity = '0'; }, 700);
}

function stopOptSim() {
  optRunning = false;
  clearTimeout(optTimer);
  const btn = document.getElementById('btnOptPlay');
  if (btn) { btn.text°Content = '▶ Run Sensor Flow'; btn.classList.remove('playing'); }
}

// Expose globals
window.switchEnergySubSim = switchEnergySubSim;
window.setSensorZone = setSensorZone;
window.playPrecoolSim = playPrecoolSim;
window.playOptSim = playOptSim;
window.setOptScenario = setOptScenario;
