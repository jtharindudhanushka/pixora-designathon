// ==========================================================================
// TRI-ZEN OS — 3D Documentary Architectural Cutaway Canvas Engine
// Technical isometric wireframe rendering with kinematic elevator & relays
// ==========================================================================

class TwinCanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Simulation & Motion state
    this.currentStage = 1; // 1: Gate Arrival, 2: Relay Unlock, 3: Lift Ascent, 4: Doorstep
    this.cabinY = 0.0; // 0.0 (Lobby) to 1.0 (Floor 14)
    this.targetCabinY = 0.0;
    this.counterweightY = 1.0;
    this.turnstileOpen = 0.0; // 0.0 (Closed) to 1.0 (Open)
    this.targetTurnstileOpen = 0.0;
    this.cableOffset = 0;
    this.signalPulses = [];
    this.particles = [];
    this.pulseColor = '#2ECC71';

    // Camera / Pan animation
    this.focusY = 0.0; // 0.0 (Ground focus) to 1.0 (Floor 14 focus)
    this.targetFocusY = 0.0;

    this.initParticles();
    this.startRenderLoop();
  }

  initParticles() {
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
  }

  setStage(stage) {
    this.currentStage = stage;

    switch (stage) {
      case 1: // Gate Arrival
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.targetFocusY = 0.1;
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 1: COURIER ARRIVAL AT LOBBY PERIMETER', 'Awaiting cryptographic token verification at Union Place turnstile...');
        break;

      case 2: // Turnstile Relay Unlock
        this.targetTurnstileOpen = 1.0;
        this.targetFocusY = 0.2;
        this.triggerCircuitPulse(180, 520, 450, 480, '#2ECC71');
        this.updateHudReadout('ENERGIZED (12V)', 'RESERVED (FL 00)', 'SECURED');
        this.updateOverlayTag('STAGE 2: CRYPTOGRAPHIC HANDSHAKE & RELAY TRIGGER', 'Single-use nonce consumed. Turnstile 1 relay energized for 8s.');
        break;

      case 3: // Elevator Ascent
        this.targetTurnstileOpen = 0.0;
        this.targetCabinY = 0.6; // In transit
        this.targetFocusY = 0.5;
        this.triggerCircuitPulse(450, 480, 450, 200, '#3B82F6');
        this.updateHudReadout('LOCKED', 'ASCENDING (FL 08)', 'SECURED');
        this.updateOverlayTag('STAGE 3: MITSUBISHI ELEVATOR BANK TRANSIT', 'Cabin ascending via high-speed core traction hoist (2.5 m/s)...');
        break;

      case 4: // Arrival at Floor 14
        this.targetCabinY = 1.0;
        this.targetFocusY = 0.85;
        this.triggerCircuitPulse(450, 160, 720, 160, '#2ECC71');
        this.updateHudReadout('LOCKED', 'ARRIVED (FL 14)', 'UNLATCHED');
        this.updateOverlayTag('STAGE 4: RESIDENCE 1402 CORRIDOR ARRIVAL', 'Courier arrived at Floor 14. Smart Deadbolt auto-cleared for handover.');
        break;
    }
  }

  triggerCircuitPulse(x1, y1, x2, y2, color = '#2ECC71') {
    this.signalPulses.push({
      x1, y1, x2, y2,
      progress: 0.0,
      color,
    });
  }

  updateHudReadout(relay, lift, door) {
    const elRelay = document.getElementById('hudRelay');
    const elLift = document.getElementById('hudLift');
    const elDoor = document.getElementById('hudDoor');
    if (elRelay) elRelay.innerText = relay;
    if (elLift) elLift.innerText = lift;
    if (elDoor) elDoor.innerText = door;
  }

  updateOverlayTag(title, desc) {
    const tag = document.getElementById('overlayStageTag');
    const d = document.getElementById('overlayStageDesc');
    if (tag) tag.innerText = title;
    if (d) d.innerText = desc;
  }

  startRenderLoop() {
    const loop = () => {
      this.updatePhysics();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updatePhysics() {
    // Smooth kinematic easing
    this.cabinY += (this.targetCabinY - this.cabinY) * 0.04;
    this.counterweightY = 1.0 - this.cabinY;
    this.turnstileOpen += (this.targetTurnstileOpen - this.turnstileOpen) * 0.08;
    this.focusY += (this.targetFocusY - this.focusY) * 0.03;
    this.cableOffset = (this.cableOffset + 0.5) % 12;

    // Ambient floating particles
    for (const p of this.particles) {
      p.y -= p.speed;
      if (p.y < 0) p.y = this.height;
    }

    // Circuit pulses
    for (let i = this.signalPulses.length - 1; i >= 0; i--) {
      const pulse = this.signalPulses[i];
      pulse.progress += 0.025;
      if (pulse.progress >= 1.0) {
        this.signalPulses.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Camera vertical pan offset
    const camOffsetY = (this.focusY - 0.5) * 80;

    ctx.save();
    ctx.translate(0, -camOffsetY);

    // 1. Dark Technical Architectural Grid
    this.drawCadGrid(ctx);

    // 2. Ambient CAD dust particles
    this.drawDustParticles(ctx);

    // 3. Ground Elevation & Street Profile (Union Place)
    this.drawGroundLevel(ctx);

    // 4. Structural Tower Slabs & Frame
    this.drawStructuralSlabs(ctx);

    // 5. Central Elevator Core (Rails, Motor, Cables, Cabin, Counterweight)
    this.drawElevatorCore(ctx);

    // 6. Ground Turnstile Barrier & Optical Sensors
    this.drawTurnstilePod(ctx);

    // 7. Floor 14 Residence 1402 Cutaway Layout
    this.drawResidence1402(ctx);

    // 8. Circuit Signal Pulses (Glowing data telemetry)
    this.drawSignalPulses(ctx);

    ctx.restore();

    // 9. Static Technical Overlays (Vignette & Coordinate Crosshairs)
    this.drawHudOverlay(ctx);
  }

  drawCadGrid(ctx) {
    ctx.strokeStyle = 'rgba(25, 38, 58, 0.4)';
    ctx.lineWidth = 1;

    const gridSize = 30;
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height + 100);
      ctx.stroke();
    }

    for (let y = 0; y < this.height + 100; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  drawDustParticles(ctx) {
    ctx.fillStyle = '#4A6B8F';
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  drawGroundLevel(ctx) {
    const groundY = 530;

    // Union Place street surface
    ctx.fillStyle = '#090D14';
    ctx.fillRect(0, groundY, this.width, this.height - groundY + 100);

    // Street datum line
    ctx.strokeStyle = '#2B3D59';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.width, groundY);
    ctx.stroke();

    // Roadway markings (Union Place)
    ctx.strokeStyle = 'rgba(74, 107, 143, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(20, groundY + 45);
    ctx.lineTo(260, groundY + 45);
    ctx.stroke();
    ctx.setLineDash([]);

    // Street Label
    ctx.font = '9px "JetBrains Mono"';
    ctx.fillStyle = '#5A7B9E';
    ctx.fillText('UNION PLACE VEHICULAR & PEDESTRIAN ACCESS · EL +0.00m', 30, groundY + 30);
  }

  drawStructuralSlabs(ctx) {
    const floors = [
      { y: 530, label: 'LOBBY / PERIMETER (FL 00)' },
      { y: 440, label: 'PODIUM AMENITIES (FL 04)' },
      { y: 340, label: 'MID-RISE TIER (FL 08)' },
      { y: 240, label: 'UPPER RESIDENCES (FL 11)' },
      { y: 150, label: 'PREMIUM ZONE · RESIDENCE 1402 (FL 14)' },
      { y: 70, label: 'MECHANICAL PENTHOUSE & TRACTION HOIST' },
    ];

    for (const fl of floors) {
      // Concrete slab cross-section
      ctx.fillStyle = '#0E1724';
      ctx.fillRect(80, fl.y, 740, 8);

      ctx.strokeStyle = '#1D2D42';
      ctx.lineWidth = 1;
      ctx.strokeRect(80, fl.y, 740, 8);

      // Floor Label
      ctx.font = '8px "JetBrains Mono"';
      ctx.fillStyle = '#446688';
      ctx.fillText(fl.label, 86, fl.y - 4);
    }

    // Outer structural column lines
    ctx.strokeStyle = 'rgba(30, 48, 72, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 60);
    ctx.lineTo(80, 530);
    ctx.moveTo(820, 60);
    ctx.lineTo(820, 530);
    ctx.stroke();
  }

  drawElevatorCore(ctx) {
    const shaftX = 390;
    const shaftWidth = 110;
    const topY = 78;
    const bottomY = 530;
    const travelDistance = bottomY - topY - 60; // 392px travel

    // 1. Shaft Steel Truss Enclosure
    ctx.fillStyle = 'rgba(7, 12, 20, 0.85)';
    ctx.fillRect(shaftX, topY, shaftWidth, bottomY - topY);

    ctx.strokeStyle = '#1B2C42';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(shaftX, topY, shaftWidth, bottomY - topY);

    // Guide Rails
    ctx.strokeStyle = '#263C59';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shaftX + 8, topY);
    ctx.lineTo(shaftX + 8, bottomY);
    ctx.moveTo(shaftX + shaftWidth - 8, topY);
    ctx.lineTo(shaftX + shaftWidth - 8, bottomY);
    ctx.stroke();

    // 2. Machine Room Pulley at Top
    const pulleyX = shaftX + shaftWidth / 2;
    const pulleyY = topY + 16;

    ctx.strokeStyle = '#3E5C82';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pulleyX, pulleyY, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Pulley spokes
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pulleyX - 14, pulleyY);
    ctx.lineTo(pulleyX + 14, pulleyY);
    ctx.moveTo(pulleyX, pulleyY - 14);
    ctx.lineTo(pulleyX, pulleyY + 14);
    ctx.stroke();

    // 3. Cabin Y Position (Inverted: 0.0 is Lobby bottomY, 1.0 is Floor 14 top)
    const cabinHeight = 44;
    const cabinActualY = (bottomY - cabinHeight - 4) - this.cabinY * (travelDistance - 40);

    // Hoist Steel Cables
    ctx.strokeStyle = '#5B7C9E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Cable from pulley to cabin
    ctx.moveTo(pulleyX - 6, pulleyY);
    ctx.lineTo(pulleyX - 6, cabinActualY);
    // Cable from pulley to counterweight
    const cwActualY = topY + 30 + this.counterweightY * (travelDistance - 40);
    ctx.moveTo(pulleyX + 12, pulleyY);
    ctx.lineTo(pulleyX + 12, cwActualY);
    ctx.stroke();

    // Counterweight block
    ctx.fillStyle = '#1D2A3D';
    ctx.strokeStyle = '#364D6E';
    ctx.lineWidth = 1;
    ctx.fillRect(shaftX + shaftWidth - 22, cwActualY, 14, 30);
    ctx.strokeRect(shaftX + shaftWidth - 22, cwActualY, 14, 30);

    // 4. Illuminated Glass Elevator Cabin
    const cabinX = shaftX + 12;
    const cabinW = shaftWidth - 36;

    const isMoving = Math.abs(this.targetCabinY - this.cabinY) > 0.02;
    const cabinColor = isMoving ? 'rgba(59, 130, 246, 0.25)' : 'rgba(46, 204, 113, 0.2)';
    const cabinBorder = isMoving ? '#3B82F6' : '#2ECC71';

    // Cabin Glow
    ctx.shadowColor = cabinBorder;
    ctx.shadowBlur = isMoving ? 15 : 8;

    ctx.fillStyle = cabinColor;
    ctx.fillRect(cabinX, cabinActualY, cabinW, cabinHeight);

    ctx.strokeStyle = cabinBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cabinX, cabinActualY, cabinW, cabinHeight);
    ctx.shadowBlur = 0; // reset

    // Glass panel window cross lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cabinX + 4, cabinActualY + 4, cabinW - 8, cabinHeight - 8);

    // Passenger / Courier Silhouette in Elevator
    if (this.currentStage >= 3) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      // Head
      ctx.arc(cabinX + cabinW / 2, cabinActualY + 16, 4, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillRect(cabinX + cabinW / 2 - 4, cabinActualY + 22, 8, 14);
    }

    // Live Floor Indicator on Cabin
    ctx.font = '7px "JetBrains Mono"';
    ctx.fillStyle = '#FFFFFF';
    const currentFlNumber = Math.round(this.cabinY * 14);
    ctx.fillText(`FL ${currentFlNumber < 10 ? '0' + currentFlNumber : currentFlNumber}`, cabinX + 6, cabinActualY + 12);
  }

  drawTurnstilePod(ctx) {
    const gateX = 170;
    const gateY = 480;

    // Security Gate Canopy
    ctx.fillStyle = 'rgba(18, 27, 40, 0.9)';
    ctx.strokeStyle = '#273B54';
    ctx.lineWidth = 1;
    ctx.strokeRect(gateX - 20, gateY - 10, 160, 56);

    ctx.font = '8px "JetBrains Mono"';
    ctx.fillStyle = '#7A9EC2';
    ctx.fillText('LOBBY ACCESS · TURNSTILE 1', gateX - 12, gateY);

    // Left & Right Housing Stanchions
    ctx.fillStyle = '#1B283B';
    ctx.strokeStyle = '#3B5578';
    ctx.fillRect(gateX, gateY + 8, 20, 36);
    ctx.strokeRect(gateX, gateY + 8, 20, 36);

    ctx.fillRect(gateX + 90, gateY + 8, 20, 36);
    ctx.strokeRect(gateX + 90, gateY + 8, 20, 36);

    // Swing Glass Barrier Arm (Kinematic rotation)
    const armAngle = this.turnstileOpen * Math.PI * 0.45; // 0 to 80 deg
    ctx.strokeStyle = this.turnstileOpen > 0.1 ? '#2ECC71' : '#3B82F6';
    ctx.lineWidth = 3;

    // Left barrier arm
    ctx.save();
    ctx.translate(gateX + 20, gateY + 24);
    ctx.rotate(-armAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(32, 0);
    ctx.stroke();
    ctx.restore();

    // Right barrier arm
    ctx.save();
    ctx.translate(gateX + 90, gateY + 24);
    ctx.rotate(armAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-32, 0);
    ctx.stroke();
    ctx.restore();

    // Optical Beam (between stanchions)
    if (this.turnstileOpen < 0.2) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gateX + 20, gateY + 24);
      ctx.lineTo(gateX + 90, gateY + 24);
      ctx.stroke();
    }

    // Courier Silhouette approaching or walking through
    if (this.currentStage === 1) {
      // Waiting at Gate
      this.drawPersonSilhouette(ctx, gateX - 8, gateY + 24, '#E0E0E0');
    } else if (this.currentStage === 2) {
      // Walking through Turnstile
      this.drawPersonSilhouette(ctx, gateX + 55, gateY + 24, '#2ECC71');
    }
  }

  drawResidence1402(ctx) {
    const resX = 540;
    const resY = 110;
    const resW = 260;
    const resH = 40;

    // Unit 1402 Architectural Plan Box
    const isAtDoor = this.currentStage === 4;
    ctx.fillStyle = isAtDoor ? 'rgba(20, 35, 25, 0.85)' : 'rgba(14, 22, 36, 0.7)';
    ctx.strokeStyle = isAtDoor ? '#2ECC71' : '#273C57';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(resX, resY, resW, resH);

    // Architectural Door Swing Arc (Yale Smart Lock)
    const doorX = resX + 16;
    const doorY = resY + resH;

    ctx.font = '8px "JetBrains Mono"';
    ctx.fillStyle = isAtDoor ? '#2ECC71' : '#88AACC';
    ctx.fillText('RESIDENCE 1402 · YALE SMART DEADBOLT', resX + 10, resY + 14);

    // Door frame
    ctx.strokeStyle = isAtDoor ? '#2ECC71' : '#4E729E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(doorX, doorY - 18);
    ctx.lineTo(doorX, doorY);
    ctx.stroke();

    // Door leaf open arc
    if (isAtDoor) {
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(doorX, doorY, 18, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Courier arrived at Doorstep
      this.drawPersonSilhouette(ctx, doorX - 16, doorY - 8, '#2ECC71');

      // Package / Grocery Delivery Box
      ctx.fillStyle = '#D35400';
      ctx.fillRect(doorX + 2, doorY - 8, 8, 8);
    } else {
      // Locked Deadbolt Indicator
      ctx.fillStyle = '#2ECC71';
      ctx.beginPath();
      ctx.arc(doorX, doorY - 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPersonSilhouette(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 3, y - 4, 6, 12);
  }

  drawSignalPulses(ctx) {
    for (const pulse of this.signalPulses) {
      const curX = pulse.x1 + (pulse.x2 - pulse.x1) * pulse.progress;
      const curY = pulse.y1 + (pulse.y2 - pulse.y1) * pulse.progress;

      ctx.save();
      ctx.shadowColor = pulse.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pulse.color;
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHudOverlay(ctx) {
    // Technical Corner Reticles
    ctx.strokeStyle = 'rgba(90, 123, 160, 0.4)';
    ctx.lineWidth = 1;

    // Top-Left Reticle
    ctx.beginPath();
    ctx.moveTo(10, 24); ctx.lineTo(10, 10); ctx.lineTo(24, 10);
    // Top-Right Reticle
    ctx.moveTo(this.width - 24, 10); ctx.lineTo(this.width - 10, 10); ctx.lineTo(this.width - 10, 24);
    // Bottom-Left Reticle
    ctx.moveTo(10, this.height - 24); ctx.lineTo(10, this.height - 10); ctx.lineTo(24, this.height - 10);
    // Bottom-Right Reticle
    ctx.moveTo(this.width - 24, this.height - 10); ctx.lineTo(this.width - 10, this.height - 10); ctx.lineTo(this.width - 10, this.height - 24);
    ctx.stroke();
  }
}

// Instantiate globally
window.twinRenderer = new TwinCanvasRenderer('twinCanvas');
