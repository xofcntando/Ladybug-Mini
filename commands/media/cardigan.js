/**
 * Cardigan - one-tap Taylor Swift "cardigan" download
 * Reuses the full .song pipeline (multi-API fallbacks + yt-dlp).
 */

const song = require('./song');

const QUERY = 'Taylor Swift cardigan official audio';

module.exports = {
  name: 'cardigan',
  aliases: ['cardigansong'],
  category: 'media',
  description: 'Taylor Swift — cardigan (song)',
  usage: '.cardigan',

  async execute(sock, msg, args, extra) {
    return song.execute(sock, msg, [QUERY], extra);
  },
};
