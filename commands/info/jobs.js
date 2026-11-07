/**
 * Job search across several remote/on-site job boards (via our Ladybug API: /v1/jobs/search)
 */

const config = require('../../config');
const { ladybugGet, replyText, salaryText } = require('../../utils/ladybugApi');

const SOURCES = ['remotive', 'arbeitnow', 'remoteok', 'jobicy', 'themuse', 'himalayas'];

/** ",jobs python developer remote in germany min:60000 src:remoteok 7d" -> API params */
function parseArgs(args) {
  const p = { words: [] };
  const rest = [...args];
  while (rest.length) {
    const t = rest.shift();
    const low = t.toLowerCase();
    if (low === 'remote') p.remote = true;
    else if (low === 'onsite' || low === 'on-site') p.remote = false;
    else if (low === 'in' && rest.length) {
      const loc = [];
      // location is everything after "in" up to the next option
      while (rest.length && !/^(min:|src:|\d+d$|remote$|onsite$)/i.test(rest[0])) loc.push(rest.shift());
      p.location = loc.join(' ');
    } else if (/^min:(\d+)k?$/i.test(t)) {
      const m = /^min:(\d+)(k?)$/i.exec(t);
      p.min_salary = Number(m[1]) * (m[2] ? 1000 : 1);
    } else if (/^src:/i.test(t)) p.source = low.slice(4);
    else if (/^\d{1,3}d$/.test(low)) p.days = parseInt(low, 10);
    else if (/^(full-?time|part-?time|contract|freelance|internship)$/.test(low)) p.job_type = low.replace('-', ' ').replace(/(full|part)time/, '$1 time');
    else p.words.push(t);
  }
  return p;
}

module.exports = {
  name: 'jobs',
  aliases: ['jobsearch', 'findjob', 'vacancies'],
  category: 'info',
  description: 'Find jobs on remote job boards',
  usage: '<keywords> [remote] [in <place>] [min:60k] [7d] [src:remoteok]',

  async execute(sock, msg, args) {
    const prefix = config.prefix;
    if (!args.length) {
      return replyText(sock, msg,
        `💼 *Job search*\n\nUsage: ${prefix}jobs <keywords> [options]\n\n` +
        `Options:\n• remote - remote jobs only\n• in <place> - e.g. in germany, in berlin\n• min:60k - minimum yearly salary\n` +
        `• 7d - posted in the last 7 days\n• contract / freelance / internship\n• src:${SOURCES.join(' | src:')}\n\n` +
        `Examples:\n${prefix}jobs python developer remote\n${prefix}jobs designer in berlin 14d\n${prefix}jobs react min:80k`);
    }

    const p = parseArgs(args);
    try {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '💼', key: msg.key } });
      const data = await ladybugGet('/v1/jobs/search', {
        q: p.words.join(' '), remote: p.remote, location: p.location, min_salary: p.min_salary,
        days: p.days, job_type: p.job_type, source: p.source, limit: 6,
      });
      const jobs = data.jobs || [];
      if (!jobs.length) {
        return replyText(sock, msg, `❌ No jobs found for "${p.words.join(' ') || 'your search'}". Try fewer filters or other keywords.`);
      }
      let out = `💼 *${jobs.length} job${jobs.length > 1 ? 's' : ''} for "${p.words.join(' ') || 'all'}"*\n`;
      jobs.forEach((j, i) => {
        const sal = salaryText(j.salary);
        out += `\n*${i + 1}. ${j.title}*\n🏢 ${j.company || 'Unknown'}\n`;
        out += `📍 ${j.location || (j.remote ? 'Remote' : 'Not specified')}${j.remote && j.location ? ' (remote)' : ''}`;
        if (j.job_type) out += ` • ${j.job_type}`;
        out += '\n';
        if (sal) out += `💰 ${sal}\n`;
        if (j.posted_at) out += `🕒 ${j.posted_at.slice(0, 10)} • via ${j.source}\n`;
        out += `🔗 ${j.url}\n`;
      });
      const failed = data.errors ? Object.keys(data.errors).length : 0;
      if (failed) out += `\n_(${failed} job board${failed > 1 ? 's' : ''} did not answer)_`;
      out += `\n> 🐞 ${config.botName}`;
      return replyText(sock, msg, out);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
