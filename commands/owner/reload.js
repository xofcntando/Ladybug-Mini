/**
 * Hot-Reload Commands (owner only)
 * ---------------------------------
 * `.reload` — rebuild the command registry from disk without restarting the
 * whole process. Useful after editing a command file on a live panel.
 */

const handler = require('../../handler');
const theme = require('../../utils/ladybugTheme');

const { header, footer, row, ICON } = theme;

module.exports = {
  name: 'reload',
  aliases: ['reloadcmd', 'reloadcommands'],
  category: 'owner',
  description: 'Hot-reload all command modules without restarting',
  usage: '.reload',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      await extra.react('♻️');
      const started = Date.now();
      const count = handler.reloadCommands();
      const took = Date.now() - started;

      const out = [
        header('Hot Reload'),
        row(ICON.ok, 'Status', 'Commands reloaded'),
        row(ICON.chart, 'Registry', `${count} entries`),
        row(ICON.clock, 'Took', `${took} ms`),
        footer('No restart needed — new code is live.'),
      ].join('\n');

      await extra.reply(out);
      await extra.react('✅');
    } catch (error) {
      await extra.reply(`❌ Reload failed: ${error.message}`);
    }
  },
};
