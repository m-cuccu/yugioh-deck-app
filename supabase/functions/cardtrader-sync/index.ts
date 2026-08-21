// Popola/aggiorna cardtrader_blueprints con tutte le carte Yu-Gi-Oh disponibili su CardTrader,
// espansione per espansione (l'API di CardTrader non offre una ricerca per nome). Da invocare
// manualmente la prima volta, poi pianificabile come Cron Job dalla Dashboard Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cardtraderFetch, jsonResponse, preflightResponse, sleep } from '../_shared/cardtrader.ts';

// Pausa tra una chiamata e l'altra per restare ben sotto le 200 richieste/10s di CardTrader.
const DELAY_MS = 100;

// Quante espansioni elaborare per invocazione. /blueprints/export accetta una sola espansione
// per chiamata e Yu-Gi-Oh ne ha centinaia: un unico sync "scarica tutto" supererebbe il tempo
// massimo di una Edge Function, quindi si procede a blocchi e si dice da dove riprendere.
const DEFAULT_BATCH = 40;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse();

  try {
    // parametri opzionali: { from, count }. Senza corpo si parte da zero.
    let from = 0;
    let count = DEFAULT_BATCH;
    try {
      const body = await req.json();
      if (Number.isFinite(body?.from)) from = Math.max(0, Math.floor(body.from));
      if (Number.isFinite(body?.count)) count = Math.max(1, Math.floor(body.count));
    } catch {
      // nessun corpo JSON: si usano i valori predefiniti
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const games = await cardtraderFetch('/games');
    const yugioh = games.find((g: { name?: string; display_name?: string }) =>
      /yu-?gi-?oh/i.test(g.display_name || g.name || '')
    );
    if (!yugioh) throw new Error('Gioco "Yu-Gi-Oh" non trovato tra /games di CardTrader');

    // /expansions non accetta filtri e restituisce le espansioni di TUTTI i giochi vendute su
    // CardTrader (Magic, Pokemon, One Piece...): il filtro va fatto qui, altrimenti si
    // scaricherebbero cataloghi di giochi che non ci interessano.
    const allExpansions = await cardtraderFetch('/expansions');
    const expansions = allExpansions.filter(
      (e: { game_id?: number }) => e.game_id === yugioh.id
    );

    const batch = expansions.slice(from, from + count);

    let totalBlueprints = 0;
    for (const expansion of batch) {
      const blueprints = await cardtraderFetch('/blueprints/export', { expansion_id: expansion.id });

      if (Array.isArray(blueprints) && blueprints.length > 0) {
        const rows = blueprints.map((b: { id: number; name: string; image_url?: string }) => ({
          blueprint_id: b.id,
          name: b.name,
          expansion_id: expansion.id,
          expansion_name: expansion.name,
          image_url: b.image_url ?? null,
          synced_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('cardtrader_blueprints')
          .upsert(rows, { onConflict: 'blueprint_id' });
        if (error) throw error;

        totalBlueprints += rows.length;
      }

      await sleep(DELAY_MS);
    }

    const processedUpTo = from + batch.length;
    const done = processedUpTo >= expansions.length;

    return jsonResponse({
        gameId: yugioh.id,
        totalExpansions: expansions.length,
        processedFrom: from,
        processedTo: processedUpTo,
        blueprints: totalBlueprints,
        done,
        // se non e' finito, valore da passare come { "from": nextFrom } alla prossima invocazione
        nextFrom: done ? null : processedUpTo,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
