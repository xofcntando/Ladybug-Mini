/**
 * Advanced Translate Command
 * ---------------------------------
 * One command, every usage pattern:
 *   .translate <lang> <text>     -> language first
 *   .translate <text> <lang>     -> text first
 *   .translate <lang>            -> reply to any message
 *   .tr / .trt / .trans          -> aliases
 *
 * Multi-provider fallback (Google gtx -> MyMemory -> dread -> siputzx),
 * so a single dead mirror never breaks translation. Auto-detects the source
 * language and resolves friendly language names (e.g. "french" -> fr).
 */

const fetch = require('node-fetch');
const APIs = require('../../utils/api');

// Friendly names -> ISO codes, so `.translate french hello` works too.
const LANG_ALIASES = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', russian: 'ru', japanese: 'ja', korean: 'ko', chinese: 'zh',
  arabic: 'ar', hindi: 'hi', urdu: 'ur', bengali: 'bn', tamil: 'ta',
  telugu: 'te', marathi: 'mr', gujarati: 'gu', punjabi: 'pa', malayalam: 'ml',
  kannada: 'kn', turkish: 'tr', dutch: 'nl', greek: 'el', polish: 'pl',
  swedish: 'sv', danish: 'da', finnish: 'fi', norwegian: 'no', hebrew: 'he',
  thai: 'th', vietnamese: 'vi', indonesian: 'id', malay: 'ms', filipino: 'tl',
  swahili: 'sw', ukrainian: 'uk', romanian: 'ro', czech: 'cs', hungarian: 'hu',
  persian: 'fa', farsi: 'fa', nepali: 'ne', sinhala: 'si', burmese: 'my',
};

const resolveLang = (token) => {
  if (!token) return null;
  const t = String(token).trim().toLowerCase();
  if (LANG_ALIASES[t]) return LANG_ALIASES[t];
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(t)) return t;
  return null;
};

const getQuotedText = (msg) => {
  const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!q) return '';
  return (
    q.conversation ||
    q.extendedTextMessage?.text ||
    q.imageMessage?.caption ||
    q.videoMessage?.caption ||
    q.documentMessage?.caption ||
    ''
  );
};

const googleTranslate = async (text, lang) => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('google http ' + res.status);
  const data = await res.json();
  const out = (data?.[0] || []).map((p) => p?.[0]).filter(Boolean).join('');
  if (!out) throw new Error('google empty');
  return { text: out, provider: 'Google' };
};

const myMemoryTranslate = async (text, lang) => {
  // MyMemory rejects "auto" as a source; use English as the fallback source.
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) throw new Error('mymemory http ' + res.status);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || /INVALID SOURCE LANGUAGE/i.test(out)) throw new Error('mymemory empty');
  return { text: out, provider: 'MyMemory' };
};

const dreadTranslate = async (text, lang) => {
  const url = `https://api.dreaded.site/api/translate?text=${encodeURIComponent(text)}&lang=${lang}`;
  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) throw new Error('dread http ' + res.status);
  const data = await res.json();
  const out = data?.translated || data?.result;
  if (!out) throw new Error('dread empty');
  return { text: out, provider: 'Dreaded' };
};

const siputzxTranslate = async (text, lang) => {
  const result = await APIs.translate(text, lang);
  const out = result?.translation || result?.result || result;
  if (!out || typeof out !== 'string') throw new Error('siputzx empty');
  return { text: out, provider: 'Siputzx' };
};

const PROVIDERS = [googleTranslate, myMemoryTranslate, siputzxTranslate, dreadTranslate];

const translateWithFallback = async (text, lang) => {
  const errors = [];
  for (const provider of PROVIDERS) {
    try {
      return await provider(text, lang);
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error('All providers failed: ' + errors.join(' | '));
};

module.exports = {
  name: 'translate',
  aliases: ['tr', 'trt', 'trans'],
  category: 'general',
  description: 'Translate text to another language (reply or inline, multi-provider)',
  usage: '.translate <lang> <text> | .translate <text> <lang> | reply + .translate <lang>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const reply = (text) => extra?.reply
      ? extra.reply(text)
      : sock.sendMessage(chatId, { text }, { quoted: msg });

    try {
      try { await sock.sendPresenceUpdate('composing', chatId); } catch (_) {}

      const quoted = getQuotedText(msg);
      let text = '';
      let lang = null;

      if (quoted) {
        // Reply mode: all args (or the first resolvable token) is the language.
        lang = resolveLang(args[0]) || resolveLang(args.join(' ').trim());
        text = quoted;
        if (!lang && args.length) {
          // No explicit language: default to English when replying.
          lang = 'en';
        }
      } else {
        // Inline mode: figure out which side is the language code.
        const first = resolveLang(args[0]);
        const last = resolveLang(args[args.length - 1]);

        if (first && args.length >= 2) {
          lang = first;
          text = args.slice(1).join(' ');
        } else if (last && args.length >= 2) {
          lang = last;
          text = args.slice(0, -1).join(' ');
        } else if (first && args.length === 1) {
          // Single token that is a language: nothing to translate.
          lang = first;
          text = '';
        }
      }

      if (!text) {
        return reply(
          '🌐 *TRANSLATOR*\n\n' +
          '*Usage:*\n' +
          '• `.translate <lang> <text>` — e.g. `.translate es Hello world`\n' +
          '• `.translate <text> <lang>` — e.g. `.translate Hello world es`\n' +
          '• Reply to any message with `.translate <lang>`\n\n' +
          '*Examples:*\n' +
          '• `.tr french good morning`\n' +
          '• `.trt how are you ja`\n\n' +
          '*Common codes:* en, es, fr, de, it, pt, ru, ja, ko, zh, ar, hi, ur, ta, te'
        );
      }

      if (!lang) {
        return reply('❌ Please specify a target language.\n\nExample: `.translate hello fr`');
      }

      await reply('🔄 Translating...');

      const { text: translated, provider } = await translateWithFallback(text, lang);

      const out =
        '🌐 *Translation*\n\n' +
        `📝 *Original:* ${text.length > 500 ? text.slice(0, 500) + '…' : text}\n` +
        `🔤 *Translated:* ${translated}\n` +
        `🌍 *Language:* ${lang.toUpperCase()}\n` +
        `⚙️ *Provider:* ${provider}`;

      return reply(out);
    } catch (error) {
      return reply(`❌ Translation failed!\n\nError: ${error.message}`);
    }
  },
};
