const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// L'inglese e' la lingua di default dell'API: si ottiene NON passando il parametro.
// Gli id delle carte sono identici in ogni lingua, quindi cambiare lingua non invalida i deck.
function langParam(lang) {
  return lang && lang !== 'en' ? `&language=${encodeURIComponent(lang)}` : '';
}

const FALLBACK_LANGS = ['en', 'it'];

async function fetchCardsWith(params, lang) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${BASE_URL}?${qs.toString()}${langParam(lang)}`);
  if (res.status === 400) return []; // l'API risponde 400 quando non trova nulla
  if (!res.ok) throw new Error('Impossibile contattare il servizio carte');
  const json = await res.json();
  return json.data || [];
}

function searchIn(query, lang) {
  return fetchCardsWith({ fname: query }, lang);
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

// Valori esatti richiesti dall'API per i filtri di ricerca (vedi CardFilters.jsx). Alcuni
// meccanismi corrispondono a piu' di una stringa `type` reale (es. i mostri Rituali si dividono
// in "Ritual Monster"/"Ritual Effect Monster", e Fusione/Synchro/Xyz hanno anche una variante
// Pendulum): per non escludere meta' delle carte, ogni voce elenca tutte le stringhe da unire.
export const MONSTER_TYPE_FILTERS = [
  { value: 'Normal Monster', apiTypes: ['Normal Monster'] },
  { value: 'Effect Monster', apiTypes: ['Effect Monster'] },
  { value: 'Ritual Monster', apiTypes: ['Ritual Monster', 'Ritual Effect Monster', 'Pendulum Effect Ritual Monster'] },
  { value: 'Fusion Monster', apiTypes: ['Fusion Monster', 'Pendulum Effect Fusion Monster'] },
  { value: 'Synchro Monster', apiTypes: ['Synchro Monster', 'Synchro Pendulum Effect Monster'] },
  { value: 'XYZ Monster', apiTypes: ['XYZ Monster', 'XYZ Pendulum Effect Monster'] },
  { value: 'Link Monster', apiTypes: ['Link Monster'] },
  { value: 'Pendulum Normal Monster', apiTypes: ['Pendulum Normal Monster'] },
  { value: 'Pendulum Effect Monster', apiTypes: ['Pendulum Effect Monster'] },
];

export const SPELL_SUBTYPE_FILTERS = ['Normal', 'Continuous', 'Equip', 'Quick-Play', 'Field', 'Ritual'];

export const TRAP_SUBTYPE_FILTERS = ['Normal', 'Continuous', 'Counter'];

export const ATTRIBUTE_FILTERS = ['LIGHT', 'DARK', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

// Traduce lo stato del pannello filtri (vedi CardFilters.jsx) nei parametri esatti dell'API.
export function resolveCardFilters(filters) {
  if (filters.category === 'monster') {
    const entry = MONSTER_TYPE_FILTERS.find((m) => m.value === filters.monsterType);
    return {
      types: entry?.apiTypes,
      attribute: filters.attribute || undefined,
      level: filters.level || undefined,
    };
  }
  if (filters.category === 'spell') {
    return { types: ['Spell Card'], race: filters.subtype || undefined };
  }
  if (filters.category === 'trap') {
    return { types: ['Trap Card'], race: filters.subtype || undefined };
  }
  return {};
}

async function fetchCardsMerged(params, lang) {
  if (!lang || lang === 'en') return fetchCardsWith(params, 'en');

  const [localized, english] = await Promise.all([
    fetchCardsWith(params, lang).catch(() => []),
    fetchCardsWith(params, 'en').catch(() => []),
  ]);

  const byId = new Map();
  for (const c of english) byId.set(c.id, c);
  for (const c of localized) byId.set(c.id, c);
  return [...byId.values()];
}

// Ricerca per nome combinabile con i filtri di tipo/sottotipo/attributo/livello: permette di
// sfogliare le carte anche senza conoscerne il nome (es. per "AAA Cercasi"). `types`, quando ha
// piu' di un valore (es. Rituale = con/senza effetto + variante Pendulum), viene interrogato con
// una chiamata per valore e i risultati vengono uniti, cosi' nessuna variante resta esclusa.
export async function searchCardsByFilters({ query, lang, types, race, attribute, level } = {}) {
  const q = (query || '').trim();
  const baseParams = {};
  if (q) baseParams.fname = q;
  if (race) baseParams.race = race;
  if (attribute) baseParams.attribute = attribute;
  if (level) baseParams.level = level;

  const hasType = Array.isArray(types) && types.length > 0;
  if (Object.keys(baseParams).length === 0 && !hasType) return [];

  const typeList = hasType ? types : [undefined];
  const batches = await Promise.all(
    typeList.map((t) => fetchCardsMerged(t ? { ...baseParams, type: t } : baseParams, lang).catch(() => []))
  );

  const byId = new Map();
  for (const batch of batches) for (const c of batch) byId.set(c.id, c);

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

const EXTRA_DECK_KINDS = ['fusion', 'synchro', 'xyz', 'link'];

// Si guarda `frameType` (sempre minuscolo: 'xyz', 'fusion_pendulum', ...) e non `type`,
// che per gli Xyz vale "XYZ Monster" in maiuscolo e sfuggiva a un confronto con "Xyz".
// I Pendulum finiscono nell'Extra solo se sono anche Fusion/Synchro/Xyz.
export function isExtraDeckCard(card) {
  const frame = (card.frameType || '').toLowerCase();
  if (frame) return EXTRA_DECK_KINDS.some((k) => frame.includes(k));

  const type = (card.type || '').toLowerCase();
  return EXTRA_DECK_KINDS.some((k) => type.includes(k));
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

  const fetchIn = async (l) => {
    const res = await fetch(
      `${BASE_URL}?archetype=${encodeURIComponent(archetype)}&num=25&offset=0${langParam(l)}`
    );
    if (!res.ok) return []; // 400 = nessuna carta dell'archetipo in quella lingua
    const json = await res.json();
    return json.data || [];
  };

  // Interi archetipi possono non avere alcuna carta tradotta (es. "Light and Darkness Ritual"):
  // chiedendo solo in italiano il risultato sarebbe vuoto e sembrerebbe che non ci siano correlate.
  let cards;
  if (!lang || lang === 'en') {
    cards = await fetchIn('en');
  } else {
    const [localized, english] = await Promise.all([fetchIn(lang), fetchIn('en')]);
    const byId = new Map();
    for (const c of english) byId.set(c.id, c);
    for (const c of localized) byId.set(c.id, c);
    cards = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  return cards.filter((c) => c.id !== card.id);
}

// Elenco delle edizioni (set + rarita') in cui una carta e' stata stampata.
export async function fetchCardSets(cardName, lang) {
  const card = await fetchCardByName(cardName, lang);
  return card?.card_sets || [];
}

// Scheda completa di una carta (effetto, statistiche) a partire dall'id.
// Come per le altre chiamate si ripiega sull'altra lingua se il record non esiste.
async function fetchCardByIdIn(cardId, lang) {
  const res = await fetch(`${BASE_URL}?id=${encodeURIComponent(cardId)}${langParam(lang)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0] || null;
}

