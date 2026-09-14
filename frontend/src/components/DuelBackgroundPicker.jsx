import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { cardArtwork, cardThumbnail, fetchArchetypeNames, fetchCardsByArchetype } from '../lib/ygoApi';

const MAX_SUGGESTIONS = 12;

// Modale a due passi: cerca un archetipo, poi scegli la carta esatta da usare come sfondo del
// pannello Life Points (non esiste un modo affidabile per sapere qual e' "il boss monster" di
// un archetipo, quindi la scelta finale e' sempre dell'utente).
export default function DuelBackgroundPicker({ onSelect, onClose }) {
  const { lang } = useLanguage();
  const [allArchetypes, setAllArchetypes] = useState([]);
  const [query, setQuery] = useState('');
  const [archetype, setArchetype] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchArchetypeNames()
      .then(setAllArchetypes)
      .catch(() => {});
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allArchetypes.filter((name) => name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [query, allArchetypes]);

  function chooseArchetype(name) {
    setArchetype(name);
    setQuery(name);
    setLoading(true);
    setError('');
    fetchCardsByArchetype(name, lang)
      .then(setCards)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function backToSearch() {
    setArchetype(null);
    setCards([]);
    setQuery('');
  }

  return (
    <div className="art-picker-overlay" onClick={onClose}>
      <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="art-picker-header">
          <h3>Sfondo del pannello</h3>
          <button className="btn-link" onClick={onClose} type="button">Chiudi</button>
        </div>

        <div className="duel-bg-picker-actions">
          {archetype && (
            <button type="button" className="btn-link" onClick={backToSearch}>
              ← Cambia archetipo
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => onSelect(null)}>
            Nessuno sfondo
          </button>
        </div>

        {!archetype ? (
          <>
            <input
              type="text"
              placeholder="Cerca un archetipo (es. Blue-Eyes)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {suggestions.length > 0 && (
              <ul className="collection-grid">
                {suggestions.map((name) => (
                  <li key={name}>
                    <button type="button" className="btn-secondary" onClick={() => chooseArchetype(name)}>
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : loading ? (
          <p className="page-message">Caricamento carte...</p>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : cards.length === 0 ? (
          <p className="page-message">Nessuna carta trovata per questo archetipo.</p>
        ) : (
          <ul className="art-picker-grid">
            {cards.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => onSelect(cardArtwork(card))} title={card.name}>
                  <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
