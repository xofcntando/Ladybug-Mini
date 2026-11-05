/**
 * Resilient ffmpeg resolver
 * ---------------------------------
 * `ffmpeg-static` ships a binary, but its postinstall can be blocked on some
 * hosts (panels, CI, pnpm with ignored scripts), leaving the path set while the
 * file is missing. Spawning a non-existent binary emits an 'error' event, and
 * any caller without an error handler crashes the whole bot.
 *
 * This module resolves a *working* ffmpeg once, in order:
 *   1. FFMPEG_PATH env override
 *   2. ffmpeg-static binary (only if the file actually exists)
 *   3. system `ffmpeg` on PATH
 * and exposes `hasFfmpeg()` + `getFfmpegPath()` so callers can fail gracefully.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

let resolved;
let resolvedOnce = false;

function binaryWorks(bin) {
  if (!bin) return false;
  try {
    const r = spawnSync(bin, ['-version'], { timeout: 8000, windowsHide: true });
    return r.status === 0;
  } catch (_) {
    return false;
  }
}

function resolveFfmpeg() {
  if (resolvedOnce) return resolved;
  resolvedOnce = true;

  const candidates = [];

  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);

  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) candidates.push(staticPath);
  } catch (_) {
    // ffmpeg-static not installed — fall through to system ffmpeg
  }

  candidates.push('ffmpeg');

  for (const bin of candidates) {
    if (binaryWorks(bin)) {
      resolved = bin;
      return resolved;
    }
  }

  resolved = null;
  return resolved;
}

function getFfmpegPath() {
  return resolveFfmpeg();
}

function hasFfmpeg() {
  return Boolean(resolveFfmpeg());
}

module.exports = { getFfmpegPath, hasFfmpeg, resolveFfmpeg };
