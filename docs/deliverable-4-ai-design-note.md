# Deliverable 4: AI Design Note
## Predictive Edge Health & Anomaly Detection Engine

**Platform:** TRI-ZEN OS (Integrated Smart Living Platform)  
**Target Subsystem:** Edge Hardware Health & Facilities Maintenance Triage (Focus: Yale Smart Locks & Connected Gateways)  
**Hackathon Tie-Breaker Weight:** 15 Marks (AI Innovation & Appropriateness)

---

### 1. The Chosen AI Capability & Problem Statement

Rather than adding an ungrounded generative chatbot that hallucinates, our AI capability addresses the single largest operating expense in smart residential buildings: **silent hardware failures that cause lockout emergencies and costly reactive maintenance truck rolls.**

* **The Edge Failure Problem:** Smart locks operating on 4x AA alkaline or Li-ion cells suffer from unpredictable internal resistance degradation, mechanical gear binding, or cold-temperature voltage sags. In standard systems, the resident only learns the lock is failing when they are locked out late at night.
* **Facilities Pain Point:** Every reactive emergency lockout incurs technician overtime, transport, and potential mortise lock drill-outs (~LKR 12,000–18,000 per incident).

---

### 2. Algorithmic Approach: Unsupervised Rolling Statistical Anomaly Detection

We implement an unsupervised, rolling-window statistical model using **actuation-normalized voltage decay tracking** combined with a dynamic Z-Score evaluation.

#### A. Mathematical Formulation
1. Edge locks transmit periodic telemetry:
   - $V_t$: Battery terminal voltage in millivolts ($mV$).
   - $A_t$: Cumulative daily motor actuations (deadbolt lock/unlock cycles).
   - $R_t$: Zigbee / BLE packet retry ratio (RF link quality).
   - $T_t$: Ambient temperature ($^\circ C$, used to filter thermal voltage dips).
2. The engine computes the **Actuation-Normalized Voltage Decay Rate** ($\kappa_t$):
   $$\kappa_t = \frac{\Delta V_t}{A_t + \epsilon} \quad (\text{mV drop per actuation})$$
3. The engine maintains a rolling 14-observation baseline window and continuously computes:
   - Rolling Mean ($\mu_\kappa$): Expected baseline voltage drop per motor actuation cycle.
   - Rolling Standard Deviation ($\sigma_\kappa$): Natural variance in power consumption.
4. The Z-Score ($z$) is evaluated at each reporting interval:
   $$z = \frac{\kappa_{\text{observed}} - \mu_\kappa}{\sigma_\kappa}$$

#### B. Trigger Conditions
* **Normal Operating State ($z < 1.8$):** Voltage decay tracks nominal cell chemistry (~11–13 mV per cycle).
* **Degraded Warning ($1.8 \le z < 2.5$):** Mild motor binding or RF interference causing excessive retries.
* **Critical Triage Active ($z \ge 2.5$ for $\ge 2$ consecutive intervals):** Indicates internal cell short-circuit or severe mechanical deadbolt friction. Drop rate exceeds $3.0\times$ baseline (~40+ mV/actuation).

---

### 3. Telemetry Schema Consumed

The AI engine subscribes directly to MQTT topic `trizen/{tower}/unit-{unit}/lock/telemetry`:

```json
{
  "deviceId": "LOCK-1402-YALE",
  "unit": "1402",
  "tower": "tower-1",
  "timestamp": "2026-09-16T17:30:00.000Z",
  "voltage_mv": 4820,
  "daily_actuations": 16,
  "packet_retry_rate": 0.082,
  "ambient_temp_c": 27.4,
  "lock_state": "LOCKED",
  "firmware_version": "v3.8.4-jkh",
  "is_anomaly_injected": true
}
```

---

### 4. Explainability Design in the User Interface

The platform strictly avoids black-box or vague alerts like *"Warning: Device Error."* It produces clear, evidence-based explainability text displayed on both the Resident Dashboard and the Facilities Management Console:

> **AI Diagnostic Alert (UI Output):**  
> *"Smart Lock #1402 voltage is dropping 3.2x faster than normal actuation baseline (41.8 mV/actuation vs 12.2 mV/actuation baseline). Internal cell failure predicted in ~48 hours. Preventive replacement ticket #WO-JKH-8492 auto-routed to Facilities."*

#### Automated Work-Order Payload:
```json
{
  "ticketId": "WO-JKH-8492",
  "targetDevice": "LOCK-1402-YALE",
  "unit": "1402",
  "tower": "tower-1",
  "priority": "URGENT",
  "assignedDepartment": "John Keells Facilities - Electrical & Access Engineering",
  "predictedHoursToFailure": 48,
  "estimatedPreventiveCostLkr": 1500,
  "commercialSavingLkr": 13500
}
```

---

### 5. Failure Modes, Fallbacks & 1-Tap Manual Override

What happens when the model is wrong in someone's home?

1. **False Positive Mitigation (1-Tap Manual Override):**
   - *Scenario:* A resident is hosting a party or moving furniture, cycling the front door deadbolt 40 times in 2 hours. The surge in actuations could temporarily inflate $\kappa_t$.
   - *Fallback:* The resident or facility operator has an immediate 1-tap action: **`[Dismiss: Heavy Usage / Moving]`**.
   - *Effect:* Dynamically applies a $1.8\times$ tolerance multiplier to the Z-score threshold for 24 hours without muting critical security perimeter alarms or low-battery cut-off protections.
2. **False Negative Mitigation:**
   - Even if the statistical model fails to flag an anomaly, hard electrical cut-offs remain embedded at the hardware firmware level (failsafe audible buzzer at 4.2V).
3. **Hard Safety Boundary:**
   - **Strict Read-Only Enforcement:** The AI engine has **zero autonomous authority to actuate physical relays, unlock doors, or disarm security alarms.**
   - Its permissions are cryptographically constrained strictly to read telemetry, generate diagnostic reports, and route facilities work orders.
