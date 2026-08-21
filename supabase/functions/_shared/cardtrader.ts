// Helper condiviso dalle Edge Function cardtrader-sync e cardtrader-price. Il token non deve
// mai raggiungere il frontend: vive solo qui, letto da un secret dell'ambiente della function.
const API_BASE = 'https://api.cardtrader.com/api/v2';

// Il browser fa una richiesta OPTIONS di preflight prima della POST: senza questi header la
// chiamata viene bloccata dalla policy CORS e la function non viene mai raggiunta.
// L'accesso resta protetto da verify_jwt, non da chi puo' fare la richiesta.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflightResponse() {
  return new Response('ok', { headers: corsHeaders });
}

function authHeaders(): HeadersInit {
  const token = Deno.env.get('CARDTRADER_API_TOKEN');
  if (!token) throw new Error('Secret CARDTRADER_API_TOKEN non configurato');
  return { Authorization: `Bearer ${token}` };
}

async function cardtraderRequest(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CardTrader API: errore ${res.status} su ${path} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

// /games, /expansions e /blueprints/export rispondono con un array nudo.
export async function cardtraderFetch(path: string, params: Record<string, string | number> = {}) {
  const json = await cardtraderRequest(path, params);
  if (Array.isArray(json)) return json;
  // difensivo: se un endpoint venisse incapsulato, si prende la prima chiave che contiene un array
  const nested = Object.values(json ?? {}).find(Array.isArray);
  return nested ?? [];
}

// /marketplace/products non risponde con un array ma con un oggetto le cui chiavi sono i
// blueprint_id e i valori gli elenchi di inserzioni: { "10050": [ {...}, {...} ] }.
// Trattandolo come array si otteneva sempre una lista vuota, e quindi nessun prezzo.
export async function fetchMarketplaceProducts(params: Record<string, string | number>) {
  const json = await cardtraderRequest('/marketplace/products', params);
  if (Array.isArray(json)) return json;
  return Object.values(json ?? {}).flat();
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
