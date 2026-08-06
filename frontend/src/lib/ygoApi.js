const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// L'inglese e' la lingua di default dell'API: si ottiene NON passando il parametro.
// Gli id delle carte sono identici in ogni lingua, quindi cambiare lingua non invalida i deck.
function langParam(lang) {
  return lang && lang !== 'en' ? `&language=${encodeURIComponent(lang)}` : '';
}

const FALLBACK_LANGS = ['en', 'it'];

async function searchIn(query, lang) {
  const res = await fetch(`${BASE_URL}?fname=${encodeURIComponent(query)}${langParam(lang)}`);
  if (res.status === 400) return []; // l'API risponde 400 quando non trova nulla
  if (!res.ok) throw new Error('Impossibile contattare il servizio carte');
  const json = await res.json();
  return json.data || [];
}

export async function searchCards(query, lang) {
  const q = query.trim();
  if (!q) return [];

  if (!lang || lang === 'en') return searchIn(q, 'en');

  // Non tutte le carte hanno un record nella lingua scelta (es. "Melffys' Joyful Surprise"
  // non esiste in italiano): cercando solo in quella lingua risulterebbero introvabili.
  // Si uniscono i due elenchi per id, tenendo il nome localizzato quando c'e'.
  const [localized, english] = await Promise.all([
    searchIn(q, lang).catch(() => []),
    searchIn(q, 'en').catch(() => []),
  ]);

  const byId = new Map();
  for (const c of english) byId.set(c.id, c);
  for (const c of localized) byId.set(c.id, c);

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Cerca una carta per nome esatto provando prima la lingua richiesta e poi le altre:
// serve perche' il nome memorizzato puo' essere in una lingua diversa da quella attiva
// (tipicamente inglese, per le carte prive di traduzione).
async function fetchCardByName(cardName, lang) {
  const langs = [lang || 'en', ...FALLBACK_LANGS.filter((l) => l !== (lang || 'en'))];
  for (const l of langs) {
    const res = await fetch(`${BASE_URL}?name=${encodeURIComponent(cardName)}${langParam(l)}`);
    if (!res.ok) continue;
    const json = await res.json();
    const card = json.data?.[0];
    if (card) return card;
  }
  return null;
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
export async function fetchCardArts(cardName, lang) {
  const card = await fetchCardByName(cardName, lang);
  return card?.card_images || [];
}

// Carte "correlate": stesso archetipo della carta data (es. Mago Nero -> Ragazza Maga Nera, ecc.)
// L'archetipo resta in inglese anche interrogando in italiano: e' una chiave interna, non un'etichetta.
export async function fetchRelatedCards(cardName, lang) {
  const card = await fetchCardByName(cardName, lang);
  const archetype = card?.archetype;
  if (!archetype) return [];

  const res = await fetch(
    `${BASE_URL}?archetype=${encodeURIComponent(archetype)}&num=25&offset=0${langParam(lang)}`
  );
  if (res.status === 400) return [];
  if (!res.ok) throw new Error('Impossibile recuperare le carte correlate');
  const json = await res.json();
  return (json.data || []).filter((c) => c.id !== card.id);
}

// Elenco delle edizioni (set + rarita') in cui una carta e' stata stampata.
export async function fetchCardSets(cardName, lang) {
  const card = await fetchCardByName(cardName, lang);
  return card?.card_sets || [];
}

// Nomi delle carte nella lingua scelta, a partire dagli id.
// Serve a mostrare un deck salvato nella lingua corrente: i nomi in `deck_cards` sono
// solo un'istantanea di quando la carta e' stata aggiunta.
export async function fetchCardNamesByIds(ids, lang) {
  const unique = [...new Set(ids)].filter((id) => id != null);
  if (unique.length === 0) return new Map();

  const url = `${BASE_URL}?id=${unique.join(',')}${langParam(lang)}`;
  const res = await fetch(url);
  if (!res.ok) return new Map(); // fallback silenzioso: si tengono i nomi salvati
  const json = await res.json();

  const map = new Map();
  for (const card of json.data || []) map.set(card.id, card.name);
  return map;
}

// Mappa il testo di rarita' (molto vario: "Ultra Rare", "Prismatic Secret Rare", "Starlight Rare", ecc.)
// sullo stile visivo corrispondente. L'ordine dei controlli conta: i nomi si sovrappongono
// (es. "Prismatic Secret Rare" contiene "Secret Rare", "Gold Secret Rare" contiene sia "Gold" che "Secret"),
// quindi si va dal piu' specifico al piu' generico.
export function rarityToClass(rarityLabel) {
  const r = (rarityLabel || '').toLowerCase();

  if (r.includes('starlight')) return 'rarity-starlight';
  if (r.includes("collector")) return 'rarity-collector';
  if (r.includes('prismatic')) return 'rarity-prismatic';
  if (r.includes('quarter century')) return 'rarity-quarter';
  if (r.includes('platinum')) return 'rarity-platinum';
  if (r.includes('gold')) return 'rarity-gold';
  if (r.includes('ghost')) return 'rarity-ghost';
  if (r.includes('starfoil')) return 'rarity-starfoil';
  if (r.includes('shatterfoil')) return 'rarity-shatterfoil';
  if (r.includes('mosaic')) return 'rarity-mosaic';
  if (r.includes('parallel')) return 'rarity-parallel';
  if (r.includes('secret')) return 'rarity-secret';
  if (r.includes('ultimate')) return 'rarity-ultimate';
  if (r.includes('ultra')) return 'rarity-ultra';
  if (r.includes('super')) return 'rarity-super';
  if (r.includes('rare')) return 'rarity-rare';
  return 'rarity-common';
}
