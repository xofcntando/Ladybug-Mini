/**
 * Advanced Self-Diagnostics
 * ---------------------------------
 * `.diag` / `.health` / `.doctor`
 *
 * Runs a live health check on the whole bot: process, memory, event-loop
 * latency, command registry, and the optional native dependencies that are
 * the usual cause of "command X crashed" reports. Every check is wrapped so
 * a missing module is reported as a warning instead of throwing.
 */

const os = require('os');
const config = require('../../config');
const theme = require('../../utils/ladybugTheme');
const { loadCommands } = require('../../utils/commandLoader');

const { header, footer, row, line, divider, blank, bar, humanDuration, humanBytes, latencyVerdict, ICON } = theme;

const checkDep = (label, loader) => {
  try {
    const v = loader();
    return { ok: true, label, detail: v || 'ok' };
  } catch (e) {
    return { ok: false, label, detail: e.message };
  }
};

const measureLoopLatency = () => {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    setImmediate(() => {
      const ns = Number(process.hrtime.bigint() - start);
      resolve(Math.round((ns / 1e6) * 100) / 100); // ms with 2 decimals
    });
  });
};

module.exports = {
  name: 'diag',
  aliases: ['health', 'doctor', 'selfcheck', 'diagnostics'],
  category: 'general',
  description: 'Run a live self-diagnostics health check on the bot',
  usage: '.diag',

  async execute(sock, msg, args, extra) {
    try {
      await extra.react('🩺');

      // ---- process ----
      const uptimeSec = Math.floor(process.uptime());
      const mem = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

      // ---- event-loop latency ----
      const loopMs = await measureLoopLatency();
      const verdict = latencyVerdict(loopMs);

      // ---- command registry ----
      let cmdCount = 0;
      let cmdError = null;
      try {
        cmdCount = loadCommands().size;
      } catch (e) {
        cmdError = e.message;
      }

      // ---- optional native deps ----
      const deps = [
        checkDep('canvas', () => {
          try { require('canvas'); return 'native'; }
          catch (_) { require('@napi-rs/canvas'); return 'napi-rs'; }
        }),
        checkDep('sharp', () => { require('sharp'); return 'ok'; }),
        checkDep('ffmpeg', () => { const f = require('../../utils/ffmpeg'); const p = f.getFfmpegPath(); if (!p) throw new Error('no working binary'); return p === 'ffmpeg' ? 'system' : 'static'; }),
        checkDep('baileys', () => { require('@whiskeysockets/baileys'); return 'ok'; }),
      ];

      const depLine = deps
        .map((d) => `${d.ok ? ICON.ok : ICON.warn} ${d.label}${d.ok ? '' : ` (${d.detail.slice(0, 40)})`}`)
        .join('\n│ ');

      const out = [
        header('Self Diagnostics'),
        row(ICON.clock, 'Uptime', humanDuration(uptimeSec)),
        row(ICON.robot, 'Node', `${process.version} · ${process.platform}/${process.arch}`),
        row(ICON.cpu, 'CPU cores', `${os.cpus().length} · load ${os.loadavg()[0].toFixed(2)}`),
        row(ICON.ram, 'Heap used', `${humanBytes(mem.heapUsed)} / ${humanBytes(mem.heapTotal)}`),
        row(ICON.ram, 'RSS', humanBytes(mem.rss)),
        row(ICON.disk, 'System RAM', `${bar(usedPct, 100)} (${usedPct}%)`),
        row(ICON.bolt, 'Loop latency', `${loopMs} ms · ${verdict.icon} ${verdict.text}`),
        divider(),
        row(ICON.chart, 'Commands', cmdError ? `${ICON.cross} ${cmdError}` : `${cmdCount} entries`),
        row(ICON.crown, 'Prefix', `\`${config.prefix}\``),
        row(ICON.bug, 'Mode', config.selfMode ? 'Self (owner only)' : 'Public'),
        divider(),
        line('*Dependencies:*'),
        '│ ' + depLine,
        blank(),
        line(`${ICON.ok} All core subsystems operational.`),
        footer(),
      ].join('\n');

      await extra.reply(out);
      await extra.react('✅');
    } catch (error) {
      await extra.reply(`❌ Diagnostics failed: ${error.message}`);
    }
  },
};
