// Prezzo CardTrader on-demand per una carta, chiamata dal frontend (CardDetailModal). Cerca i
// blueprint_id gia' sincronizzati per quel nome (cardtrader-sync) e chiede il prezzo live solo
// per quelli, cosi' il token e le chiamate a CardTrader restano sempre lato server.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cardtraderFetch } from '../_shared/cardtrader.ts';

// Limite deliberato: non si controllano tutte le ristampe storiche di una carta ad ogni
// richiesta, solo le prime trovate, per restare leggeri sul rate limit condiviso da tutta l'app.
const MAX_BLUEPRINTS_PER_LOOKUP = 5;

function cardtraderSearchUrl(name: string) {
  return `https://www.cardtrader.com/en/games/yu-gi-oh/categories/yu-gi-oh-singles/blueprints_search?name=${encodeURIComponent(name)}`;
}

Deno.serve(async (req) => {
  try {
    const { cardName } = await req.json();
    const name = (cardName || '').trim();
    if (!name) {
      return new Response(JSON.stringify({ error: 'cardName mancante' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      .limit(MAX_BLUEPRINTS_PER_LOOKUP);
    if (error) throw error;

    if (!blueprints || blueprints.length === 0) {
      return new Response(JSON.stringify({ price: null, url }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let cheapest: { cents: number; currency: string } | null = null;
    for (const { blueprint_id } of blueprints) {
      const listings = await cardtraderFetch('/marketplace/products', { blueprint_id });
      for (const listing of listings as Array<{ price?: { cents: number; currency: string } }>) {
        const cents = listing.price?.cents;
        if (typeof cents !== 'number') continue;
        if (!cheapest || cents < cheapest.cents) {
          cheapest = { cents, currency: listing.price!.currency };
        }
      }
    }

    if (!cheapest) {
      return new Response(JSON.stringify({ price: null, url }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ price: cheapest.cents / 100, currency: cheapest.currency, url }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
