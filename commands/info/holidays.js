/**
 * Upcoming public holidays for a country (via /v1/info/holidays)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'holidays',
  aliases: ['holiday', 'publicholidays'],
  category: 'info',
  description: 'Upcoming public holidays for a country',
  usage: '<country code, e.g. US, DE, ZA> [year]',

  async execute(sock, msg, args) {
    const cc = (args[0] || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) {
      return replyText(sock, msg, `❌ Usage: ${config.prefix}holidays <2-letter country code> [year]\n\nExample: ${config.prefix}holidays ZA`);
    }
    const year = /^\d{4}$/.test(args[1] || '') ? Number(args[1]) : undefined;
    try {
      const d = await ladybugGet('/v1/info/holidays', { country: cc, year, upcoming: year ? undefined : true });
      if (!d.holidays.length) return replyText(sock, msg, `No more public holidays listed for ${cc} in ${d.year}.`);
      const list = d.holidays.slice(0, 12).map((h) => `• ${h.date} - ${h.name}${h.local_name && h.local_name !== h.name ? ` (${h.local_name})` : ''}`);
      return replyText(sock, msg, `🎉 *${year ? '' : 'Upcoming '}public holidays: ${cc} ${d.year}*\n\n${list.join('\n')}`);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
