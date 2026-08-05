import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createSuggestion,
  deleteSuggestion,
  getDeck,
  listSuggestions,
  saveDeckCards,
} from '../lib/decksApi';
import { cardThumbnail, fetchCardArts, isExtraDeckCard, searchCards } from '../lib/ygoApi';

const LIMITS = { main: [40, 60], extra: [0, 15], side: [0, 15] };
const MAX_COPIES = 3;

function toEditable(card) {
  return {
    card_id: card.card_id,
    card_name: card.card_name,
    card_image: card.card_image,
    quantity: card.quantity,
  };
}

export default function DeckEditorPage() {
  const { deckId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState({ main: [], extra: [], side: [] });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [targetKey, setTargetKey] = useState('');
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestResults, setSuggestResults] = useState([]);
  const [suggestSearching, setSuggestSearching] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState(null);
  const [comment, setComment] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);

  const [artPicker, setArtPicker] = useState(null); // { section, cardId, cardName }
  const [artOptions, setArtOptions] = useState([]);
  const [artLoading, setArtLoading] = useState(false);

  const readOnly = deck ? deck.user_id !== user.id : false;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDeck(deckId)
      .then((full) => {
        if (cancelled) return;
        setDeck(full);
        setCards({
          main: full.cards.main.map(toEditable),
          extra: full.cards.extra.map(toEditable),
          side: full.cards.side.map(toEditable),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [deckId]);

  function reloadSuggestions() {
    setSuggestionsLoading(true);
    return listSuggestions(deckId)
      .then((data) => setSuggestions(data))
      .catch((err) => setError(err.message))
      .finally(() => setSuggestionsLoading(false));
  }

  useEffect(() => {
    reloadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchCards(query)
        .then((data) => { if (!cancelled) setResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (!suggestQuery.trim()) {
      setSuggestResults([]);
      return;
    }
    let cancelled = false;
    setSuggestSearching(true);
    const timer = setTimeout(() => {
      searchCards(suggestQuery)
        .then((data) => { if (!cancelled) setSuggestResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setSuggestResults([]); })
        .finally(() => { if (!cancelled) setSuggestSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [suggestQuery]);

  const totalCopies = useMemo(() => {
    const map = new Map();
    for (const section of ['main', 'extra', 'side']) {
      for (const c of cards[section]) map.set(c.card_id, (map.get(c.card_id) || 0) + c.quantity);
    }
    return map;
  }, [cards]);

  const allCardsFlat = useMemo(() => {
    const flat = [];
    for (const section of ['main', 'extra', 'side']) {
      for (const c of cards[section]) flat.push({ ...c, section });
    }
    return flat;
  }, [cards]);

  function addCard(card) {
    if (readOnly) return;
    const section = isExtraDeckCard(card) ? 'extra' : 'main';
    const currentCopies = totalCopies.get(card.id) || 0;
    if (currentCopies >= MAX_COPIES) {
      setError(`"${card.name}" ha già ${MAX_COPIES} copie nel deck.`);
      return;
    }
    setError('');
    setCards((prev) => {
      const list = prev[section];
      const existing = list.find((c) => c.card_id === card.id);
      const next = existing
        ? list.map((c) => (c.card_id === card.id ? { ...c, quantity: c.quantity + 1 } : c))
        : [...list, { card_id: card.id, card_name: card.name, card_image: cardThumbnail(card), quantity: 1 }];
      return { ...prev, [section]: next };
    });
    setDirty(true);
    setQuery('');
    setResults([]);
  }

  function changeQuantity(section, cardId, delta) {
    if (readOnly) return;
    setCards((prev) => {
      const list = prev[section]
        .map((c) => (c.card_id === cardId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0);
      return { ...prev, [section]: list };
    });
    setDirty(true);
  }

  function moveCard(fromSection, toSection, cardId) {
    if (readOnly || fromSection === toSection) return;
    setCards((prev) => {
      const card = prev[fromSection].find((c) => c.card_id === cardId);
      if (!card) return prev;
      const fromList = prev[fromSection].filter((c) => c.card_id !== cardId);
      const existingInTarget = prev[toSection].find((c) => c.card_id === cardId);
      const toList = existingInTarget
        ? prev[toSection].map((c) => (c.card_id === cardId ? { ...c, quantity: c.quantity + card.quantity } : c))
        : [...prev[toSection], card];
      return { ...prev, [fromSection]: fromList, [toSection]: toList };
    });
    setDirty(true);
  }

  function openArtPicker(section, card) {
    if (readOnly) return;
    setArtPicker({ section, cardId: card.card_id, cardName: card.card_name });
    setArtOptions([]);
    setArtLoading(true);
    fetchCardArts(card.card_name)
      .then((arts) => setArtOptions(arts))
      .catch((err) => setError(err.message))
      .finally(() => setArtLoading(false));
  }

  function closeArtPicker() {
    setArtPicker(null);
    setArtOptions([]);
  }

  function chooseArt(imageUrl) {
    if (!artPicker) return;
    const { section, cardId } = artPicker;
    setCards((prev) => ({
      ...prev,
      [section]: prev[section].map((c) => (c.card_id === cardId ? { ...c, card_image: imageUrl } : c)),
    }));
    setDirty(true);
    closeArtPicker();
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveDeckCards(deckId, cards);
      setDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitSuggestion(e) {
    e.preventDefault();
    if (!targetKey || !selectedReplacement) return;
    const [targetSection, targetCardIdStr] = targetKey.split(':');
    const targetCardId = Number(targetCardIdStr);
    const target = cards[targetSection].find((c) => c.card_id === targetCardId);
    if (!target) return;

    setSuggestBusy(true);
    setError('');
    try {
      await createSuggestion(deckId, user.id, {
        targetCardId: target.card_id,
        targetCardName: target.card_name,
        targetSection,
        suggestedCardId: selectedReplacement.id,
        suggestedCardName: selectedReplacement.name,
        suggestedCardImage: cardThumbnail(selectedReplacement),
        comment,
      });
      setTargetKey('');
      setSuggestQuery('');
      setSuggestResults([]);
      setSelectedReplacement(null);
      setComment('');
      await reloadSuggestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestBusy(false);
    }
  }

  async function handleAccept(suggestion) {
    setError('');
    const section = suggestion.target_section;
    const list = cards[section];
    const targetIndex = list.findIndex((c) => c.card_id === suggestion.target_card_id);
    if (targetIndex === -1) {
      setError('La carta da sostituire non è più nel deck.');
      return;
    }

    const currentTotalOfSuggested = totalCopies.get(suggestion.suggested_card_id) || 0;
    if (currentTotalOfSuggested >= MAX_COPIES) {
      setError(`"${suggestion.suggested_card_name}" ha già ${MAX_COPIES} copie nel deck, impossibile applicare.`);
      return;
    }

    const nextList = list
      .map((c) => (c.card_id === suggestion.target_card_id ? { ...c, quantity: c.quantity - 1 } : c))
      .filter((c) => c.quantity > 0);

    const existingReplacement = nextList.find((c) => c.card_id === suggestion.suggested_card_id);
    const finalList = existingReplacement
      ? nextList.map((c) =>
          c.card_id === suggestion.suggested_card_id ? { ...c, quantity: c.quantity + 1 } : c
        )
      : [
          ...nextList,
          {
            card_id: suggestion.suggested_card_id,
            card_name: suggestion.suggested_card_name,
            card_image: suggestion.suggested_card_image,
            quantity: 1,
          },
        ];

    const nextCards = { ...cards, [section]: finalList };

    setSuggestBusy(true);
    try {
      await saveDeckCards(deckId, nextCards);
      setCards(nextCards);
      await deleteSuggestion(suggestion.id);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestBusy(false);
    }
  }

  async function handleDismiss(suggestion) {
    setSuggestBusy(true);
    setError('');
    try {
      await deleteSuggestion(suggestion.id);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestBusy(false);
    }
  }

  if (loading) return <p className="page-message">Caricamento deck...</p>;
  if (!deck) return <p className="page-message">{error || 'Deck non trovato'}</p>;

  return (
    <div className="page editor-page">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate('/')} type="button">← Indietro</button>
        <h2>{deck.name}{readOnly && <span className="badge-readonly">di altro utente</span>}</h2>
        {!readOnly && (
          <button className="btn-primary" onClick={handleSave} disabled={!dirty || saving} type="button">
            {saving ? 'Salvataggio...' : dirty ? 'Salva modifiche' : 'Salvato'}
          </button>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      {!readOnly && (
        <div className="card-search">
          <input
            type="text"
            placeholder="Cerca una carta per nome..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <p className="page-message">Ricerca...</p>}
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((card) => (
                <li key={card.id} className="search-result" onClick={() => addCard(card)}>
                  {cardThumbnail(card) && <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />}
                  <span>{card.name}</span>
                  <span className="search-result-type">{card.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {['main', 'extra', 'side'].map((section) => {
        const [min, max] = LIMITS[section];
        const total = cards[section].reduce((sum, c) => sum + c.quantity, 0);
        const outOfRange = total < min || total > max;
        return (
          <section key={section} className="deck-section">
            <h3>
              {sectionLabel(section)}{' '}
              <span className={outOfRange ? 'count-warning' : 'count-ok'}>
                {total} carte {min > 0 || max > 0 ? `(${min}-${max})` : ''}
              </span>
            </h3>
            {cards[section].length === 0 ? (
              <p className="page-message">Nessuna carta.</p>
            ) : (
              <ul className="deck-card-grid">
                {cards[section].map((c) => (
                  <li key={c.card_id} className="deck-card-tile">
                    {c.card_image && (
                      readOnly ? (
                        <img src={c.card_image} alt={c.card_name} loading="lazy" />
                      ) : (
                        <button
                          type="button"
                          className="art-picker-trigger"
                          onClick={() => openArtPicker(section, c)}
                          title="Cambia art"
                        >
                          <img src={c.card_image} alt={c.card_name} loading="lazy" />
                        </button>
                      )
                    )}
                    <span className="deck-card-tile-name">{c.card_name}</span>
                    {!readOnly && (
                      <div className="deck-card-tile-controls">
                        <button type="button" onClick={() => changeQuantity(section, c.card_id, -1)}>-</button>
                        <span>{c.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(section, c.card_id, 1)}
                          disabled={(totalCopies.get(c.card_id) || 0) >= MAX_COPIES}
                        >
                          +
                        </button>
                        <select
                          value={section}
                          onChange={(e) => moveCard(section, e.target.value, c.card_id)}
                        >
                          <option value="main">Main</option>
                          <option value="extra">Extra</option>
                          <option value="side">Side</option>
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="suggestions-section">
        <h3>Suggerimenti{suggestions.length > 0 ? ` (${suggestions.length})` : ''}</h3>

        {readOnly && (
          <form onSubmit={handleSubmitSuggestion} className="suggestion-form">
            <label>
              Carta da sostituire
              <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                <option value="">-- scegli una carta del deck --</option>
                {allCardsFlat.map((c) => (
                  <option key={`${c.section}:${c.card_id}`} value={`${c.section}:${c.card_id}`}>
                    {c.card_name} ({sectionLabel(c.section)})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Carta suggerita al suo posto
              <input
                type="text"
                value={suggestQuery}
                onChange={(e) => {
                  setSuggestQuery(e.target.value);
                  setSelectedReplacement(null);
                }}
                placeholder="Cerca una carta..."
              />
            </label>
            {suggestSearching && <p className="page-message">Ricerca...</p>}
            {!selectedReplacement && suggestResults.length > 0 && (
              <ul className="search-results">
                {suggestResults.map((card) => (
                  <li
                    key={card.id}
                    className="search-result"
                    onClick={() => {
                      setSelectedReplacement(card);
                      setSuggestQuery(card.name);
                      setSuggestResults([]);
                    }}
                  >
                    {cardThumbnail(card) && <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />}
                    <span>{card.name}</span>
                  </li>
                ))}
              </ul>
            )}

            <label>
              Commento (opzionale)
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Perché questa carta?"
              />
            </label>

            <button
              className="btn-primary"
              type="submit"
              disabled={!targetKey || !selectedReplacement || suggestBusy}
            >
              Invia suggerimento
            </button>
          </form>
        )}

        {suggestionsLoading ? (
          <p className="page-message">Caricamento suggerimenti...</p>
        ) : suggestions.length === 0 ? (
          <p className="page-message">Nessun suggerimento ancora.</p>
        ) : (
          <ul className="suggestion-list">
            {suggestions.map((s) => (
              <li key={s.id} className="suggestion-item">
                <div>
                  <span className="suggestion-author">{s.profiles?.username || 'Un utente'}</span>{' '}
                  propone <strong>{s.suggested_card_name}</strong> al posto di{' '}
                  <strong>{s.target_card_name}</strong> ({sectionLabel(s.target_section)})
                </div>
                {s.comment && <p className="suggestion-comment">"{s.comment}"</p>}
                {!readOnly && (
                  <div className="suggestion-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleAccept(s)}
                      disabled={suggestBusy}
                      type="button"
                    >
                      Applica
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDismiss(s)}
                      disabled={suggestBusy}
                      type="button"
                    >
                      Rifiuta
                    </button>
                  </div>
                )}
                {readOnly && s.author_id === user.id && (
                  <button className="btn-link" onClick={() => handleDismiss(s)} type="button">
                    Ritira
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {artPicker && (
        <div className="art-picker-overlay" onClick={closeArtPicker}>
          <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="art-picker-header">
              <h3>Scegli l'art per {artPicker.cardName}</h3>
              <button className="btn-link" onClick={closeArtPicker} type="button">Chiudi</button>
            </div>
            {artLoading ? (
              <p className="page-message">Caricamento arti...</p>
            ) : artOptions.length === 0 ? (
              <p className="page-message">Nessuna art alternativa trovata.</p>
            ) : (
              <ul className="art-picker-grid">
                {artOptions.map((art) => (
                  <li key={art.id}>
                    <button type="button" onClick={() => chooseArt(art.image_url_small || art.image_url)}>
                      <img src={art.image_url_small || art.image_url} alt={artPicker.cardName} loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function sectionLabel(section) {
  if (section === 'main') return 'Main Deck';
  if (section === 'extra') return 'Extra Deck';
  return 'Side Deck';
}
