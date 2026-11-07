/**
 * Tiny client for our own Ladybug API (config.ladybugApiUrl / ladybugApiKey).
 * Used by the info & jobs commands. Throws Errors with a message that is safe to show in chat.
 */

const axios = require('axios');
const config = require('../config');

async function ladybugGet(route, params = {}, { timeout = 45000 } = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') clean[k] = v;
  let res;
  try {
    res = await axios.get(`${String(config.ladybugApiUrl).replace(/\/$/, '')}${route}`, {
      params: { ...clean, apikey: config.ladybugApiKey },
      timeout,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('The service took too long, try again in a moment.');
    throw new Error('Could not reach the Ladybug API.');
  }
  if (res.status === 401) throw new Error('The bot API key is invalid.');
  if (res.status === 429) throw new Error('Too many requests right now, try again shortly.');
  if (res.status >= 400) {
    const d = res.data?.detail;
    throw new Error(typeof d === 'string' ? d : `Request failed (${res.status}).`);
  }
  return res.data;
}

/** Reply helper shared by the commands: quoted text message, trimmed to what WhatsApp shows comfortably. */
function replyText(sock, msg, text) {
  const out = text.length > 3800 ? `${text.slice(0, 3790).trimEnd()}…` : text;
  return sock.sendMessage(msg.key.remoteJid, { text: out }, { quoted: msg });
}

const money = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

function salaryText(s) {
  if (!s) return '';
  const cur = s.currency ? `${s.currency} ` : '';
  if (s.annual_min || s.annual_max) {
    const lo = s.annual_min, hi = s.annual_max;
    return `${cur}${lo ? money(lo) : ''}${lo && hi && lo !== hi ? '-' : ''}${hi && hi !== lo ? money(hi) : ''}/yr`;
  }
  return s.text || '';
}

module.exports = { ladybugGet, replyText, salaryText, money };
