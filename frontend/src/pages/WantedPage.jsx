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
import { cardThumbnail, searchCards } from '../lib/ygoApi';
import WantedPostCard from '../components/WantedPostCard';

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
  const [selectedCard, setSelectedCard] = useState(null);
  const [quantity, setQuantity] = useState(String(MIN_QUANTITY));
  const [note, setNote] = useState('');

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
    if (!query.trim() || selectedCard) {
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
  }, [query, lang, selectedCard]);

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setQuery('');
    setResults([]);
    setSelectedCard(null);
    setQuantity(String(MIN_QUANTITY));
    setNote('');
  }

  function startEdit(post) {
    setEditingId(post.id);
    setFormOpen(true);
    // in modifica la carta non si cambia: si aggiustano copie e nota
    setSelectedCard({ id: post.card_id, name: post.card_name });
    setQuery(post.card_name);
    setQuantity(String(post.quantity));
    setNote(post.note || '');
    window.scrollTo({ top: 0 });
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
        await updateWantedPost(editingId, { quantity: qty, note: note.trim() || null });
      } else {
        await createWantedPost(user.id, {
          cardId: selectedCard.id,
          cardName: selectedCard.name,
          cardImage: cardThumbnail(selectedCard),
          quantity: qty,
          note,
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
                </li>
              ))}
            </ul>
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
