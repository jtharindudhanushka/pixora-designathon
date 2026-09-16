// ==========================================================================
// TRI-ZEN OS — 3D Architectural Digital Twin WebGL Engine (Three.js)
// Light Studio Aesthetic · Matte Dark Architectural Models · Lift Core & Residence 1402
// Dynamic Cinematic Camera Tracking for Simulation Stages
// ==========================================================================

class TwinCanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`[DigitalTwin] Canvas #${canvasId} not found.`);
      return;
    }

    // Motion & simulation states
    this.currentStage = 0; // 0: Standby, 1: Gate, 2: Token/Relay, 3: Lift, 4: Doorstep
    this.cabinY = 0.0; // 0.0 (Ground FL 00) to 1.0 (FL 14 Residence)
    this.targetCabinY = 0.0;
    this.turnstileOpen = 0.0; // 0.0 (Closed) to 1.0 (Open 90deg)
    this.targetTurnstileOpen = 0.0;
    this.doorOpen = 0.0; // 0.0 (Locked/Closed) to 1.0 (Ajar/Open 50deg)
    this.targetDoorOpen = 0.0;

    // Camera preset mode: 'auto' | 'tower' | 'lobby' | 'lift' | 'residence'
    this.cameraMode = 'auto';

    // Cinematic camera targets for simulation stages
    this.cameraStageTargets = {
      // Stage 0: Full Tower Overview (Hero 3/4 beauty view)
      0: { pos: new THREE.Vector3(21, 15, 23), look: new THREE.Vector3(0, 9.5, 0) },
      // Stage 1: Ground Plaza & Turnstile 1 Entrance
      1: { pos: new THREE.Vector3(1.4, 2.2, 7.4), look: new THREE.Vector3(0, 0.9, 2.8) },
      // Stage 2: Turnstile 1 Handshake Hero Shot (Scanner pulse + flapper swing)
      2: { pos: new THREE.Vector3(-1.8, 1.8, 4.8), look: new THREE.Vector3(0, 0.7, 2.8) },
      // Stage 3: Elevator Ascent Base Angle (dynamically tracks upward during motion)
      3: { pos: new THREE.Vector3(10.5, 8.5, 12.5), look: new THREE.Vector3(-1.2, 7.0, 0) },
      // Stage 4: Residence 1402 Cutaway Suite (Direct view into doorway & smart lock)
      4: { pos: new THREE.Vector3(2.6, 15.6, 4.0), look: new THREE.Vector3(0.5, 14.8, 0) }
    };

    // Static camera presets for manual user switching
    this.cameraPresets = {
      tower: { pos: new THREE.Vector3(21, 15, 23), look: new THREE.Vector3(0, 9.5, 0) },
      lobby: { pos: new THREE.Vector3(1.4, 2.2, 7.4), look: new THREE.Vector3(0, 0.9, 2.8) },
      lift: { pos: new THREE.Vector3(7.5, 9.0, 9.5), look: new THREE.Vector3(-1.2, 8.0, 0) },
      residence: { pos: new THREE.Vector3(2.6, 15.6, 4.0), look: new THREE.Vector3(0.5, 14.8, 0) }
    };

    this.currentCamTarget = {
      pos: this.cameraStageTargets[0].pos.clone(),
      look: this.cameraStageTargets[0].look.clone()
    };

    this.isUserInteracting = false;
    this.userInteractionTimeout = null;

    this.signalPulses = [];
    this.displayedFloor = 0;

    this.initThree();
    this.buildScene();
    this.setupEventListeners();
    this.startRenderLoop();
  }

  initThree() {
    const width = this.canvas.clientWidth || 900;
    const height = this.canvas.clientHeight || 620;

    // 1. Scene with light studio background & soft atmospheric depth
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f5f9); // Clean architectural slate-white
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    // 2. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    this.camera.position.copy(this.cameraStageTargets[0].pos);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // 4. OrbitControls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.target.copy(this.cameraStageTargets[0].look);
      this.controls.maxPolarAngle = Math.PI / 2 + 0.02; // prevent clipping beneath plinth
      this.controls.minDistance = 3.0;
      this.controls.maxDistance = 70;

      this.controls.addEventListener('start', () => {
        this.isUserInteracting = true;
        if (this.userInteractionTimeout) clearTimeout(this.userInteractionTimeout);
      });
      this.controls.addEventListener('end', () => {
        // Return to auto camera interpolation after 4 seconds of inactivity
        this.userInteractionTimeout = setTimeout(() => {
          this.isUserInteracting = false;
        }, 4000);
      });
    }

    // 5. Lighting Setup for Light Background + Dark Models
    this.setupLighting();
  }

  setupLighting() {
    // 1. Crisp white studio ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(ambientLight);

    // 2. Key Sun Light (Warm white, sharp contrast on dark model edges)
    const keySun = new THREE.DirectionalLight(0xfffaed, 1.45);
    keySun.position.set(24, 45, 20);
    this.scene.add(keySun);

    // 3. Fill Light (Cool sky bounce)
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.6);
    fillLight.position.set(-20, 25, -20);
    this.scene.add(fillLight);

    // 4. Soft Ground Bounce
    const groundBounce = new THREE.DirectionalLight(0xe2e8f0, 0.35);
    groundBounce.position.set(0, -10, 0);
    this.scene.add(groundBounce);

    // 5. Turnstile Security Light (Electric Cyan / Green)
    this.turnstileLight = new THREE.PointLight(0x0284c7, 2.2, 10);
    this.turnstileLight.position.set(0, 1.2, 2.8);
    this.scene.add(this.turnstileLight);

    // 6. Residence 1402 Warm Amber Interior Cove Light
    this.residenceLight = new THREE.PointLight(0xf59e0b, 2.5, 9);
    this.residenceLight.position.set(1.4, 15.0, 0.2);
    this.scene.add(this.residenceLight);

    // 7. High-Intensity Elevator Cabin Xenon Glow (Travels with cabin)
    this.cabinLight = new THREE.PointLight(0x38bdf8, 3.2, 8);
    this.cabinLight.position.set(-1.2, 0.6, 0);
    this.scene.add(this.cabinLight);
  }

  buildScene() {
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.buildGroundPlaza();
    this.buildSkyscraperStructure();
    this.buildElevatorCore();
    this.buildTurnstileGate();
    this.buildResidence1402();
    this.build3DLocationBeacon();
  }

  buildGroundPlaza() {
    // 1. Architectural Plinth (Clean light stone podium)
    const plinthGeo = new THREE.CylinderGeometry(18, 18.2, 0.4, 64);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.1
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.2;
    this.rootGroup.add(plinth);

    // 2. Blueprint Coordinate Grid
    const grid = new THREE.GridHelper(30, 30, 0x64748b, 0xcbd5e1);
    grid.position.y = 0.02;
    this.rootGroup.add(grid);

    // 3. Entrance Walkway / Paved Plaza Deck
    const walkwayGeo = new THREE.BoxGeometry(6.5, 0.06, 11);
    const walkwayMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.1
    });
    const walkway = new THREE.Mesh(walkwayGeo, walkwayMat);
    walkway.position.set(0, 0.04, 3.6);
    this.rootGroup.add(walkway);

    // 4. Perimeter Tactile Border
    const borderGeo = new THREE.RingGeometry(17.8, 18.1, 64);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.03;
    this.rootGroup.add(border);
  }

  buildSkyscraperStructure() {
    // High-Rise Tower Dimensions (53-Storey Vertical Scale)
    this.towerHeight = 22.0;
    this.towerWidth = 7.0;
    this.towerDepth = 5.0;

    // 1. Matte Dark Columns (4 Massive Corner Structural Pylons)
    const colGeo = new THREE.BoxGeometry(0.38, this.towerHeight, 0.38);
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Matte Charcoal Slate
      roughness: 0.7,
      metalness: 0.3
    });

    const colOffsets = [
      { x: -this.towerWidth / 2 + 0.19, z: -this.towerDepth / 2 + 0.19 },
      { x: this.towerWidth / 2 - 0.19,  z: -this.towerDepth / 2 + 0.19 },
      { x: -this.towerWidth / 2 + 0.19, z: this.towerDepth / 2 - 0.19 },
      { x: this.towerWidth / 2 - 0.19,  z: this.towerDepth / 2 - 0.19 }
    ];

    colOffsets.forEach(pt => {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(pt.x, this.towerHeight / 2, pt.z);
      this.rootGroup.add(col);
    });

    // 2. Transparent Crystal Glass Curtain Wall Envelope
    const glassGeo = new THREE.BoxGeometry(this.towerWidth, this.towerHeight, this.towerDepth);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      transmission: 0.85,
      ior: 1.45,
      depthWrite: false
    });
    const curtainWall = new THREE.Mesh(glassGeo, glassMat);
    curtainWall.position.y = this.towerHeight / 2;
    this.rootGroup.add(curtainWall);

    // 3. Dark Architectural Mullions / Window Grids
    const edgesGeo = new THREE.EdgesGeometry(glassGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });
    const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
    wireframe.position.y = this.towerHeight / 2;
    this.rootGroup.add(wireframe);

    // 4. Matte Dark Floor Plates (18 Visible Slabs)
    const slabGeo = new THREE.BoxGeometry(this.towerWidth - 0.1, 0.12, this.towerDepth - 0.1);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark Graphite Slate
      roughness: 0.8,
      metalness: 0.2
    });

    const floorCount = 18;
    for (let i = 0; i <= floorCount; i++) {
      const y = (i / floorCount) * this.towerHeight;
      // Leave Floor 14 open for the cutaway suite!
      if (Math.abs(y - 14.4) < 0.3) continue;

      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(0, y, 0);
      this.rootGroup.add(slab);

      // Dark edge definition line
      const slabEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slabGeo),
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 })
      );
      slabEdges.position.set(0, y, 0);
      this.rootGroup.add(slabEdges);
    }

    // 5. Special Tier Outlines (FL 00 Lobby, FL 04 Podium, FL 08 Mid-Rise, FL 53 Crown)
    this.buildTierRibbon(0.1, 0x0284c7); // FL 00 Lobby
    this.buildTierRibbon(4.8, 0x475569); // FL 04 Amenities
    this.buildTierRibbon(9.6, 0x475569); // FL 08 Mid-Rise

    // 6. Rooftop Mechanical Penthouse & Hoist Crown (FL 53)
    const crownGeo = new THREE.BoxGeometry(4.4, 1.8, 3.6);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Deep Charcoal
      roughness: 0.6,
      metalness: 0.4
    });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(-0.5, this.towerHeight + 0.9, 0);
    this.rootGroup.add(crown);

    // Rooftop Aviation Warning Beacon
    const beaconGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.set(-0.5, this.towerHeight + 2.1, 0);
    this.rootGroup.add(this.beacon);

    // Hoist Antenna Mast
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.6, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(-0.5, this.towerHeight + 1.3, 0);
    this.rootGroup.add(mast);
  }

  buildTierRibbon(y, colorHex) {
    const ribbonGeo = new THREE.BoxGeometry(this.towerWidth + 0.3, 0.16, this.towerDepth + 0.3);
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(ribbonGeo),
      new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 })
    );
    outline.position.y = y;
    this.rootGroup.add(outline);
  }

  buildElevatorCore() {
    // ========================================================================
    // OPEN PANORAMIC GLASS ELEVATOR SHAFT (High Visibility Core)
    // ========================================================================
    this.liftShaftY0 = 0.4;
    this.liftShaftY1 = 14.4; // Elevation of Floor 14 Residence
    this.liftMaxTravel = this.liftShaftY1 - this.liftShaftY0;

    // 1. Vertical Structural Guide Rails (Steel vertical tracks from FL 00 to Roof)
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, this.towerHeight, 8);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant cyan guide rails for maximum contrast
      metalness: 0.9,
      roughness: 0.2
    });

    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(-1.8, this.towerHeight / 2, -0.65);
    this.rootGroup.add(rail1);

    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(-1.8, this.towerHeight / 2, 0.65);
    this.rootGroup.add(rail2);

    // 2. Open Steel Truss Cross-Bracing on Elevator Hoistway
    const trussCount = 9;
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    for (let t = 0; t <= trussCount; t++) {
      const ty = (t / trussCount) * this.towerHeight;
      const ringGeo = new THREE.BoxGeometry(1.6, 0.08, 1.6);
      const ring = new THREE.Mesh(ringGeo, trussMat);
      ring.position.set(-1.2, ty, 0);
      this.rootGroup.add(ring);
    }

    // 3. Shaft Floor Elevation Level Markers along the shaft
    this.shaftLevelMarkers = [];
    const keyLevels = [
      { y: 0.4, label: 'FL 00 LOBBY', col: 0x0284c7 },
      { y: 4.8, label: 'FL 04 PODIUM', col: 0x64748b },
      { y: 9.6, label: 'FL 08 MID-RISE', col: 0x64748b },
      { y: 14.4, label: 'FL 14 MAYA', col: 0x10b981 }
    ];

    keyLevels.forEach(lvl => {
      const markerGeo = new THREE.BoxGeometry(0.1, 0.08, 0.4);
      const markerMat = new THREE.MeshBasicMaterial({ color: lvl.col });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(-1.95, lvl.y, 0);
      this.rootGroup.add(marker);
      this.shaftLevelMarkers.push({ mesh: marker, y: lvl.y });
    });

    // 4. Counterweight System (Moves downward as cabin ascends)
    const cweightGeo = new THREE.BoxGeometry(0.3, 1.2, 0.8);
    const cweightMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }); // Amber counterweight
    this.counterweight = new THREE.Mesh(cweightGeo, cweightMat);
    this.counterweight.position.set(-1.9, this.liftShaftY1, 0);
    this.rootGroup.add(this.counterweight);

    // 5. High-Visibility Elevator Cabin Assembly
    this.cabinGroup = new THREE.Group();
    this.cabinGroup.position.set(-1.2, this.liftShaftY0, 0);
    this.rootGroup.add(this.cabinGroup);

    // A. Dark Matte Titanium Cabin Outer Shell
    const frameGeo = new THREE.BoxGeometry(1.3, 1.5, 1.3);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Sleek Charcoal
      metalness: 0.8,
      roughness: 0.25
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    this.cabinGroup.add(frame);

    // Cabin Edge Accents (Electric Cyan outline)
    const frameEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(frameGeo),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    this.cabinGroup.add(frameEdges);

    // B. Panoramic Crystal Glass Front Window (Facing Camera)
    const cabinGlassGeo = new THREE.BoxGeometry(1.32, 1.3, 0.08);
    const cabinGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
      transmission: 0.8
    });
    const cabinGlass = new THREE.Mesh(cabinGlassGeo, cabinGlassMat);
    cabinGlass.position.set(0, 0, 0.64);
    this.cabinGroup.add(cabinGlass);

    // C. Cabin Interior Floor & Ceiling High-Luminance Light Panels
    const ceilLightGeo = new THREE.PlaneGeometry(1.1, 1.1);
    const ceilLightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ceilLight = new THREE.Mesh(ceilLightGeo, ceilLightMat);
    ceilLight.rotation.x = Math.PI / 2;
    ceilLight.position.y = 0.72;
    this.cabinGroup.add(ceilLight);

    const floorLightMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
    const floorLight = new THREE.Mesh(ceilLightGeo, floorLightMat);
    floorLight.rotation.x = Math.PI / 2;
    floorLight.position.y = -0.72;
    this.cabinGroup.add(floorLight);

    // D. Digital LED Floor Readout Display on Front of Elevator Car!
    this.liftFloorCanvas = document.createElement('canvas');
    this.liftFloorCanvas.width = 128;
    this.liftFloorCanvas.height = 64;
    this.liftFloorCtx = this.liftFloorCanvas.getContext('2d');
    this.liftFloorTexture = new THREE.CanvasTexture(this.liftFloorCanvas);

    const badgeGeo = new THREE.PlaneGeometry(0.9, 0.45);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: this.liftFloorTexture,
      transparent: true
    });
    this.cabinDisplayBadge = new THREE.Mesh(badgeGeo, badgeMat);
    this.cabinDisplayBadge.position.set(0, 0.2, 0.7);
    this.cabinGroup.add(this.cabinDisplayBadge);
    this.updateCabinFloorBadge(0, false);

    // 6. Dynamic Steel Hoist Cable from Top Crown to Cabin
    const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
    this.hoistCable = new THREE.Mesh(cableGeo, cableMat);
    this.rootGroup.add(this.hoistCable);
  }

  updateCabinFloorBadge(floorNum, isAscending) {
    if (!this.liftFloorCtx) return;
    const ctx = this.liftFloorCtx;
    ctx.clearRect(0, 0, 128, 64);

    // Background pill
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 56, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = isAscending ? '#38bdf8' : '#10b981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 56, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = isAscending ? '#38bdf8' : '#34d399';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = (isAscending ? '▲ ' : '') + `FL ${floorNum < 10 ? '0' + floorNum : floorNum}`;
    ctx.fillText(text, 64, 34);

    this.liftFloorTexture.needsUpdate = true;
  }

  buildTurnstileGate() {
    // ========================================================================
    // GROUND LOBBY SECURITY PORTAL (Turnstile 1)
    // ========================================================================
    this.turnstileGroup = new THREE.Group();
    this.turnstileGroup.position.set(0, 0, 2.8);
    this.rootGroup.add(this.turnstileGroup);

    // 1. Dual Matte Stainless Charcoal Pedestals
    const pedestalGeo = new THREE.BoxGeometry(0.36, 0.95, 1.4);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });

    const leftPedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    leftPedestal.position.set(-0.7, 0.475, 0);
    this.turnstileGroup.add(leftPedestal);

    const rightPedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    rightPedestal.position.set(0.7, 0.475, 0);
    this.turnstileGroup.add(rightPedestal);

    // 2. Optical NFC/QR Scanner Top Plate
    const scannerGeo = new THREE.BoxGeometry(0.28, 0.03, 0.38);
    const scannerMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const scannerTop = new THREE.Mesh(scannerGeo, scannerMat);
    scannerTop.position.set(-0.7, 0.96, 0.35);
    this.turnstileGroup.add(scannerTop);

    // 3. Status LED Halo Indicator Ring
    const ringGeo = new THREE.RingGeometry(0.07, 0.13, 24);
    this.turnstileStatusMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
    const statusRing = new THREE.Mesh(ringGeo, this.turnstileStatusMat);
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.set(-0.7, 0.98, 0.35);
    this.turnstileGroup.add(statusRing);

    // 4. Physical Swing Barrier Flappers (Retract / Swing 90deg on access)
    const flapperGeo = new THREE.BoxGeometry(0.65, 0.75, 0.04);
    const flapperMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981, // Emerald safety glass
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.1
    });

    // Left Flapper Wing
    this.flapperLeftPivot = new THREE.Group();
    this.flapperLeftPivot.position.set(-0.52, 0.55, 0);
    const flapperLeft = new THREE.Mesh(flapperGeo, flapperMat);
    flapperLeft.position.set(0.32, 0, 0);
    this.flapperLeftPivot.add(flapperLeft);
    this.turnstileGroup.add(this.flapperLeftPivot);

    // Right Flapper Wing
    this.flapperRightPivot = new THREE.Group();
    this.flapperRightPivot.position.set(0.52, 0.55, 0);
    const flapperRight = new THREE.Mesh(flapperGeo, flapperMat);
    flapperRight.position.set(-0.32, 0, 0);
    this.flapperRightPivot.add(flapperRight);
    this.turnstileGroup.add(this.flapperRightPivot);
  }

  buildResidence1402() {
    // ========================================================================
    // FLOOR 14 RESIDENCE 1402 ARCHITECTURAL CUTAWAY SUITE (Hero Delivery Unit)
    // ========================================================================
    this.residenceGroup = new THREE.Group();
    this.residenceGroup.position.set(0.6, 14.4, 0);
    this.rootGroup.add(this.residenceGroup);

    // 1. Cantilevered Luxury Floor Plate (Rich Teak Hardwood)
    const floorGeo = new THREE.BoxGeometry(4.8, 0.16, 4.2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x292524, // Warm Walnut / Dark Teak Hardwood
      roughness: 0.5,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0.9, 0.08, 0);
    this.residenceGroup.add(floor);

    // Emerald Highlight Border around Residence 1402 Floor
    const resEdgeGeo = new THREE.EdgesGeometry(floorGeo);
    const resEdgeMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const resEdges = new THREE.LineSegments(resEdgeGeo, resEdgeMat);
    resEdges.position.set(0.9, 0.08, 0);
    this.residenceGroup.add(resEdges);

    // 2. Interior Walls (Cutaway architectural layout)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917, // Matte Dark Interior Partitions
      roughness: 0.9
    });

    // Corridor Partition Wall Left
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.3), wallMat);
    wallLeft.position.set(-1.4, 0.9, -1.35);
    this.residenceGroup.add(wallLeft);

    // Corridor Partition Wall Right
    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.4), wallMat);
    wallRight.position.set(-1.4, 0.9, 1.15);
    this.residenceGroup.add(wallRight);

    // Doorway Header
    const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.9), wallMat);
    doorHeader.position.set(-1.4, 1.575, -0.15);
    this.residenceGroup.add(doorHeader);

    // 3. Entrance Doorway with Hinged Opening Door!
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-1.4, 0, -0.55); // Door hinge location
    this.residenceGroup.add(this.doorPivot);

    const doorLeafGeo = new THREE.BoxGeometry(0.06, 1.5, 0.8);
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Matte Charcoal Door
      roughness: 0.6,
      metalness: 0.3
    });
    const doorLeaf = new THREE.Mesh(doorLeafGeo, doorLeafMat);
    doorLeaf.position.set(0, 0.75, 0.4); // Centered relative to hinge
    this.doorPivot.add(doorLeaf);

    // Yale Linus Smart Deadbolt Escutcheon
    const yaleLockGeo = new THREE.BoxGeometry(0.14, 0.32, 0.1);
    const yaleLockMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.95,
      roughness: 0.15
    });
    const yaleLock = new THREE.Mesh(yaleLockGeo, yaleLockMat);
    yaleLock.position.set(0, 0.85, 0.7);
    this.doorPivot.add(yaleLock);

    // Yale Smart Lock Status LED Indicator (Red locked, Green unlocked)
    const ledGeo = new THREE.SphereGeometry(0.035, 12, 12);
    this.yaleLedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Locked by default
    this.yaleLed = new THREE.Mesh(ledGeo, this.yaleLedMat);
    this.yaleLed.position.set(0.06, 0.95, 0.7);
    this.doorPivot.add(this.yaleLed);

    // 4. Delivery Welcome Doorstep Drop Zone (Outside corridor mat)
    const dropZoneGeo = new THREE.PlaneGeometry(1.1, 0.9);
    this.dropZoneMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.dropZone = new THREE.Mesh(dropZoneGeo, this.dropZoneMat);
    this.dropZone.rotation.x = -Math.PI / 2;
    this.dropZone.position.set(-1.85, 0.09, -0.15);
    this.residenceGroup.add(this.dropZone);

    // 5. Living Room Designer Furniture (Warm residential interior)
    const sofaGeo = new THREE.BoxGeometry(2.0, 0.55, 1.0);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const sofa = new THREE.Mesh(sofaGeo, sofaMat);
    sofa.position.set(1.6, 0.28, 0.6);
    this.residenceGroup.add(sofa);

    const mediaGeo = new THREE.BoxGeometry(1.8, 0.45, 0.4);
    const mediaMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const media = new THREE.Mesh(mediaGeo, mediaMat);
    media.position.set(1.6, 0.23, -1.3);
    this.residenceGroup.add(media);

    // Balcony Glass Railing
    const railGeo = new THREE.BoxGeometry(4.8, 0.65, 0.06);
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1
    });
    const balconyRail = new THREE.Mesh(railGeo, railMat);
    balconyRail.position.set(0.9, 0.4, 2.05);
    this.residenceGroup.add(balconyRail);
  }

  build3DLocationBeacon() {
    // ========================================================================
    // 3D FLOATING DELIVERY TARGET BEACON (Residence 1402 Locator Pin)
    // ========================================================================
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.position.set(1.8, 15.6, 0);
    this.rootGroup.add(this.beaconGroup);

    // Glowing Diamond Pin
    const pinGeo = new THREE.OctahedronGeometry(0.24, 0);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.beaconPin = new THREE.Mesh(pinGeo, pinMat);
    this.beaconGroup.add(this.beaconPin);

    // Pulsing Sonar Ring on Floor 14
    const sonarGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    this.sonarMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.sonarRing = new THREE.Mesh(sonarGeo, this.sonarMat);
    this.sonarRing.rotation.x = -Math.PI / 2;
    this.sonarRing.position.y = -1.1;
    this.beaconGroup.add(this.sonarRing);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.canvas) return;
    const width = this.canvas.clientWidth || 900;
    const height = this.canvas.clientHeight || 620;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  // Camera preset selection API (manual or auto)
  setCameraPreset(presetName) {
    this.cameraMode = presetName;

    if (presetName === 'auto') {
      const target = this.cameraStageTargets[this.currentStage] || this.cameraStageTargets[0];
      this.currentCamTarget.pos.copy(target.pos);
      this.currentCamTarget.look.copy(target.look);
    } else if (this.cameraPresets[presetName]) {
      const target = this.cameraPresets[presetName];
      this.currentCamTarget.pos.copy(target.pos);
      this.currentCamTarget.look.copy(target.look);
    }
  }

  // Main simulation stage controller (0 to 4)
  setStage(stage) {
    this.currentStage = stage;

    switch (stage) {
      case 0: // Standby Idle
      default:
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.targetDoorOpen = 0.0;
        this.setTurnstileColor(0x0284c7);
        this.setYaleLockColor(0xef4444); // Locked Red
        this.setDropZoneActive(false);
        this.updateCabinFloorBadge(0, false);
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 0: PERIMETER SECURED · STANDBY', 'System standby. Awaiting resident delivery pass issuance...');
        break;

      case 1: // Gate Arrival
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.targetDoorOpen = 0.0;
        this.setTurnstileColor(0x0284c7);
        this.setYaleLockColor(0xef4444);
        this.setDropZoneActive(false);
        this.updateCabinFloorBadge(0, false);
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 1: COURIER ARRIVAL AT LOBBY PERIMETER', 'Awaiting cryptographic token verification at Union Place turnstile...');
        break;

      case 2: // Turnstile Relay Unlock
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 1.0;
        this.targetDoorOpen = 0.0;
        this.setTurnstileColor(0x10b981); // Emerald access granted
        this.setYaleLockColor(0xef4444);
        this.setDropZoneActive(false);
        this.triggerCircuitPulse(0);
        this.updateCabinFloorBadge(0, false);
        this.updateHudReadout('ENERGIZED (12V)', 'RESERVED (FL 00)', 'SECURED');
        this.updateOverlayTag('STAGE 2: CRYPTOGRAPHIC HANDSHAKE & RELAY TRIGGER', 'Single-use nonce consumed. Turnstile 1 barrier energized for 8s.');
        break;

      case 3: // Elevator Ascent (Climbing to FL 14!)
        this.targetTurnstileOpen = 0.0;
        this.targetCabinY = 1.0; // Glide all the way to Floor 14
        this.targetDoorOpen = 0.0;
        this.setTurnstileColor(0x475569);
        this.setYaleLockColor(0xef4444);
        this.setDropZoneActive(false);
        this.triggerCircuitPulse(1);
        this.updateHudReadout('LOCKED', 'ASCENDING (FL 08)', 'SECURED');
        this.updateOverlayTag('STAGE 3: MITSUBISHI ELEVATOR BANK TRANSIT', 'Cabin ascending via high-speed core traction hoist (2.5 m/s)...');
        break;

      case 4: // Arrival at Floor 14 Residence
        this.targetCabinY = 1.0;
        this.targetTurnstileOpen = 0.0;
        this.targetDoorOpen = 1.0; // Door swings open!
        this.setTurnstileColor(0x475569);
        this.setYaleLockColor(0x10b981); // Yale lock unlocked Green!
        this.setDropZoneActive(true);
        this.triggerCircuitPulse(2);
        this.updateCabinFloorBadge(14, false);
        this.updateHudReadout('LOCKED', 'ARRIVED (FL 14)', 'UNLATCHED');
        this.updateOverlayTag('STAGE 4: RESIDENCE 1402 CORRIDOR ARRIVAL', 'Courier arrived at Floor 14. Smart Deadbolt auto-cleared for handover.');
        break;
    }

    // Auto camera director transition
    if (this.cameraMode === 'auto') {
      const target = this.cameraStageTargets[stage] || this.cameraStageTargets[0];
      this.currentCamTarget.pos.copy(target.pos);
      this.currentCamTarget.look.copy(target.look);
    }
  }

  setTurnstileColor(hex) {
    if (this.turnstileStatusMat) this.turnstileStatusMat.color.setHex(hex);
    if (this.turnstileLight) this.turnstileLight.color.setHex(hex);
  }

  setYaleLockColor(hex) {
    if (this.yaleLedMat) this.yaleLedMat.color.setHex(hex);
    if (this.residenceLight) this.residenceLight.color.setHex(hex);
  }

  setDropZoneActive(isActive) {
    if (this.dropZoneMat) {
      this.dropZoneMat.color.setHex(isActive ? 0x10b981 : 0x475569);
      this.dropZoneMat.opacity = isActive ? 0.8 : 0.25;
    }
  }

  triggerCircuitPulse(kind) {
    const pulseGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: kind === 0 ? 0x10b981 : (kind === 1 ? 0x0284c7 : 0x10b981),
      transparent: true,
      opacity: 0.95
    });
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    pulseMesh.position.set(-1.2, 0.5, 0);
    this.rootGroup.add(pulseMesh);

    this.signalPulses.push({
      mesh: pulseMesh,
      y: 0.5,
      targetY: kind === 0 ? 3.0 : 14.5,
      speed: 0.3,
      alive: true
    });
  }

  updateHudReadout(relay, lift, door) {
    const elRelay = document.getElementById('hudRelay');
    const elLift = document.getElementById('hudLift');
    const elDoor = document.getElementById('hudDoor');
    if (elRelay) elRelay.innerText = relay;
    if (elLift) elLift.innerText = lift;
    if (elDoor) {
      elDoor.innerText = door;
      elDoor.className = door === 'UNLATCHED' ? 'hud-value hud-green' : 'hud-value';
    }
  }

  updateOverlayTag(title, desc) {
    const tag = document.getElementById('overlayStageTag');
    const d = document.getElementById('overlayStageDesc');
    if (tag) tag.innerText = title;
    if (d) d.innerText = desc;
  }

  startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.updatePhysics();
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  updatePhysics() {
    // 1. Interpolate Elevator Movement (FL 00 to FL 14)
    this.cabinY += (this.targetCabinY - this.cabinY) * 0.035;
    const currentCabinWorldY = this.liftShaftY0 + this.cabinY * this.liftMaxTravel;

    if (this.cabinGroup) {
      this.cabinGroup.position.y = currentCabinWorldY;
    }
    if (this.cabinLight) {
      this.cabinLight.position.y = currentCabinWorldY + 0.2;
    }

    // Counterweight moves inversely
    if (this.counterweight) {
      this.counterweight.position.y = this.liftShaftY1 - this.cabinY * this.liftMaxTravel + 0.8;
    }

    // Dynamic Hoist Cable
    if (this.hoistCable) {
      const topY = this.towerHeight + 0.9;
      const cableLength = Math.max(0.2, topY - currentCabinWorldY);
      this.hoistCable.scale.set(1, cableLength, 1);
      this.hoistCable.position.set(-1.2, topY - cableLength / 2, 0);
    }

    // Update Floor Readout on Cabin Front
    const calculatedFloor = Math.min(14, Math.round(this.cabinY * 14));
    const isMoving = Math.abs(this.targetCabinY - this.cabinY) > 0.02;
    if (calculatedFloor !== this.displayedFloor || isMoving) {
      this.displayedFloor = calculatedFloor;
      this.updateCabinFloorBadge(calculatedFloor, isMoving);

      // Also update HUD lift readout dynamically
      const elLift = document.getElementById('hudLift');
      if (elLift && this.currentStage === 3) {
        elLift.innerText = `ASCENDING (FL ${calculatedFloor < 10 ? '0' + calculatedFloor : calculatedFloor})`;
      }
    }

    // 2. Interpolate Turnstile Flapper Wings
    this.turnstileOpen += (this.targetTurnstileOpen - this.turnstileOpen) * 0.08;
    const swingAngle = this.turnstileOpen * (Math.PI / 2);
    if (this.flapperLeftPivot) this.flapperLeftPivot.rotation.y = -swingAngle;
    if (this.flapperRightPivot) this.flapperRightPivot.rotation.y = swingAngle;

    // 3. Interpolate Residence 1402 Entrance Door Opening
    this.doorOpen += (this.targetDoorOpen - this.doorOpen) * 0.06;
    if (this.doorPivot) {
      this.doorPivot.rotation.y = this.doorOpen * (Math.PI / 3.2); // Swing open 55deg
    }

    // 4. Dynamic Camera Tracking in Stage 3 (Follow lift cabin as it ascends)
    if (this.cameraMode === 'auto' && !this.isUserInteracting && this.controls) {
      if (this.currentStage === 3) {
        // Track the ascending elevator
        this.currentCamTarget.pos.set(10.5, Math.max(7.5, currentCabinWorldY + 2.0), 12.5);
        this.currentCamTarget.look.set(-1.2, currentCabinWorldY, 0);
      }

      this.camera.position.lerp(this.currentCamTarget.pos, 0.045);
      this.controls.target.lerp(this.currentCamTarget.look, 0.05);
    } else if (this.cameraMode !== 'auto' && !this.isUserInteracting && this.controls) {
      this.camera.position.lerp(this.currentCamTarget.pos, 0.05);
      this.controls.target.lerp(this.currentCamTarget.look, 0.05);
    }

    // 5. Rooftop Beacon Pulse
    if (this.beacon) {
      const time = performance.now() * 0.003;
      this.beacon.material.opacity = Math.sin(time) > 0.2 ? 1.0 : 0.2;
    }

    // 6. 3D Delivery Beacon Pin & Sonar Ripple
    if (this.beaconPin) {
      const t = performance.now() * 0.0025;
      this.beaconPin.rotation.y += 0.02;
      this.beaconPin.position.y = Math.sin(t) * 0.12;
    }
    if (this.sonarRing) {
      const t = (performance.now() * 0.0015) % 1.0;
      const s = 1.0 + t * 0.8;
      this.sonarRing.scale.set(s, s, s);
      this.sonarMat.opacity = (1.0 - t) * 0.65;
    }

    // 7. Signal Pulses Ascent
    for (let i = this.signalPulses.length - 1; i >= 0; i--) {
      const p = this.signalPulses[i];
      p.y += p.speed;
      p.mesh.position.y = p.y;
      p.mesh.scale.setScalar(1 + (p.y / 14.5) * 0.4);
      p.mesh.material.opacity = 1 - (p.y / p.targetY) * 0.6;

      if (p.y >= p.targetY) {
        this.rootGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.signalPulses.splice(i, 1);
      }
    }
  }
}

// Global instantiation after window loads
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE !== 'undefined') {
    window.twinRenderer = new TwinCanvasRenderer('twinCanvas');
    console.log('[DigitalTwin] 3D Light WebGL Skyscraper with Dynamic Camera Tracking initialized.');
  } else {
    console.error('[DigitalTwin] Three.js library not loaded.');
  }
});
