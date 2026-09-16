// ==========================================================================
// TRI-ZEN OS — 3-Pane Digital Twin Simulation Logic
// Seamless physical-digital coordination across Rider, Blueprint, and Resident
// ==========================================================================

let ws;
let activePasses = [];
let unitDevices = {};
let latestAiReport = null;
let currentPassId = null;

document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchInitialData();
  startRiderCountdownTicker();
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
    document.getElementById('mqttStatusLabel').innerText = 'MQTT Bus: Port 1883 Active';
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
    document.getElementById('mqttStatusLabel').innerText = 'Reconnecting to Bus...';
    setTimeout(initWebSocket, 2000);
  };
}

function handleLiveHardwareEvent(packet) {
  const { type, data } = packet;

  switch (type) {
    case 'TURNSTILE_STATE':
      updateBlueprintTurnstile(data);
      break;
    case 'ELEVATOR_STATE':
      updateBlueprintElevator(data);
      break;
    case 'LOCK_TELEMETRY':
      updateAiTelemetryUI(data);
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
      appendBlueprintMqttPacket(data);
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
      const primaryPass = activePasses.find((p) => p.status === 'ACTIVE') || activePasses[0];
      currentPassId = primaryPass.passId;

      // Update Rider pane
      document.getElementById('riderPartnerName').innerText = primaryPass.partner;
      document.getElementById('resCourierName').innerText = primaryPass.partner;

      if (primaryPass.status === 'USED') {
        setStepperStage(4);
      } else {
        setStepperStage(1);
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
// PANE 1 & PANE 2: Courier Scan & Blueprint Physical Animation
// --------------------------------------------------------------------------
async function triggerLobbyScan() {
  if (!currentPassId) {
    alert('No active delivery pass found. Tap "+ Issue Pass" on Maya\'s app.');
    return;
  }

  const feedbackBanner = document.getElementById('gateScanFeedback');
  const feedbackTitle = document.getElementById('feedbackTitle');
  const feedbackSub = document.getElementById('feedbackSub');

  try {
    const res = await fetch('/api/passes/validate-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passId: currentPassId }),
    });

    const data = await res.json();

    feedbackBanner.classList.remove('hidden');

    if (data.success) {
      // Success: Turnstile authorized
      feedbackBanner.className = 'scan-feedback-banner';
      feedbackTitle.innerText = 'Access Granted (Gate 1)';
      feedbackSub.innerText = 'Turnstile 1 unlocked. Mitsubishi Lift A dispatched to Floor 14.';

      // Advance Resident Stepper to "At Gate"
      setStepperStage(2);

      // Trigger Blueprint hardware animations
      animateBlueprintHandshake();

      document.getElementById('riderPassBadge').innerText = 'CONSUMED';
      document.getElementById('riderPassBadge').style.background = 'rgba(59, 130, 246, 0.2)';
      document.getElementById('riderPassBadge').style.color = 'var(--status-accent)';
    } else {
      // Replay Attack or Expired
      feedbackBanner.className = 'scan-feedback-banner feedback-rejected';
      feedbackTitle.innerText = 'Access Denied / Replay Alert';
      feedbackSub.innerText = data.error || 'Token has already been consumed.';
    }
  } catch (err) {
    console.error('Handshake API error:', err);
  }
}

function animateBlueprintHandshake() {
  const armLeft = document.getElementById('armLeft');
  const armRight = document.getElementById('armRight');
  const opticalBeam = document.getElementById('opticalBeam');
  const zoneLobby = document.getElementById('zoneLobby');
  const bpLedRelay = document.getElementById('bpLedRelay');
  const bpRelayState = document.getElementById('bpRelayState');
  const bpCabin = document.getElementById('blueprintCabin');
  const bpCabinFloor = document.getElementById('bpCabinFloor');
  const zoneFloor14 = document.getElementById('zoneFloor14');

  // 1. Turnstile Relay Energizes (0s - 3s)
  zoneLobby.classList.add('zone-active');
  bpLedRelay.className = 'chip-led led-green';
  bpRelayState.innerText = 'ENERGIZED (12V)';
  armLeft.classList.add('retracted');
  armRight.classList.add('retracted');
  opticalBeam.classList.add('beam-broken');

  // 2. Courier passes optical sensor, boards elevator (3.5s)
  setTimeout(() => {
    bpRelayState.innerText = 'PASSAGE DETECTED';
    setStepperStage(3); // Elevator Ascending
    document.getElementById('resDeliveryStatusSub').innerText = 'Courier in Lift Bank A (Floor 4... 14)';

    // Cabin leaves Ground and ascends
    bpCabin.classList.add('cabin-traveling');
    bpCabinFloor.innerText = 'ASCENDING (FL 4)';
    bpCabin.style.bottom = '35%';

    // Relock turnstile
    setTimeout(() => {
      armLeft.classList.remove('retracted');
      armRight.classList.remove('retracted');
      opticalBeam.classList.remove('beam-broken');
      zoneLobby.classList.remove('zone-active');
      bpLedRelay.className = 'chip-led';
      bpRelayState.innerText = 'LOCKED';
    }, 2000);

    // 3. Cabin reaches Floor 14 (7s)
    setTimeout(() => {
      bpCabin.style.bottom = '78%';
      bpCabinFloor.innerText = 'FLOOR 14 (DOORS OPEN)';
      zoneFloor14.classList.add('zone-active');
      setStepperStage(4); // Doorstep
      document.getElementById('resDeliveryStatusSub').innerText = 'Courier arrived at Floor 14 corridor';

      setTimeout(() => {
        bpCabin.classList.remove('cabin-traveling');
        zoneFloor14.classList.remove('zone-active');
      }, 5000);
    }, 3500);

  }, 3500);
}

function updateBlueprintTurnstile(data) {
  const bpLedRelay = document.getElementById('bpLedRelay');
  const bpLedOptical = document.getElementById('bpLedOptical');
  const bpRelayState = document.getElementById('bpRelayState');
  const bpOpticalState = document.getElementById('bpOpticalState');

  bpRelayState.innerText = data.relayClosed ? 'ENERGIZED' : 'LOCKED';
  bpLedRelay.className = data.relayClosed ? 'chip-led led-green' : 'chip-led';

  bpOpticalState.innerText = data.opticalSensorTriggered ? 'BEAM BROKEN' : 'STANDBY';
  bpLedOptical.className = data.opticalSensorTriggered ? 'chip-led led-blue' : 'chip-led';
}

function updateBlueprintElevator(data) {
  const bpCabin = document.getElementById('blueprintCabin');
  const bpCabinFloor = document.getElementById('bpCabinFloor');

  if (data.status === 'TRANSIT_ASCENDING') {
    bpCabinFloor.innerText = `ASCENDING (FL ${data.currentFloor})`;
    bpCabin.classList.add('cabin-traveling');
  } else if (data.status === 'ARRIVED_DESTINATION') {
    bpCabinFloor.innerText = `FLOOR ${data.currentFloor} (DOORS OPEN)`;
    bpCabin.classList.remove('cabin-traveling');
  } else {
    bpCabinFloor.innerText = `FLOOR ${data.currentFloor} (${data.status})`;
  }
}

// --------------------------------------------------------------------------
// PANE 3: Resident Stepper & Device Controls
// --------------------------------------------------------------------------
function setStepperStage(stage) {
  const s1 = document.getElementById('step1');
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  const s4 = document.getElementById('step4');
  const c1 = document.getElementById('conn1');
  const c2 = document.getElementById('conn2');
  const c3 = document.getElementById('conn3');

  // Reset
  [s1, s2, s3, s4].forEach((s) => (s.className = 'step-node'));
  [c1, c2, c3].forEach((c) => (c.className = 'step-connector'));

  if (stage >= 1) s1.className = 'step-node completed';
  if (stage >= 2) {
    c1.className = 'step-connector completed';
    s2.className = 'step-node completed';
  }
  if (stage >= 3) {
    c2.className = 'step-connector completed';
    s3.className = 'step-node completed';
  }
  if (stage >= 4) {
    c3.className = 'step-connector completed';
    s4.className = 'step-node completed';
    document.getElementById('resDeliveryBadge').innerText = 'Delivered';
    document.getElementById('resDeliveryBadge').style.background = '#E8F0FE';
    document.getElementById('resDeliveryBadge').style.color = '#1A73E8';
  }
}

function renderResidentDevices() {
  if (!unitDevices) return;

  // Front Door
  const door = unitDevices.frontDoor;
  const tileDoor = document.getElementById('tileDoor');
  const tagDoor = document.getElementById('tileDoorTag');
  const statDoor = document.getElementById('resDoorLockState');
  const bpDoorTag = document.getElementById('bpDoorTag');

  if (door && tileDoor && tagDoor) {
    const isLocked = door.state === 'LOCKED';
    tileDoor.className = `device-tile-card ${isLocked ? 'tile-black' : 'tile-white'}`;
    tagDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
    tagDoor.style.color = isLocked ? 'var(--status-success)' : 'var(--status-danger)';
    if (statDoor) statDoor.innerText = isLocked ? 'Locked' : 'Unlocked';
    if (bpDoorTag) bpDoorTag.innerText = isLocked ? 'DOOR LOCKED' : 'DOOR UNLOCKED';
  }

  // Living Room AC
  const ac = unitDevices.livingRoomAc;
  const tileAc = document.getElementById('tileAc');
  const valAc = document.getElementById('resAcTemp');
  const subAc = document.getElementById('resAcModeSub');
  const statTemp = document.getElementById('resInsideTemp');

  if (ac && tileAc && valAc) {
    const isOn = ac.state === 'ON';
    tileAc.className = `device-tile-card ${isOn ? 'tile-black' : 'tile-white'}`;
    valAc.innerText = `${ac.temp}°C`;
    subAc.innerText = isOn ? 'Cool · Eco Mode' : 'Off';
    if (statTemp) statTemp.innerText = `${ac.temp}°C`;
  }

  // Guest Lights
  const lights = unitDevices.guestRoomLights;
  const switchLights = document.getElementById('switchLights');
  const tileLights = document.getElementById('tileLights');
  const subLights = document.getElementById('resLightsSub');

  if (lights && switchLights && tileLights) {
    const isOn = lights.state === 'ON';
    switchLights.checked = isOn;
    tileLights.className = `device-tile-card ${isOn ? 'tile-black' : 'tile-white'}`;
    subLights.innerText = isOn ? 'On · 80%' : 'Off';
  }

  // Guest AC
  const guestAc = unitDevices.guestRoomAc;
  const switchGuestAc = document.getElementById('switchGuestAc');
  const tileGuestAc = document.getElementById('tileGuestAc');
  const subGuestAc = document.getElementById('resGuestAcSub');

  if (guestAc && switchGuestAc && tileGuestAc) {
    const isOn = guestAc.state === 'ON';
    switchGuestAc.checked = isOn;
    tileGuestAc.className = `device-tile-card ${isOn ? 'tile-black' : 'tile-white'}`;
    subGuestAc.innerText = isOn ? `On · ${guestAc.temp}°C` : 'Off';
  }

  // Count active devices
  let count = 0;
  if (door?.state === 'LOCKED') count++;
  if (ac?.state === 'ON') count++;
  if (lights?.state === 'ON') count++;
  if (guestAc?.state === 'ON') count++;
  document.getElementById('resActiveDevices').innerText = `${count} Devices`;
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

async function stepAc(delta) {
  const currentTemp = unitDevices.livingRoomAc?.temp || 23;
  const target = Math.max(18, Math.min(28, currentTemp + delta));

  await fetch('/api/devices/living-ac/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp: target, state: 'ON' }),
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
// Natural Language AI Input Bar ("Tell your home what you need…")
// --------------------------------------------------------------------------
function handleResidentAiKey(e) {
  if (e.key === 'Enter') submitResidentAi();
}

async function submitResidentAi() {
  const input = document.getElementById('residentAiInput');
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
      showResidentToast(`✨ ${data.result.responseMessage}`);
      input.value = '';
      fetchDevices();
      fetchPasses();
    }
  } catch (err) {
    console.error('Assistant error:', err);
  }
}

function showResidentToast(msg) {
  const toast = document.getElementById('residentAiToast');
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 5000);
}

function focusResidentAi() {
  const input = document.getElementById('residentAiInput');
  input.focus();
  input.placeholder = 'e.g. Prep home for Keells delivery or Turn off ACs...';
}

// --------------------------------------------------------------------------
// PANE 1: Rider Countdown Progress
// --------------------------------------------------------------------------
function startRiderCountdownTicker() {
  setInterval(() => {
    if (activePasses.length === 0) return;
    const pass = activePasses[0];
    const now = Date.now();
    const remainingMs = Math.max(0, pass.expiresAt - now);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);

    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    document.getElementById('riderRemainingTime').innerText = timeStr;

    const total = pass.expiresAt - pass.issuedAt;
    const elapsed = now - pass.issuedAt;
    const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
    document.getElementById('riderProgressFill').style.width = `${percent}%`;
  }, 1000);
}

// --------------------------------------------------------------------------
// PANE 2: Live MQTT Packet Stream Terminal
// --------------------------------------------------------------------------
function appendBlueprintMqttPacket(packet) {
  const terminal = document.getElementById('bpMqttTerminal');
  if (!terminal) return;

  const row = document.createElement('div');
  row.className = 'terminal-row';

  const d = new Date(packet.timestamp || Date.now());
  const timeStr = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

  row.innerHTML = `
    <span class="term-time">${timeStr}</span>
    <span class="term-topic">${packet.topic}</span>
    <span class="term-msg">${packet.rawPayload}</span>
  `;

  terminal.prepend(row);

  while (terminal.children.length > 40) {
    terminal.removeChild(terminal.lastChild);
  }
}

// --------------------------------------------------------------------------
// FACILITIES & AI PREDICTIVE DRAWER
// --------------------------------------------------------------------------
function toggleFacilitiesDrawer() {
  const drawer = document.getElementById('facilitiesDrawer');
  drawer.classList.toggle('hidden');
}

function updateAiTelemetryUI(telemetry) {
  const voltEl = document.getElementById('drawerVoltage');
  const barEl = document.getElementById('drawerVoltsBar');
  if (voltEl) voltEl.innerText = `${telemetry.voltage_mv} mV`;

  if (barEl) {
    const percent = Math.min(100, Math.max(0, ((telemetry.voltage_mv - 4100) / (6000 - 4100)) * 100));
    barEl.style.width = `${percent}%`;
  }
}

function updateAiAlertUI(report) {
  latestAiReport = report;

  const dropEl = document.getElementById('drawerDropRate');
  const zEl = document.getElementById('drawerZscore');
  const statusEl = document.getElementById('drawerStatusTag');
  const card = document.getElementById('drawerAlertCard');
  const icon = document.getElementById('drawerAlertIcon');
  const title = document.getElementById('drawerAlertTitle');
  const desc = document.getElementById('drawerAlertDesc');
  const wo = document.getElementById('drawerWorkOrder');
  const btnInject = document.getElementById('btnDrawerInject');
  const pulse = document.getElementById('aiDrawerPulse');

  if (!dropEl) return;

  dropEl.innerText = `${report.currentDropRate} mV/act`;
  zEl.innerText = `${report.zScore} σ`;
  statusEl.innerText = report.status;

  if (report.isAnomaly) {
    statusEl.className = 'unit-status-green unit-status-red';
    card.className = 'explainable-alert-card anomaly-state';
    icon.innerText = '!';
    title.innerText = 'CRITICAL ANOMALY: Cell Short-Circuit';
    desc.innerText = report.explainabilityText;
    wo.classList.remove('hidden');
    if (report.workOrder) {
      document.getElementById('drawerTicketId').innerText = report.workOrder.ticketId;
    }
    btnInject.innerText = '✓ Reset Battery to Normal Healthy Baseline';
    if (pulse) pulse.style.background = 'var(--status-danger)';
  } else {
    statusEl.className = 'unit-status-green';
    card.className = 'explainable-alert-card normal-state';
    icon.innerText = '✓';
    title.innerText = 'Health Optimal: Lock #1402';
    desc.innerText = report.explainabilityText;
    wo.classList.add('hidden');
    btnInject.innerText = '⚠️ Inject Accelerated Battery Short-Circuit (~42 mV/actuation)';
    if (pulse) pulse.style.background = 'var(--status-success)';
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
  alert('1-Tap Override Applied: Tolerance threshold widened without compromising security.');
}

// --------------------------------------------------------------------------
// Modal Pass Creation
// --------------------------------------------------------------------------
function openPassModal() {
  document.getElementById('modalNewPass').classList.remove('hidden');
}

function closePassModal() {
  document.getElementById('modalNewPass').classList.add('hidden');
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
    document.getElementById('riderPartnerName').innerText = partner;
    document.getElementById('resCourierName').innerText = partner;
  }
}
