// Prezzo CardTrader on-demand per una carta, chiamata dal frontend (CardDetailModal). Cerca i
// blueprint_id gia' sincronizzati per quel nome (cardtrader-sync) e chiede il prezzo live solo
// per quelli, cosi' il token e le chiamate a CardTrader restano sempre lato server.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchMarketplaceProducts, jsonResponse, preflightResponse } from '../_shared/cardtrader.ts';

// Non si controllano tutte le ristampe storiche di una carta a ogni richiesta: /marketplace/products
// ammette 10 chiamate al secondo e ne serve una per stampa. Si guarda quindi un sottoinsieme,
// ordinato in modo deterministico (senza ORDER BY il database ne restituirebbe altre a ogni
// chiamata, e il prezzo mostrato cambierebbe senza motivo apparente).
const MAX_BLUEPRINTS_PER_LOOKUP = 8;

function cardtraderSearchUrl(name: string) {
  return `https://www.cardtrader.com/en/games/yu-gi-oh/categories/yu-gi-oh-singles/blueprints_search?name=${encodeURIComponent(name)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse();

  try {
    const { cardName } = await req.json();
    const name = (cardName || '').trim();
    if (!name) {
      return jsonResponse({ error: 'cardName mancante' }, 400);
    }

    const url = cardtraderSearchUrl(name);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: blueprints, error } = await supabase
      .from('cardtrader_blueprints')
      .select('blueprint_id')
      .ilike('name', name) // case-insensitive, senza wildcard = confronto esatto
      .order('blueprint_id', { ascending: true })
      .limit(MAX_BLUEPRINTS_PER_LOOKUP);
    if (error) throw error;

    if (!blueprints || blueprints.length === 0) {
      return jsonResponse({ price: null, url });
    }

    let cheapest: { cents: number; currency: string } | null = null;
    for (const { blueprint_id } of blueprints) {
      const listings = await fetchMarketplaceProducts({ blueprint_id });
      for (const listing of listings as Array<{ price?: { cents: number; currency: string } }>) {
        const cents = listing.price?.cents;
        if (typeof cents !== 'number') continue;
        if (!cheapest || cents < cheapest.cents) {
          cheapest = { cents, currency: listing.price!.currency };
        }
      }
    }

    if (!cheapest) {
      return jsonResponse({ price: null, url });
    }

    return jsonResponse({
        price: cheapest.cents / 100,
        currency: cheapest.currency,
        // quante stampe sono state controllate: il prezzo e' il piu' basso fra queste,
        // non necessariamente fra tutte le ristampe esistenti della carta
        printingsChecked: blueprints.length,
        url,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
