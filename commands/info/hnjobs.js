/**
 * Hacker News "Who is hiring?" posts (via /v1/jobs/hn-hiring)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'hnjobs',
  aliases: ['hnhiring', 'whoishiring'],
  category: 'info',
  description: 'Jobs from the Hacker News "Who is hiring?" thread',
  usage: '<keywords>',

  async execute(sock, msg, args) {
    const q = args.join(' ').trim();
    try {
      const d = await ladybugGet('/v1/jobs/hn-hiring', { q, limit: 5 });
      const posts = d.posts || [];
      if (!posts.length) return replyText(sock, msg, `❌ No posts found${q ? ` for "${q}"` : ''}.`);
      let out = `🧑‍💻 *${d.thread}*${q ? `\nSearch: "${q}"` : ''} (${d.total_matches ?? posts.length} matches)\n`;
      posts.forEach((p, i) => {
        const text = p.text.replace(/\s+/g, ' ');
        out += `\n*${i + 1}.* ${text.length > 330 ? `${text.slice(0, 330).trimEnd()}…` : text}\n🔗 ${p.url}\n`;
      });
      out += `\n> Try ${config.prefix}hnjobs python remote`;
      return replyText(sock, msg, out);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
