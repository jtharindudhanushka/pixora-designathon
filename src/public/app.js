// ==========================================================================
// TRI-ZEN OS — Integrated Smart Living Platform Frontend Logic
// Real-Time WebSocket Client, Dual View Switcher, and Device Synchronizer
// ==========================================================================

let ws;
let currentPasses = [];
let unitDevices = {};
let latestAiReport = null;
let currentToken = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchInitialData();
  startPassProgressTicker();
});

// View Mode Switcher
function switchView(mode) {
  const btnResident = document.getElementById('btnViewResident');
  const btnOperator = document.getElementById('btnViewOperator');
  const viewResident = document.getElementById('viewResident');
  const viewOperator = document.getElementById('viewOperator');

  if (mode === 'resident') {
    btnResident.classList.add('active');
    btnOperator.classList.remove('active');
    viewResident.classList.add('active');
    viewOperator.classList.remove('active');
  } else {
    btnOperator.classList.add('active');
    btnResident.classList.remove('active');
    viewOperator.classList.add('active');
    viewResident.classList.remove('active');
  }
}

// --------------------------------------------------------------------------
// WebSocket Connection
// --------------------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebSocket] Connected to TRI-ZEN real-time stream.');
    document.getElementById('systemStatusText').innerText = 'MQTT Broker & Realtime Bus: CONNECTED';
  };

  ws.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      handleRealtimeEvent(packet);
    } catch (err) {
      console.error('[WebSocket] Parse error:', err);
    }
  };

  ws.onclose = () => {
    document.getElementById('systemStatusText').innerText = 'Bus Reconnecting...';
    setTimeout(initWebSocket, 2000);
  };
}

function handleRealtimeEvent(packet) {
  const { type, data } = packet;

  switch (type) {
    case 'TURNSTILE_STATE':
      updateTurnstileUI(data);
      break;
    case 'ELEVATOR_STATE':
      updateElevatorUI(data);
      break;
    case 'LOCK_TELEMETRY':
      updateTelemetryReadout(data);
      break;
    case 'AI_ALERT':
      updateAiAlertUI(data);
      break;
    case 'PASS_ISSUED':
    case 'DELIVERY_ENTRY_HANDSHAKE':
      fetchPasses();
      break;
    case 'DEVICE_STATE_CHANGED':
      fetchDevices();
      break;
    case 'RAW_MQTT_PACKET':
      appendMqttPacket(data);
      break;
  }
}

// --------------------------------------------------------------------------
// Initial Data Fetching
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
    if (data.success) {
      currentPasses = data.passes;
      renderPasses();
    }
  } catch (err) {
    console.error('Failed to fetch passes:', err);
  }
}

async function fetchDevices() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    if (data.success) {
      unitDevices = data.devices;
      renderDeviceTiles();
    }
  } catch (err) {
    console.error('Failed to fetch devices:', err);
  }
}

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry/latest');
    const data = await res.json();
    if (data.success) {
      updateTelemetryReadout(data.telemetry);
      updateAiAlertUI(data.aiAnalysis);
    }
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}

