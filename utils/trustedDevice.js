/* ============================================================
   MOVE PLUS — Trusted Device & Risk-Based OTP Utility
   ============================================================
   Provides:
     - Device ID generation (SHA-256 hash)
     - JWT-signed trusted_device cookie management
     - GeoIP-based country lookup
     - Risk score computation
     - Full trusted device check pipeline
   ============================================================ */

const crypto  = require("crypto");
const jwt     = require("jsonwebtoken");
const geoip   = require("geoip-lite");

const JWT_SECRET  = process.env.JWT_DEVICE_SECRET || "change-me-in-production";
const COOKIE_NAME = "trusted_device";
const TOKEN_DAYS  = 30;

// ──────────────────────────────────────────────────────────
// GeoIP helper
// ──────────────────────────────────────────────────────────

/**
 * Returns a 2-letter ISO country code (e.g. "PT", "AO") or "XX" if unknown.
 * Handles IPv4-mapped IPv6 (::ffff:x.x.x.x) transparently.
 */
function getCountryFromIp(rawIp) {
  try {
    // Strip IPv4-mapped IPv6 prefix
    const ip = rawIp ? rawIp.replace(/^::ffff:/, "") : "127.0.0.1";
    // 127.x or ::1 – local dev
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "LOCAL";
    const geo = geoip.lookup(ip);
    return (geo && geo.country) ? geo.country : "XX";
  } catch {
    return "XX";
  }
}

// ──────────────────────────────────────────────────────────
// Device ID (deterministic, salted hash — never raw data)
// ──────────────────────────────────────────────────────────

/**
 * Generates a stable device ID from user_id + user_agent + a pepper salt.
 * Never stored in plain text in the DB.
 */
function generateDeviceId(userId, userAgent = "") {
  const pepper = process.env.DEVICE_ID_PEPPER || "moveplus-device-pepper";
  return crypto
    .createHash("sha256")
    .update(`${userId}|${userAgent}|${pepper}`)
    .digest("hex");
}

// ──────────────────────────────────────────────────────────
// JWT cookie helpers
// ──────────────────────────────────────────────────────────

/**
 * Creates a signed JWT that is placed inside the HttpOnly cookie.
 * Payload: { deviceId, userId }
 */
function generateDeviceToken(deviceId, userId) {
  return jwt.sign(
    { deviceId, userId },
    JWT_SECRET,
    { expiresIn: `${TOKEN_DAYS}d` }
  );
}

/**
 * Verifies the JWT from the cookie.
 * Returns the payload { deviceId, userId } or null if invalid/expired.
 */
function verifyDeviceToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Sets the trusted_device cookie on the response.
 */
function setTrustedCookie(res, deviceId, userId) {
  const token  = generateDeviceToken(deviceId, userId);
  const maxAge = TOKEN_DAYS * 24 * 60 * 60 * 1000; // ms
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production", // enforce in prod
    sameSite: "Strict",
    maxAge,
  });
  return token;
}

/**
 * Clears the trusted_device cookie.
 */
function clearTrustedCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "Strict" });
}

// ──────────────────────────────────────────────────────────
// Risk Score Engine
// ──────────────────────────────────────────────────────────

/**
 * Extracts the real client IP, considering X-Forwarded-For proxy header.
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
}

/**
 * Compares two IPv4 addresses at the /24 subnet level.
 * Returns true if they share the same /24 subnet.
 */
function sameSubnet24(ip1, ip2) {
  try {
    const clean1 = ip1.replace(/^::ffff:/, "");
    const clean2 = ip2.replace(/^::ffff:/, "");
    const parts1 = clean1.split(".");
    const parts2 = clean2.split(".");
    if (parts1.length !== 4 || parts2.length !== 4) return false;
    return parts1[0] === parts2[0] &&
           parts1[1] === parts2[1] &&
           parts1[2] === parts2[2];
  } catch {
    return false;
  }
}

/**
 * Returns true if the current hour (0-23) is in an unusual range (23:00 – 06:00).
 */
