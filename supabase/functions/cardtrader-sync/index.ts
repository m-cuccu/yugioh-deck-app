// Popola/aggiorna cardtrader_blueprints con tutte le carte Yu-Gi-Oh disponibili su CardTrader,
// espansione per espansione (l'API di CardTrader non offre una ricerca per nome). Da invocare
// manualmente la prima volta, poi pianificabile come Cron Job dalla Dashboard Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cardtraderFetch, sleep } from '../_shared/cardtrader.ts';

// Pausa tra una chiamata e l'altra per restare ben sotto le 200 richieste/10s di CardTrader.
const DELAY_MS = 100;

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const games = await cardtraderFetch('/games');
    const yugioh = games.find((g: { name?: string; display_name?: string }) =>
      /yu-?gi-?oh/i.test(g.display_name || g.name || '')
    );
    if (!yugioh) throw new Error('Gioco "Yu-Gi-Oh" non trovato tra /games di CardTrader');

    const expansions = await cardtraderFetch('/expansions', { game_id: yugioh.id });

    let totalBlueprints = 0;
    for (const expansion of expansions) {
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

    return new Response(
      JSON.stringify({ expansions: expansions.length, blueprints: totalBlueprints }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
