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
