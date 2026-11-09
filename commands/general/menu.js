/**
 * Menu Command - Button-based command browser
 *
 * Default view: image + quick-reply buttons + a tappable category picker.
 * `.menu all`      -> compact full text listing
 * `.menu <category>` -> every command in that category with descriptions
 * `.menu page <n>`   -> category page (used by the "More" row)
 *
 * Falls back to plain text when interactive buttons are unavailable, so the
 * menu still works on WhatsApp builds that do not render native flow messages.
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

let sendButtons;
let sendInteractiveMessage;
try {
  ({ sendButtons, sendInteractiveMessage } = require('gifted-btns'));
} catch {
  sendButtons = null;
  sendInteractiveMessage = null;
}

const PER_PAGE = 8;

// Display order + emoji per category. Unknown categories are appended alphabetically.
const CATEGORY_META = {
  general: { emoji: '🧭', title: 'General', order: 1 },
  ai: { emoji: '🤖', title: 'AI', order: 2 },
  media: { emoji: '🎞️', title: 'Media', order: 3 },
  fun: { emoji: '🎭', title: 'Fun', order: 4 },
  games: { emoji: '🎮', title: 'Games', order: 5 },
  economy: { emoji: '💰', title: 'Economy', order: 6 },
  info: { emoji: '🔎', title: 'Info & Jobs', order: 7 },
  utility: { emoji: '🔧', title: 'Utility', order: 8 },
  anime: { emoji: '👾', title: 'Anime', order: 9 },
  textmaker: { emoji: '🖋️', title: 'Textmaker', order: 10 },
  ladybug: { emoji: '🐞', title: 'Ladybug', order: 11 },
  premium: { emoji: '⭐', title: 'Premium', order: 12 },
  prank: { emoji: '🃏', title: 'Prank', order: 13 },
  crush: { emoji: '💘', title: 'Crush', order: 14 },
  group: { emoji: '🔵', title: 'Group', order: 15 },
  admin: { emoji: '🛡️', title: 'Admin', order: 16 },
  owner: { emoji: '👑', title: 'Owner', order: 17 },
  download: { emoji: '⬇️', title: 'Downloaders', order: 18 },
  other: { emoji: '📁', title: 'Other', order: 99 },
};

const GAME_NAMES = ['bomb', 'bet', 'horse', 'slots', 'coinflip', 'rps', 'tictactoe', 'fish', 'hunt', 'chop', 'forage', 'rpg'];
const FUN_HIDE = new Set(GAME_NAMES);

const meta = (key) => CATEGORY_META[key] || { emoji: '📁', title: key, order: 50 };

const label = (key) => `${meta(key).emoji} ${meta(key).title}`;

/** Group commands by category (main names only, aliases skipped) and sort them. */
function collect() {
  const commands = loadCommands();
  const categories = {};

  for (const [name, cmd] of commands) {
    if (cmd.name !== name) continue;
    const category = String(cmd.category || 'other').toLowerCase();
    if (!categories[category]) categories[category] = [];
    categories[category].push(cmd);
  }

  const ordered = Object.keys(categories).sort((a, b) => {
    const ma = meta(a);
    const mb = meta(b);
    return ma.order - mb.order || ma.title.localeCompare(mb.title);
  });

  return { commands, categories, ordered };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Move the game/betting commands out of `fun` and into `games` for display. */
function commandsFor(key, categories) {
  if (key === 'games') {
    const fromGames = (categories.games || []).map((c) => c.name);
    const fromFun = (categories.fun || []).map((c) => c.name).filter((n) => GAME_NAMES.includes(n));
    const names = [...new Set([...GAME_NAMES.filter((n) => fromGames.includes(n) || fromFun.includes(n)), ...fromGames])];
    const byName = new Map((categories.games || []).concat(categories.fun || []).map((c) => [c.name, c]));
    return names.map((n) => byName.get(n)).filter(Boolean);
  }
  if (key === 'fun') return (categories.fun || []).filter((c) => !FUN_HIDE.has(c.name));
  return categories[key] || [];
}

function fullText(extra, commands, categories, ordered) {
  const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
  const displayOwner = ownerNames[0] || config.ownerName || 'Bot Owner';

  let text = `╭───「 🐞 *${config.botName}* 」───╮\n\n`;
  text += `│ 👋 Hello!\n`;
  text += `│ ⚡ *Prefix:* ${config.prefix}\n`;
  text += `│ 📦 *Commands:* ${commands.size}\n`;
  text += `│ 👑 *Owner:* ${displayOwner}\n`;
  text += `│ 🏷️ *Brand:* ${config.brand || 'Ntandomods'}\n`;
  text += `│ ⏱️ *Awake:* ${Math.floor(process.uptime() / 60)}m\n\n`;

  for (const key of ordered) {
    const list = commandsFor(key, categories);
    if (!list.length) continue;
    text += `┏━ ${label(key)} (${list.length})\n`;
    text += `┃ ${list.map((c) => `${config.prefix}${c.name}`).join(' ')}\n`;
    text += `┗━━━━━━━━━━━━━━\n\n`;
  }

  text += `╰━━━━━━━━━━━━━━━━━\n\n`;
  text += `💡 Type ${config.prefix}menu <category> to open one section\n`;
  text += `> 🐞 *${config.botName}* v2.0.0 • ${config.brand || 'Ntandomods'}`;
  return text;
}

function categoryText(key, categories) {
  const list = commandsFor(key, categories);
  const lines = list.map((c) => {
    const desc = String(c.description || c.desc || '').replace(/\s+/g, ' ').trim();
    return desc ? `• *${config.prefix}${c.name}* — ${desc}` : `• *${config.prefix}${c.name}*`;
  });
  return [
    `${label(key)} — *${list.length} command${list.length === 1 ? '' : 's'}*`,
    '',
    ...lines,
    '',
    `💡 ${config.prefix}menu — back to the menu`,
    `> 🐞 *${config.botName}* • ${config.brand || 'Ntandomods'}`,
  ].join('\n');
}

function rowsFor(ordered, categories, page) {
  const pages = chunk(ordered, PER_PAGE);
  const rows = (pages[page] || []).map((key) => {
    const count = commandsFor(key, categories).length;
    return {
      title: label(key).slice(0, 24),
      description: `${count} command${count === 1 ? '' : 's'}`,
      id: `menu_cat_${key}`,
    };
  });
  if (page + 1 < pages.length) {
    rows.push({
      title: 'More categories ➡️'.slice(0, 24),
      description: `Next page (${page + 2}/${pages.length})`,
      id: `menu_page_${page + 1}`,
    });
  }
  return { rows, pages };
}

function homeText(categories, ordered, interactive = true) {
  const total = Object.values(categories).reduce((n, list) => n + list.length, 0);
  return [
    `🐞 *${config.botName}*`,
    `⚡ Prefix: *${config.prefix}*  •  📦 ${total} commands`,
    '',
    interactive
      ? 'Tap *Browse Categories* to open a section, or use the buttons below.'
      : `Type *${config.prefix}menu <category>* to open a section.`,
    `Owner: ${Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName || 'Bot Owner'}  •  ${config.brand || 'Ntandomods'}`,
  ].join('\n');
}

function footer() {
  return `${config.botName} • ${config.brand || 'Ntandomods'}`;
}

async function sendInteractable(sock, msg, extra, { text, buttons, fallback }) {
  const isGroup = String(extra.from || '').endsWith('@g.us');
  // NOTE: never pass a raw image Buffer here. gifted-btns' header resolver expects a
  // URL/object and logs "resolveImageHeader failed" (dropping the header) otherwise.
  // Buttons first; a bare image is not worth risking the whole message.
  const imageUrl = process.env.MENU_IMAGE_URL || '';
  const base = { text, footer: footer(), aimode: !isGroup };
  if (imageUrl) base.image = { url: imageUrl };

  if (sendInteractiveMessage) {
    try {
      const sent = await sendInteractiveMessage(
        sock,
        extra.from,
        { ...base, interactiveButtons: buttons },
        { quoted: msg }
      );
      console.log('[menu] interactive sent:', sent?.key?.id || '(no key)', '| status:', sent?.status ?? '(none)');
      return true;
    } catch (e) {
      console.error('[menu] interactive send failed:', e.message);
    }
  }

  if (sendButtons) {
    try {
      const simple = buttons
        .filter((b) => b.name === 'quick_reply')
        .map((b) => {
          const p = JSON.parse(b.buttonParamsJson);
          return { id: p.id, text: p.display_text };
        });
      if (simple.length) {
        await sendButtons(sock, extra.from, { title: '', text, footer: footer(), aimode: !isGroup, buttons: simple }, { quoted: msg });
        return true;
      }
    } catch (e) {
      console.error('[menu] button send failed:', e.message);
    }
  }

  await sock.sendMessage(extra.from, { text: fallback || text }, { quoted: msg });
  return false;
}

async function sendHome(sock, msg, extra, categories, ordered, page = 0) {
  const pages = chunk(ordered, PER_PAGE);
  const safePage = Math.max(0, Math.min(page, pages.length - 1));
  const { rows } = rowsFor(ordered, categories, safePage);
  const first = ordered.find((k) => k !== 'general') || ordered[0];

  const buttons = [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '📋 All Commands', id: 'menu_all' }),
    },
    ...(first
      ? [{
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🎵 Cardigan',
            id: 'menu_cardigan',
          }),
        }]
      : []),
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: safePage === 0 ? 'Browse Categories' : `Categories (${safePage + 1}/${pages.length})`,
        sections: [{ title: safePage === 0 ? 'Pick a section' : `Page ${safePage + 1}`, rows }],
      }),
    },
  ];

  const fallback = [
    homeText(categories, ordered, false),
    '',
    ordered.map((k) => `• ${config.prefix}menu ${k}`).join('\n'),
    '',
    `Type ${config.prefix}menu all for the full list.`,
  ].join('\n');

  return sendInteractable(sock, msg, extra, {
    text: homeText(categories, ordered),
    buttons,
    fallback,
  });
}

