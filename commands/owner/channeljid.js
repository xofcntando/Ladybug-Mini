/**
 * ChannelJid Command - Owner only
 * Resolves a WhatsApp Channel invite link to its @newsletter JID.
 * Usage: .channeljid https://whatsapp.com/channel/<code>
 */

module.exports = {
  name: 'channeljid',
  aliases: ['newsletterjid', 'cjid'],
  category: 'owner',
  description: 'Get the JID of a WhatsApp Channel from its link (owner only)',
  usage: '.channeljid <channel link>',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminOnly: false,

  async execute(sock, msg, args, extra) {
    try {
      const input = (args.join(' ') || '').trim();
      const code = input.match(/channel\/([A-Za-z0-9_-]+)/)?.[1] || (/^[A-Za-z0-9_-]{15,}$/.test(input) ? input : null);

      if (!code) {
        return extra.reply('Usage: .channeljid https://whatsapp.com/channel/<code>');
      }
      if (typeof sock.newsletterMetadata !== 'function') {
        return extra.reply('This Baileys version cannot look up channels.');
      }

      const meta = await sock.newsletterMetadata('invite', code);
      if (!meta?.id) {
        return extra.reply('Could not find that channel. Check the link.');
      }

      const name = meta.name || meta.thread_metadata?.name?.text || 'Channel';
      await extra.reply(`Channel: ${name}\nJID: ${meta.id}\n\nTo use it: .setnewsletter ${meta.id}`);
    } catch (err) {
      console.error('channeljid error:', err);
      await extra.reply(`Failed to get channel JID: ${err.message || 'Error'}`);
    }
  },
};
