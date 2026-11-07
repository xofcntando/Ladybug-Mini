/**
 * Wikipedia summary (via /v1/info/wiki)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'wiki',
  aliases: ['wikipedia', 'whatis'],
  category: 'info',
  description: 'Wikipedia summary of a topic',
  usage: '<topic>',

  async execute(sock, msg, args) {
    const q = args.join(' ').trim();
    if (!q) return replyText(sock, msg, `❌ Usage: ${config.prefix}wiki <topic>\n\nExample: ${config.prefix}wiki Nelson Mandela`);
    try {
      const d = await ladybugGet('/v1/info/wiki', { q });
      const caption = `📖 *${d.title}*${d.description ? `\n_${d.description}_` : ''}\n\n${d.summary}\n\n🔗 ${d.url}`;
      if (d.thumbnail) {
        try {
          return await sock.sendMessage(msg.key.remoteJid, { image: { url: d.thumbnail }, caption: caption.slice(0, 1000) }, { quoted: msg });
        } catch { /* fall back to text */ }
      }
      return replyText(sock, msg, caption);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
