/**
 * Job market snapshot for a role (via /v1/jobs/insights)
 */

const config = require('../../config');
const { ladybugGet, replyText, money } = require('../../utils/ladybugApi');

module.exports = {
  name: 'jobstats',
  aliases: ['salary', 'jobmarket'],
  category: 'info',
  description: 'Openings, top skills and pay for a role',
  usage: '<role or skill> [remote]',

  async execute(sock, msg, args) {
    const remote = args.some((a) => a.toLowerCase() === 'remote');
    const q = args.filter((a) => a.toLowerCase() !== 'remote').join(' ').trim();
    if (!q) {
      return replyText(sock, msg, `📊 Usage: ${config.prefix}jobstats <role or skill> [remote]\n\nExample: ${config.prefix}jobstats react developer`);
    }
    try {
      const d = await ladybugGet('/v1/jobs/insights', { q, remote: remote || undefined }, { timeout: 60000 });
      if (!d.openings_found) return replyText(sock, msg, `❌ No openings found for "${q}".`);
      let out = `📊 *Job market: ${q}*\n\n🧮 Openings found: *${d.openings_found}*\n`;
      if (d.remote_share != null) out += `🌍 Remote: ${Math.round(d.remote_share * 100)}%\n`;
      if (d.salary) {
        out += `💰 Published pay (yearly, mostly USD, ${d.salary.jobs_with_salary} jobs): median *${money(d.salary.median)}*, ` +
          `range ${money(d.salary.min)} - ${money(d.salary.max)}\n`;
      }
      if (d.top_tags?.length) out += `\n🛠 *Top skills / tags*\n${d.top_tags.slice(0, 8).map((t) => `• ${t.tag} (${t.count})`).join('\n')}\n`;
      if (d.top_companies?.length) out += `\n🏢 *Hiring most*\n${d.top_companies.slice(0, 5).map((c) => `• ${c.company} (${c.count})`).join('\n')}\n`;
      out += `\n> Use ${config.prefix}jobs ${q} to see the listings.`;
      return replyText(sock, msg, out);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
