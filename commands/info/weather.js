/**
 * Weather - current conditions + forecast (via /v1/info/weather, no third-party key needed)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'weather',
  aliases: ['w', 'clima', 'forecast'],
  category: 'info',
  description: 'Weather and 3-day forecast for a city',
  usage: '<city> [imperial]',

  async execute(sock, msg, args) {
    const imperial = args.some((a) => /^(imperial|f|fahrenheit)$/i.test(a));
    const city = args.filter((a) => !/^(imperial|f|fahrenheit)$/i.test(a)).join(' ').trim();
    if (!city) {
      return replyText(sock, msg, `❌ Usage: ${config.prefix}weather <city>\n\nExample: ${config.prefix}weather London\n${config.prefix}weather New York imperial`);
    }
    try {
      const d = await ladybugGet('/v1/info/weather', { city, days: 3, units: imperial ? 'imperial' : 'metric' });
      const u = d.units, c = d.current, pl = d.place || {};
      let out = `🌦 *Weather in ${pl.name || city}${pl.country ? `, ${pl.country}` : ''}*\n\n`;
      out += `${c.summary}\n🌡 ${c.temperature}${u.temperature} (feels like ${c.feels_like}${u.temperature})\n`;
      out += `💧 Humidity ${c.humidity_pct}%\n💨 Wind ${c.wind_speed} ${u.wind}\n`;
      out += `\n📅 *Forecast*\n`;
      d.forecast.forEach((f) => {
        out += `• ${f.date}: ${f.summary}, ${f.temp_min}-${f.temp_max}${u.temperature}`;
        if (f.rain_chance_pct != null) out += `, rain ${f.rain_chance_pct}%`;
        out += '\n';
      });
      return replyText(sock, msg, out.trimEnd());
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
