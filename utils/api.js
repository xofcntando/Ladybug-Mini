/**
 * API Integration Utilities - Ladybug Mini
 * Fixed for Ladybug API (https://ladybug-api-e8q8.onrender.com)
 */

const axios = require('axios');

const api = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

const APIs = {
  // Base URL for Ladybug API
  base() {
    const config = require('../config');
    return String(config.mediaApiUrl || config.ladybugApiUrl || config.knightApiUrl || 'https://ladybug-api-e8q8.onrender.com').replace(/\/$/, '');
  },

  // API Key for Ladybug API
  key() {
    const config = require('../config');
    return String(config.mediaApiKey || config.ladybugApiKey || config.knightApiKey || 'nzN64y+bq1bd/QwnMLOxxQDgG5AL78ul82qg4tPI1lk=').trim();
  },

  // Standard headers with X-API-Key
  headers(extra = {}) {
    return {
      'X-API-Key': APIs.key(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      ...extra,
    };
  },

  // YouTube Audio & Video Fetcher
  _ytFetch: async ({ url, query, kind = 'audio' }) => {
    const apiKey = APIs.key();
    const primaryPath = kind === 'audio' ? '/api/ytmp3' : '/api/download/ytmp4';
    const fallbackPath = kind === 'audio' ? '/api/download/ytaudio' : '/v1/media/ytmp4';
    
    const params = { format: kind === 'audio' ? '128kbps' : '720p', apikey: encodeURIComponent(apiKey) };
    if (url) params.url = url; else params.query = query;

    // Try primary path first
    for (const p of [primaryPath, fallbackPath]) {
      try {
        const res = await axios.get(`${APIs.base()}${p}`, {
          params,
          timeout: 120000,
          validateStatus: () => true,
          headers: APIs.headers(),
        });

        if (res.status < 400 && res.data && res.data.success !== false) {
          const result = res.data?.result || res.data;
          const download = result.download || result.dl_url || result.dl || result.file?.download_url || result.download_url;
          if (download) {
            return {
              ...result,
              download,
              dl_url: download,
              dl: download,
            };
          }
        }
      } catch (e) {
        console.log(`_ytFetch ${p} attempt error:`, e.message);
      }
    }

    throw new Error('Ladybug API media request failed on all endpoints');
  },

  // Audio helpers
  getIzumiDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getIzumiDownloadByQuery: async (query) => APIs._ytFetch({ query, kind: 'audio' }),
  getYupraDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getOkatsuDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getEliteProTechDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),

  // Video helpers
  getEliteProTechVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),
  getYupraVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),
  getOkatsuVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),

  // Image Generation
  generateImage: async (prompt) => {
    try {
      const response = await api.post(`${APIs.base()}/v1/ai/image`, { prompt }, {
        params: { apikey: encodeURIComponent(APIs.key()) },
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: APIs.headers({ 'Content-Type': 'application/json', Accept: 'image/*' }),
      });
      return { buffer: Buffer.from(response.data), contentType: response.headers['content-type'] || 'image/png' };
    } catch (error) {
      throw new Error('Failed to generate image');
    }
  },

  // AI Chat
  chatAI: async (text) => {
    try {
      const response = await api.post(`${APIs.base()}/v1/ai/chat`, { prompt: text }, {
        params: { apikey: encodeURIComponent(APIs.key()) },
        timeout: 90000,
        headers: APIs.headers({ 'Content-Type': 'application/json' }),
      });
      const out = response.data || {};
      return { msg: out.text || out.msg || '' };
    } catch (error) {
      throw new Error('Failed to get AI response');
    }
  },

  // YouTube Download
  ytDownload: async (url, type = 'audio') => {
    return APIs._ytFetch({ url, kind: type });
  },

  // Screenshot Website
  screenshotWebsite: async (url) => {
    try {
      const response = await axios.get(`${APIs.base()}/v1/screenshot`, {
        params: { apikey: encodeURIComponent(APIs.key()), url },
        timeout: 60000,
        responseType: 'arraybuffer',
        headers: APIs.headers({ Accept: 'image/*' }),
      });
      if (response.headers['content-type']?.includes('image')) {
        return Buffer.from(response.data);
      }
      throw new Error('Screenshot API returned no image');
    } catch (error) {
      throw new Error('Failed to take screenshot');
    }
  },

  // Card Image
  getCardImage: async (kind, params = {}) => {
    const card = String(kind || '').trim().toLowerCase();
    if (!card) throw new Error('Card type required');
    const response = await api.get(`${APIs.base()}/v1/cards/${encodeURIComponent(card)}`, {
      params: { apikey: encodeURIComponent(APIs.key()), ...params },
      timeout: 45000,
      responseType: 'arraybuffer',
      headers: APIs.headers({ Accept: 'image/png' }),
      validateStatus: () => true,
    });
    const ctype = String(response.headers['content-type'] || '');
    if (ctype.includes('json')) {
      let data = {};
      try { data = JSON.parse(Buffer.from(response.data).toString()); } catch {}
      throw new Error(data.error || data.message || `Card ${card} failed`);
    }
    if (response.status >= 400 || !response.data || response.data.byteLength < 80) {
      throw new Error(`Card ${card} failed (${response.status})`);
    }
    return Buffer.from(response.data);
  },

  // Upload Temp Image
  uploadTempImage: async (buffer, filename = 'image.jpg', contentType = 'image/jpeg') => {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType });
    const { data } = await axios.post(`${APIs.base()}/v1/files`, form, {
      params: { apikey: encodeURIComponent(APIs.key()) },
      headers: APIs.headers({ ...form.getHeaders() }),
      timeout: 60000,
      maxBodyLength: 25 * 1024 * 1024,
    });
    const url = data?.download_url || data?.url;
    if (!url) throw new Error('Image upload failed');
    return url;
  },

  // Reactions GIF
  getReactionGif: async (type) => {
    const kind = String(type || '').trim().toLowerCase();
    if (!kind) throw new Error('GIF type required');
    const response = await api.get(`${APIs.base()}/v1/anime/react`, {
      params: { apikey: encodeURIComponent(APIs.key()), action: kind },
      timeout: 20000,
      headers: APIs.headers(),
    });
    const data = response.data || {};
    const result = data.result || data;
    const url = result.url || result.image || data.url;
    if (!url) throw new Error(data.error || result.error || `No ${kind} gif`);
    return {
      type: result.type || kind,
      url,
      image: result.image || url,
      title: result.title || kind,
      anime: result.anime || null,
      pairing: result.pairing || null,
    };
  },

  // Text to Speech
  textToSpeech: async (text) => {
    try {
      const response = await axios.post(`${APIs.base()}/v1/ai/tts`,
        { text, voice: 'nova', store: true },
        {
          params: { apikey: encodeURIComponent(APIs.key()) },
          timeout: 90000,
          headers: APIs.headers({ 'Content-Type': 'application/json' }),
        });
      const data = response.data || {};
      const url = data.download_url || data.url;
      if (!url) throw new Error('TTS returned no download URL');
      return url;
    } catch (error) {
      throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }
};

module.exports = APIs;
