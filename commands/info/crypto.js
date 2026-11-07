/**
 * Crypto prices (via /v1/info/crypto, CoinGecko ids)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

const SYMBOLS = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple', ada: 'cardano',
  doge: 'dogecoin', ltc: 'litecoin', dot: 'polkadot', trx: 'tron', usdt: 'tether', matic: 'matic-network',
  avax: 'avalanche-2', link: 'chainlink', shib: 'shiba-inu', ton: 'the-open-network',
};

module.exports = {
  name: 'crypto',
  aliases: ['btc', 'cryptoprice', 'coinprice'],
  category: 'info',
  description: 'Crypto price with 24h change',
  usage: '[coin ...] [in usd|eur|zar]',

  async execute(sock, msg, args) {
    let vs = 'usd';
    const rest = [...args];
    const at = rest.findIndex((a) => a.toLowerCase() === 'in');
    if (at >= 0) { vs = (rest[at + 1] || 'usd').toLowerCase(); rest.splice(at, 2); }
    const coins = (rest.length ? rest : ['bitcoin', 'ethereum']).map((c) => SYMBOLS[c.toLowerCase()] || c.toLowerCase());
    try {
      const d = await ladybugGet('/v1/info/crypto', { ids: coins.join(','), vs });
      const lines = Object.entries(d.prices).map(([id, p]) => {
        const price = p[vs], ch = p[`${vs}_24h_change`];
        const arrow = ch >= 0 ? '🟢' : '🔴';
        const fmt = price >= 1 ? price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(price);
        return `${arrow} *${id}*: ${fmt} ${vs.toUpperCase()}${ch != null ? ` (${ch >= 0 ? '+' : ''}${ch.toFixed(2)}% 24h)` : ''}`;
      });
      if (!lines.length) throw new Error('No data for those coins.');
      return replyText(sock, msg, `🪙 *Crypto prices*\n\n${lines.join('\n')}`);
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}\n\nExample: ${config.prefix}crypto btc eth in eur`);
    }
  },
};
