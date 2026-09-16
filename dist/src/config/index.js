export const CONFIG = {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    MQTT_PORT: process.env.MQTT_PORT ? parseInt(process.env.MQTT_PORT, 10) : 1883,
    JWT_SECRET: process.env.JWT_SECRET || 'jkh-trizen-enterprise-sec-token-2026',
    TOWER_ID: 'tower-1',
    PROJECT_NAME: 'TRI-ZEN Colombo 02',
    CLIENT: 'John Keells Properties',
    OPERATOR: 'John Keells Facilities Management',
    DEFAULT_UNIT: '1402',
    DEFAULT_RESIDENT: 'Maya Senanayake',
    COURIER_PARTNERS: ['Keells Super Express', 'PickMe Food', 'Uber Eats', 'DHL Keells'],
    PASS_TTL_MINUTES: 15,
    AI_BASELINE_WINDOW: 14, // 14 readings rolling baseline
    AI_ZSCORE_THRESHOLD: 2.5, // 2.5 standard deviations triggers triage
};
