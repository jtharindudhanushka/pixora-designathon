// ==========================================================================
// TRI-ZEN OS — 3D Architectural Digital Twin WebGL Engine (Three.js)
// 53-Storey High-Rise Cutaway, Mitsubishi Hoist Core, Turnstile & Residence 1402
// ==========================================================================

class TwinCanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`[DigitalTwin] Canvas #${canvasId} not found.`);
      return;
    }

    // Motion & simulation state
    this.currentStage = 0; // 0: Standby, 1: Gate, 2: Token/Relay, 3: Lift, 4: Doorstep
    this.cabinY = 0.0; // 0.0 (Ground) to 1.0 (Floor 14)
    this.targetCabinY = 0.0;
    this.turnstileOpen = 0.0; // 0.0 (Closed) to 1.0 (Open)
    this.targetTurnstileOpen = 0.0;

    // Cinematic camera targets
    this.cameraStageTargets = {
      0: { pos: new THREE.Vector3(22, 14, 24), look: new THREE.Vector3(0, 9, 0) }, // Full 53-storey Tower Overview
      1: { pos: new THREE.Vector3(8, 3.5, 9),  look: new THREE.Vector3(0, 1.2, 0) }, // Ground Lobby Turnstile
      2: { pos: new THREE.Vector3(4.8, 2.2, 5.2), look: new THREE.Vector3(0, 1.0, 0) }, // Gate Handshake Close-up
      3: { pos: new THREE.Vector3(14, 12, 16), look: new THREE.Vector3(0, 8, 0) }, // Elevator Shaft Tracking
      4: { pos: new THREE.Vector3(8, 16.5, 9), look: new THREE.Vector3(0.5, 14.2, 0) }, // Residence 1402 Doorstep
    };

    this.currentCamTarget = {
      pos: this.cameraStageTargets[0].pos.clone(),
      look: this.cameraStageTargets[0].look.clone()
    };
    this.isUserInteracting = false;
    this.userInteractionTimeout = null;

    this.signalPulses = [];
    this.particles = [];

    this.initThree();
    this.buildScene();
    this.setupEventListeners();
    this.startRenderLoop();
  }

  initThree() {
    const width = this.canvas.clientWidth || 900;
    const height = this.canvas.clientHeight || 620;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f18);
    this.scene.fog = new THREE.FogExp2(0x0a0f18, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    this.camera.position.copy(this.cameraStageTargets[0].pos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 4. OrbitControls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.copy(this.cameraStageTargets[0].look);
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't dip far below ground
      this.controls.minDistance = 4;
      this.controls.maxDistance = 65;

      this.controls.addEventListener('start', () => {
        this.isUserInteracting = true;
        if (this.userInteractionTimeout) clearTimeout(this.userInteractionTimeout);
      });
      this.controls.addEventListener('end', () => {
        // Return to cinematic camera interpolation 3.5s after user stops dragging
        this.userInteractionTimeout = setTimeout(() => {
          this.isUserInteracting = false;
        }, 3500);
      });
    }

    // 5. Lighting
    this.setupLighting();
  }

  setupLighting() {
    // Ambient light: cool architectural studio illumination
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    this.scene.add(ambientLight);

    // Key Sun Light: crisp architectural highlights
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(24, 40, 20);
    this.scene.add(keyLight);

    // Fill Light: sleek cool-blue glass rim reflections
    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.5);
    fillLight.position.set(-20, 25, -20);
    this.scene.add(fillLight);

    // Ground Bounce Light: soft up-light
    const bounceLight = new THREE.DirectionalLight(0x0f172a, 0.4);
    bounceLight.position.set(0, -10, 0);
    this.scene.add(bounceLight);

    // Turnstile Ground Light (energized green/cyan)
    this.turnstileLight = new THREE.PointLight(0x3b82f6, 1.5, 8);
    this.turnstileLight.position.set(0, 1.2, 2.5);
    this.scene.add(this.turnstileLight);

    // Residence 1402 Ambient Glow (Amber/Emerald)
    this.residenceLight = new THREE.PointLight(0xf59e0b, 1.8, 7);
    this.residenceLight.position.set(0.6, 14.5, 0.4);
    this.scene.add(this.residenceLight);

    // Moving Elevator Cabin Light (warm xenon glow inside lift)
    this.cabinLight = new THREE.PointLight(0x60a5fa, 2.0, 5);
    this.cabinLight.position.set(-1.2, 1.0, 0);
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
    this.buildAmbientDustParticles();
  }

  buildGroundPlaza() {
    // 1. Sleek architectural ground slab
    const groundGeo = new THREE.CylinderGeometry(18, 18, 0.4, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1322,
      roughness: 0.8,
      metalness: 0.3
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.2;
    this.rootGroup.add(ground);

    // 2. Precision CAD blueprint coordinate grid
    const grid = new THREE.GridHelper(30, 30, 0x1e3a8a, 0x111c30);
    grid.position.y = 0.02;
    this.rootGroup.add(grid);

    // 3. Ground entrance pathway / plaza deck
    const plazaGeo = new THREE.BoxGeometry(8, 0.1, 10);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x131d31,
      roughness: 0.6,
      metalness: 0.2
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.05, 3.5);
    this.rootGroup.add(plaza);

    // 4. Perimeter border ring
    const ringGeo = new THREE.RingGeometry(17.8, 18.2, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.rootGroup.add(ring);
  }

  buildSkyscraperStructure() {
    // Tower Dimensions (representing 53-storey high-rise at Union Place)
    this.towerHeight = 22.0;
    this.towerWidth = 7.0;
    this.towerDepth = 5.0;

    // 1. Transparent Glass Curtain Wall Envelope
    const glassGeo = new THREE.BoxGeometry(this.towerWidth, this.towerHeight, this.towerDepth);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.2,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.45,
      depthWrite: false
    });
    const curtainWall = new THREE.Mesh(glassGeo, glassMat);
    curtainWall.position.y = this.towerHeight / 2;
    this.rootGroup.add(curtainWall);

    // 2. Architectural Mullions / Outer Structural Wireframe
    const edgesGeo = new THREE.EdgesGeometry(glassGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.45 });
    const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
    wireframe.position.y = this.towerHeight / 2;
    this.rootGroup.add(wireframe);

    // 3. Central Structural Core (Shear concrete spine)
    const coreGeo = new THREE.BoxGeometry(2.8, this.towerHeight + 0.4, 2.6);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.2
    });
    const coreSpine = new THREE.Mesh(coreGeo, coreMat);
    coreSpine.position.set(-1.0, this.towerHeight / 2, 0);
    this.rootGroup.add(coreSpine);

    // 4. Horizontal Floor Plates (18 visible horizontal slabs throughout the vertical envelope)
    const slabGeo = new THREE.BoxGeometry(this.towerWidth - 0.2, 0.12, this.towerDepth - 0.2);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2
    });

    const floorCount = 18;
    for (let i = 0; i <= floorCount; i++) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      const y = (i / floorCount) * this.towerHeight;
      slab.position.set(0, y, 0);
      this.rootGroup.add(slab);

      // Floor edge indicator light
      const slabEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slabGeo),
        new THREE.LineBasicMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.3 })
      );
      slabEdges.position.set(0, y, 0);
      this.rootGroup.add(slabEdges);
    }

    // 5. Special Tier Highlights (Lobby FL 00, Podium FL 04, Mid-Rise FL 08, Res 1402 FL 14, Penthouse FL 53)
    this.buildTierLabelPlate(0.1, 'FL 00 · GROUND LOBBY & TURNSTILES', 0x22c55e);
    this.buildTierLabelPlate(4.8, 'FL 04 · PODIUM AMENITIES & DECK', 0x3b82f6);
    this.buildTierLabelPlate(9.6, 'FL 08 · MID-RISE RESIDENTIAL CORE', 0x64748b);
    this.buildTierLabelPlate(14.4, 'FL 14 · MAYA RESIDENCE 1402', 0x10b981, true);

    // 6. Rooftop Mechanical Penthouse & Hoist Crown (FL 53)
    const crownGeo = new THREE.BoxGeometry(4.2, 1.8, 3.4);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x090e17,
      roughness: 0.5,
      metalness: 0.6
    });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(-0.5, this.towerHeight + 0.9, 0);
    this.rootGroup.add(crown);

    // Rooftop warning beacon
    const beaconGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.set(-0.5, this.towerHeight + 2.0, 0);
    this.rootGroup.add(this.beacon);

    // Hoist antenna mast
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.5, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(-0.5, this.towerHeight + 1.25, 0);
    this.rootGroup.add(mast);
  }

  buildTierLabelPlate(y, text, colorHex, isHighlighted = false) {
    const plateGeo = new THREE.BoxGeometry(this.towerWidth + 0.4, 0.22, this.towerDepth + 0.4);
    const plateMat = new THREE.MeshStandardMaterial({
      color: isHighlighted ? 0x064e3b : 0x0f172a,
      emissive: isHighlighted ? 0x059669 : 0x000000,
      emissiveIntensity: isHighlighted ? 0.35 : 0,
      roughness: 0.4
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = y;
    this.rootGroup.add(plate);

    // Glowing border outline
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(plateGeo),
      new THREE.LineBasicMaterial({ color: colorHex, linewidth: isHighlighted ? 2 : 1 })
    );
    outline.position.y = y;
    this.rootGroup.add(outline);
  }

  buildElevatorCore() {
    // Vertical Mitsubishi High-Speed Traction Lift Shaft
    this.liftShaftY0 = 0.4;
    this.liftShaftY1 = 14.4; // Height of Floor 14 Residence
    this.liftMaxTravel = this.liftShaftY1 - this.liftShaftY0;

    // 1. Steel Guide Rails
    const railGeo = new THREE.CylinderGeometry(0.03, 0.03, this.towerHeight, 8);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.3 });

    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(-1.8, this.towerHeight / 2, -0.6);
    this.rootGroup.add(rail1);

    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(-1.8, this.towerHeight / 2, 0.6);
    this.rootGroup.add(rail2);

    // 2. Elevator Cabin Assembly
    this.cabinGroup = new THREE.Group();
    this.cabinGroup.position.set(-1.2, this.liftShaftY0, 0);
    this.rootGroup.add(this.cabinGroup);

    // Cabin Metallic Frame
    const frameGeo = new THREE.BoxGeometry(1.2, 1.4, 1.2);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    this.cabinGroup.add(frame);

    // Cabin Panoramic Glass Window
    const cabinGlassGeo = new THREE.BoxGeometry(1.22, 1.2, 0.1);
    const cabinGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      metalness: 0.2
    });
    const cabinGlass = new THREE.Mesh(cabinGlassGeo, cabinGlassMat);
    cabinGlass.position.set(0, 0, 0.58);
    this.cabinGroup.add(cabinGlass);

    // Cabin Floor & Ceiling light panels
    const ceilLightGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const ceilLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ceilLight = new THREE.Mesh(ceilLightGeo, ceilLightMat);
    ceilLight.rotation.x = Math.PI / 2;
    ceilLight.position.y = 0.68;
    this.cabinGroup.add(ceilLight);

    // Hoist Cable from Cabin to Top Penthouse
    const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 6);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    this.hoistCable = new THREE.Mesh(cableGeo, cableMat);
    this.rootGroup.add(this.hoistCable);
  }

  buildTurnstileGate() {
    // Lobby Security Portal (Turnstile 1 at ground entrance)
    this.turnstileGroup = new THREE.Group();
    this.turnstileGroup.position.set(0, 0, 2.8);
    this.rootGroup.add(this.turnstileGroup);

    // 1. Dual Stainless Steel Pedestals
    const pedestalGeo = new THREE.BoxGeometry(0.35, 0.9, 1.4);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25
    });

    const leftPedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    leftPedestal.position.set(-0.7, 0.45, 0);
    this.turnstileGroup.add(leftPedestal);

    const rightPedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    rightPedestal.position.set(0.7, 0.45, 0);
    this.turnstileGroup.add(rightPedestal);

    // 2. Scanner Reader Glass Top Plate (with NFC/QR glyph)
    const readerGlassGeo = new THREE.BoxGeometry(0.3, 0.03, 0.4);
    const readerGlassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftReader = new THREE.Mesh(readerGlassGeo, readerGlassMat);
    leftReader.position.set(-0.7, 0.92, 0.3);
    this.turnstileGroup.add(leftReader);

    // 3. Physical Swing Barrier Flappers (Retract/open on authorization)
    const flapperGeo = new THREE.BoxGeometry(0.65, 0.75, 0.04);
    const flapperMat = new THREE.MeshPhysicalMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2,
      metalness: 0.1
    });

    // Left Wing (pivots around -0.65)
    this.flapperLeftPivot = new THREE.Group();
    this.flapperLeftPivot.position.set(-0.52, 0.55, 0);
    const flapperLeft = new THREE.Mesh(flapperGeo, flapperMat);
    flapperLeft.position.set(0.32, 0, 0);
    this.flapperLeftPivot.add(flapperLeft);
    this.turnstileGroup.add(this.flapperLeftPivot);

    // Right Wing (pivots around +0.65)
    this.flapperRightPivot = new THREE.Group();
    this.flapperRightPivot.position.set(0.52, 0.55, 0);
    const flapperRight = new THREE.Mesh(flapperGeo, flapperMat);
    flapperRight.position.set(-0.32, 0, 0);
    this.flapperRightPivot.add(flapperRight);
    this.turnstileGroup.add(this.flapperRightPivot);

    // 4. Status LED Indicator Ring
    const statusRingGeo = new THREE.RingGeometry(0.08, 0.14, 16);
    this.turnstileStatusMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide });
    const statusRing = new THREE.Mesh(statusRingGeo, this.turnstileStatusMat);
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.set(-0.7, 0.93, 0.3);
    this.turnstileGroup.add(statusRing);
  }

  buildResidence1402() {
    // Floor 14 Residence 1402 Architectural Cutaway
    this.residenceGroup = new THREE.Group();
    this.residenceGroup.position.set(0.8, 14.4, 0);
    this.rootGroup.add(this.residenceGroup);

    // 1. Apartment Interior Floor Plate (Warm luxury hardwood)
    const floorGeo = new THREE.BoxGeometry(4.6, 0.1, 3.8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.6,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0.8, 0.05, 0);
    this.residenceGroup.add(floor);

    // 2. Interior Partition Walls (Cutaway architectural layout)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });

    // Corridor entrance wall with doorway opening
    const wallCorridor1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.2), wallMat);
    wallCorridor1.position.set(-1.4, 0.9, -1.2);
    this.residenceGroup.add(wallCorridor1);

    const wallCorridor2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.4), wallMat);
    wallCorridor2.position.set(-1.4, 0.9, 1.1);
    this.residenceGroup.add(wallCorridor2);

    // Door Header
    const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.9), wallMat);
    doorHeader.position.set(-1.4, 1.6, 0.05);
    this.residenceGroup.add(doorHeader);

    // 3. Entrance Door Frame & Yale Smart Deadbolt
    const frameGeo = new THREE.BoxGeometry(0.16, 1.5, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.7 });
    const doorJamb = new THREE.Mesh(frameGeo, frameMat);
    doorJamb.position.set(-1.4, 0.75, -0.4);
    this.residenceGroup.add(doorJamb);

    // Yale Smart Lock Escutcheon
    const yaleLockGeo = new THREE.BoxGeometry(0.18, 0.28, 0.1);
    const yaleLockMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
    const yaleLock = new THREE.Mesh(yaleLockGeo, yaleLockMat);
    yaleLock.position.set(-1.38, 0.85, -0.4);
    this.residenceGroup.add(yaleLock);

    // Yale Smart LED Indicator (Red locked, Green unlocked)
    const ledGeo = new THREE.SphereGeometry(0.03, 8, 8);
    this.yaleLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    this.yaleLed = new THREE.Mesh(ledGeo, this.yaleLedMat);
    this.yaleLed.position.set(-1.3, 0.93, -0.4);
    this.residenceGroup.add(this.yaleLed);

    // 4. Glowing Apartment Furniture / Living Space Silhouette
    const sofaGeo = new THREE.BoxGeometry(1.8, 0.5, 0.9);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const sofa = new THREE.Mesh(sofaGeo, sofaMat);
    sofa.position.set(1.4, 0.25, 0.5);
    this.residenceGroup.add(sofa);

    const tvConsoleGeo = new THREE.BoxGeometry(1.6, 0.4, 0.4);
    const tvConsoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const tvConsole = new THREE.Mesh(tvConsoleGeo, tvConsoleMat);
    tvConsole.position.set(1.4, 0.2, -1.2);
    this.residenceGroup.add(tvConsole);
  }

  buildAmbientDustParticles() {
    const particleCount = 70;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 26;
      positions[i + 1] = Math.random() * 26;
      positions[i + 2] = (Math.random() - 0.5) * 26;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.25,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    this.ambientParticles = new THREE.Points(geometry, material);
    this.rootGroup.add(this.ambientParticles);
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

  setStage(stage) {
    this.currentStage = stage;

    switch (stage) {
      case 0: // Standby Idle
      default:
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.setTurnstileColor(0x3b82f6);
        this.setYaleLockColor(0x22c55e); // Locked / Secured
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 0: PERIMETER SECURED · STANDBY', 'System standby. Awaiting resident delivery pass issuance...');
        break;

      case 1: // Gate Arrival
        this.targetCabinY = 0.0;
        this.targetTurnstileOpen = 0.0;
        this.setTurnstileColor(0x38bdf8);
        this.setYaleLockColor(0x22c55e);
        this.updateHudReadout('LOCKED (0V)', 'FL 00 (LOBBY)', 'SECURED');
        this.updateOverlayTag('STAGE 1: COURIER ARRIVAL AT LOBBY PERIMETER', 'Awaiting cryptographic token verification at Union Place turnstile...');
        break;

      case 2: // Turnstile Relay Unlock
        this.targetTurnstileOpen = 1.0;
        this.setTurnstileColor(0x22c55e);
        this.triggerCircuitPulse(0);
        this.updateHudReadout('ENERGIZED (12V)', 'RESERVED (FL 00)', 'SECURED');
        this.updateOverlayTag('STAGE 2: CRYPTOGRAPHIC HANDSHAKE & RELAY TRIGGER', 'Single-use nonce consumed. Turnstile 1 barrier energized for 8s.');
        break;

      case 3: // Elevator Ascent
        this.targetTurnstileOpen = 0.0;
        this.targetCabinY = 0.6;
        this.setTurnstileColor(0x64748b);
        this.triggerCircuitPulse(1);
        this.updateHudReadout('LOCKED', 'ASCENDING (FL 08)', 'SECURED');
        this.updateOverlayTag('STAGE 3: MITSUBISHI ELEVATOR BANK TRANSIT', 'Cabin ascending via high-speed core traction hoist (2.5 m/s)...');
        break;

      case 4: // Arrival at Floor 14 Residence
        this.targetCabinY = 1.0;
        this.targetTurnstileOpen = 0.0;
        this.setTurnstileColor(0x64748b);
        this.setYaleLockColor(0x10b981); // Auto-cleared for handover
        this.triggerCircuitPulse(2);
        this.updateHudReadout('LOCKED', 'ARRIVED (FL 14)', 'UNLATCHED');
        this.updateOverlayTag('STAGE 4: RESIDENCE 1402 CORRIDOR ARRIVAL', 'Courier arrived at Floor 14. Smart Deadbolt auto-cleared for handover.');
        break;
    }

    // Update cinematic camera target
    const target = this.cameraStageTargets[stage] || this.cameraStageTargets[0];
    this.currentCamTarget.pos.copy(target.pos);
    this.currentCamTarget.look.copy(target.look);
  }

  setTurnstileColor(hex) {
    if (this.turnstileStatusMat) this.turnstileStatusMat.color.setHex(hex);
    if (this.turnstileLight) this.turnstileLight.color.setHex(hex);
  }

  setYaleLockColor(hex) {
    if (this.yaleLedMat) this.yaleLedMat.color.setHex(hex);
    if (this.residenceLight) this.residenceLight.color.setHex(hex);
  }

  triggerCircuitPulse(kind) {
    // Generate a vertical optic pulse traversing the elevator spine
    const pulseGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: kind === 0 ? 0x22c55e : (kind === 1 ? 0x38bdf8 : 0x10b981),
      transparent: true,
      opacity: 0.95
    });
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    pulseMesh.position.set(-1.0, 0.5, 0);
    this.rootGroup.add(pulseMesh);

    this.signalPulses.push({
      mesh: pulseMesh,
      y: 0.5,
      targetY: kind === 0 ? 3.0 : 14.5,
      speed: 0.25,
      alive: true
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
    const animate = () => {
      requestAnimationFrame(animate);
      this.updatePhysics();
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  updatePhysics() {
    const delta = 0.016;

    // 1. Interpolate Elevator Movement
    this.cabinY += (this.targetCabinY - this.cabinY) * 0.04;
    const currentCabinWorldY = this.liftShaftY0 + this.cabinY * this.liftMaxTravel;
    if (this.cabinGroup) {
      this.cabinGroup.position.y = currentCabinWorldY;
    }
    if (this.cabinLight) {
      this.cabinLight.position.y = currentCabinWorldY + 0.2;
    }

    // Hoist cable updates dynamically from top penthouse to elevator cabin
    if (this.hoistCable) {
      const topY = this.towerHeight + 0.9;
      const cableLength = Math.max(0.2, topY - currentCabinWorldY);
      this.hoistCable.scale.set(1, cableLength, 1);
      this.hoistCable.position.set(-1.2, topY - cableLength / 2, 0);
    }

    // 2. Interpolate Turnstile Flapper Wings
    this.turnstileOpen += (this.targetTurnstileOpen - this.turnstileOpen) * 0.08;
    const swingAngle = this.turnstileOpen * (Math.PI / 2); // 0 to 90 degrees
    if (this.flapperLeftPivot) {
      this.flapperLeftPivot.rotation.y = -swingAngle;
    }
    if (this.flapperRightPivot) {
      this.flapperRightPivot.rotation.y = swingAngle;
    }

    // 3. Cinematic Camera Transition (when user is not actively dragging)
    if (!this.isUserInteracting && this.controls) {
      this.camera.position.lerp(this.currentCamTarget.pos, 0.04);
      this.controls.target.lerp(this.currentCamTarget.look, 0.05);
    }

    // 4. Rooftop Beacon Pulse
    if (this.beacon) {
      const time = performance.now() * 0.003;
      this.beacon.material.opacity = Math.sin(time) > 0.3 ? 1.0 : 0.2;
    }

    // 5. Ambient Particles Floating
    if (this.ambientParticles) {
      const pos = this.ambientParticles.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += 0.03;
        if (pos[i] > 26) pos[i] = 0;
      }
      this.ambientParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 6. Signal Pulses Ascent
    for (let i = this.signalPulses.length - 1; i >= 0; i--) {
      const p = this.signalPulses[i];
      p.y += p.speed;
      p.mesh.position.y = p.y;
      p.mesh.scale.setScalar(1 + (p.y / 14.5) * 0.5);
      p.mesh.material.opacity = 1 - (p.y / p.targetY) * 0.7;

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
    console.log('[DigitalTwin] Real 3D WebGL Skyscraper initialized successfully.');
  } else {
    console.error('[DigitalTwin] Three.js library not loaded.');
  }
});
