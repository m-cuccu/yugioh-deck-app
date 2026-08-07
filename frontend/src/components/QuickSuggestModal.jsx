import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { createSuggestion } from '../lib/decksApi';
import { cardThumbnail, searchCards } from '../lib/ygoApi';
import { sectionLabel } from '../lib/suggestions';

// Suggerimento rapido su una carta specifica, aperto direttamente dal deck di un altro utente
// invece di dover scorrere fino al modulo in fondo alla pagina.
// "Aggiungi" non compare qui perche' non si riferisce a una carta gia' presente.
export default function QuickSuggestModal({ deckId, target, onClose, onCreated }) {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [kind, setKind] = useState('replace');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (kind !== 'replace' || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchCards(query, lang)
        .then((data) => { if (!cancelled) setResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, lang, kind]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (kind === 'replace' && !selected) return;

    setBusy(true);
    setError('');
    try {
      await createSuggestion(deckId, user.id, {
        kind,
        targetCardId: target.card_id,
        targetCardName: target.card_name,
        targetSection: target.section,
        suggestedCardId: kind === 'replace' ? selected.id : null,
        suggestedCardName: kind === 'replace' ? selected.name : null,
        suggestedCardImage: kind === 'replace' ? cardThumbnail(selected) : null,
        comment,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="art-picker-overlay" onClick={onClose}>
      <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="art-picker-header">
          <h3>Suggerisci su {target.card_name}</h3>
          <button className="btn-link" onClick={onClose} type="button">Chiudi</button>
        </div>

        <p className="quick-suggest-target">
          {target.card_name} · {sectionLabel(target.section)} · {target.quantity}{' '}
          {target.quantity === 1 ? 'copia' : 'copie'} nel deck
        </p>

        <form onSubmit={handleSubmit} className="suggestion-form">
          <div className="suggest-kind-tabs">
            <button
              type="button"
              className={kind === 'replace' ? 'active' : ''}
              onClick={() => setKind('replace')}
            >
              ⇄ Sostituisci
            </button>
            <button
              type="button"
              className={kind === 'remove' ? 'active' : ''}
              onClick={() => {
                setKind('remove');
                setSelected(null);
                setQuery('');
                setResults([]);
              }}
            >
              − Rimuovi
            </button>
          </div>

          {kind === 'replace' && (
            <>
              <label>
                Carta suggerita al suo posto
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Cerca una carta..."
                  autoFocus
                />
              </label>
              {searching && <p className="page-message">Ricerca...</p>}
              {!selected && results.length > 0 && (
                <ul className="search-results quick-suggest-results">
                  {results.map((card) => (
                    <li
                      key={card.id}
                      className="search-result"
                      onClick={() => {
                        setSelected(card);
                        setQuery(card.name);
                        setResults([]);
                      }}
                    >
                      {cardThumbnail(card) && (
                        <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />
                      )}
                      <span>{card.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <label>
            Motivazione (opzionale)
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={kind === 'remove' ? 'Perché toglierla?' : 'Perché questa carta?'}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="btn-primary"
            type="submit"
            disabled={busy || (kind === 'replace' && !selected)}
          >
            {busy ? 'Invio...' : 'Invia suggerimento'}
          </button>
        </form>
      </div>
    </div>
  );
}
