/**
 * ApiStatus Command - Owner only
 * Shows whether the Ladybug download API is up and how its backends are doing.
 */
const axios = require('axios');
const config = require('../../config');

module.exports = {
  name: 'apistatus',
  aliases: ['apicheck', 'dlstatus'],
  category: 'owner',
  description: 'Check the Ladybug download API health (owner only)',
  usage: '.apistatus',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminOnly: false,

  async execute(sock, msg, args, extra) {
    const base = String(config.mediaApiUrl || config.ladybugApiUrl || '').replace(/\/$/, '');
    const key = config.mediaApiKey || config.ladybugApiKey || '';
    const lines = ['Ladybug API status', ''];
    try {
      const t0 = Date.now();
      const health = await axios.get(`${base}/health`, { timeout: 60000, validateStatus: () => true });
      const ms = Date.now() - t0;
      lines.push(`API: ${health.status === 200 ? 'online' : `HTTP ${health.status}`} (${ms} ms${ms > 5000 ? ', waking up' : ''})`);

      const { data, status } = await axios.get(`${base}/v1/media/status`, {
        headers: { 'X-API-Key': key },
        timeout: 60000,
        validateStatus: () => true,
      });
      if (status !== 200 || !data) {
        lines.push(`Media status: HTTP ${status}`);
      } else {
        lines.push(`Download order: ${(data.backend_order || []).join(' > ') || 'n/a'}`);
        if (data.vda) {
          const v = data.vda;
          lines.push(`VDA keys: ${v.usable}/${v.keys} usable, ${v.out_of_balance} out of balance, ${v.invalid} invalid`);
          if (v.last_error) lines.push(`VDA last error: ${String(v.last_error).slice(0, 140)}`);
          if (v.usable === 0) lines.push('ACTION: add or top up VDA keys');
        } else {
          lines.push('VDA: not configured');
        }
        lines.push(`Cookies: ${data.cookies?.set ? 'set' : 'not set'} | Proxy: ${data.proxy_set ? 'yes' : 'no'}`);
        const err = data.backend_last_error?.ytdlp;
        if (err) lines.push(`yt-dlp last error: ${String(err).slice(0, 160)}`);
      }
    } catch (e) {
      lines.push(`Could not reach the API: ${e.message}`);
    }
    await extra.reply(lines.join('\n'));
  },
};
