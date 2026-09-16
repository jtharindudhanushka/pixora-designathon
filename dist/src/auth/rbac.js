import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config/index.js';
// In-memory cache for consumed single-use jti tokens (Atomic replay defense)
const consumedNonces = new Set();
// Permission Matrix defining RBAC per brief
const ROLE_PERMISSIONS = {
    DEVELOPER_ADMIN: [
        'tower:provision',
        'device:factory_reset',
        'lease:manage',
        'passes:create',
        'passes:consume',
        'unit:control',
        'telemetry:read',
        'facilities:triage',
    ],
    PROPERTY_MGR: [
        'passes:consume',
        'telemetry:read',
        'facilities:triage',
        'building:override',
        'turnstile:control',
        'elevator:control',
    ],
    OWNER: [
        'device:pair',
        'device:factory_reset',
        'lease:manage',
        'passes:create',
        'unit:control',
        'telemetry:read',
    ],
    LONG_TERM_TENANT: [
        'passes:create',
        'unit:control',
        'scenes:manage',
        'telemetry:read',
        // explicitly NO device:factory_reset or lease:manage
    ],
    SHORT_TERM_GUEST: [
        'lock:actuate',
        'comfort:presets',
        // explicitly NO scene customization, visitor passes, or settings
    ],
    COURIER_PASS: [
        'lobby:turnstile_enter',
        'elevator:destination_floor',
        // Single-use 15 min restricted route only
    ],
};
/**
 * Issue a cryptographically signed JWT for a resident, guest, or courier pass
 */
export function issueToken(role, name, unit = CONFIG.DEFAULT_UNIT, ttlMinutes = CONFIG.PASS_TTL_MINUTES, metadata) {
    const jti = uuidv4();
    const expiresAt = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    const scopes = ROLE_PERMISSIONS[role] || [];
    const payload = {
        sub: `${role.toLowerCase()}-${uuidv4().substring(0, 8)}`,
        role,
        name,
        tower: CONFIG.TOWER_ID,
        unit,
        jti,
        scopes,
        expiresAt,
        metadata,
    };
    const token = jwt.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: `${ttlMinutes}m`,
    });
    return { token, payload };
}
/**
 * Validates a JWT token against cryptographic signature, expiration, and single-use revocation
 */
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        // Check if single-use token was already consumed
        if (consumedNonces.has(decoded.jti)) {
            return {
                valid: false,
                error: `Replay attack detected: Pass token [${decoded.jti.substring(0, 8)}] was already consumed.`,
            };
        }
        return { valid: true, payload: decoded };
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Pass token has expired (15-minute window elapsed).' };
        }
        return { valid: false, error: `Invalid cryptographic token: ${err.message}` };
    }
}
/**
 * Atomically consumes a single-use token upon physical gate/turnstile passage
 */
export function consumeSingleUseToken(jti) {
    if (consumedNonces.has(jti)) {
        return false; // Already consumed
    }
    consumedNonces.add(jti);
    return true;
}
/**
 * Check if a role possesses a required scope
 */
export function hasScope(role, requiredScope) {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(requiredScope);
}
