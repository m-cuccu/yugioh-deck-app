import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  createWantedPost,
  deleteWantedPost,
  listWantedPosts,
  setWantedOffer,
  updateWantedPost,
} from '../lib/wantedApi';
import {
  cardThumbnail,
  fetchCardSets,
  rarityToClass,
  resolveCardFilters,
  searchCardsByFilters,
} from '../lib/ygoApi';
import WantedPostCard from '../components/WantedPostCard';
import CardFilters, { EMPTY_CARD_FILTERS, hasActiveCardFilters } from '../components/CardFilters';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 9;

// Il campo resta una stringa mentre si digita (per poterlo svuotare): qui si riporta
// a un numero valido, all'uscita dal campo e prima di salvare.
function clampQuantity(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_QUANTITY) return MIN_QUANTITY;
  return Math.min(n, MAX_QUANTITY);
}

export default function WantedPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState('open'); // 'open' | 'all' | 'mine'

  // ?post=<id> arriva da un annuncio condiviso: si mostra quello, anche se nel frattempo
  // e' stato chiuso, altrimenti chi apre il link non troverebbe nulla.
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedPostId = searchParams.get('post');

  // form nuovo annuncio / modifica
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState(EMPTY_CARD_FILTERS);
  const [selectedCard, setSelectedCard] = useState(null);
  const [quantity, setQuantity] = useState(String(MIN_QUANTITY));
  const [note, setNote] = useState('');
  const [rarityLabel, setRarityLabel] = useState(null);
  const [rarityPickerOpen, setRarityPickerOpen] = useState(false);
  const [rarityOptions, setRarityOptions] = useState([]);
  const [rarityLoading, setRarityLoading] = useState(false);

  function reload() {
    setLoading(true);
    const opts = sharedPostId
      ? { status: 'all' }
      : filter === 'mine'
        ? { status: 'all', mineOnly: true }
        : { status: filter === 'all' ? 'all' : 'open' };
    listWantedPosts(user.id, opts)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, filter, sharedPostId]);

  const visiblePosts = sharedPostId ? posts.filter((p) => p.id === sharedPostId) : posts;

  useEffect(() => {
    if ((!query.trim() && !hasActiveCardFilters(filters)) || selectedCard) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchCardsByFilters({ query, lang, ...resolveCardFilters(filters) })
        .then((data) => { if (!cancelled) setResults(data.slice(0, 25)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, lang, filters, selectedCard]);

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setQuery('');
    setResults([]);
    setFilters(EMPTY_CARD_FILTERS);
    setSelectedCard(null);
    setQuantity(String(MIN_QUANTITY));
    setNote('');
    setRarityLabel(null);
    setRarityPickerOpen(false);
    setRarityOptions([]);
  }

  function startEdit(post) {
    setEditingId(post.id);
    setFormOpen(true);
    // in modifica la carta non si cambia: si aggiustano copie, nota e rarita'
    setSelectedCard({ id: post.card_id, name: post.card_name });
    setQuery(post.card_name);
    setQuantity(String(post.quantity));
    setNote(post.note || '');
    setRarityLabel(post.rarity_label || null);
    window.scrollTo({ top: 0 });
  }

  function openRarityPicker() {
    if (!selectedCard) return;
    setRarityPickerOpen(true);
    setRarityOptions([]);
    setRarityLoading(true);
    fetchCardSets(selectedCard.name, lang)
      .then(setRarityOptions)
      .catch((err) => setError(err.message))
      .finally(() => setRarityLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCard) return;

    // il campo e' una stringa libera mentre si digita: si valida qui, non a ogni battuta
    const qty = clampQuantity(quantity);

    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await updateWantedPost(editingId, {
          quantity: qty,
          note: note.trim() || null,
          rarity_label: rarityLabel || null,
        });
      } else {
        await createWantedPost(user.id, {
          cardId: selectedCard.id,
          cardName: selectedCard.name,
          cardImage: cardThumbnail(selectedCard),
          quantity: qty,
          note,
          rarityLabel,
        });
      }
      resetForm();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleOffer(post) {
    setBusy(true);
    setError('');
    try {
      await setWantedOffer(post.id, user.id, !post.iHaveIt);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(post) {
    setBusy(true);
    setError('');
    try {
      await updateWantedPost(post.id, { status: post.status === 'open' ? 'closed' : 'open' });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(post) {
    if (!window.confirm(`Eliminare l'annuncio per "${post.card_name}"? L'operazione non è reversibile.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteWantedPost(post.id);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>AAA Cercasi</h2>
        <div className="page-actions">
          <button
            className="btn-primary"
            type="button"
            onClick={() => (formOpen ? resetForm() : setFormOpen(true))}
          >
            {formOpen ? 'Annulla' : '+ Nuovo annuncio'}
          </button>
        </div>
      </div>

      <p className="visibility-hint">
        Cerchi una carta vera per completare un mazzo? Pubblica un annuncio: chi ce l'ha può
        segnalarsi e mettersi d'accordo con te nella discussione.
      </p>

      {error && <p className="auth-error">{error}</p>}

      {formOpen && (
        <form className="suggestion-form wanted-form" onSubmit={handleSubmit}>
          <label>
            Carta cercata
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!editingId) setSelectedCard(null);
              }}
              placeholder="Cerca una carta..."
              disabled={Boolean(editingId)}
            />
          </label>
          {!editingId && <CardFilters value={filters} onChange={setFilters} />}
          {editingId && (
            <p className="deck-sort-hint">
              La carta non si può cambiare: elimina l'annuncio e creane uno nuovo.
            </p>
          )}
          {searching && <p className="page-message">Ricerca...</p>}
          {!selectedCard && results.length > 0 && (
            <ul className="search-results quick-suggest-results">
              {results.map((card) => (
                <li
                  key={card.id}
                  className="search-result"
                  onClick={() => {
                    setSelectedCard(card);
                    setQuery(card.name);
                    setResults([]);
                  }}
                >
                  {cardThumbnail(card) && <img src={cardThumbnail(card)} alt={card.name} loading="lazy" />}
                  <span>{card.name}</span>
                  <span className="search-result-type">{card.type}</span>
                </li>
              ))}
            </ul>
          )}

          {selectedCard && (
            <div className="wanted-rarity-choice">
              {rarityLabel ? (
                <p className="rarity-current">
                  Edizione: <strong>{rarityLabel}</strong>{' '}
                  <button className="btn-link" type="button" onClick={() => setRarityLabel(null)}>
                    Rimuovi
                  </button>
                </p>
              ) : (
                <button className="btn-secondary" type="button" onClick={openRarityPicker}>
                  Scegli rarità/edizione (opzionale)
                </button>
              )}
            </div>
          )}

          <label>
            Copie cercate
            <input
              type="number"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={quantity}
              // si tiene il testo cosi' com'e' mentre si digita: normalizzando a ogni battuta
              // il campo non si puo' svuotare per riscriverlo, e torna sempre a 1
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => setQuantity(String(clampQuantity(quantity)))}
            />
          </label>

          <label>
            Nota (opzionale)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. zona, condizioni accettate, scambio o acquisto"
            />
          </label>

          <button className="btn-primary" type="submit" disabled={busy || !selectedCard}>
            {editingId ? 'Salva modifiche' : 'Pubblica annuncio'}
          </button>
        </form>
      )}

      {rarityPickerOpen && (
        <div className="art-picker-overlay" onClick={() => setRarityPickerOpen(false)}>
          <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="art-picker-header">
              <h3>Scegli l'edizione di {selectedCard?.name}</h3>
              <button className="btn-link" type="button" onClick={() => setRarityPickerOpen(false)}>
                Chiudi
              </button>
            </div>
            {rarityLoading ? (
              <p className="page-message">Caricamento edizioni...</p>
            ) : rarityOptions.length === 0 ? (
              <p className="page-message">Nessuna edizione trovata per questa carta.</p>
            ) : (
              <ul className="rarity-list">
                {rarityOptions.map((set, i) => {
                  const label = `${set.set_rarity} · ${set.set_name}`;
                  return (
                    <li key={`${set.set_code}-${i}`} className="rarity-item">
                      <span className={`rarity-swatch ${rarityToClass(set.set_rarity)}`} />
                      <div className="rarity-item-text">
                        <span className="rarity-name">{set.set_rarity}</span>
                        <span className="rarity-set">{set.set_name} ({set.set_code})</span>
                      </div>
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => {
                          setRarityLabel(label);
                          setRarityPickerOpen(false);
                        }}
                      >
                        Scegli
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {sharedPostId ? (
        <p className="visibility-hint">
          Stai guardando un annuncio condiviso.{' '}
          <button className="btn-link" type="button" onClick={() => setSearchParams({})}>
            Mostra tutti gli annunci
          </button>
        </p>
      ) : (
        <div className="suggest-kind-tabs wanted-filters">
          <button type="button" className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>
            Aperti
          </button>
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            Tutti
          </button>
          <button type="button" className={filter === 'mine' ? 'active' : ''} onClick={() => setFilter('mine')}>
            I miei
          </button>
        </div>
      )}

      {loading ? (
        <p className="page-message">Caricamento annunci...</p>
      ) : visiblePosts.length === 0 ? (
        <p className="page-message">
          {sharedPostId
            ? "L'annuncio condiviso non esiste più: potrebbe essere stato eliminato."
            : filter === 'mine'
              ? 'Non hai pubblicato annunci.'
              : 'Nessun annuncio al momento.'}
        </p>
      ) : (
        <ul className="wanted-list">
          {visiblePosts.map((post) => (
            <WantedPostCard
              key={post.id}
              post={post}
              busy={busy}
              highlighted={post.id === sharedPostId}
              onToggleOffer={handleToggleOffer}
              onEdit={startEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
