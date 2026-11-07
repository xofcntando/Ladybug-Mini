/**
 * Book search (via /v1/info/books, Open Library)
 */

const config = require('../../config');
const { ladybugGet, replyText } = require('../../utils/ladybugApi');

module.exports = {
  name: 'book',
  aliases: ['books', 'booksearch'],
  category: 'info',
  description: 'Search books by title, author or ISBN',
  usage: '<title / author / ISBN>',

  async execute(sock, msg, args) {
    const q = args.join(' ').trim();
    if (!q) return replyText(sock, msg, `❌ Usage: ${config.prefix}book <title or author>\n\nExample: ${config.prefix}book dune`);
    try {
      const d = await ladybugGet('/v1/info/books', { q, limit: 5 });
      if (!d.books.length) return replyText(sock, msg, `❌ No books found for "${q}".`);
      let out = `📚 *Books: ${q}* (${d.total} results)\n`;
      d.books.forEach((b, i) => {
        out += `\n*${i + 1}. ${b.title}*\n✍️ ${(b.authors || ['Unknown']).slice(0, 2).join(', ')}`;
        if (b.first_published) out += ` • ${b.first_published}`;
        if (b.pages) out += ` • ${b.pages} pages`;
        if (b.rating) out += ` • ⭐ ${b.rating.toFixed(1)}`;
        out += `\n🔗 ${b.url}\n`;
      });
      return replyText(sock, msg, out.trimEnd());
    } catch (err) {
      return replyText(sock, msg, `❌ ${err.message}`);
    }
  },
};
