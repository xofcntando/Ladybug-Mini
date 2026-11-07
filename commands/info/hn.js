/**
 * Hacker News front page (via /v1/info/hn)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

const KINDS = ['top', 'new', 'best', 'ask', 'show', 'job'];

module.exports = {
  name: 'hn',
  aliases: ['hackernews'],
  category: 'info',
  description: 'Hacker News stories (top, new, best, ask, show, job)',
  usage: '[top|new|best|ask|show|job]',

  async execute(sock, msg, args) {
    const kind = KINDS.includes((args[0] || '').toLowerCase()) ? args[0].toLowerCase() : 'top';
    try {
      const d = await ladybugGet('/v1/info/hn', { kind, limit: 8 });
      let out = `🟧 *Hacker News: ${kind}*\n`;
      d.stories.forEach((s, i) => {
        out += `\n*${i + 1}. ${s.title}*\n`;
        if (s.score != null) out += `▲ ${s.score}${s.comments != null ? ` • 💬 ${s.comments}` : ''}\n`;
        out += `🔗 ${s.url}\n`;
      });
      out += `\n> ${config.prefix}hn ${KINDS.join(' | ')}`;
      return replyText(sock, msg, out);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
