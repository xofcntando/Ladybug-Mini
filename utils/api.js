/**
 * API Integration Utilities
 */

const axios = require('axios');

const api = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// API Endpoints
const APIs = {
  // Base URL + key for our own self-hosted Ladybug API (see config.js)
  base() {
    const config = require('../config');
    return String(config.ladybugApiUrl || config.mediaApiUrl || '').replace(/\/$/, '');
  },

  key() {
    const config = require('../config');
    return config.ladybugApiKey || config.mediaApiKey || '';
  },

  // Image Generation — our /v1/ai/image returns the image bytes directly
  generateImage: async (prompt) => {
    try {
      const response = await api.post(`${APIs.base()}/v1/ai/image`, { prompt }, {
        params: { apikey: APIs.key() },
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: { 'Content-Type': 'application/json', Accept: 'image/*' },
      });
      return { buffer: Buffer.from(response.data), contentType: response.headers['content-type'] || 'image/png' };
    } catch (error) {
      throw new Error('Failed to generate image');
    }
  },

  // AI Chat — our /v1/ai/chat returns { text, model, provider }
  chatAI: async (text) => {
    try {
      const response = await api.post(`${APIs.base()}/v1/ai/chat`, { prompt: text }, {
        params: { apikey: APIs.key() },
        timeout: 90000,
        headers: { 'Content-Type': 'application/json' },
      });
      const out = response.data || {};
      return { msg: out.text || out.msg || '' };
    } catch (error) {
      throw new Error('Failed to get AI response');
    }
  },

  // YouTube Download — compat route keeps the { success, result } shape the bot expects
  ytDownload: async (url, type = 'audio') => {
    try {
      const path = type === 'audio' ? '/api/download/ytaudio' : '/api/download/ytmp4';
      const response = await api.get(`${APIs.base()}${path}`, {
        params: { apikey: APIs.key(), url, format: type === 'audio' ? '128kbps' : `${require('../config').videoQuality || '360'}p` },
        timeout: 180000,
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to download YouTube video');
    }
  },
  
  // Instagram Download
  igDownload: async (url) => {
    try {
      const response = await api.get(`https://api.siputzx.my.id/api/d/igdl`, {
        params: { url }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to download Instagram content');
    }
  },
  
  // TikTok Download
  tiktokDownload: async (url) => {
    try {
      const response = await api.get(`https://api.siputzx.my.id/api/d/tiktok`, {
        params: { url }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to download TikTok video');
    }
  },
  
  // Translate — our /v1/ai/translate takes { text, target_language }
  translate: async (text, to = 'en') => {
    try {
      const response = await api.post(`${APIs.base()}/v1/ai/translate`, { text, target_language: to }, {
        params: { apikey: APIs.key() },
        timeout: 90000,
        headers: { 'Content-Type': 'application/json' },
      });
      const out = response.data || {};
      return { result: out.text || out.result || '' };
    } catch (error) {
      throw new Error('Translation failed');
    }
  },

  // Random Meme — our /v1/fun/meme
  getMeme: async (subreddit) => {
    try {
      const response = await api.get(`${APIs.base()}/v1/fun/meme`, {
        params: { apikey: APIs.key(), ...(subreddit ? { subreddit } : {}) },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch meme');
    }
  },

  // Random Quote — quotable.io is free and keyless, left as-is
  getQuote: async () => {
    try {
      const response = await api.get('https://api.quotable.io/random');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch quote');
    }
  },

  // Random Joke — our /v1/fun/joke
  getJoke: async () => {
    try {
      const response = await api.get(`${APIs.base()}/v1/fun/joke`, {
        params: { apikey: APIs.key() },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch joke');
    }
  },
  
  // Weather
  getWeather: async (city) => {
    try {
      const response = await api.get(`https://api.siputzx.my.id/api/tools/weather`, {
        params: { city }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch weather');
    }
  },
  
  // Shorten URL
  shortenUrl: async (url) => {
    try {
      const response = await api.get(`https://tinyurl.com/api-create.php`, {
        params: { url }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to shorten URL');
    }
  },
  
  // Wikipedia Search
  wikiSearch: async (query) => {
    try {
      const response = await api.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      throw new Error('Wikipedia search failed');
    }
  },
  
  // Song Download APIs
  // --- YouTube downloaders -------------------------------------------------
  // All of these used to hit unrelated third-party hosts (izumi, yupra, okatsu,
  // eliteprotech). They now delegate to our own self-hosted Ladybug API, which
  // returns { success, result: { title, thumbnail, download, ... } }.
  _ytFetch: async ({ url, query, kind = 'audio' }) => {
    const path = kind === 'audio' ? '/api/download/ytaudio' : '/api/download/ytmp4';
    const params = { apikey: APIs.key(), format: kind === 'audio' ? '128kbps' : '720p' };
    if (url) params.url = url; else params.query = query;
    const res = await axios.get(`${APIs.base()}${path}`, {
      params,
      timeout: 180000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    });
    const result = res?.data?.result || res?.data;
    if (!result || !(result.download || result.dl_url || result.dl)) {
      throw new Error(result?.error || res?.data?.error || 'Ladybug API returned no download');
    }
    if (!result.download) result.download = result.dl_url || result.dl;
    return result;
  },

  getIzumiDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getIzumiDownloadByQuery: async (query) => APIs._ytFetch({ query, kind: 'audio' }),
  getYupraDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getOkatsuDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getEliteProTechDownloadByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'audio' }),
  getEliteProTechVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),
  getYupraVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),
  getOkatsuVideoByUrl: async (youtubeUrl) => APIs._ytFetch({ url: youtubeUrl, kind: 'video' }),
  getTikTokDownload: async (url) => {
    const apiUrl = `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`;
    try {
      const response = await axios.get(apiUrl, { 
        timeout: 15000,
        headers: {
          'accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data && response.data.status && response.data.data) {
        let videoUrl = null;
        let title = null;
        
        if (response.data.data.urls && Array.isArray(response.data.data.urls) && response.data.data.urls.length > 0) {
          videoUrl = response.data.data.urls[0];
          title = response.data.data.metadata?.title || 'TikTok Video';
        } else if (response.data.data.video_url) {
          videoUrl = response.data.data.video_url;
          title = response.data.data.metadata?.title || 'TikTok Video';
        } else if (response.data.data.url) {
          videoUrl = response.data.data.url;
          title = response.data.data.metadata?.title || 'TikTok Video';
        } else if (response.data.data.download_url) {
          videoUrl = response.data.data.download_url;
          title = response.data.data.metadata?.title || 'TikTok Video';
        }
        
        return { videoUrl, title };
      }
      throw new Error('Invalid API response');
    } catch (error) {
      throw new Error('TikTok download failed');
    }
  },
  
  // Screenshot Website — our own /v1/screenshot (Playwright/Chromium, no third party)
  screenshotWebsite: async (url) => {
    try {
      const response = await axios.get(`${APIs.base()}/v1/screenshot`, {
        params: { apikey: APIs.key(), url },
        timeout: 60000,
        responseType: 'arraybuffer',
        headers: { accept: 'image/*', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (response.headers['content-type']?.includes('image')) {
        return Buffer.from(response.data);
      }
      throw new Error('Screenshot API returned no image');
    } catch (error) {
      throw new Error('Failed to take screenshot');
    }
  },

  ladybugBase() {
    const config = require('../config');
    return (config.ladybugApiUrl || config.knightApiUrl || config.mediaApiUrl || '').replace(/\/$/, '');
  },

  ladybugKey() {
    const config = require('../config');
    return config.ladybugApiKey || config.knightApiKey || config.mediaApiKey || '';
  },

  // Ladybug card PNG — GET /v1/cards/:kind (welcome, goodbye, wanted, jail, …)
  getCardImage: async (kind, params = {}) => {
    const card = String(kind || '').trim().toLowerCase();
    if (!card) throw new Error('Card type required');
    const response = await api.get(`${APIs.ladybugBase()}/v1/cards/${encodeURIComponent(card)}`, {
      params: { apikey: APIs.ladybugKey(), ...params },
      timeout: 45000,
      responseType: 'arraybuffer',
      headers: { Accept: 'image/png' },
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

  // Upload an image buffer to our own /v1/files and get a public URL
  uploadTempImage: async (buffer, filename = 'image.jpg', contentType = 'image/jpeg') => {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType });
    const { data } = await axios.post(`${APIs.base()}/v1/files`, form, {
      params: { apikey: APIs.key() },
      headers: { ...form.getHeaders(), Accept: 'application/json' },
      timeout: 60000,
      maxBodyLength: 25 * 1024 * 1024,
    });
    const url = data?.download_url || data?.url;
    if (!url) throw new Error('Image upload failed');
    return url;
  },

  // Ladybug meme maker — POST /v1/image/meme (url, top, optional bottom) returns the PNG
  getMemeImage: async ({ url, top, bottom }) => {
    const payload = { url, top };
    if (bottom) payload.bottom = bottom;
    const response = await api.post(`${APIs.ladybugBase()}/v1/image/meme`, payload, {
      params: { apikey: APIs.ladybugKey() },
      timeout: 45000,
      responseType: 'arraybuffer',
      headers: { 'Content-Type': 'application/json', Accept: 'image/png' },
      validateStatus: () => true,
    });
    const body = Buffer.from(response.data || []);
    if (String(response.headers['content-type'] || '').includes('json')) {
      let data = {};
      try { data = JSON.parse(body.toString()); } catch {}
      throw new Error(data?.detail || data?.error || data?.message || 'Meme failed');
    }
    if (response.status >= 400 || body.length < 80) throw new Error(`Meme failed (${response.status})`);
    return body;
  },

  // Ladybug Reactions GIF — GET /v1/anime/react?action=:type
  getReactionGif: async (type) => {
    const kind = String(type || '').trim().toLowerCase();
    if (!kind) throw new Error('GIF type required');
    const response = await api.get(`${APIs.ladybugBase()}/v1/anime/react`, {
      params: { apikey: APIs.ladybugKey(), action: kind },
      timeout: 20000,
      headers: { Accept: 'application/json' },
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

  // Text to Speech API
  textToSpeech: async (text) => {
    try {
      // Our /v1/ai/tts returns MP3 bytes; store=true gives a public download URL instead
      const response = await axios.post(`${APIs.base()}/v1/ai/tts`,
        { text, voice: 'nova', store: true },
        {
          params: { apikey: APIs.key() },
          timeout: 90000,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
