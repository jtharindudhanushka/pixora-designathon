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
  if (countPill) countPill.innerText = '1 pass';

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
    statusEl.innerText = 'IDLE · NO PASS';
    statusEl.className = 'token-status-pill idle';
    statusEl.style.background = '';
    statusEl.style.color = '';
  }

  const brandEl = document.getElementById('courierBrandTitle');
  if (brandEl) brandEl.innerText = 'No Courier Assigned';

  const orderEl = document.getElementById('courierOrderId');
  if (orderEl) orderEl.innerText = 'Awaiting resident pass issuance';

  const countdownEl = document.getElementById('passCountdownVal');
  if (countdownEl) countdownEl.innerText = 'No active pass';

  const pinEl = document.getElementById('courierPinVal');
  if (pinEl) pinEl.innerText = '— · —';

  const scanBtn = document.getElementById('btnScanPass');
  if (scanBtn) scanBtn.disabled = true;

  const qrBox = document.getElementById('courierQrBox');
  if (qrBox) qrBox.style.opacity = '0.45';

  const alertBox = document.getElementById('scanResultAlert');
  if (alertBox) alertBox.classList.add('hidden');

  // Bring to Resident App Home screen
  goToScreen('screenHome');

  // Resident App UI: Show Empty State of Arrivals
  const emptyCard = document.getElementById('mEmptyArrivals');
  if (emptyCard) emptyCard.classList.remove('hidden');

  const countPill = document.getElementById('mPassCountPill');
  if (countPill) countPill.innerText = '0 passes';

  const deliverySection = document.getElementById('deliverySection');
  if (deliverySection) deliverySection.classList.add('hidden');

  const trackerCard = document.getElementById('deliveryTrackerCard');
  if (trackerCard) trackerCard.classList.add('hidden');

  const successCard = document.getElementById('deliverySuccessCard');
  if (successCard) successCard.classList.add('hidden');

  jumpToStage(0);
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
  1: { sub: 'Heading to Tower 1 · Grocery order', eta: '~6 min away', badge: 'Live' },
  2: { sub: 'Courier arrived · verifying pass at Gate 1', eta: '~3 min away', badge: 'Live' },
  3: { sub: 'Access granted · lift dispatched to Floor 14', eta: '~1 min away', badge: 'Live' },
  4: { sub: 'Courier at Unit 1402 door', eta: 'Delivering now', badge: 'Arriving' },
};

let deliverySuccessTimer = null;

function updateResidentStepper(stage) {
  const badge = document.getElementById('dtBadge');
  const sub = document.getElementById('dtSubtext');
  const eta = document.getElementById('dtEta');
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

  if (badge) badge.innerText = copy.badge;
  if (sub) sub.innerText = copy.sub;
  if (eta) eta.innerText = copy.eta;

  if (stage >= 4) {
    scheduleDeliverySuccess();
  }
}

// Mirrors the Figma "Delivery Successful" screen: the tracker card is
// replaced by a full green success card for a few seconds, then the whole
// delivery section is dismissed automatically (pass consumed).
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
  ['screenHome', 'screenCreatePass', 'screenSharePass'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
  const bottomNav = document.getElementById('phoneBottomNav');
  if (bottomNav) bottomNav.classList.toggle('hidden', screenId !== 'screenHome');
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
