/**
 * Play Command - one entry point for YouTube audio and video.
 *
 *   .play <name or link>        audio (same engine as .song)
 *   .play -v <name or link>     video (same engine as .ytvideo)
 *
 * This exists because `.play` used to be nothing but an alias of `.song`, so
 * the usage text it printed said ".song ..." and there was no way to ask for a
 * video. Now `.play` is a real command: it owns its own help text, defaults to
 * audio, and takes -v / --video to hand over to the video downloader.
 *
 * The heavy lifting stays in song.js and video.js, so there is one downloader
 * implementation to maintain, not three.
 */

const config = require('../../config');
const song = require('./song');
const video = require('./video');

const VIDEO_FLAGS = new Set(['-v', '--video', '-vid', 'video', 'mp4']);

module.exports = {
  name: 'play',
  aliases: ['playsong', 'playaudio'],
  category: 'media',
  description: 'Play a song, or a video with -v, straight from YouTube',
  usage: '.play <song name or link>  •  .play -v <video name or link>',

  async execute(sock, msg, args, extra) {
    const chatId = extra?.from || msg.key.remoteJid;
    const reply = extra?.reply || ((text) => sock.sendMessage(chatId, { text }, { quoted: msg }));

    const words = [...args];
    let wantsVideo = false;

    // Flags can appear anywhere, but only before the query starts.
    while (words.length && VIDEO_FLAGS.has(String(words[0]).toLowerCase())) {
      wantsVideo = true;
      words.shift();
    }

    const query = words.join(' ').trim();
    if (!query) {
      return reply(
        `🎵 *${config.botName} Play*\n\n` +
        `*Audio:*\n${config.prefix}play <song name or YouTube link>\n\n` +
        `*Video:*\n${config.prefix}play -v <video name or YouTube link>\n\n` +
        `_Example:_ ${config.prefix}play Tyla Water`
      );
    }

    const target = wantsVideo ? video : song;
    // Both downloaders read args as a plain list, so hand the cleaned query back.
    return target.execute(sock, msg, [query], extra || { from: chatId, reply });
  },
};
