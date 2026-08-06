import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  createDeckVersion,
  createSuggestion,
  deleteSuggestion,
  getDeck,
  listDeckVersions,
  listSuggestions,
  respondToSuggestion,
  saveDeckCards,
} from '../lib/decksApi';
import { applySuggestionToCards, MAX_COPIES, sectionLabel } from '../lib/suggestions';
import SuggestionCard from '../components/SuggestionCard';
import { exportDeckAsJson, exportDeckAsYdk } from '../lib/deckIO';
import {
  cardThumbnail,
  fetchCardArts,
  fetchCardNamesByIds,
  fetchCardSets,
  fetchRelatedCards,
  isExtraDeckCard,
  rarityToClass,
  searchCards,
} from '../lib/ygoApi';

const LIMITS = { main: [40, 60], extra: [0, 15], side: [0, 15] };

function toEditable(card) {
  return {
    card_id: card.card_id,
    card_name: card.card_name,
    card_image: card.card_image,
    quantity: card.quantity,
    rarity_label: card.rarity_label || null,
  };
}

export default function DeckEditorPage() {
  const { deckId } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { refreshUnread } = useNotifications();
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
  const [suggestKind, setSuggestKind] = useState('replace'); // 'replace' | 'add' | 'remove'
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

  const [relatedPicker, setRelatedPicker] = useState(null); // { cardName }
  const [relatedOptions, setRelatedOptions] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const [rarityPicker, setRarityPicker] = useState(null); // { section, cardId, cardName }
  const [rarityOptions, setRarityOptions] = useState([]);
  const [rarityLoading, setRarityLoading] = useState(false);

  const [respondingId, setRespondingId] = useState(null); // suggerimento a cui si sta rispondendo
  const [responseComment, setResponseComment] = useState('');
  const [versions, setVersions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

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

  // Chiave stabile con gli id presenti nel deck: cambia solo quando cambia l'insieme delle
  // carte, non a ogni modifica di quantita' o di nome (che l'effetto qui sotto riscrive).
  const cardIdsKey = useMemo(
    () =>
      [...cards.main, ...cards.extra, ...cards.side]
        .map((c) => c.card_id)
        .sort((a, b) => a - b)
        .join(','),
    [cards]
  );

  // I nomi salvati in deck_cards sono l'istantanea di quando la carta e' stata aggiunta:
  // qui li riallineiamo alla lingua scelta (solo per la visualizzazione, senza toccare il deck).
  useEffect(() => {
    if (!cardIdsKey) return;
    const ids = cardIdsKey.split(',').map(Number);

    let cancelled = false;
    fetchCardNamesByIds(ids, lang).then((names) => {
      if (cancelled || names.size === 0) return;
      setCards((prev) => {
        let changed = false;
        const next = {};
        for (const section of ['main', 'extra', 'side']) {
          next[section] = prev[section].map((c) => {
            const translated = names.get(c.card_id);
            if (!translated || translated === c.card_name) return c;
            changed = true;
            return { ...c, card_name: translated };
          });
        }
        return changed ? next : prev;
      });
    });
    return () => { cancelled = true; };
  }, [cardIdsKey, lang]);

  function reloadSuggestions() {
    setSuggestionsLoading(true);
    return listSuggestions(deckId)
      .then((data) => setSuggestions(data))
      .catch((err) => setError(err.message))
      .finally(() => setSuggestionsLoading(false));
  }

  function reloadVersions() {
    return listDeckVersions(deckId)
      .then((data) => setVersions(data))
      .catch(() => setVersions([]));
  }

  useEffect(() => {
    reloadSuggestions();
    reloadVersions();
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
      searchCards(query, lang)
        .then((data) => { if (!cancelled) setResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, lang]);

  useEffect(() => {
    if (!suggestQuery.trim()) {
      setSuggestResults([]);
      return;
    }
    let cancelled = false;
    setSuggestSearching(true);
    const timer = setTimeout(() => {
      searchCards(suggestQuery, lang)
        .then((data) => { if (!cancelled) setSuggestResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setSuggestResults([]); })
        .finally(() => { if (!cancelled) setSuggestSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [suggestQuery, lang]);

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
        : [
            ...list,
            { card_id: card.id, card_name: card.name, card_image: cardThumbnail(card), quantity: 1, rarity_label: null },
          ];
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
    fetchCardArts(card.card_name, lang)
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

  function openRelatedPicker(card) {
    if (readOnly) return;
    setRelatedPicker({ cardName: card.card_name });
    setRelatedOptions([]);
    setRelatedLoading(true);
    fetchRelatedCards(card.card_name, lang)
      .then((related) => setRelatedOptions(related))
      .catch((err) => setError(err.message))
      .finally(() => setRelatedLoading(false));
  }

  function closeRelatedPicker() {
    setRelatedPicker(null);
    setRelatedOptions([]);
  }

  function openRarityPicker(section, card) {
    if (readOnly) return;
    setRarityPicker({
      section,
      cardId: card.card_id,
      cardName: card.card_name,
      currentLabel: card.rarity_label || null,
    });
    setRarityOptions([]);
    setRarityLoading(true);
    fetchCardSets(card.card_name, lang)
      .then((sets) => setRarityOptions(sets))
      .catch((err) => setError(err.message))
      .finally(() => setRarityLoading(false));
  }

  function closeRarityPicker() {
    setRarityPicker(null);
    setRarityOptions([]);
  }

  function chooseRarity(set) {
    if (!rarityPicker) return;
    const { section, cardId } = rarityPicker;
    const label = `${set.set_rarity} · ${set.set_name}`;
    setCards((prev) => ({
      ...prev,
      [section]: prev[section].map((c) => (c.card_id === cardId ? { ...c, rarity_label: label } : c)),
    }));
    setDirty(true);
    closeRarityPicker();
  }

  function clearRarity() {
    if (!rarityPicker) return;
    const { section, cardId } = rarityPicker;
    setCards((prev) => ({
      ...prev,
      [section]: prev[section].map((c) => (c.card_id === cardId ? { ...c, rarity_label: null } : c)),
    }));
    setDirty(true);
    closeRarityPicker();
  }

  // esporta quello che si vede a schermo (comprese le modifiche non ancora salvate)
  function handleExport(format) {
    const snapshot = { name: deck.name, cards };
    if (format === 'json') exportDeckAsJson(snapshot);
    else exportDeckAsYdk(snapshot);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveDeckCards(deckId, cards);
      setDirty(false);
      // snapshot dopo il salvataggio, cosi' lo storico riflette le versioni effettive
      await createDeckVersion(deckId, cards, 'Salvataggio');
      await reloadVersions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitSuggestion(e) {
    e.preventDefault();

    const payload = { kind: suggestKind, comment };

    if (suggestKind === 'replace' || suggestKind === 'remove') {
      if (!targetKey) return;
      const [targetSection, targetCardIdStr] = targetKey.split(':');
      const target = cards[targetSection].find((c) => c.card_id === Number(targetCardIdStr));
      if (!target) return;
      payload.targetCardId = target.card_id;
      payload.targetCardName = target.card_name;
      payload.targetSection = targetSection;
    }

    if (suggestKind === 'replace' || suggestKind === 'add') {
      if (!selectedReplacement) return;
      payload.suggestedCardId = selectedReplacement.id;
      payload.suggestedCardName = selectedReplacement.name;
      payload.suggestedCardImage = cardThumbnail(selectedReplacement);
      // per l'aggiunta la sezione di destinazione la deduciamo dal tipo di carta
      if (suggestKind === 'add') {
        payload.targetSection = isExtraDeckCard(selectedReplacement) ? 'extra' : 'main';
      }
    }

    setSuggestBusy(true);
    setError('');
    try {
      await createSuggestion(deckId, user.id, payload);
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
    const { nextCards, error: applyError } = applySuggestionToCards(cards, suggestion);
    if (applyError) {
      setError(applyError);
      return;
    }

    setSuggestBusy(true);
    try {
      await createDeckVersion(deckId, cards, 'Prima di applicare un suggerimento');
      await saveDeckCards(deckId, nextCards);
      setCards(nextCards);
      await respondToSuggestion(suggestion.id, 'accepted', responseComment);
      setRespondingId(null);
      setResponseComment('');
      await reloadSuggestions();
      await reloadVersions();
      refreshUnread();
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestBusy(false);
    }
  }

  async function handleReject(suggestion) {
    setSuggestBusy(true);
    setError('');
    try {
      await respondToSuggestion(suggestion.id, 'rejected', responseComment);
      setRespondingId(null);
      setResponseComment('');
      await reloadSuggestions();
      refreshUnread();
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestBusy(false);
    }
  }

  // l'autore puo' ritirare un suggerimento ancora in attesa
  async function handleWithdraw(suggestion) {
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

  async function handleRestoreVersion(version) {
    if (!window.confirm('Ripristinare questa versione del deck? Lo stato attuale viene salvato nello storico.')) {
      return;
    }
    setRestoringId(version.id);
    setError('');
    try {
      const restored = {
        main: version.cards.main || [],
        extra: version.cards.extra || [],
        side: version.cards.side || [],
      };
      await createDeckVersion(deckId, cards, 'Prima di un ripristino');
      await saveDeckCards(deckId, restored);
      setCards(restored);
      setDirty(false);
      await reloadVersions();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return <p className="page-message">Caricamento deck...</p>;
  if (!deck) return <p className="page-message">{error || 'Deck non trovato'}</p>;

  return (
    <div className="page editor-page">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)} type="button">← Indietro</button>
        <h2>{deck.name}{readOnly && <span className="badge-readonly">di altro utente</span>}</h2>
        <div className="editor-actions">
          <button className="btn-secondary" onClick={() => handleExport('json')} type="button">
            Esporta JSON
          </button>
          <button className="btn-secondary" onClick={() => handleExport('ydk')} type="button">
            Esporta YDK
          </button>
          {!readOnly && (
            <button className="btn-primary" onClick={handleSave} disabled={!dirty || saving} type="button">
              {saving ? 'Salvataggio...' : dirty ? 'Salva modifiche' : 'Salvato'}
            </button>
          )}
        </div>
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
                {cards[section].map((c) => {
                  const rarityClass = c.rarity_label ? rarityToClass(c.rarity_label) : '';
                  return (
                  <li key={c.card_id} className="deck-card-tile">
                    {readOnly && <span className="deck-card-qty-badge">×{c.quantity}</span>}
                    {c.card_image && (
                      readOnly ? (
                        <span className={`card-art-wrap ${rarityClass}`} title={c.rarity_label || undefined}>
                          <img src={c.card_image} alt={c.card_name} loading="lazy" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="art-picker-trigger"
                          onClick={() => openArtPicker(section, c)}
                          title={c.rarity_label || 'Cambia art'}
                        >
                          <span className={`card-art-wrap ${rarityClass}`}>
                            <img src={c.card_image} alt={c.card_name} loading="lazy" />
                          </span>
                        </button>
                      )
                    )}
                    <span className={`deck-card-tile-name ${rarityClass ? `name-${rarityClass}` : ''}`}>
                      {c.card_name}
                    </span>
                    {c.rarity_label && <span className="deck-card-tile-rarity">{c.rarity_label}</span>}
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
                    {!readOnly && (
                      <button
                        type="button"
                        className="related-cards-trigger"
                        onClick={() => openRelatedPicker(c)}
                      >
                        Carte correlate
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        className="related-cards-trigger"
                        onClick={() => openRarityPicker(section, c)}
                      >
                        Rarità{c.rarity_label ? ' ✓' : ''}
                      </button>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <section className="suggestions-section">
        <h3>Suggerimenti{suggestions.length > 0 ? ` (${suggestions.length})` : ''}</h3>

        {readOnly && (
          <form onSubmit={handleSubmitSuggestion} className="suggestion-form">
            <div className="suggest-kind-tabs">
              {[
                { key: 'replace', label: '⇄ Sostituisci' },
                { key: 'add', label: '+ Aggiungi' },
                { key: 'remove', label: '− Rimuovi' },
              ].map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={suggestKind === k.key ? 'active' : ''}
                  onClick={() => {
                    setSuggestKind(k.key);
                    setTargetKey('');
                    setSuggestQuery('');
                    setSuggestResults([]);
                    setSelectedReplacement(null);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {(suggestKind === 'replace' || suggestKind === 'remove') && (
              <label>
                {suggestKind === 'replace' ? 'Carta da sostituire' : 'Carta da rimuovere'}
                <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                  <option value="">-- scegli una carta del deck --</option>
                  {allCardsFlat.map((c) => (
                    <option key={`${c.section}:${c.card_id}`} value={`${c.section}:${c.card_id}`}>
                      {c.card_name} ({sectionLabel(c.section)}) ×{c.quantity}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(suggestKind === 'replace' || suggestKind === 'add') && (
              <>
                <label>
                  {suggestKind === 'replace' ? 'Carta suggerita al suo posto' : 'Carta da aggiungere'}
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
              </>
            )}

            <label>
              Commento (opzionale)
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={suggestKind === 'remove' ? 'Perché toglierla?' : 'Perché questa carta?'}
              />
            </label>

            <button
              className="btn-primary"
              type="submit"
              disabled={
                suggestBusy ||
                (suggestKind === 'replace' && (!targetKey || !selectedReplacement)) ||
                (suggestKind === 'add' && !selectedReplacement) ||
                (suggestKind === 'remove' && !targetKey)
              }
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
            {suggestions.map((s) => {
              const status = s.status || 'pending';
              return (
                <SuggestionCard key={s.id} suggestion={s}>
                  {!readOnly && status === 'pending' && (
                    respondingId === s.id ? (
                      <div className="suggestion-reject-form">
                        <input
                          type="text"
                          value={responseComment}
                          onChange={(e) => setResponseComment(e.target.value)}
                          placeholder="Motivo (opzionale)"
                        />
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() => handleAccept(s)}
                          disabled={suggestBusy}
                        >
                          Applica
                        </button>
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() => handleReject(s)}
                          disabled={suggestBusy}
                        >
                          Rifiuta
                        </button>
                        <button
                          className="btn-link"
                          type="button"
                          onClick={() => {
                            setRespondingId(null);
                            setResponseComment('');
                          }}
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
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
                          className="btn-secondary"
                          onClick={() => {
                            setRespondingId(s.id);
                            setResponseComment('');
                          }}
                          disabled={suggestBusy}
                          type="button"
                        >
                          Rispondi con un motivo
                        </button>
                      </div>
                    )
                  )}
                  {readOnly && status === 'pending' && s.author_id === user.id && (
                    <button className="btn-link" onClick={() => handleWithdraw(s)} type="button">
                      Ritira
                    </button>
                  )}
                </SuggestionCard>
              );
            })}
          </ul>
        )}
      </section>

      {!readOnly && (
        <section className="history-section">
          <div className="history-header">
            <h3>Storico del deck{versions.length > 0 ? ` (${versions.length})` : ''}</h3>
            <button className="btn-link" type="button" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? 'Nascondi' : 'Mostra'}
            </button>
          </div>

          {showHistory && (
            versions.length === 0 ? (
              <p className="page-message">
                Nessuna versione salvata. Ne viene creata una a ogni salvataggio.
              </p>
            ) : (
              <ul className="version-list">
                {versions.map((v) => {
                  const counts = {
                    main: (v.cards.main || []).reduce((s, c) => s + c.quantity, 0),
                    extra: (v.cards.extra || []).reduce((s, c) => s + c.quantity, 0),
                    side: (v.cards.side || []).reduce((s, c) => s + c.quantity, 0),
                  };
                  return (
                    <li key={v.id} className="version-item">
                      <div className="version-info">
                        <span className="version-label">{v.label || 'Versione'}</span>
                        <span className="version-meta">
                          {new Date(v.created_at).toLocaleString('it-IT')} · Main {counts.main} · Extra{' '}
                          {counts.extra} · Side {counts.side}
                        </span>
                      </div>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => handleRestoreVersion(v)}
                        disabled={restoringId === v.id}
                      >
                        {restoringId === v.id ? 'Ripristino...' : 'Ripristina'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </section>
      )}

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

      {relatedPicker && (
        <div className="art-picker-overlay" onClick={closeRelatedPicker}>
          <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="art-picker-header">
              <h3>Carte correlate a {relatedPicker.cardName}</h3>
              <button className="btn-link" onClick={closeRelatedPicker} type="button">Chiudi</button>
            </div>
            {relatedLoading ? (
              <p className="page-message">Ricerca carte correlate...</p>
            ) : relatedOptions.length === 0 ? (
              <p className="page-message">Nessuna carta correlata trovata per questo archetipo.</p>
            ) : (
              <ul className="related-cards-list">
                {relatedOptions.map((card) => {
                  const owned = totalCopies.get(card.id) || 0;
                  const alreadyMax = owned >= MAX_COPIES;
                  return (
                    <li key={card.id} className={`related-card-item ${owned > 0 ? 'is-owned' : ''}`}>
                      {cardThumbnail(card) && <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />}
                      <div className="related-card-text">
                        <span className="related-card-name">{card.name}</span>
                        <span className={`related-card-owned ${owned > 0 ? 'has-copies' : ''}`}>
                          {owned > 0 ? `${owned}x nel deck` : 'non nel deck'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => addCard(card)}
                        disabled={alreadyMax}
                      >
                        {alreadyMax ? 'Max 3' : '+ Aggiungi'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {rarityPicker && (
        <div className="art-picker-overlay" onClick={closeRarityPicker}>
          <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="art-picker-header">
              <h3>Scegli l'edizione di {rarityPicker.cardName}</h3>
              <button className="btn-link" onClick={closeRarityPicker} type="button">Chiudi</button>
            </div>
            {rarityPicker.currentLabel ? (
              <p className="rarity-current">
                Attuale: <strong>{rarityPicker.currentLabel}</strong>{' '}
                <button className="btn-link" onClick={clearRarity} type="button">Rimuovi</button>
              </p>
            ) : (
              <p className="rarity-current rarity-current-none">Nessuna edizione scelta (carta comune)</p>
            )}
            {rarityLoading ? (
              <p className="page-message">Caricamento edizioni...</p>
            ) : rarityOptions.length === 0 ? (
              <p className="page-message">Nessuna edizione trovata per questa carta.</p>
            ) : (
              <ul className="rarity-list">
                {rarityOptions.map((set, i) => {
                  const label = `${set.set_rarity} · ${set.set_name}`;
                  const isSelected = label === rarityPicker.currentLabel;
                  return (
                    <li key={`${set.set_code}-${i}`} className={`rarity-item ${isSelected ? 'is-selected' : ''}`}>
                      <span className={`rarity-swatch ${rarityToClass(set.set_rarity)}`} />
                      <div className="rarity-item-text">
                        <span className="rarity-name">{set.set_rarity}</span>
                        <span className="rarity-set">{set.set_name} ({set.set_code})</span>
                      </div>
                      <button
                        className={isSelected ? 'btn-secondary' : 'btn-primary'}
                        onClick={() => chooseRarity(set)}
                        type="button"
                      >
                        {isSelected ? '✓ Scelta' : 'Scegli'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