// --------------------------------------------------------------------------
// Pass Management & Dynamic 15-min Countdown Progress Bar
// --------------------------------------------------------------------------
function renderPasses() {
  const container = document.getElementById('passesList');
  const countPill = document.getElementById('passCountPill');
  container.innerHTML = '';

  const activePasses = currentPasses.filter((p) => p.status === 'ACTIVE' || p.status === 'USED');
  countPill.innerText = `${activePasses.length} ${activePasses.length === 1 ? 'pass' : 'passes'}`;

  if (activePasses.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; color: var(--text-secondary); font-size: 13px; text-align: center; width: 100%;">
        No active delivery passes. Tap "+ Issue Pass" above.
      </div>`;
    return;
  }

  activePasses.forEach((pass) => {
    // Keep first pass as active token for the inspector
    if (!currentToken && pass.token) {
      currentToken = pass.token;
      updateTokenDecoder(pass);
    }

    const card = document.createElement('div');
    card.className = 'pass-card';
    card.id = `pass-card-${pass.passId}`;

    const partnerIcon = pass.partner.includes('Keells') ? '🛒' : pass.partner.includes('PickMe') ? '🛵' : '📦';
    const isUsed = pass.status === 'USED';

    card.innerHTML = `
      <div class="pass-card-top">
        <div class="pass-partner">
          <div class="partner-logo-box">${partnerIcon}</div>
          <span class="partner-name">${pass.partner}</span>
        </div>
        <span class="status-badge" style="${isUsed ? 'background: #E8F0FE; color: #1A73E8;' : ''}">
          ${isUsed ? 'Arrived / Used' : 'Active'}
        </span>
      </div>

      <div class="pass-route">${pass.route}</div>

      <div class="pass-timer-wrap">
        <div class="pass-timer-meta">
          <span id="timer-text-${pass.passId}">Calculating window...</span>
          <span>15-min window</span>
        </div>
        <div class="pass-progress-track">
          <div class="pass-progress-fill" id="timer-bar-${pass.passId}" style="width: 20%;"></div>
        </div>
      </div>

      <button class="pass-action-btn" onclick="triggerPassEntry('${pass.passId}')" ${isUsed ? 'disabled style="opacity: 0.5;"' : ''}>
        ${isUsed ? '✓ Entered Turnstile 1' : 'Simulate Courier Gate Tap'}
      </button>
    `;

    container.appendChild(card);
  });

  updatePassProgress();
}

function updatePassProgress() {
  const now = Date.now();

  currentPasses.forEach((pass) => {
    const textEl = document.getElementById(`timer-text-${pass.passId}`);
    const barEl = document.getElementById(`timer-bar-${pass.passId}`);
    if (!textEl || !barEl) return;

    const totalDuration = pass.expiresAt - pass.issuedAt;
    const elapsed = now - pass.issuedAt;
    const remainingMs = Math.max(0, pass.expiresAt - now);
    const remainingMins = Math.ceil(remainingMs / 60000);

    const percentElapsed = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    barEl.style.width = `${percentElapsed}%`;

    if (pass.status === 'USED') {
      textEl.innerText = 'Pass consumed at Lobby Turnstile';
      barEl.style.backgroundColor = '#2ECC71';
    } else if (remainingMs <= 0) {
      textEl.innerText = 'Pass window expired';
      barEl.style.backgroundColor = '#E74C3C';
    } else {
      textEl.innerText = `${remainingMins} min remaining`;
      barEl.style.backgroundColor = 'var(--status-accent)';
    }
  });
}

function startPassProgressTicker() {
  setInterval(updatePassProgress, 1000);
}

async function triggerPassEntry(passId) {
  try {
    const res = await fetch('/api/passes/validate-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      fetchPasses();
    } else {
      alert(`Handshake Rejected: ${data.error}`);
    }
  } catch (err) {
    console.error('Handshake error:', err);
  }
}

// --------------------------------------------------------------------------
// Quick Controls Synchronizer (2x2 Grid)
// --------------------------------------------------------------------------
function renderDeviceTiles() {
  if (!unitDevices) return;

  // 1. Front Door Tile
  const door = unitDevices.frontDoor;
  const tileDoor = document.getElementById('tileFrontDoor');
  const pillDoor = document.getElementById('pillFrontDoor');
  const statDoor = document.getElementById('statDoorState');

  if (door && tileDoor && pillDoor) {
    const isLocked = door.state === 'LOCKED';
    tileDoor.className = `device-tile ${isLocked ? 'tile-dark' : 'tile-light'}`;
    pillDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
    pillDoor.className = `state-pill ${isLocked ? 'success-pill' : ''}`;
    if (statDoor) statDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
  }

  // 2. Living Room AC
  const ac = unitDevices.livingRoomAc;
  const tileAc = document.getElementById('tileLivingAc');
  const valAc = document.getElementById('valLivingTemp');
  const subAc = document.getElementById('subLivingAc');
  const statTemp = document.getElementById('statInsideTemp');

  if (ac && tileAc && valAc) {
    const isOn = ac.state === 'ON';
    tileAc.className = `device-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    valAc.innerText = `${ac.temp}°C`;
    subAc.innerText = isOn ? 'Cool · Eco Mode' : 'Off';
    if (statTemp) statTemp.innerText = `${ac.temp}°C`;
  }

  // 3. Guest Lights
  const lights = unitDevices.guestRoomLights;
  const switchLights = document.getElementById('switchGuestLights');
  const tileLights = document.getElementById('tileGuestLights');
  const subLights = document.getElementById('subGuestLights');

  if (lights && switchLights && tileLights) {
    const isOn = lights.state === 'ON';
    switchLights.checked = isOn;
    tileLights.className = `device-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    subLights.innerText = isOn ? 'On · 80%' : 'Off';
  }

  // 4. Guest AC
  const guestAc = unitDevices.guestRoomAc;
  const switchGuestAc = document.getElementById('switchGuestAc');
  const tileGuestAc = document.getElementById('tileGuestAc');
  const subGuestAc = document.getElementById('subGuestAc');

  if (guestAc && switchGuestAc && tileGuestAc) {
    const isOn = guestAc.state === 'ON';
    switchGuestAc.checked = isOn;
    tileGuestAc.className = `device-tile ${isOn ? 'tile-dark' : 'tile-light'}`;
    subGuestAc.innerText = isOn ? `On · ${guestAc.temp}°C` : 'Off';
  }

  // Active count calculation
  let activeCount = 0;
  if (door?.state === 'LOCKED') activeCount++;
  if (ac?.state === 'ON') activeCount++;
  if (lights?.state === 'ON') activeCount++;
  if (guestAc?.state === 'ON') activeCount++;
  document.getElementById('statActiveCount').innerText = `${activeCount} Devices`;
}

async function toggleFrontDoor() {
  const currentState = unitDevices.frontDoor?.state || 'LOCKED';
  const newState = currentState === 'LOCKED' ? 'UNLOCKED' : 'LOCKED';

  await fetch('/api/devices/front-door/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: newState }),
  });
  fetchDevices();
}

async function stepTemp(deviceId, delta) {
  const currentTemp = unitDevices.livingRoomAc?.temp || 23;
  const targetTemp = Math.max(18, Math.min(28, currentTemp + delta));

  await fetch(`/api/devices/${deviceId}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp: targetTemp, state: 'ON' }),
  });
  fetchDevices();
}

