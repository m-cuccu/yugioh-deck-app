import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { cardThumbnail, fetchCardByName, fetchCardsBySet } from '../lib/ygoApi';
import {
  fetchCardImageFromYugipedia,
  fetchOverframeImageFromYugipedia,
  fetchSetCardNamesFromYugipedia,
} from '../lib/yugipediaApi';
import CardDetailModal from '../components/CardDetailModal';

// Le rarita' "Grand Master Rare" hanno sempre un'illustrazione Overframe (Extended Art),
// che esce dai bordi della carta: YGOPRODeck non la espone come immagine, va presa da
// Yugipedia solo al bisogno (quando l'utente apre la carta), non per tutta la grid.
// Per le carte trovate su YGOPRODeck si guarda card_sets; per quelle risolte/segnaposto
// via Yugipedia (che spesso non ha ancora un card_sets per questo set, o non esiste affatto
// su YGOPRODeck) si guarda invece `rarities`, raccolta dalla tabella del set su Yugipedia.
function hasOverframeVariant(card, setName) {
  const fromYgoprodeck = card.card_sets?.some(
    (s) => s.set_name === setName && s.set_rarity?.toLowerCase().includes('grand master')
  );
  const fromYugipedia = card.rarities?.some((r) => r.toLowerCase().includes('grand master'));
  return Boolean(fromYgoprodeck || fromYugipedia);
}

// Le carte segnaposto (senza scheda YGOPRODeck) hanno una singola immagine piatta invece
// di `card_images`: si adatta alla forma che CardDetailModal si aspetta.
function toModalCard(card) {
  if (!card.pending) return card;
  return { ...card, card_images: card.image ? [{ image_url: card.image }] : [] };
}

// Evita di ripetere, ogni volta che si torna sulla pagina nella stessa sessione, il fallback
// pesante su Yugipedia (una chiamata + una per ogni carta non ancora nota su YGOPRODeck).
const sessionCache = new Map();

// YGOPRODeck spesso collega al set solo le carte che sono ristampe di carte gia' esistenti
// (nome e immagine pronti da subito): quelle nuove del prodotto restano scollegate finche'
// non vengono catalogate per bene, anche quando il set non e' del tutto vuoto su YGOPRODeck.
// Si confrontano quindi sempre i nomi con Yugipedia e si risolve solo cio' che manca:
// prima si riprova un'ultima volta su YGOPRODeck (potrebbe essere stato appena aggiunto),
// poi si tiene almeno l'immagine da Yugipedia come segnaposto.
async function findMissingCards(setName, lang, knownNames) {
  const yugipediaNames = await fetchSetCardNamesFromYugipedia(setName).catch(() => []);
  const missing = yugipediaNames.filter((n) => !knownNames.has(n.name.toLowerCase()));
  if (missing.length === 0) return [];

  const results = new Array(missing.length);
  let next = 0;

  async function worker() {
    while (next < missing.length) {
      const i = next++;
      const { name, unofficial, rarities } = missing[i];
      const card = await fetchCardByName(name, lang).catch(() => null);
      if (card) {
        results[i] = { ...card, rarities };
        continue;
      }
      const image = await fetchCardImageFromYugipedia(name).catch(() => null);
      results[i] = { id: `pending-${name}`, name, pending: true, unofficial, rarities, image };
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, missing.length) }, worker));
  return results;
}

export default function SpoilerSetPage() {
  const { setName } = useParams();
  const { lang } = useLanguage();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extraFromYugipedia, setExtraFromYugipedia] = useState(0);
  const [selectedCard, setSelectedCard] = useState(null);
  const [overframeImage, setOverframeImage] = useState(null);

  function openCard(card) {
    setSelectedCard(toModalCard(card));
    setOverframeImage(null);
    if (hasOverframeVariant(card, setName)) {
      fetchOverframeImageFromYugipedia(card.name).then(setOverframeImage).catch(() => {});
    }
  }

  useEffect(() => {
    const cacheKey = `${setName}:${lang}`;
    const cached = sessionCache.get(cacheKey);
    if (cached) {
      setCards(cached.cards);
      setExtraFromYugipedia(cached.extraFromYugipedia);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchCardsBySet(setName, lang)
      .then(async (known) => {
        if (cancelled) return null;
        const knownNames = new Set(known.map((c) => c.name.toLowerCase()));
        const missing = await findMissingCards(setName, lang, knownNames);
        return { cards: [...known, ...missing], extraFromYugipedia: missing.length };
      })
      .then((result) => {
        if (cancelled || !result) return;
        sessionCache.set(cacheKey, result);
        setCards(result.cards);
        setExtraFromYugipedia(result.extraFromYugipedia);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [setName, lang]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>{setName}</h2>
        <div className="page-actions">
          <Link to="/spoiler" className="btn-secondary">← Tutti i set</Link>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {!loading && cards.length > 0 && (
        <p className="visibility-hint">
          {cards.length} carte rivelate finora.
          {extraFromYugipedia > 0 &&
            ` Di cui ${extraFromYugipedia} non ancora catalogate su YGOPRODeck (dati da Yugipedia, in parte con nome non ufficiale finche' Konami non lo confirma).`}
        </p>
      )}

      {loading ? (
        <p className="page-message">Caricamento...</p>
      ) : cards.length === 0 ? (
        <p className="page-message">Nessuna carta rivelata ancora per questo set.</p>
      ) : (
        <ul className="art-picker-grid">
          {cards.map((card) => (
            <li key={card.id}>
              {card.pending ? (
                <button
                  type="button"
                  className={`spoiler-pending-card ${card.image ? 'spoiler-pending-card-image' : ''}`}
                  title={`${card.name}${card.unofficial ? ' (nome non ufficiale)' : ''} · dettagli non ancora disponibili su YGOPRODeck`}
                  onClick={() => openCard(card)}
                >
                  {card.image ? <img src={card.image} alt={card.name} loading="lazy" /> : card.name}
                  {card.unofficial && <span className="spoiler-unofficial-badge">?</span>}
                  {hasOverframeVariant(card, setName) && (
                    <span className="spoiler-overframe-badge" title="Disponibile anche in Overframe (Extended Art)">
                      EA
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openCard(card)}
                  title={`DEBUG ${card.name} · rarities=${JSON.stringify(card.rarities)} · card_sets=${JSON.stringify(card.card_sets)}`}
                >
                  <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />
                  {hasOverframeVariant(card, setName) && (
                    <span className="spoiler-overframe-badge" title="Disponibile anche in Overframe (Extended Art)">
                      EA
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          overframeImage={overframeImage}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