async function sendCategory(sock, msg, extra, key, categories) {
  const text = categoryText(key, categories);
  const buttons = [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '⬅️ Back to Menu', id: 'menu_home' }),
    },
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '📋 All Commands', id: 'menu_all' }),
    },
  ];
  return sendInteractable(sock, msg, extra, { text, buttons, fallback: text });
}

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  category: 'general',
  description: 'Show all commands with buttons',
  usage: '.menu [all|category]',

  async execute(sock, msg, args, extra) {
    try {
      const { commands, categories, ordered } = collect();
      const sub = String(args[0] || '').toLowerCase().trim();

      // `.menu page 2` is what the "More categories" row sends.
      if (sub === 'page') {
        const page = parseInt(args[1], 10) || 0;
        return await sendHome(sock, msg, extra, categories, ordered, page);
      }

      if (sub === 'home' || sub === 'menu' || !sub) {
        return await sendHome(sock, msg, extra, categories, ordered, 0);
      }

      if (sub === 'all' || sub === 'full') {
        return await sock.sendMessage(extra.from, {
          text: fullText(extra, commands, categories, ordered),
        }, { quoted: msg });
      }

      if (categories[sub] || sub === 'games') {
        return await sendCategory(sock, msg, extra, sub, categories);
      }

      return await extra.reply(
        `❌ Unknown category: *${sub}*\n\nTry ${config.prefix}menu to open the menu.`
      );
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  },
};
