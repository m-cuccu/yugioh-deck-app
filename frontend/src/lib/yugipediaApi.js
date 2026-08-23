const API_URL = 'https://yugipedia.com/api.php';

// Fonte di riserva per completare l'elenco di un set: YGOPRODeck a volte collega solo le
// carte che sono ristampe di gia' esistenti (quindi gia' pronte, con nome definitivo) e non
// ancora quelle nuove del prodotto, che restano scollegate dal set finche' non vengono
// catalogate per bene - anche quando il set NON e' del tutto vuoto su YGOPRODeck (motivo per
// cui questa funzione va sempre incrociata con fetchCardsBySet, non usata solo come ripiego
// per i set completamente vuoti). Yugipedia genera la tabella delle carte di un set via un
// modulo Lua: non compare nel wikitext grezzo, va letta dall'HTML gia' impaginato (`prop=text`).
// La loro API e' pubblica e risponde gia' con CORS aperto di default (un solo header
// access-control-allow-origin: *). Il parametro MediaWiki `origin=*`, che servirebbe a
// richiederlo esplicitamente, va evitato: qui duplica l'header e il browser rifiuta la
// risposta ("contains multiple values '*, *'").
export async function fetchSetCardNamesFromYugipedia(setName) {
  const url = `${API_URL}?action=parse&page=${encodeURIComponent(setName)}&prop=text&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const html = json.parse?.text?.['*'];
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found = new Map(); // nome inglese -> { number, unofficial }

  // Ogni tab regione (JP/EN/TCG/...) e' una tabella "card-list" a se': si scorrono tutte
  // perche' regioni diverse possono avere carte rivelate diverse. La colonna nome si chiama
  // "English name" nei tab non-inglesi (affiancata alla localizzata) ma solo "Name" nei tab
  // gia' in inglese (es. un set TCG-first, senza equivalente OCG) - vanno accettati entrambi.
  for (const table of doc.querySelectorAll('table.card-list')) {
    const headerCells = [...table.querySelectorAll('tr:first-child th')];
    const headers = headerCells.map((th) => th.textContent.trim().toLowerCase());
    const nameCol = headers.findIndex((h) => h === 'name' || h.includes('english name'));
    const numberCol = headers.findIndex((h) => h.includes('card number'));
    const rarityCol = headers.findIndex((h) => h.includes('rarity'));
    if (nameCol === -1) continue;

    const rows = [...table.querySelectorAll('tr')].slice(1);
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      const nameCell = cells[nameCol];
      if (!nameCell) continue;
      // Yugipedia racchiude ogni nome tra virgolette decorative, fuori dal link: rimuoverle
      // scorporando il testo intero (`textContent.replace(/"/g, '')`) toglierebbe anche le
      // virgolette che fanno parte del nome vero e proprio (es. `Invocation - "Chalice"`).
      // L'attributo `title` del link e' il titolo esatto della pagina, virgolette incluse.
      const anchor = nameCell.querySelector('a');
      const name = (anchor?.getAttribute('title') || nameCell.textContent.replace(/^["“”]+|["“”]+$/g, '')).trim();
      if (!name || found.has(name)) continue;
      // Le carte spoilerate senza ancora un nome ufficiale Konami sono segnate da Yugipedia
      // con questa dicitura: il nome che si vede e' una traduzione della community, non certa.
      const unofficial = /\(unofficial name\)/i.test(nameCell.textContent);
      // La colonna rarita' elenca piu' link (una per rarita' stampata): serve a rilevare
      // le Grand Master Rare (sempre Overframe/Extended Art) anche per le carte che
      // YGOPRODeck non ha ancora collegato al set, quindi senza un card_sets da controllare.
      const rarities = rarityCol !== -1 ? [...(cells[rarityCol]?.querySelectorAll('a') || [])].map((a) => a.textContent.trim()) : [];
      found.set(name, {
        number: numberCol !== -1 ? cells[numberCol]?.textContent.trim() || '' : '',
        unofficial,
        rarities,
      });
    }
  }

  return [...found.entries()].map(([name, info]) => ({ name, ...info }));
}

// Immagine della carta ospitata da Yugipedia, usata solo per le carte non ancora presenti
// su YGOPRODeck (altrimenti si usa sempre l'immagine di YGOPRODeck, piu' affidabile).
export async function fetchCardImageFromYugipedia(cardName) {
  const url = `${API_URL}?action=query&titles=${encodeURIComponent(cardName)}&prop=pageimages&piprop=original&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const page = Object.values(json.query?.pages || {})[0];
  return page?.original?.source || null;
}

// Variante "Overframe"/Extended Art (illustrazione che esce dai bordi della carta, tipica
// delle rarita' Grand Master Rare): YGOPRODeck non la espone come immagine separata, va presa
// dai file di Yugipedia (suffisso "-EA" nel nome del file, per "Extended Art").
export async function fetchOverframeImageFromYugipedia(cardName) {
  const listUrl = `${API_URL}?action=query&titles=${encodeURIComponent(cardName)}&prop=images&imlimit=50&format=json`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) return null;
  const listJson = await listRes.json();
  const page = Object.values(listJson.query?.pages || {})[0];
  const eaFile = (page?.images || []).find((f) => /-EA\.\w+$/i.test(f.title));
  if (!eaFile) return null;

  const infoUrl = `${API_URL}?action=query&titles=${encodeURIComponent(eaFile.title)}&prop=imageinfo&iiprop=url&format=json`;
  const infoRes = await fetch(infoUrl);
  if (!infoRes.ok) return null;
  const infoJson = await infoRes.json();
  const infoPage = Object.values(infoJson.query?.pages || {})[0];
  return infoPage?.imageinfo?.[0]?.url || null;
}
