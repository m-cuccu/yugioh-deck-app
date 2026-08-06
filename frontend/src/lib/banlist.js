const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// La risposta completa pesa ~450 KB, ma a noi serve solo id -> stato.
// La riduciamo e la teniamo in localStorage per qualche giorno: le banlist ufficiali
// cambiano circa ogni tre mesi, quindi non ha senso riscaricarla a ogni avvio.
const CACHE_PREFIX = 'ygo-banlist-';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const BANLIST_FORMATS = [
  { key: 'tcg', label: 'TCG' },
  { key: 'ocg', label: 'OCG' },
  { key: 'none', label: 'Off' },
];

const STATUS_FIELD = { tcg: 'ban_tcg', ocg: 'ban_ocg' };

export function maxCopiesFor(status) {
  if (status === 'Forbidden') return 0;
  if (status === 'Limited') return 1;
  if (status === 'Semi-Limited') return 2;
  return 3;
}

export function banlistLabel(status, lang) {
  if (!status) return null;
  if (lang !== 'it') return status;
  if (status === 'Forbidden') return 'Vietata';
  if (status === 'Limited') return 'Limitata';
  if (status === 'Semi-Limited') return 'Semi-Limitata';
  return status;
}

export function banlistClass(status) {
  if (status === 'Forbidden') return 'ban-forbidden';
  if (status === 'Limited') return 'ban-limited';
  if (status === 'Semi-Limited') return 'ban-semi';
  return '';
}

function readCache(format) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + format);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || !parsed?.map) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.map;
  } catch {
    return null;
  }
}

function writeCache(format, map) {
  try {
    localStorage.setItem(CACHE_PREFIX + format, JSON.stringify({ fetchedAt: Date.now(), map }));
  } catch {
    // spazio esaurito o storage non disponibile: si ricarichera' la prossima volta
  }
}

// Restituisce un oggetto { [cardId]: 'Forbidden' | 'Limited' | 'Semi-Limited' }
export async function fetchBanlist(format) {
  if (!format || format === 'none') return {};

  const cached = readCache(format);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}?banlist=${encodeURIComponent(format)}`);
  if (!res.ok) throw new Error('Impossibile recuperare la banlist');
  const json = await res.json();

  const field = STATUS_FIELD[format];
  const map = {};
  for (const card of json.data || []) {
    const status = card.banlist_info?.[field];
    if (status) map[card.id] = status;
  }

  writeCache(format, map);
  return map;
}
