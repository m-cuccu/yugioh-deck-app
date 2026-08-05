const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

export async function searchCards(query) {
  const q = query.trim();
  if (!q) return [];

  const url = `${BASE_URL}?fname=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (res.status === 400) return []; // API returns 400 when nothing matches
  if (!res.ok) throw new Error('Impossibile contattare il servizio carte');
  const json = await res.json();
  return json.data || [];
}

export function isExtraDeckCard(card) {
  const t = card.type || '';
  return (
    t.includes('Fusion') ||
    t.includes('Synchro') ||
    t.includes('Xyz') ||
    t.includes('Link')
  );
}

export function cardThumbnail(card) {
  return card.card_images?.[0]?.image_url_small || card.card_images?.[0]?.image_url || '';
}

// Nota: l'API di YGOPRODeck restituisce tutte le art alternative solo cercando per nome esatto;
// la ricerca per id restituisce una sola immagine.
export async function fetchCardArts(cardName) {
  const url = `${BASE_URL}?name=${encodeURIComponent(cardName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impossibile recuperare le arti di questa carta');
  const json = await res.json();
  const card = json.data?.[0];
  return card?.card_images || [];
}

// Carte "correlate": stesso archetipo della carta data (es. Dark Magician -> Dark Magician Girl, ecc.)
export async function fetchRelatedCards(cardName) {
  const infoRes = await fetch(`${BASE_URL}?name=${encodeURIComponent(cardName)}`);
  if (!infoRes.ok) throw new Error('Impossibile recuperare la carta');
  const infoJson = await infoRes.json();
  const archetype = infoJson.data?.[0]?.archetype;
  if (!archetype) return [];

  const res = await fetch(`${BASE_URL}?archetype=${encodeURIComponent(archetype)}&num=25&offset=0`);
  if (res.status === 400) return [];
  if (!res.ok) throw new Error('Impossibile recuperare le carte correlate');
  const json = await res.json();
  return (json.data || []).filter((c) => c.name !== cardName);
}

// Elenco delle edizioni (set + rarita') in cui una carta e' stata stampata.
export async function fetchCardSets(cardName) {
  const url = `${BASE_URL}?name=${encodeURIComponent(cardName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impossibile recuperare le edizioni di questa carta');
  const json = await res.json();
  const card = json.data?.[0];
  return card?.card_sets || [];
}

// Mappa il testo di rarita' (molto vario: "Ultra Rare", "Prismatic Secret Rare", "Ghost Rare", ecc.)
// su una manciata di stili di bordo, per tenere la UI semplice senza dover elencare ogni singola rarita' ufficiale.
export function rarityToClass(rarityLabel) {
  const r = (rarityLabel || '').toLowerCase();
  if (r.includes('starlight') || r.includes('prismatic') || r.includes('secret') || r.includes('quarter century')) {
    return 'rarity-secret';
  }
  if (r.includes('ghost') || r.includes('platinum') || r.includes('collector')) return 'rarity-ghost';
  if (r.includes('ultimate')) return 'rarity-ultimate';
  if (r.includes('ultra')) return 'rarity-ultra';
  if (r.includes('super')) return 'rarity-super';
  if (r.includes('rare')) return 'rarity-rare';
  return 'rarity-common';
}
