/**
 * Download guard: one download per user at a time, short-lived link cache,
 * and helpers for the API's "queue is full" (503) responses.
 */
const active = new Set();
const cache = new Map(); // key -> { value, at }
const CACHE_TTL_MS = 8 * 60 * 1000; // API files live ~10 min (MEDIA_TTL_MINUTES)

function acquire(key) {
  if (active.has(key)) return false;
  active.add(key);
  return true;
}

function release(key) {
  active.delete(key);
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, at: Date.now() });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/** Seconds to wait after a 503, from Retry-After (default 15, capped at 25). */
function retryDelayMs(res) {
  const h = Number(res?.headers?.['retry-after']);
  const s = Number.isFinite(h) && h > 0 ? h : 15;
  return Math.min(s, 25) * 1000;
}

const BUSY_MESSAGE = '⏳ The download server is busy right now. Please try again in a minute.';

module.exports = { acquire, release, cacheGet, cacheSet, retryDelayMs, BUSY_MESSAGE };
