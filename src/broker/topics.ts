/**
 * Standardized MQTT Topic Taxonomy for TRI-ZEN Hardware Abstraction Layer (HAL)
 * Pattern: trizen/{tower}/{zone}/{subsystem}/{id}/{type}
 */
export const TOPICS = {
  // Lobby Turnstile Relays
  TURNSTILE_COMMAND: (tower = 'tower-1', turnstileId = '1') =>
    `trizen/${tower}/lobby/turnstile/${turnstileId}/command`,
  TURNSTILE_STATE: (tower = 'tower-1', turnstileId = '1') =>
    `trizen/${tower}/lobby/turnstile/${turnstileId}/state`,

  // Core Elevator Dispatch (Mitsubishi Electric Controller)
  ELEVATOR_COMMAND: (tower = 'tower-1', bankId = 'bank-a') =>
    `trizen/${tower}/core/elevator/${bankId}/command`,
  ELEVATOR_STATE: (tower = 'tower-1', bankId = 'bank-a') =>
    `trizen/${tower}/core/elevator/${bankId}/state`,

  // In-Unit Device Actuation (Lock, Living AC, Guest AC, Balcony Lights)
  UNIT_DEVICE_COMMAND: (tower = 'tower-1', unit = '1402', deviceId = '+') =>
    `trizen/${tower}/unit-${unit}/devices/${deviceId}/command`,
  UNIT_DEVICE_STATE: (tower = 'tower-1', unit = '1402', deviceId = '+') =>
    `trizen/${tower}/unit-${unit}/devices/${deviceId}/state`,

  // Edge Device Telemetry (Yale Smart Lock Voltage, Actuations, Retries)
  LOCK_TELEMETRY: (tower = 'tower-1', unit = '1402') =>
    `trizen/${tower}/unit-${unit}/lock/telemetry`,

  // System & Operator Notifications / AI Alerts
  ALERTS: `trizen/system/alerts`,
  WORK_ORDERS: `trizen/facilities/work-orders`,
};
