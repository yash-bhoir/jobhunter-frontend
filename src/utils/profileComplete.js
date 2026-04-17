/**
 * Mandatory fields every user must fill before accessing the platform.
 * Mirrors the weights in the backend's calcCompletion, but only the
 * fields we actually require (not LinkedIn / portfolio / resume).
 */
export const MANDATORY_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'city',
  'currentRole',
  'targetRole',
  'experience',   // 0 is valid (fresher)
  'noticePeriod',
  'workType',
  // 'skills' — checked separately as an array
];

/**
 * Returns true when the user's profile has all mandatory fields filled.
 * @param {object|null} user — the user object from AuthContext
 */
export function isProfileComplete(user) {
  if (!user) return false;
  // Admins bypass the profile gate
  if (user.role === 'admin' || user.role === 'super_admin') return true;

  const p = user.profile || {};

  for (const field of MANDATORY_FIELDS) {
    const val = p[field];
    // experience === 0 is valid (fresher), but null/undefined/'' are not
    if (field === 'experience') {
      if (val === null || val === undefined || val === '') return false;
      continue;
    }
    if (!val || (typeof val === 'string' && val.trim() === '')) return false;
  }

  // At least one skill required
  if (!Array.isArray(p.skills) || p.skills.length === 0) return false;

  return true;
}

/**
 * Returns which mandatory fields are missing (for highlighting).
 * @param {object|null} user
 * @returns {string[]} list of missing field names
 */
export function getMissingFields(user) {
  if (!user) return [...MANDATORY_FIELDS, 'skills'];
  if (user.role === 'admin' || user.role === 'super_admin') return [];

  const p       = user.profile || {};
  const missing = [];

  for (const field of MANDATORY_FIELDS) {
    const val = p[field];
    if (field === 'experience') {
      if (val === null || val === undefined || val === '') missing.push(field);
      continue;
    }
    if (!val || (typeof val === 'string' && val.trim() === '')) missing.push(field);
  }

  if (!Array.isArray(p.skills) || p.skills.length === 0) missing.push('skills');

  return missing;
}

const DRAFT_KEY = 'jh_profile_draft';

export function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}

export function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
