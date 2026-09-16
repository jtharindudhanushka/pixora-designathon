// ==========================================================================
// TRI-ZEN OS — Isometric Architectural Cutaway Canvas Engine
// Light-mode axonometric building diagram with kinematic elevator & relays
// ==========================================================================

// Standard 2:1 isometric projection helpers. Building space uses (gx, gy, gz):
// gx = position across the footprint, gy = depth into the footprint,
// gz = vertical tier (0 = ground/lobby upward).
const TILE_W = 108; // iso tile half-width footprint unit
const TILE_H = 54; // iso tile half-height footprint unit
const TIER_H = 58; // pixel height of one vertical tier

function isoProject(gx, gy, gz, originX, originY) {
  return {
    x: originX + (gx - gy) * (TILE_W / 2),
    y: originY + (gx + gy) * (TILE_H / 2) - gz * TIER_H,
  };
}

class TwinCanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Isometric scene origin (ground-floor near-corner of the footprint)
    this.originX = this.width / 2 - 40;
    this.originY = this.height - 90;

    // Footprint corners in grid units (a simple rectangular tower plate)
    this.footprint = { x0: 0, y0: 0, x1: 4.2, y1: 2.4 };

    // Tiers mirror the original elevation labels, compressed to 6 stacked levels
    this.tiers = [
      { gz: 0, label: 'LOBBY / PERIMETER · FL 00' },
      { gz: 1, label: 'PODIUM AMENITIES · FL 04' },
      { gz: 2, label: 'MID-RISE TIER · FL 08' },
      { gz: 3, label: 'UPPER RESIDENCES · FL 11' },
      { gz: 4, label: 'RESIDENCE 1402 · FL 14', highlightable: true },
      { gz: 5, label: 'MECHANICAL PENTHOUSE & HOIST' },
    ];

    // Elevator shaft footprint position (within the tower plate)
    this.shaftGx = 2.6;
    this.shaftGy = 1.2;

    // Turnstile position (ground tier, near footprint edge)
    this.turnstileGx = 0.9;
    this.turnstileGy = 2.0;

    // Simulation & motion state
    this.currentStage = 1; // 1: Gate Arrival, 2: Relay Unlock, 3: Lift Ascent, 4: Doorstep
    this.cabinY = 0.0; // 0.0 (ground tier) to 1.0 (Residence 1402 tier)
    this.targetCabinY = 0.0;
    this.turnstileOpen = 0.0; // 0.0 (Closed) to 1.0 (Open)
    this.targetTurnstileOpen = 0.0;
    this.signalPulses = [];
    this.particles = [];

    this.initParticles();
    this.startRenderLoop();
  }

  initParticles() {
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 1.2 + 0.4,
        speed: Math.random() * 0.15 + 0.05,
        alpha: Math.random() * 0.15 + 0.04,
      });
    }
  }

  setStage(stage) {
    this.currentStage = stage;

    switch (stage) {
      case 1: // Gate Arrival
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 1: COURIER ARRIVAL AT LOBBY PERIMETER', 'Awaiting cryptographic token verification at Union Place turnstile...');
        break;

      case 2: // Turnstile Relay Unlock
        this.targetTurnstileOpen = 1.0;
        this.triggerCircuitPulse(0, 0);
        this.updateHudReadout('ENERGIZED (12V)', 'RESERVED (FL 00)', 'SECURED');
        this.updateOverlayTag('STAGE 2: CRYPTOGRAPHIC HANDSHAKE & RELAY TRIGGER', 'Single-use nonce consumed. Turnstile 1 relay energized for 8s.');
        break;

      case 3: // Elevator Ascent
        this.targetTurnstileOpen = 0.0;
        this.targetCabinY = 0.6;
        this.triggerCircuitPulse(1, 1);
        this.updateHudReadout('LOCKED', 'ASCENDING (FL 08)', 'SECURED');
        this.updateOverlayTag('STAGE 3: MITSUBISHI ELEVATOR BANK TRANSIT', 'Cabin ascending via high-speed core traction hoist (2.5 m/s)...');
        break;

      case 4: // Arrival at Floor 14
        this.targetCabinY = 1.0;
        this.triggerCircuitPulse(2, 2);
        this.updateHudReadout('LOCKED', 'ARRIVED (FL 14)', 'UNLATCHED');
        this.updateOverlayTag('STAGE 4: RESIDENCE 1402 CORRIDOR ARRIVAL', 'Courier arrived at Floor 14. Smart Deadbolt auto-cleared for handover.');
        break;
    }
  }

  triggerCircuitPulse(kind) {
    this.signalPulses.push({ kind, progress: 0.0 });
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
    this.cabinY += (this.targetCabinY - this.cabinY) * 0.04;
    this.turnstileOpen += (this.targetTurnstileOpen - this.turnstileOpen) * 0.08;

    for (const p of this.particles) {
      p.y -= p.speed;
      if (p.y < 0) p.y = this.height;
    }

    for (let i = this.signalPulses.length - 1; i >= 0; i--) {
      const pulse = this.signalPulses[i];
      pulse.progress += 0.02;
      if (pulse.progress >= 1.0) this.signalPulses.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Light-mode canvas background + subtle floor grid
    ctx.fillStyle = '#F7F8F9';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGroundPlane(ctx);
    this.drawDustParticles(ctx);

    // Tiers drawn back-to-front, bottom-to-top so higher/farther slabs
    // correctly occlude the ones behind them
    for (const tier of this.tiers) {
      this.drawTierSlab(ctx, tier);
    }

    this.drawElevatorShaft(ctx);
    this.drawTurnstilePod(ctx);
    this.drawResidenceHighlight(ctx);
    this.drawSignalPulses(ctx);
    this.drawHudOverlay(ctx);
  }

  drawDustParticles(ctx) {
    ctx.fillStyle = '#9CA3AF';
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  drawGroundPlane(ctx) {
    const { x0, y0, x1, y1 } = this.footprint;
    const pad = 1.6;
    const corners = [
      isoProject(x0 - pad, y0 - pad, 0, this.originX, this.originY),
      isoProject(x1 + pad, y0 - pad, 0, this.originX, this.originY),
      isoProject(x1 + pad, y1 + pad, 0, this.originX, this.originY),
      isoProject(x0 - pad, y1 + pad, 0, this.originX, this.originY),
    ];
    ctx.fillStyle = '#EEF0F2';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.fill();

    // Iso grid lines on the ground plane
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0 - pad); gx <= x1 + pad; gx++) {
      const a = isoProject(gx, y0 - pad, 0, this.originX, this.originY);
      const b = isoProject(gx, y1 + pad, 0, this.originX, this.originY);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let gy = Math.ceil(y0 - pad); gy <= y1 + pad; gy++) {
      const a = isoProject(x0 - pad, gy, 0, this.originX, this.originY);
      const b = isoProject(x1 + pad, gy, 0, this.originX, this.originY);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.font = '9px "JetBrains Mono"';
    ctx.fillStyle = '#6B7280';
    const labelPt = isoProject(x0 - pad, y1 + pad + 0.3, 0, this.originX, this.originY);
    ctx.fillText('UNION PLACE · TOWER 1 VERTICAL SLICE · ISOMETRIC', labelPt.x, labelPt.y);
  }

  // Draws one stacked "floor slab" as an isometric box: top face + two
  // visible side faces, giving genuine 3D depth instead of a flat elevation.
  drawTierSlab(ctx, tier) {
    const { x0, y0, x1, y1 } = this.footprint;
    const gz = tier.gz;
    const topH = 0.14; // slab thickness in tier units

    const isHighlighted = tier.highlightable && this.currentStage === 4;
    const topFill = isHighlighted ? '#DFF6E8' : '#FFFFFF';
    const sideFillL = isHighlighted ? '#BEEBD1' : '#E5E7EB';
    const sideFillR = isHighlighted ? '#CFF0DE' : '#EDEFF2';
    const strokeColor = isHighlighted ? '#1E9E52' : '#D1D5DB';

    const topCorners = [
      isoProject(x0, y0, gz + topH, this.originX, this.originY),
      isoProject(x1, y0, gz + topH, this.originX, this.originY),
      isoProject(x1, y1, gz + topH, this.originX, this.originY),
      isoProject(x0, y1, gz + topH, this.originX, this.originY),
    ];
    const baseCorners = [
      isoProject(x0, y0, gz, this.originX, this.originY),
      isoProject(x1, y0, gz, this.originX, this.originY),
      isoProject(x1, y1, gz, this.originX, this.originY),
      isoProject(x0, y1, gz, this.originX, this.originY),
    ];

    // Right face (x1,y0 -> x1,y1)
    ctx.fillStyle = sideFillR;
    ctx.beginPath();
    ctx.moveTo(topCorners[1].x, topCorners[1].y);
    ctx.lineTo(topCorners[2].x, topCorners[2].y);
    ctx.lineTo(baseCorners[2].x, baseCorners[2].y);
    ctx.lineTo(baseCorners[1].x, baseCorners[1].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Front-left face (x0,y1 -> x1,y1)
    ctx.fillStyle = sideFillL;
    ctx.beginPath();
    ctx.moveTo(topCorners[3].x, topCorners[3].y);
    ctx.lineTo(topCorners[2].x, topCorners[2].y);
    ctx.lineTo(baseCorners[2].x, baseCorners[2].y);
    ctx.lineTo(baseCorners[3].x, baseCorners[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.fillStyle = topFill;
    ctx.beginPath();
    ctx.moveTo(topCorners[0].x, topCorners[0].y);
    topCorners.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tier label anchored at the top-left edge
    const labelPt = isoProject(x0, y0, gz + topH, this.originX, this.originY);
    ctx.font = isHighlighted ? 'bold 9px "JetBrains Mono"' : '8px "JetBrains Mono"';
    ctx.fillStyle = isHighlighted ? '#1E9E52' : '#6B7280';
    ctx.fillText(tier.label, labelPt.x - 4, labelPt.y - 6);
  }

  // The elevator shaft is drawn as a vertical iso-extruded column cutting
  // through every tier, with the cabin as a small colored box sliding
  // along it based on cabinY.
  drawElevatorShaft(ctx) {
    const ctx2 = ctx;
    const gx = this.shaftGx;
    const gy = this.shaftGy;
    const halfW = 0.35;
    const topZ = this.tiers[this.tiers.length - 1].gz + 0.6;
    const baseZ = 0;

    const corners = (z) => [
      isoProject(gx - halfW, gy - halfW, z, this.originX, this.originY),
      isoProject(gx + halfW, gy - halfW, z, this.originX, this.originY),
      isoProject(gx + halfW, gy + halfW, z, this.originX, this.originY),
      isoProject(gx - halfW, gy + halfW, z, this.originX, this.originY),
    ];

    const top = corners(topZ);
    const base = corners(baseZ);

    // Shaft side faces (right + front-left), translucent so floor labels
    // stay legible behind it
    ctx2.fillStyle = 'rgba(243, 244, 246, 0.9)';
    ctx2.strokeStyle = '#9CA3AF';
    ctx2.lineWidth = 1;

    ctx2.beginPath();
    ctx2.moveTo(top[1].x, top[1].y);
    ctx2.lineTo(top[2].x, top[2].y);
    ctx2.lineTo(base[2].x, base[2].y);
    ctx2.lineTo(base[1].x, base[1].y);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();

    ctx2.beginPath();
    ctx2.moveTo(top[3].x, top[3].y);
    ctx2.lineTo(top[2].x, top[2].y);
    ctx2.lineTo(base[2].x, base[2].y);
    ctx2.lineTo(base[3].x, base[3].y);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();

    // Cap / machine room at the top
    ctx2.fillStyle = '#E5E7EB';
    ctx2.beginPath();
    ctx2.moveTo(top[0].x, top[0].y);
    top.slice(1).forEach((c) => ctx2.lineTo(c.x, c.y));
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();

    // --- Cabin ---
    const cabinZ = baseZ + 0.3 + this.cabinY * (this.tiers[4].gz - 0.3);
    const cCorners = corners(cabinZ + 0.55).concat(corners(cabinZ));
    const isMoving = Math.abs(this.targetCabinY - this.cabinY) > 0.02;
    const cabinFill = isMoving ? 'rgba(59, 130, 246, 0.25)' : 'rgba(30, 158, 82, 0.22)';
    const cabinBorder = isMoving ? '#3B82F6' : '#1E9E52';

    ctx2.fillStyle = cabinFill;
    ctx2.strokeStyle = cabinBorder;
    ctx2.lineWidth = 1.5;

    // cabin right face
    ctx2.beginPath();
    ctx2.moveTo(cCorners[1].x, cCorners[1].y);
    ctx2.lineTo(cCorners[2].x, cCorners[2].y);
    ctx2.lineTo(cCorners[6].x, cCorners[6].y);
    ctx2.lineTo(cCorners[5].x, cCorners[5].y);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();

    // cabin top
    ctx2.beginPath();
    ctx2.moveTo(cCorners[0].x, cCorners[0].y);
    ctx2.lineTo(cCorners[1].x, cCorners[1].y);
    ctx2.lineTo(cCorners[2].x, cCorners[2].y);
    ctx2.lineTo(cCorners[3].x, cCorners[3].y);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();

    const currentFlNumber = Math.round(this.cabinY * 14);
    const labelPt = isoProject(gx - halfW, gy - halfW, cabinZ + 0.55, this.originX, this.originY);
    ctx2.font = 'bold 8px "JetBrains Mono"';
    ctx2.fillStyle = cabinBorder;
    ctx2.fillText(`FL ${currentFlNumber < 10 ? '0' + currentFlNumber : currentFlNumber}`, labelPt.x - 10, labelPt.y - 6);

    if (this.currentStage >= 3) {
      const p = isoProject(gx, gy, cabinZ + 0.28, this.originX, this.originY);
      this.drawPersonSilhouette(ctx2, p.x, p.y, '#111827');
    }
  }

  drawTurnstilePod(ctx) {
    const gx = this.turnstileGx;
    const gy = this.turnstileGy;
    const p = isoProject(gx, gy, 0.16, this.originX, this.originY);

    ctx.font = '8px "JetBrains Mono"';
    ctx.fillStyle = '#6B7280';
    ctx.fillText('LOBBY ACCESS · TURNSTILE 1', p.x - 34, p.y - 30);

    // Two stanchions (small iso boxes)
    const stanchionOffsets = [-0.32, 0.32];
    stanchionOffsets.forEach((off) => {
      const sc = isoProject(gx + off, gy, 0.16, this.originX, this.originY);
      const scBase = isoProject(gx + off, gy, 0, this.originX, this.originY);
      ctx.fillStyle = '#E5E7EB';
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(sc.x - 5, sc.y, 10, scBase.y - sc.y);
      ctx.fill();
      ctx.stroke();
    });

    // Swing arms (kinematic rotation), anchored to each stanchion
    const armAngle = this.turnstileOpen * Math.PI * 0.45;
    ctx.strokeStyle = this.turnstileOpen > 0.1 ? '#1E9E52' : '#3B82F6';
    ctx.lineWidth = 2.5;

    const leftAnchor = isoProject(gx - 0.32, gy, 0.16, this.originX, this.originY);
    ctx.save();
    ctx.translate(leftAnchor.x, leftAnchor.y);
    ctx.rotate(-armAngle * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.restore();

    const rightAnchor = isoProject(gx + 0.32, gy, 0.16, this.originX, this.originY);
    ctx.save();
    ctx.translate(rightAnchor.x, rightAnchor.y);
    ctx.rotate(armAngle * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, 0);
    ctx.stroke();
    ctx.restore();

    if (this.currentStage === 1) {
      const wp = isoProject(gx - 0.7, gy, 0.16, this.originX, this.originY);
      this.drawPersonSilhouette(ctx, wp.x, wp.y, '#4B5563');
    } else if (this.currentStage === 2) {
      const wp = isoProject(gx + 0.1, gy, 0.16, this.originX, this.originY);
      this.drawPersonSilhouette(ctx, wp.x, wp.y, '#1E9E52');
    }
  }

  drawResidenceHighlight(ctx) {
    if (this.currentStage !== 4) return;
    const p = isoProject(this.shaftGx - 0.9, this.footprint.y1 - 0.2, this.tiers[4].gz + 0.4, this.originX, this.originY);

    ctx.fillStyle = '#1E9E52';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();

    this.drawPersonSilhouette(ctx, p.x - 14, p.y + 2, '#1E9E52');

    // Package box
    ctx.fillStyle = '#D97706';
    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
  }

  drawPersonSilhouette(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2.5, y - 7, 5, 10);
  }

  drawSignalPulses(ctx) {
    // Renders a brief expanding ring near the shaft/turnstile to signal a
    // just-fired hardware command, without depending on exact screen coords.
    for (const pulse of this.signalPulses) {
      const anchor = pulse.kind === 0
        ? isoProject(this.turnstileGx, this.turnstileGy, 0.16, this.originX, this.originY)
        : isoProject(this.shaftGx, this.shaftGy, 0.3 + this.cabinY * 3, this.originX, this.originY);
      const radius = 4 + pulse.progress * 22;
      ctx.save();
      ctx.globalAlpha = 1 - pulse.progress;
      ctx.strokeStyle = pulse.kind === 0 ? '#1E9E52' : '#3B82F6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHudOverlay(ctx) {
    ctx.strokeStyle = 'rgba(107, 114, 128, 0.4)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(10, 24); ctx.lineTo(10, 10); ctx.lineTo(24, 10);
    ctx.moveTo(this.width - 24, 10); ctx.lineTo(this.width - 10, 10); ctx.lineTo(this.width - 10, 24);
    ctx.moveTo(10, this.height - 24); ctx.lineTo(10, this.height - 10); ctx.lineTo(24, this.height - 10);
    ctx.moveTo(this.width - 24, this.height - 10); ctx.lineTo(this.width - 10, this.height - 10); ctx.lineTo(this.width - 10, this.height - 24);
    ctx.stroke();
  }
}

// Instantiate globally
window.twinRenderer = new TwinCanvasRenderer('twinCanvas');
