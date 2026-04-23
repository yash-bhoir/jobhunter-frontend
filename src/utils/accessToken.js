/** Session JWT for API `Authorization: Bearer …` (refresh stays httpOnly cookie). */
const KEY = 'jh_access_token';
/** Stops parallel 401s from hammering POST /auth/refresh after one failure (cleared on login). */
const CIRCUIT = 'jh_auth_refresh_circuit';

export function isAuthRefreshCircuitOpen() {
  if (typeof window === 'undefined') return false;
  try { return window.sessionStorage.getItem(CIRCUIT) === '1'; }
  catch { return false; }
}

export function openAuthRefreshCircuit() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(CIRCUIT, '1'); } catch { /* ignore */ }
}

export function clearAuthRefreshCircuit() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(CIRCUIT); } catch { /* ignore */ }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } catch { /* private mode / quota */ }
}

export function clearAccessToken() {
  setAccessToken(null);
}