// Nome inglese di una carta. Serve per cercarla su servizi esterni (il catalogo CardTrader
// e' in inglese), dove il nome tradotto non troverebbe alcuna corrispondenza.
export async function fetchEnglishCardName(cardId) {
  const card = await fetchCardByIdIn(cardId, 'en');
  return card?.name || null;
}

export async function fetchCardDetails(cardId, lang) {
  const langs = [lang || 'en', ...FALLBACK_LANGS.filter((l) => l !== (lang || 'en'))];

  let card = null;
  for (const l of langs) {
    card = await fetchCardByIdIn(cardId, l);
    if (card) break;
  }
  if (!card) return null;

  // si porta dietro anche il nome inglese, usato per il prezzo su CardTrader
  if (!lang || lang === 'en') {
    card.englishName = card.name;
  } else {
    const english = await fetchCardByIdIn(cardId, 'en');
    card.englishName = english?.name || card.name;
  }

  return card;
}

// Dati completi delle carte di un deck a partire dagli id, nella lingua scelta.
// Serve sia a riallineare i nomi (in `deck_cards` sono solo un'istantanea di quando la
// carta e' stata aggiunta) sia a ordinare per tipo, livello o attacco.
// Le carte prive di record nella lingua scelta si recuperano dall'inglese.
export async function fetchCardsByIds(ids, lang) {
  const unique = [...new Set(ids)].filter((id) => id != null);
  if (unique.length === 0) return new Map();

  const fetchIn = async (l) => {
    const res = await fetch(`${BASE_URL}?id=${unique.join(',')}${langParam(l)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  };

  const [localized, english] =
    !lang || lang === 'en'
      ? [[], await fetchIn('en').catch(() => [])]
      : await Promise.all([fetchIn(lang).catch(() => []), fetchIn('en').catch(() => [])]);

  const map = new Map();
  for (const card of english) map.set(card.id, card);
  for (const card of localized) map.set(card.id, card);
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
