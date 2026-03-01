/* ============================================
   MOVE PLUS — Safe Redirect Utility
   Validates all redirect URLs against an allowlist
   to prevent open-redirect attacks.
   ============================================ */

(function () {
  "use strict";

  /**
   * Allowlist of permitted redirect destinations.
   * - Relative paths (starting with "/" or not starting with a protocol) are always allowed.
   * - External origins must be explicitly listed here.
   */
  const ALLOWED_EXTERNAL_ORIGINS = [
    "https://moveplusao.vercel.app",
    "https://wa.me",
  ];

  /**
   * Checks whether a URL is safe to redirect to.
   * Relative paths and same-origin paths are always safe.
   * Absolute URLs must match an allowed external origin.
   *
   * @param {string} url - The URL to validate
   * @returns {boolean}
   */
  function isAllowedRedirect(url) {
    if (!url || typeof url !== "string") return false;

    const trimmed = url.trim();

    // Block javascript: and data: schemes
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
      return false;
    }

    // Relative URLs (no protocol) are safe — they stay on the same origin
    if (
      trimmed.startsWith("/") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      !trimmed.includes("://")
    ) {
      return true;
    }

    // Absolute URL — check against the allowlist
    try {
      const parsed = new URL(trimmed);
      return ALLOWED_EXTERNAL_ORIGINS.some(
        (allowed) => parsed.origin === new URL(allowed).origin,
      );
    } catch {
      // Malformed URL — block it
      return false;
    }
  }

  /**
   * Safely redirect to a URL. If the URL is not in the allowlist,
   * redirect to the fallback instead and log a warning.
   *
   * @param {string} url      - Desired redirect target
   * @param {string} fallback - Safe fallback URL (default: site root)
   */
  function safeRedirect(url, fallback) {
    const defaultFallback =
      fallback || (window.location.pathname.includes("/pages/") ? "../index.html" : "/");

    if (isAllowedRedirect(url)) {
      window.location.href = url;
    } else {
      console.warn(
        "[safeRedirect] Blocked redirect to untrusted URL:",
        url,
        "→ Redirecting to:",
        defaultFallback,
      );
      window.location.href = defaultFallback;
    }
  }

  // Expose globally
  window.safeRedirect = safeRedirect;
  window.isAllowedRedirect = isAllowedRedirect;
})();