async function toggleDevice(deviceId) {
  let newState = 'ON';
  if (deviceId === 'living-ac') {
    newState = unitDevices.livingRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  } else if (deviceId === 'guest-lights') {
    newState = unitDevices.guestRoomLights?.state === 'ON' ? 'OFF' : 'ON';
  } else if (deviceId === 'guest-ac') {
    newState = unitDevices.guestRoomAc?.state === 'ON' ? 'OFF' : 'ON';
  }

  await fetch(`/api/devices/${deviceId}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: newState }),
  });
  fetchDevices();
}

// --------------------------------------------------------------------------
// AI Natural Language Input Bar ("Tell your home what you need…")
// --------------------------------------------------------------------------
function handleAiInputKey(e) {
  if (e.key === 'Enter') {
    submitAiCommand();
  }
}

async function submitAiCommand() {
  const input = document.getElementById('aiCommandInput');
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
      showToast(`✨ ${data.result.responseMessage}`);
      input.value = '';
      fetchDevices();
      fetchPasses();
    }
  } catch (err) {
    console.error('Assistant query error:', err);
  }
}

function showToast(message) {
  const toast = document.getElementById('aiResponseToast');
  toast.innerText = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 6000);
}

function focusAiBar() {
  switchView('resident');
  const bar = document.getElementById('aiCommandInput');
  bar.focus();
  bar.placeholder = 'e.g. Issue Keells pass or Turn off all ACs...';
}

// --------------------------------------------------------------------------
// Hardware & Operator UI Updates
// --------------------------------------------------------------------------
function updateTurnstileUI(data) {
  const badge = document.getElementById('badgeTurnstile');
  const ledRelay = document.getElementById('ledTurnstileRelay');
  const ledSensor = document.getElementById('ledOpticalSensor');
  const msg = document.getElementById('msgTurnstile');

  badge.innerText = data.state;
  badge.className = `status-badge ${data.state === 'ENERGIZED' ? 'status-badge-active' : ''}`;
  msg.innerText = data.message;

  if (data.relayClosed) {
    ledRelay.className = 'led led-green';
  } else {
    ledRelay.className = 'led';
  }

  if (data.opticalSensorTriggered) {
    ledSensor.className = 'led led-blue';
  } else {
    ledSensor.className = 'led';
  }
}

function updateElevatorUI(data) {
  const badge = document.getElementById('badgeElevator');
  const cabin = document.getElementById('elevatorCabin');
  const floorLabel = document.getElementById('cabinFloorLabel');
  const msg = document.getElementById('msgElevator');

  badge.innerText = data.status;
  floorLabel.innerText = `FL ${data.currentFloor}`;
  msg.innerText = data.message;

  // Calculate bottom offset percentage: 0 to 14 floors
  const maxFloor = 14;
  const percent = Math.min(100, Math.max(0, (data.currentFloor / maxFloor) * 80));
  cabin.style.bottom = `${percent}%`;

  if (data.doorsOpen) {
    cabin.style.borderColor = 'var(--status-success)';
  } else {
    cabin.style.borderColor = '#444444';
  }
}

function testTurnstilePulse() {
  fetch('/api/passes/validate-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passId: currentPasses[0]?.passId }),
  });
}

function testElevatorDispatch() {
  fetch('/api/passes/validate-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passId: currentPasses[0]?.passId }),
  });
}

// --------------------------------------------------------------------------
// AI Predictive Health Center
// --------------------------------------------------------------------------
function updateTelemetryReadout(telemetry) {
  document.getElementById('aiVoltageMv').innerText = `${telemetry.voltage_mv} mV`;

  const percent = Math.min(100, Math.max(0, ((telemetry.voltage_mv - 4100) / (6000 - 4100)) * 100));
  const bar = document.getElementById('voltageBar');
  bar.style.width = `${percent}%`;

  if (percent < 30) {
    bar.style.backgroundColor = 'var(--status-danger)';
  } else if (percent < 60) {
    bar.style.backgroundColor = 'var(--status-warning)';
  } else {
    bar.style.backgroundColor = 'var(--status-success)';
  }
}

function updateAiAlertUI(report) {
  latestAiReport = report;

  const dropRateEl = document.getElementById('aiDropRate');
  const zScoreEl = document.getElementById('aiZscore');
  const statusEl = document.getElementById('aiHealthStatus');
  const card = document.getElementById('aiAlertCard');
  const iconEl = document.getElementById('aiAlertIcon');
  const headlineEl = document.getElementById('aiAlertHeadline');
  const subEl = document.getElementById('aiAlertSub');
  const bodyEl = document.getElementById('aiAlertExplainability');
  const woBox = document.getElementById('workOrderBox');
  const woId = document.getElementById('woTicketId');
  const btnInject = document.getElementById('btnInjectAnomaly');

  dropRateEl.innerText = `${report.currentDropRate} mV/act`;
  zScoreEl.innerText = `${report.zScore} σ`;
  statusEl.innerText = report.status;

  if (report.isAnomaly) {
    statusEl.className = 't-val-status status-red';
    card.className = 'ai-alert-card state-anomaly';
    iconEl.innerText = '⚠️';
    headlineEl.innerText = `CRITICAL ANOMALY: Cell Short-Circuit Detected`;
    subEl.innerText = `Deviation: +${report.zScore}σ from rolling baseline. Failure in ~${report.predictedHoursToFailure} hours.`;
    bodyEl.innerText = report.explainabilityText;
    woBox.classList.remove('hidden');
    if (report.workOrder) woId.innerText = report.workOrder.ticketId;
    btnInject.innerText = '✅ Reset Battery to Healthy State';
  } else {
    statusEl.className = 't-val-status status-green';
    card.className = 'ai-alert-card state-normal';
    iconEl.innerText = '✅';
    headlineEl.innerText = `Health Optimal: Lock #1402`;
    subEl.innerText = `Telemetry adhering to 14-day rolling statistical baseline.`;
    bodyEl.innerText = report.explainabilityText;
    woBox.classList.add('hidden');
    btnInject.innerText = '⚠️ Inject Battery Anomaly (Cell Short-Circuit)';
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
  updateTelemetryReadout(data.telemetry);
}

async function applyManualOverride() {
  const res = await fetch('/api/telemetry/manual-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationHours: 24, reason: 'Heavy moving/usage' }),
  });
  const data = await res.json();
  updateAiAlertUI(data.aiAnalysis);
  showToast(data.message);
}

