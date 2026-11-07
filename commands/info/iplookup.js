/**
 * IP geolocation (via /v1/info/ip). Public IPs only.
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'ip',
  aliases: ['iplookup', 'ipinfo'],
  category: 'info',
  description: 'Location and ISP of a public IP address',
  usage: '<ip address>',

  async execute(sock, msg, args) {
    const ip = (args[0] || '').trim();
    if (!ip) return replyText(sock, msg, `❌ Usage: ${config.prefix}ip <address>\n\nExample: ${config.prefix}ip 8.8.8.8`);
    try {
      const d = await ladybugGet('/v1/info/ip', { ip });
      const out = `🌐 *${d.ip}* (${d.type})\n\n📍 ${[d.city, d.region, d.country].filter(Boolean).join(', ')}\n` +
        `🕒 ${d.timezone || 'n/a'}\n🏢 ${d.isp || d.org || 'n/a'}${d.asn ? ` (AS${d.asn})` : ''}\n` +
        `🧭 ${d.latitude}, ${d.longitude}\n🗺 https://maps.google.com/?q=${d.latitude},${d.longitude}`;
      return replyText(sock, msg, out);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
