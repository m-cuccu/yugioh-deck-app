import { supabase } from './supabaseClient';

// Il token CardTrader vive solo nella Edge Function: il frontend chiama solo questa funzione,
// mai api.cardtrader.com direttamente.
const cache = new Map();

// Ritorna { price: number|null, currency?: string, url: string }. `price` e' null se la carta
// non e' (ancora) nel catalogo sincronizzato o se non ci sono inserzioni attive.
export async function fetchCardTraderPrice(cardName) {
  const name = (cardName || '').trim();
  if (!name) return { price: null, url: '' };

  if (cache.has(name)) return cache.get(name);

  const { data, error } = await supabase.functions.invoke('cardtrader-price', {
    body: { cardName: name },
  });
  if (error) throw error;

  cache.set(name, data);
  return data;
}
