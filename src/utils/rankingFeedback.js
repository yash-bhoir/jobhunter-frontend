import { api } from './axios';

/**
 * Fire-and-forget ranking signal for POST /jobs/:id/ranking-event.
 * Never throws to callers; safe for UI event handlers.
 */
export function logJobRankingEvent(jobId, type, meta) {
  if (!jobId || !type) return;
  api.post(`/jobs/${jobId}/ranking-event`, {
    type,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  }).catch(() => {});
}

/** LinkedIn / email-ingested listings (same event enum as Job ranking). */
export function logLinkedInRankingEvent(linkedInJobId, type, meta) {
  if (!linkedInJobId || !type) return;
  api.post(`/linkedin/jobs/${linkedInJobId}/ranking-event`, {
    type,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  }).catch(() => {});
}
