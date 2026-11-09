/**
 * Button / list tap ids.
 *
 * WhatsApp replies to an interactive message in several different shapes depending
 * on the client and Baileys version: buttonsResponseMessage, listResponseMessage,
 * templateButtonReplyMessage, or (v7 native flow) interactiveResponseMessage with a
 * paramsJson payload. Walking the whole message also catches replies nested inside
 * ephemeral / viewOnce wrappers.
 */

function extractReplyId(root) {
  const queue = [root];
  const seen = new Set();

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);

    const btn = node.buttonsResponseMessage?.selectedButtonId;
    if (btn) return String(btn);

    const row = node.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (row) return String(row);

    const tpl = node.templateButtonReplyMessage?.selectedId;
    if (tpl) return String(tpl);

    const ir = node.interactiveResponseMessage;
    if (ir) {
      const paramsJson =
        ir?.nativeFlowResponseMessage?.paramsJson ||
        ir?.native_flow_response_message?.paramsJson;
      if (paramsJson) {
        try {
          const parsed = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
          const id = parsed?.id || parsed?.selectedId || parsed?.rowId || parsed?.selected_row_id;
          if (id) return String(id);
        } catch {
          const m = String(paramsJson).match(/["']?(?:id|selectedId|rowId)["']?\s*[:=]\s*["']?([\w-]+)/);
          if (m) return m[1];
        }
      }
      // Some clients echo the tapped label as body text.
      const label = ir?.body?.text;
      if (label) return String(label);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return '';
}

const LABEL_IDS = {
  'all commands': 'menu_all',
  'cardigan': 'menu_cardigan',
  'back to menu': 'menu_home',
  'browse categories': 'menu_home',
  'more categories': 'menu_page_1',
};

/** Some WhatsApp builds echo the button label instead of our id. */
function normalizeReplyId(raw) {
  const id = String(raw || '').trim();
  if (!id) return '';
  const key = id
    .replace(/[^a-z0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return LABEL_IDS[key] || id;
}

module.exports = { extractReplyId, normalizeReplyId };
