/**
 * Song Downloader - Download audio from YouTube
 * Optimized for Ladybug API (https://ladybug-api-e8q8.onrender.com)
 * Fixed for Ladybug-Mini WhatsApp Bot
 */

const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const APIs = require('../../utils/api');
const { toAudio, toPTT } = require('../../utils/converter');
const { ytdlpAudio } = require('../../utils/ytdlp');
const config = require('../../config');
const guard = require('../../utils/dlGuard');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const YT_API = String(config.mediaApiUrl || config.ladybugApiUrl || 'https://ladybug-api-e8q8.onrender.com').replace(/\/$/, '');
const YT_API_KEY = config.mediaApiKey || config.ladybugApiKey || 'nzN64y+bq1bd/QwnMLOxxQDgG5AL78ul82qg4tPI1lk=';
const PRINCE_API = String(config.princeApiUrl || 'https://api.princetechn.com').replace(/\/$/, '');
const PRINCE_API_KEY = config.princeApiKey || 'prince';
const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickUrl(result) {
  if (!result) return null;
  const url =
    result.download ||
    result.dl_url ||
    result.dl ||
    result.audio ||
    result.download_url ||
    result.downloadUrl ||
    result.file?.download_url ||
    result.result?.download ||
    result.result?.dl_url;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function isIpLockedCdn(url) {
  return /googlevideo\.com|youtube\.com\/videoplayback/i.test(String(url || ''));
}

function extractYouTubeId(input) {
  const text = String(input || '').trim();
  const patterns = [
    /(?:youtube\.com\/(?:watch\\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function toYouTubeWatchUrl(input) {
  const id = extractYouTubeId(input);
  return id ? `https://youtu.be/${id}` : String(input || '').trim();
}

/**
 * Search YouTube using yt-search with fallback to Ladybug API ytsearch
 * (Prevents 429 IP bans on Render/hosting servers)
 */
async function resolveVideoInfo(text) {
  const isDirectUrl = text.includes('youtube.com') || text.includes('youtu.be');
  if (isDirectUrl) {
    const videoId = extractYouTubeId(text);
    if (videoId) {
      try {
        const info = await yts({ videoId });
        if (info?.videoId || info?.url) {
          return {
            url: info.url || `https://www.youtube.com/watch?v=${videoId}`,
            title: info.title || 'YouTube Audio',
            thumbnail: info.thumbnail || info.image || null,
            timestamp: info.timestamp || info.duration?.timestamp || '—',
          };
        }
      } catch (err) {
        console.log('[song] yts videoId lookup failed:', err?.message || err);
      }
    }
    return {
      url: text.trim(),
      title: 'YouTube Audio',
      thumbnail: null,
      timestamp: '—',
    };
  }

  // 1. Try local yt-search
  try {
    const search = await yts(text);
    if (search?.videos?.length) {
      return search.videos[0];
    }
  } catch (err) {
    console.log('[song] local yt-search failed, trying Ladybug API search...', err.message);
  }

  // 2. Fallback to Ladybug API /api/download/ytsearch (Server-side search)
  try {
    const res = await axios.get(`${YT_API}/api/download/ytsearch`, {
      params: { query: text, limit: 5 },
      headers: {
        'X-API-Key': YT_API_KEY,
        'User-Agent': UA,
        Accept: 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    const results = res.data?.result?.results || res.data?.results || [];
    if (results.length > 0) {
      const top = results[0];
      return {
        url: top.url,
        title: top.title,
        thumbnail: top.thumbnail || null,
        timestamp: top.duration || '—',
      };
    }
  } catch (apiSearchErr) {
    console.log('[song] Ladybug API search failed:', apiSearchErr.message);
  }

  return null;
}

/**
 * Primary Downloader: Ladybug API (Supports /api/ytmp3, /api/download/ytaudio, /v1/media/ytmp3)
 * CRITICAL FIX: Sends 'X-API-Key' in headers so '+' in base64 key is NEVER decoded into spaces!
 */
async function ladybugSongDownload(url, title = '', attempts = 3) {
  let lastError;
  let sawBusy = false;
  let busyRes = null;
  const cacheKey = `audio:${toYouTubeWatchUrl(url)}`;
  const cached = guard.cacheGet(cacheKey);
  if (cached) return cached;
  const headers = {
    'X-API-Key': YT_API_KEY,
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
  };

  const endpoints = [
    {
      path: '/api/ytmp3',
      params: { url },
      extract: (data) => data,
    },
    {
      path: '/api/download/ytaudio',
      params: { url, format: '128kbps' },
      extract: (data) => data.result || data,
    },
    {
      path: '/v1/media/ytmp3',
      params: { url, kbps: 128 },
      extract: (data) => ({
        download: data?.file?.download_url || (data?.file?.id ? `${YT_API}/dl/${data.file.id}` : null),
        title: data?.title,
        thumbnail: data?.thumbnail,
      }),
    },
  ];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    sawBusy = false;
    for (const ep of endpoints) {
      try {
        console.log(`[song] Requesting Ladybug endpoint ${ep.path} (attempt ${attempt})...`);
        const res = await axios.get(`${YT_API}${ep.path}`, {
          params: { ...ep.params, apikey: encodeURIComponent(YT_API_KEY) },
          timeout: 120000,
          validateStatus: () => true,
          headers,
        });
        const { data, status } = res;

        if (status === 503) {
          sawBusy = true;
          busyRes = res;
          console.log(`[song] ${ep.path} queue busy (503)`);
          break; // same server queue for every endpoint: wait and retry instead

        }

        if (status >= 400 || (data && data.success === false)) {
          const msg = data?.detail || data?.error || data?.message || `HTTP ${status}`;
          console.log(`[song] ${ep.path} returned status ${status}: ${msg}`);
          continue;
        }

        const extracted = ep.extract(data);
        const download = pickUrl(extracted) || pickUrl(data);
        if (download) {
          console.log(`[song] Successfully received download URL from ${ep.path}`);
          const out = {
            download,
            title: extracted?.title || data?.title || title,
            thumbnail: extracted?.thumbnail || data?.thumbnail || null,
          };
          guard.cacheSet(cacheKey, out);
          return out;
        }
      } catch (err) {
        lastError = err;
        console.log(`[song] ${ep.path} attempt error:`, err.message);
      }
    }
    if (attempt < attempts) await sleep(sawBusy ? guard.retryDelayMs(busyRes) : 1200 * attempt);
  }
  if (sawBusy) {
    const e = new Error('busy');
    e.busy = true;
    throw e;
  }
  throw lastError || new Error('Ladybug API audio endpoints failed');
}

/**
 * Fallback Downloader: Prince API
 */
async function princeSongDownload(url, attempts = 2) {
  const watchUrl = toYouTubeWatchUrl(url);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const endpoint = new URL('/api/download/ytmp3', PRINCE_API);
      endpoint.searchParams.set('apikey', PRINCE_API_KEY);
      endpoint.searchParams.set('url', watchUrl);
      const { data, status } = await axios.get(endpoint.toString(), {
        timeout: 60000,
        validateStatus: () => true,
        headers: { Accept: 'application/json', 'User-Agent': UA },
      });
      if (status >= 400 || data?.success === false) {
        throw new Error(data?.message || data?.error || `Prince API HTTP ${status}`);
      }
      const result = data?.result || data;
      const download = result?.downloadUrl || pickUrl(result);
      if (!download) throw new Error('Prince API returned no download URL');
      return {
        download,
        title: result?.title,
        thumbnail: result?.thumbnail || null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Prince API failed');
}

/**
 * Fallback Downloader: Hector API
 */
async function hectorSongDownload(url, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, status } = await axios.get(HECTOR_API, {
        params: { url },
        timeout: 60000,
        validateStatus: () => true,
        headers: { Accept: 'application/json', 'User-Agent': UA },
      });
      if (status >= 400 || data?.status === false) {
        throw new Error(data?.message || data?.error || `Hector API HTTP ${status}`);
      }
      const download = data?.audio;
      if (!download || !/^https?:\/\//i.test(download)) {
        throw new Error('Hector API returned no audio URL');
      }
      return {
        download,
        title: data?.title,
        thumbnail: data?.thumbnail || null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Hector API failed');
}

/**
 * Buffer fetcher with stream/decompress support
 */
async function fetchAudioBuffer(audioUrl, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        decompress: true,
        validateStatus: (s) => s >= 200 && s < 400,
        headers,
      });
      const buf = Buffer.from(audioResponse.data);
      if (buf.length > 0) return buf;
      throw new Error('Empty audio buffer');
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if (status === 403 || status === 451) throw err;
      console.log(`[song] file fetch attempt ${attempt}/${attempts}:`, status || err.code || err.message);
      if (attempt < attempts) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Failed to fetch audio file');
}

function detectAudioFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.toString('ascii', 4, 8) === 'ftyp') return { name: 'M4A/MP4', ext: 'm4a' };
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { name: 'MP3', ext: 'mp3' };
  }
  if (buf.toString('ascii', 0, 4) === 'OggS') return { name: 'OGG/Opus', ext: 'ogg' };
  if (buf.toString('ascii', 0, 4) === 'RIFF') return { name: 'WAV', ext: 'wav' };
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return { name: 'WebM', ext: 'webm' };
  return null;
}

async function sendSuggestions(sock, chatId, msg, video) {
  try {
    const title = String(video?.title || '').trim();
    if (!title || /^YouTube Audio$/i.test(title)) return;
    const search = await Promise.race([
      yts(title),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    const currentId = extractYouTubeId(video.url || '') || video.videoId;
    const picks = (search?.videos || [])
      .filter((v) => v.videoId !== currentId && v.title && v.title !== title)
      .slice(0, 3);
    if (!picks.length) return;
    const lines = picks.map((v, i) => `${i + 1}. ${v.title}${v.timestamp ? ` (${v.timestamp})` : ''}\n   .song ${v.title.slice(0, 60)}`);
    await sock.sendMessage(chatId, { text: `More like this:\n${lines.join('\n')}\n\nPowered by Ladybug` }, { quoted: msg });
  } catch (e) {
    console.log('[song] suggestions skipped:', e.message);
  }
}

const pendingPicks = new Map(); // "chat:sender" -> { video, at }
const PICK_TTL_MS = 10 * 60 * 1000;

async function sendPickButtons(sock, chatId, msg, caption, thumbnail) {
  const buttons = [
    { id: 'song_pick_audio', text: '🎵 Audio' },
    { id: 'song_pick_document', text: '📄 Document' },
    { id: 'song_pick_voice', text: '🎤 Voice note' },
  ];
  const text = `${caption}\n\nHow do you want it?`;
  try {
    if (sendInteractiveMessage) {
      const base = { text, footer: 'Tap an option', interactiveButtons: buttons.map((b) => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }),
      })) };
      if (thumbnail) base.image = { url: thumbnail };
      await sendInteractiveMessage(sock, chatId, base, { quoted: msg });
      return true;
    }
    if (sendButtons) {
      await sendButtons(sock, chatId, { title: '', text, footer: 'Tap an option', buttons }, { quoted: msg });
      return true;
    }
  } catch (e) {
    console.log('[song] pick buttons failed:', e.message);
  }
  return false;
}

module.exports = {
  name: 'song',
  aliases: ['music', 'yta', 'mp3', 'songdl'],
  category: 'media',
  description: 'Download audio from YouTube',
  usage: '.song <song name or YouTube link>  |  .song doc <name>  |  .song voice <name>',

  async execute(sock, msg, args, extra = {}) {
    const chatId = msg.key.remoteJid;
    const lockKey = `song:${chatId}:${extra.sender || msg.key.participant || chatId}`;
    if (!guard.acquire(lockKey)) {
      return sock.sendMessage(chatId, { text: '⏳ You already have a download running. Please wait for it to finish.' }, { quoted: msg });
    }
    try {
      return await this.run(sock, msg, args, extra);
    } finally {
      guard.release(lockKey);
    }
  },

  async run(sock, msg, args, extra = {}) {
    try {
      const chatId = msg.key.remoteJid;
      const pickKey = `${chatId}:${extra.sender || msg.key.participant || chatId}`;
      const MODES = { audio: 'audio', doc: 'document', document: 'document', file: 'document', voice: 'voice', ptt: 'voice', vn: 'voice' };

      let mode = null;
      let video = null;
      let rest = [...args];

      if (rest[0] === '__pick') {
        // Button tap: .song __pick <audio|document|voice>
        mode = MODES[String(rest[1] || '').toLowerCase()] || 'audio';
        const pending = pendingPicks.get(pickKey);
        if (!pending || Date.now() - pending.at > PICK_TTL_MS) {
          return await sock.sendMessage(chatId, { text: 'That song request expired. Send .song <name> again.' }, { quoted: msg });
        }
        pendingPicks.delete(pickKey);
        video = pending.video;
      } else {
        if (MODES[String(rest[0] || '').toLowerCase()] && rest.length > 1) {
          mode = MODES[String(rest.shift()).toLowerCase()];
        }
        const text = rest.join(' ').trim();

        if (!text) {
          return await sock.sendMessage(
            chatId,
            { text: 'Usage: .song <song name or YouTube link>\nOptional: .song doc <name> or .song voice <name>' },
            { quoted: msg }
          );
        }

        // Step 1: Resolve song information
        video = await resolveVideoInfo(text);
        if (!video?.url) {
          return await sock.sendMessage(chatId, { text: '❌ No results found on YouTube.' }, { quoted: msg });
        }

        const caption = `${video.title || 'YouTube Audio'}\nDuration: ${video.timestamp || '-'}\nPowered by Ladybug`;
        const hasThumb = video.thumbnail && /^https?:\/\//i.test(video.thumbnail);

        if (!mode) {
          // No mode given: let the user choose how to receive it.
          pendingPicks.set(pickKey, { video, at: Date.now() });
          const shown = await sendPickButtons(sock, chatId, msg, caption, hasThumb ? video.thumbnail : null);
          if (shown) return;
          // Buttons unavailable: fall through and send as normal audio.
          pendingPicks.delete(pickKey);
          mode = 'audio';
        } else if (hasThumb) {
          await sock.sendMessage(chatId, { image: { url: video.thumbnail }, caption }, { quoted: msg });
        } else {
          await sock.sendMessage(chatId, { text: caption }, { quoted: msg });
        }
      }

      mode = mode || 'audio';

      let audioData;
      let audioBuffer;
      let downloadSuccess = false;

      // Prioritize working Ladybug API routes first!
      const apiMethods = [
        { name: 'Ladybug API', method: () => ladybugSongDownload(video.url, video.title) },
        { name: 'EliteProTech (Ladybug)', method: () => APIs.getEliteProTechDownloadByUrl(video.url) },
        { name: 'Yupra (Ladybug)', method: () => APIs.getYupraDownloadByUrl(video.url) },
        { name: 'Prince API', method: () => princeSongDownload(video.url) },
        { name: 'Hector API', method: () => hectorSongDownload(video.url) },
      ];

      let serverBusy = false;
      for (const apiMethod of apiMethods) {
        if (serverBusy && apiMethod.name.includes('(Ladybug)')) continue; // same busy server
        try {
          audioData = await apiMethod.method();
          const audioUrl = pickUrl(audioData);
          if (!audioUrl) {
            console.log(`${apiMethod.name} returned no download URL, trying next...`);
            continue;
          }

          if (isIpLockedCdn(audioUrl)) {
            console.log(`${apiMethod.name} gave IP-locked CDN URL, trying next...`);
            continue;
          }

          const downloadHeaders = {
            'User-Agent': UA,
            Accept: '*/*',
            'Accept-Encoding': 'identity',
          };
          if (audioData.referer) downloadHeaders.Referer = audioData.referer;

          try {
            audioBuffer = await fetchAudioBuffer(audioUrl, downloadHeaders);
            if (audioBuffer?.length) {
              const detected = detectAudioFormat(audioBuffer);
              if (!detected) {
                const head = audioBuffer.slice(0, 60).toString('utf8').replace(/\s+/g, ' ');
                console.log(`${apiMethod.name} returned non-audio (${audioBuffer.length} bytes): ${head}`);
                audioBuffer = null;
                continue;
              }
              downloadSuccess = true;
              console.log(`[song] OK via ${apiMethod.name} (${audioBuffer.length} bytes, format: ${detected.name})`);
              break;
            }
          } catch (downloadErr) {
            console.log(`Download failed from ${apiMethod.name}:`, downloadErr.message);
            continue;
          }
        } catch (apiErr) {
          if (apiErr.busy) serverBusy = true;
          console.log(`${apiMethod.name} API error:`, apiErr.message);
          continue;
        }
      }

      // Local yt-dlp fallback if configured
      if (!downloadSuccess || !audioBuffer) {
        try {
          console.log('[song] HTTP APIs failed, trying local yt-dlp...');
          const local = await ytdlpAudio(video.url);
          if (local?.buffer?.length) {
            audioBuffer = local.buffer;
            downloadSuccess = true;
          }
        } catch (ytdlpErr) {
          console.log('[song] yt-dlp fallback failed:', ytdlpErr.message);
        }
      }

      if (!downloadSuccess || !audioBuffer) {
        const e = new Error(serverBusy ? 'busy' : 'All download sources failed. Please check connection to Ladybug API.');
        e.busy = serverBusy;
        throw e;
      }

      const formatInfo = detectAudioFormat(audioBuffer) || { name: 'MP3', ext: 'mp3' };
      let finalBuffer = audioBuffer;
      let finalMimetype = 'audio/mpeg';
      let finalExtension = 'mp3';

      if (formatInfo.ext !== 'mp3') {
        try {
          finalBuffer = await toAudio(audioBuffer, formatInfo.ext);
          if (!finalBuffer || finalBuffer.length === 0) {
            finalBuffer = audioBuffer; // Fallback to raw buffer
          }
        } catch (convErr) {
          console.log('[song] Audio conversion skipped, sending original format:', convErr.message);
          finalBuffer = audioBuffer;
          finalMimetype = formatInfo.ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
          finalExtension = formatInfo.ext;
        }
      }

      const safeTitle = (audioData?.title || video?.title || 'song').replace(/[^\w\s-]/g, '').trim() || 'song';

      // Send in the format the user picked
      if (mode === 'document') {
        await sock.sendMessage(
          chatId,
          { document: finalBuffer, mimetype: finalMimetype, fileName: `${safeTitle}.${finalExtension}`, caption: `${safeTitle}\nPowered by Ladybug` },
          { quoted: msg }
        );
      } else if (mode === 'voice') {
        let voiceBuffer;
        try {
          voiceBuffer = await toPTT(audioBuffer, formatInfo.ext);
        } catch (e) {
          console.log('[song] voice conversion failed, sending as audio:', e.message);
        }
        if (voiceBuffer?.length) {
          await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
        } else {
          await sock.sendMessage(
            chatId,
            { audio: finalBuffer, mimetype: finalMimetype, fileName: `${safeTitle}.${finalExtension}`, ptt: false },
            { quoted: msg }
          );
        }
      } else {
        await sock.sendMessage(
          chatId,
          { audio: finalBuffer, mimetype: finalMimetype, fileName: `${safeTitle}.${finalExtension}`, ptt: false },
          { quoted: msg }
        );
      }

      sendSuggestions(sock, chatId, msg, video); // fire and forget

      // Clean temp folder asynchronously
      try {
        const tempDir = path.join(__dirname, '../../temp');
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          const now = Date.now();
          files.forEach((file) => {
            const filePath = path.join(tempDir, file);
            try {
              const stats = fs.statSync(filePath);
              if (now - stats.mtimeMs > 60000) {
                fs.unlinkSync(filePath);
              }
            } catch (e) {}
          });
        }
      } catch (cleanupErr) {}
    } catch (err) {
      console.error('Song command error:', err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: err.busy ? guard.BUSY_MESSAGE : `❌ Failed to download song: ${err.message || 'Unknown error'}` },
        { quoted: msg }
      );
    }
  },
};