function isUnusualHour() {
  const hour = new Date().getUTCHours();
  return hour >= 23 || hour < 6;
}

/**
 * Computes a numeric risk score.
 * @param {object} req            - Express request
 * @param {object|null} device    - Row from trusted_devices (or null)
 * @param {object} customer       - Row from customers (for failed_login_attempts)
 * @returns {{ score: number, reasons: string[] }}
 */
function computeRiskScore(req, device, customer = {}) {
  let score   = 0;
  const reasons = [];
  const currentIp      = getClientIp(req);
  const currentCountry = getCountryFromIp(currentIp);
  const currentUa      = req.headers["user-agent"] || "";

  if (!device) {
    score += 70;
    reasons.push("Novo dispositivo (+70)");
  } else {
    // Country check
    if (device.country && device.country !== "LOCAL" &&
        currentCountry !== "LOCAL" && currentCountry !== device.country) {
      score += 80;
      reasons.push(`País diferente: ${device.country} → ${currentCountry} (+80)`);
    }

    // Subnet check (only for real IPs)
    if (device.ip_address && currentIp !== "127.0.0.1" && currentIp !== "::1") {
      if (!sameSubnet24(device.ip_address, currentIp)) {
        score += 40;
        reasons.push(`Subnet IP diferente (+40)`);
      }
    }

    // User-agent check
    if (device.user_agent && device.user_agent !== currentUa) {
      score += 60;
      reasons.push("User-agent diferente (+60)");
    }
  }

  // Unusual hour
  if (isUnusualHour()) {
    score += 20;
    reasons.push("Horário incomum (+20)");
  }

  // Many failed login attempts
  if (customer.failed_login_attempts >= 5) {
    score += 50;
    reasons.push(`Muitas tentativas falhadas: ${customer.failed_login_attempts} (+50)`);
  }

  return { score, reasons };
}

// ──────────────────────────────────────────────────────────
// Full Pipeline — used in /login
// ──────────────────────────────────────────────────────────

/**
 * Full trusted device check.
 * Returns:
 *   { trusted: true,  deviceRow }   — skip OTP
 *   { trusted: false, reason }      — OTP required
 */
async function checkTrustedDevice(req, userId, customer, pool) {
  const cookieToken = req.cookies?.[COOKIE_NAME];

  if (!cookieToken) {
    return { trusted: false, reason: "Sem cookie de dispositivo de confiança" };
  }

  // Verify JWT signature
  const payload = verifyDeviceToken(cookieToken);
  if (!payload) {
    return { trusted: false, reason: "Cookie inválido ou expirado" };
  }

  // Ensure the token belongs to this user
  if (String(payload.userId) !== String(userId)) {
    return { trusted: false, reason: "Cookie não pertence a este utilizador" };
  }

  // Look up in DB
  const now = new Date();
  const dbResult = await pool.query(
    `SELECT * FROM trusted_devices
     WHERE device_id = $1 AND user_id = $2 AND expires_at > $3
     LIMIT 1`,
    [payload.deviceId, userId, now]
  );

  if (dbResult.rows.length === 0) {
    return { trusted: false, reason: "Dispositivo não encontrado ou expirado na BD" };
  }

  const device = dbResult.rows[0];

  // Compute risk
  const { score, reasons } = computeRiskScore(req, device, customer);
  console.log(`[TrustedDevice] userId=${userId} score=${score}`, reasons);

  if (score >= 50) {
    return { trusted: false, reason: `Risk score elevado (${score})`, score, reasons };
  }

  // All good — update last_used_at
  await pool.query(
    "UPDATE trusted_devices SET last_used_at = NOW(), ip_address = $1 WHERE id = $2",
    [getClientIp(req), device.id]
  );

  return { trusted: true, deviceRow: device };
}

// ──────────────────────────────────────────────────────────

module.exports = {
  getCountryFromIp,
  generateDeviceId,
  generateDeviceToken,
  verifyDeviceToken,
  setTrustedCookie,
  clearTrustedCookie,
  getClientIp,
  computeRiskScore,
  checkTrustedDevice,
  COOKIE_NAME,
};
