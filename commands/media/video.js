/**
 * Video Downloader - YouTube MP4 via Ladybug API
 * Fixed for Ladybug-Mini WhatsApp Bot
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const yts = require('yt-search');
const axios = require('axios');
const APIs = require('../../utils/api');
const config = require('../../config');
const { ytdlpVideo } = require('../../utils/ytdlp');
const guard = require('../../utils/dlGuard');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YT_API = String(config.mediaApiUrl || config.ladybugApiUrl || 'https://ladybug-api-e8q8.onrender.com').replace(/\/$/, '');
const YT_API_KEY = config.mediaApiKey || config.ladybugApiKey || 'nzN64y+bq1bd/QwnMLOxxQDgG5AL78ul82qg4tPI1lk=';
const DEFAULT_QUALITY = String(config.videoQuality || '360');

function pickUrl(result) {
  if (!result) return null;
  const url = result?.download || result?.dl_url || result?.dl || result?.file?.download_url || result?.download_url;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function toYouTubeWatchUrl(input) {
  const id = String(input || '').match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  return id ? `https://youtu.be/${id}` : String(input || '').trim();
}

function videoQuality(value, fallback = DEFAULT_QUALITY) {
  return String(value || '').match(/(\d{3,4})/)?.[1] || fallback;
}

async function ladybugVideoDownload({ url, query, quality = DEFAULT_QUALITY }) {
  const q = videoQuality(quality);
  const headers = {
    'X-API-Key': YT_API_KEY,
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
  };

  const routes = url
    ? [
        { path: '/api/download/ytmp4', params: { url, format: `${q}p` } },
        { path: '/v1/media/ytmp4', params: { url, quality: q } },
      ]
    : [
        { path: '/api/download/ytmp4', params: { query, format: `${q}p` } },
        { path: '/v1/yt/play', params: { query, type: 'video', quality: q } },
      ];

  const cacheKey = `video:${toYouTubeWatchUrl(url || query)}:${q}`;
  const cached = guard.cacheGet(cacheKey);
  if (cached) return cached;

  let lastErr;
  let sawBusy = false;
  for (let round = 0; round < 3; round++) {
    sawBusy = false;
    let busyRes = null;
    for (const r of routes) {
      try {
        const res = await axios.get(`${YT_API}${r.path}`, {
          params: { ...r.params, apikey: encodeURIComponent(YT_API_KEY) },
          timeout: 180000,
          validateStatus: () => true,
          headers,
        });
        const { data, status } = res;

        if (status === 503) {
          sawBusy = true;
          busyRes = res;
          continue;
        }
        if (status >= 400 || data?.success === false) {
          continue;
        }

        const file = data?.file || data?.result || data;
        // Use the link the API returns. file.id is the YouTube video id, NOT the /dl/ file id.
        const dl_url = pickUrl(file) || pickUrl(data) || (data?.file?.id ? `${YT_API}/dl/${data.file.id}` : null); // /v1/media/* returns {file:{id}} = real file id

        if (dl_url) {
          const out = {
            title: file.title || data.title || 'Video',
            dl_url,
            sourceUrl: file.url || data.webpage_url || url,
          };
          guard.cacheSet(cacheKey, out);
          return out;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!sawBusy) break;
    if (round < 2) await sleep(guard.retryDelayMs(busyRes));
  }

  if (sawBusy) {
    const e = new Error('busy');
    e.busy = true;
    throw e;
  }
  throw lastErr || new Error('Ladybug API video download failed');
}

module.exports = {
  name: 'video',
  aliases: ['ytvideo', 'ytmp4', 'mp4'],
  category: 'media',
  description: 'Download video from YouTube',
  usage: '.video <song name or YouTube link>',

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const lockKey = `video:${chatId}:${msg.key.participant || chatId}`;
    if (!guard.acquire(lockKey)) {
      return sock.sendMessage(chatId, { text: '⏳ You already have a download running. Please wait for it to finish.' }, { quoted: msg });
    }
    try {
      return await this.run(sock, msg, args);
    } finally {
      guard.release(lockKey);
    }
  },

  async run(sock, msg, args) {
    try {
      const text = args.join(' ').trim();
      const chatId = msg.key.remoteJid;

      if (!text) {
        return await sock.sendMessage(
          chatId,
          { text: 'Usage: .video <video name or YouTube link>' },
          { quoted: msg }
        );
      }

      await sock.sendMessage(chatId, { text: '⏳ Fetching video, please wait...' }, { quoted: msg });

      let result;
      try {
        result = await ladybugVideoDownload({
          url: text.includes('youtube.com') || text.includes('youtu.be') ? text : undefined,
          query: text,
        });
      } catch (err) {
        try {
          result = await APIs.getEliteProTechVideoByUrl(text);
        } catch (e2) {
          if (err.busy) throw err;
          throw e2;
        }
      }

      if (!result?.dl_url) {
        throw new Error('Could not obtain video download link');
      }

      await sock.sendMessage(
        chatId,
        {
          video: { url: result.dl_url },
          caption: `${result.title || ''}\nPowered by Ladybug`.trim(),
          mimetype: 'video/mp4',
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error('Video command error:', err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: err.busy ? guard.BUSY_MESSAGE : `❌ Failed to download video: ${err.message || 'Error'}` },
        { quoted: msg }
      );
    }
  },
};
