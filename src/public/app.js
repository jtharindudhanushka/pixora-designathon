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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebSocket] Connected to TRI-ZEN real-time hardware stream.');
  };

  ws.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      handleLiveHardwareEvent(packet);
    } catch (err) {
      console.error('[WebSocket] Event parse error:', err);
    }
  };

  ws.onclose = () => {
    setTimeout(initWebSocket, 2500);
  };
}

function handleLiveHardwareEvent(packet) {
  const { type, data } = packet;

  switch (type) {
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
    if (data.success && data.passes.length > 0) {
      activePasses = data.passes;
      const primary = activePasses.find((p) => p.status === 'ACTIVE') || activePasses[0];
      currentPassId = primary.passId;

      if (primary.status === 'USED') {
        document.getElementById('courierPassStatus').innerText = 'CONSUMED';
        document.getElementById('courierPassStatus').style.background = 'rgba(59, 130, 246, 0.2)';
        document.getElementById('courierPassStatus').style.color = 'var(--accent-blue)';
        jumpToStage(4);
      }
    }
  } catch (err) {
    console.error('Pass fetch error:', err);
  }
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

function startSequencePlayback() {
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
      if (i <= stage) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  // 2. Update Maya's App Delivery Stepper
  updateResidentStepper(stage);

  // 3. Update 3D Architectural Canvas
  if (window.twinRenderer) {
    window.twinRenderer.setStage(stage);
  }
}

function updateResidentStepper(stage) {
  const s1 = document.getElementById('stNode1');
  const s2 = document.getElementById('stNode2');
  const s3 = document.getElementById('stNode3');
  const s4 = document.getElementById('stNode4');
  const b1 = document.getElementById('stBar1');
  const b2 = document.getElementById('stBar2');
  const b3 = document.getElementById('stBar3');
  const badge = document.getElementById('dtBadge');
  const sub = document.getElementById('dtSubtext');

  [s1, s2, s3, s4].forEach((s) => s && (s.className = 'st-node'));
  [b1, b2, b3].forEach((b) => b && (b.className = 'st-bar'));

  if (stage >= 1) s1.className = 'st-node completed';
  if (stage >= 2) {
    b1.className = 'st-bar completed';
    s2.className = 'st-node completed';
    sub.innerText = 'Courier scanned at Lobby Gate 1';
  }
  if (stage >= 3) {
    b2.className = 'st-bar completed';
    s3.className = 'st-node completed';
    sub.innerText = 'Courier in Lift Bank A (Floor 8... 14)';
  }
  if (stage >= 4) {
    b3.className = 'st-bar completed';
    s4.className = 'st-node completed';
    badge.innerText = 'Delivered';
    badge.style.background = '#E8F0FE';
    badge.style.color = '#1A73E8';
    sub.innerText = 'Package dropped at Residence 1402 doorstep';
  }
}

// --------------------------------------------------------------------------
// Cryptographic Pass Scan Action
// --------------------------------------------------------------------------
async function triggerHandshakeScan() {
  if (!currentPassId) {
    alert('No active pass. Issuing new pass...');
    await confirmIssuePass();
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

      document.getElementById('courierPassStatus').innerText = 'CONSUMED';
      document.getElementById('courierPassStatus').style.background = 'rgba(59, 130, 246, 0.2)';
      document.getElementById('courierPassStatus').style.color = 'var(--accent-blue)';
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
    if (activePasses.length === 0) return;
    const pass = activePasses[0];
    const now = Date.now();
    const remainingMs = Math.max(0, pass.expiresAt - now);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);

    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs} min remaining`;
    const el = document.getElementById('passCountdownVal');
    if (el) el.innerText = timeStr;
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
// Modal Pass Creation
// --------------------------------------------------------------------------
function openPassModal() {
  document.getElementById('modalPass').classList.remove('hidden');
}

function closePassModal() {
  document.getElementById('modalPass').classList.add('hidden');
}

async function confirmIssuePass() {
  const partner = document.getElementById('selPartner').value;
  const duration = parseInt(document.getElementById('selDuration').value, 10);

  const res = await fetch('/api/passes/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner, ttlMinutes: duration, unit: '1402' }),
  });

  const data = await res.json();
  if (data.success) {
    closePassModal();
    fetchPasses();
    jumpToStage(1);
  }
}
