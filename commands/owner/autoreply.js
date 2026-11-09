/**
 * Auto-reply AI switch (owner only)
 * .autoreply / .autoreply on / .autoreply off
 *
 * Enables the DM auto-responder (global) and shows the group auto-respond mode.
 * Group chats are toggled with .chatbot auto / .chatbot on / .chatbot off.
 */

const config = require('../../config');
const database = require('../../database');

function statusText(chatId, isGroup) {
  const global = database.getGlobalSettings();
  const lines = [`╭───「 🤖 *AUTO-REPLY AI* 」───╮`];
  lines.push(`│ 💬 *Direct messages:* ${global.chatbotAutoDM ? '🟢 On' : '❌ Off'}`);

  if (isGroup) {
    const g = database.getGroupSettings(chatId);
    const mode = g.chatbotAuto ? '🟢 Auto (every message)' : g.chatbot ? '🟡 Mention only' : '❌ Off';
    lines.push(`│ 👥 *This group:* ${mode}`);
  }

  lines.push(`╰━━━━━━━━━━━━━━━╯`, '');
  lines.push(`*.autoreply on* — reply to every DM`);
  lines.push(`*.autoreply off* — stop DM replies`);
  if (isGroup) lines.push(`*.chatbot auto* — reply to every group message`);
  lines.push('', `💡 ${config.prefix}ai <question> — ask once instead`);
  lines.push(`> 🐞 *${config.botName}* • ${config.brand || 'Ntandomods'}`);
  return lines.join('\n');
}

module.exports = {
  name: 'autoreply',
  aliases: ['autochat', 'ar'],
  category: 'owner',
  description: 'Toggle the AI auto-responder for DMs',
  usage: '.autoreply [on|off]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const isGroup = String(chatId || '').endsWith('@g.us');
    const action = String(args[0] || '').toLowerCase().trim();

    if (!action || action === 'status') {
      return extra.reply(statusText(chatId, isGroup));
    }

    if (action !== 'on' && action !== 'off') {
      return extra.reply('*Usage:* .autoreply on | .autoreply off');
    }

    const enable = action === 'on';
    const current = database.getGlobalSettings().chatbotAutoDM;
    if (current === enable) {
      return extra.reply(`*DM auto-reply is already ${enable ? 'on' : 'off'}.*`);
    }

    database.updateGlobalSettings({ chatbotAutoDM: enable });
    return extra.reply(
      enable
        ? '🟢 *Auto-reply AI enabled for DMs.*\\n\\nEvery new direct message gets an AI reply (5s cooldown per chat). Commands are ignored.'
        : '❌ *Auto-reply AI disabled for DMs.*'
    );
  },
};
