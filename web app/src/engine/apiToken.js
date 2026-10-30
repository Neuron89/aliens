/* Optional shared secret for the content / generate HTTP APIs.
   The server enforces it on writes when API_TOKEN is set (server/index.js);
   the GM types it once on the session screen (ADVANCED) and it lives in
   localStorage.apiToken. Every API fetch sends it as `x-api-token`. */
const KEY = 'apiToken';

export function getApiToken() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setApiToken(value) {
  try {
    const v = String(value || '').trim();
    if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
}

/** Headers for an /api call: `extra` plus x-api-token when one is stored. */
export function apiHeaders(extra = {}) {
  const t = getApiToken();
  return t ? { ...extra, 'x-api-token': t } : { ...extra };
}
