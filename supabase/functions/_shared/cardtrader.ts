// Helper condiviso dalle Edge Function cardtrader-sync e cardtrader-price. Il token non deve
// mai raggiungere il frontend: vive solo qui, letto da un secret dell'ambiente della function.
const API_BASE = 'https://api.cardtrader.com/api/v2';

function authHeaders(): HeadersInit {
  const token = Deno.env.get('CARDTRADER_API_TOKEN');
  if (!token) throw new Error('Secret CARDTRADER_API_TOKEN non configurato');
  return { Authorization: `Bearer ${token}` };
}

export async function cardtraderFetch(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`CardTrader API: errore ${res.status} su ${path}`);
  const json = await res.json();

  // La documentazione pubblica non specifica se ogni endpoint risponde con un array nudo o
  // con un oggetto che lo contiene: si copre entrambi i casi piu' comuni, va verificato con
  // un token reale alla prima sincronizzazione e aggiustato se necessario.
  if (Array.isArray(json)) return json;
  return json.data ?? json.blueprints ?? json.products ?? json.expansions ?? json.games ?? [];
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
