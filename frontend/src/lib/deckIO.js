const SECTIONS = ['main', 'extra', 'side'];

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportDeckAsJson(deck) {
  const payload = {
    name: deck.name,
    cards: {
      main: deck.cards.main.map(stripCard),
      extra: deck.cards.extra.map(stripCard),
      side: deck.cards.side.map(stripCard),
    },
  };
  downloadFile(`${deck.name}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function stripCard(c) {
  return { card_id: c.card_id, card_name: c.card_name, card_image: c.card_image, quantity: c.quantity };
}

export function exportDeckAsYdk(deck) {
  const lines = ['#created by yugioh-deck-app', '#main'];
  const expand = (section) => deck.cards[section].flatMap((c) => Array(c.quantity).fill(String(c.card_id)));

  lines.push(...expand('main'));
  lines.push('#extra');
  lines.push(...expand('extra'));
  lines.push('!side');
  lines.push(...expand('side'));

  downloadFile(`${deck.name}.ydk`, lines.join('\n'), 'text/plain');
}

export function parseJsonDeckFile(content) {
  const parsed = JSON.parse(content);
  const cards = parsed.cards || { main: [], extra: [], side: [] };
  return {
    name: parsed.name || 'Deck importato',
    cards: {
      main: cards.main || [],
      extra: cards.extra || [],
      side: cards.side || [],
    },
  };
}

function parseYdkIds(content) {
  const sections = { main: [], extra: [], side: [] };
  let current = 'main';
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#main')) { current = 'main'; continue; }
    if (line.startsWith('#extra')) { current = 'extra'; continue; }
    if (line.startsWith('!side')) { current = 'side'; continue; }
    if (line.startsWith('#')) continue;
    if (/^\d+$/.test(line)) sections[current].push(line);
  }
  return sections;
}

export async function parseYdkFile(content, deckName) {
  const idsBySection = parseYdkIds(content);
  const allIds = [...new Set([...idsBySection.main, ...idsBySection.extra, ...idsBySection.side])];

  const cardMap = new Map();
  if (allIds.length > 0) {
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${allIds.join(',')}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      for (const card of json.data || []) cardMap.set(String(card.id), card);
    }
  }

  const cards = { main: [], extra: [], side: [] };
  for (const section of SECTIONS) {
    const counts = new Map();
    for (const id of idsBySection[section]) counts.set(id, (counts.get(id) || 0) + 1);
    for (const [id, quantity] of counts) {
      const card = cardMap.get(id);
      cards[section].push({
        card_id: Number(id),
        card_name: card ? card.name : `Carta #${id}`,
        card_image: card?.card_images?.[0]?.image_url_small || null,
        quantity,
      });
    }
  }

  return { name: deckName || 'Deck importato', cards };
}