// --------------------------------------------------------------------------
// MQTT Inspector Feed
// --------------------------------------------------------------------------
function appendMqttPacket(packet) {
  const feed = document.getElementById('mqttFeed');
  if (!feed) return;

  const line = document.createElement('div');
  line.className = 'mqtt-line';
  line.innerHTML = `
    <div class="mqtt-line-header">
      <span>TOPIC: ${packet.topic}</span>
      <span>QoS ${packet.qos}</span>
    </div>
    <div class="mqtt-line-payload">${packet.rawPayload}</div>
  `;

  feed.prepend(line);

  // Keep max 50 lines
  while (feed.children.length > 50) {
    feed.removeChild(feed.lastChild);
  }
}

function clearMqttLog() {
  document.getElementById('mqttFeed').innerHTML = '';
}

// --------------------------------------------------------------------------
// Modals & Pass Creation
// --------------------------------------------------------------------------
function openNewPassModal() {
  document.getElementById('modalNewPass').classList.remove('hidden');
}

function closeNewPassModal() {
  document.getElementById('modalNewPass').classList.add('hidden');
}

async function confirmIssuePass() {
  const partner = document.getElementById('selectPartner').value;
  const ttl = parseInt(document.getElementById('selectDuration').value, 10);

  const res = await fetch('/api/passes/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner, ttlMinutes: ttl, unit: '1402' }),
  });

  const data = await res.json();
  if (data.success) {
    closeNewPassModal();
    showToast(`Issued pass for ${partner} (15m window)`);
    fetchPasses();
  }
}

function updateTokenDecoder(pass) {
  document.getElementById('claimPartner').innerText = pass.partner;
}

function simulateLobbyScan() {
  if (currentPasses.length > 0) {
    triggerPassEntry(currentPasses[0].passId);
  }
}

function openRbacModal() {
  switchView('operator');
}
