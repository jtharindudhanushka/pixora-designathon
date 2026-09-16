# TRI-ZEN OS — Integrated Smart Living Platform
> **Autonomous Living by John Keells Properties**  
> Developed by **Team Pixora** for the 24-Hour Designathon / Codefest.

[![System Verification](https://img.shields.io/badge/Verification-20%2F20%20PASS-2ECC71.svg)](#automated-system-verification)
[![Architecture](https://img.shields.io/badge/Hardware%20Abstraction-MQTT%20(Aedes)-3B82F6.svg)](#hardware-abstraction-layer-hal)
[![Design System](https://img.shields.io/badge/Design%20System-Monochrome%20Luxury-111111.svg)](#design-system-alignment)
[![AI Engine](https://img.shields.io/badge/AI%20Model-Rolling%20Z--Score%20Telemetry-F39C12.svg)](#ai-predictive-health-engine)

---

## Executive Overview

**TRI-ZEN OS** is an enterprise-grade proptech operating system engineered specifically for **John Keells Properties (JKH)** and deployed across its flagship 53-storey smart residential development: **TRI-ZEN, Colombo 02**.

Rather than offering another isolated gadget controller, TRI-ZEN OS solves two systemic market failures:
1. **Resident Fragmentation:** Unifies disparate smart locks, VRV air conditioning, elevators, and access gates into a single, high-contrast monochrome application.
2. **Corporate Conglomerate Flywheel:** Retains data within the John Keells Group ecosystem (direct integration with **Keells Super** grocery deliveries, **Cinnamon Hotels & Resorts** serviced apartments, and **FriMi** payment gateways) while reducing facilities truck-roll OPEX by **30–40%** via predictive edge telemetry.

---

## Key Deliverables & Documentation Index

- 📄 **[Deliverable 1: Solution Concept Brief](docs/deliverable-1-solution-concept.md)** — Problem framing, the 4 audiences, quantifiable JKH business case, and formal defense of what we deliberately cut.
- 📱 **[Deliverable 2: Resident App Prototype](DESIGN_SYSTEM.md)** — High-fidelity design system tokens and component specs matching teammate Osanda's Figma layout.
- ⚡ **Deliverable 3: Working Functional Slice** — Live-running vertical slice (`src/`) featuring the *Frictionless Delivery Handshake*, embedded MQTT broker, virtual edge daemon, and interactive testbed console.
- 🧠 **[Deliverable 4: AI Design Note](docs/deliverable-4-ai-design-note.md)** — Mathematical formulation of our predictive health model, rolling Z-score telemetry analysis, UI explainability strings, and 1-tap manual override fallback.
- 📐 **[Deliverable 5: System Architecture Sketch](docs/deliverable-5-system-architecture.md)** — C4 blueprint, zero-trust RBAC enforcement matrix, sequence diagrams, and MQTT topic taxonomy.

---

## Design System Alignment (`DESIGN_SYSTEM.md`)

The web testbed strictly adheres to the monochrome design tokens defined in `DESIGN_SYSTEM.md`:
- **Color Rule:** Pure black (`#0A0A0A` / `#111111`) for active/engaged cards; pure white (`#FFFFFF`) with `#EAEAEA` borders for inactive/neutral surfaces.
- **Status-Only Color Accents:** Green (`#2ECC71`) for locked/healthy states, Blue (`#3B82F6`) for elapsed pass countdown progress bars, Amber/Red for AI battery degradation alerts.
- **Shape Language:** 20–24px rounded card corners, 999px pill badges and buttons.
- **Component Inventory:** Status bar chip (`Tower 1 · 1402`), hero stat chips (Temp, Door Lock, Active Devices), natural-language AI search bar, 15-minute dynamic pass progress cards, and a 2×2 quick-control grid with AC temperature stepper (`−` / `+`).

---

## Live System Architecture

```
[ Resident Client / Webview ]
       │ Issues single-use, 15-minute delivery pass
       ▼
[ JKH API Gateway & Access Service ]
       │ Validates JWT claims, checks expiry, atomically revokes nonce
       ▼
[ Embedded MQTT Message Broker (Aedes) ]
       │ Publishes targeted hardware commands to tower topics
       ▼
[ Virtual Device Emulator (Edge Daemon) ]
       │ Simulates turnstile relay unlock and elevator dispatch
       ▼
[ AI Predictive Anomaly Engine ]
       │ Tracks actuation-normalized voltage decay: kappa = deltaV / (A + 1)
       │ Auto-routes work orders when z-score exceeds 2.5 standard deviations
       ▼
[ WebSocket Event Stream (ws://localhost:3000/ws) ]
       └─► Pushes instant arrival alerts & raw MQTT inspector packets to console
```

---

## Quickstart & Evaluation Guide

### 1. Installation
The platform runs with zero external dependencies (no external MQTT broker or Docker needed):
```bash
npm install
```

### 2. Run Automated End-to-End Verification
Executes our comprehensive automated test suite testing cryptographic tokens, anti-replay nonce invalidation, AI Z-Score anomaly detection, 1-tap override, and natural language scene parsing:
```bash
npm run test:flow
```
*Expected output: `20/20 TESTS PASSED (100%)`*

### 3. Launch Live Interactive Console
```bash
npm start
```
Open your browser at **`http://localhost:3000`**.

### 4. Interactive Live Demo Steps for Judges
1. **Test Frictionless Delivery Handshake:**
   - On the **Resident App View**, observe the active pass for *Keells Super Express*.
   - Tap **"Simulate Courier Gate Tap"** (or switch to the Operator view and tap the button).
   - Watch the **Turnstile 1 relay** energize (green LED on, solenoid unlatched for 8s).
   - Watch the **Mitsubishi elevator cabin** auto-dispatch to Ground and ascend to Floor 14.
   - Attempt to tap the pass again: observe the instant cryptographic rejection (**Replay Attack Prevented**).
2. **Test AI Predictive Maintenance & Anomaly Triage:**
   - Switch to **🏢 Tower Edge & AI Engine** view.
   - Tap **"⚠️ Inject Battery Anomaly (Cell Short-Circuit)"**.
   - Observe the live voltage drop rate accelerate to **3.2x baseline** ($z > 2.5\sigma$).
   - Watch the **Explainable AI Diagnostic Alert Card** appear with auto-generated work order `#WO-JKH-8492` saving LKR 13,500.
   - Test the 1-tap fallback: tap **"🛡️ 1-Tap Override (Dismiss / Heavy Usage)"** and verify tolerance widens without muting alarms.
3. **Test Natural Language Scene Bar:**
   - On the Resident App view, type: `"Turn off living room AC and lock front door"` or `"Prep home for Keells delivery"`.
   - Press Enter and observe instant execution across the device state grid.

---

## Commercial ROI Summary for John Keells Properties

| Financial & Operational Metric | Traditional Smart Home | TRI-ZEN OS by John Keells Properties |
| :--- | :--- | :--- |
| **Price per sqft Sales Premium** | 0% (Standard marble/gym amenity) | **+5% to +8%** premium on turnkey smart units (~LKR 2.6B across 891 units) |
| **Facilities Truck-Roll Overhead** | 100% reactive (LKR 12,000–18,000/visit) | **30%–40% reduction** via predictive batch swaps (LKR 8.5M–12M annual OPEX saving) |
| **Customer Data Sovereignty** | Leaked to AWS, Tuya, Google Cloud | **100% Retained** in John Keells Group private cloud |
| **Group Ecosystem Monetization** | Zero | Direct synergy with **Keells Super**, **Cinnamon Hotels**, and **FriMi** |
