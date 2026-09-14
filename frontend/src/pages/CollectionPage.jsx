import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { listOwnedCardIds, setCardOwned, setCollectionVisibility } from '../lib/collectionApi';
import { browseAllCards, cardThumbnail, resolveCardFilters, searchCardsByFilters } from '../lib/ygoApi';
import CardFilters, { EMPTY_CARD_FILTERS, hasActiveCardFilters } from '../components/CardFilters';
import CardDetailModal from '../components/CardDetailModal';
import SectionTabs from '../components/SectionTabs';

const PAGE_SIZE = 60;

export default function CollectionPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const { unreadRequests } = useNotifications();

  const [ownedIds, setOwnedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [visibilityBusy, setVisibilityBusy] = useState(false);

  async function toggleVisibility() {
    setVisibilityBusy(true);
    try {
      await setCollectionVisibility(user.id, !profile?.collection_public);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setVisibilityBusy(false);
    }
  }

  const [query, setQuery] = useState('');
  const [numberQuery, setNumberQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_CARD_FILTERS);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const searching = Boolean(numberQuery.trim()) || Boolean(query.trim()) || hasActiveCardFilters(filters);

  useEffect(() => {
    listOwnedCardIds(user.id)
      .then(setOwnedIds)
      .catch((err) => setError(err.message));
  }, [user.id]);

  // Ogni cambio di ricerca/filtro riparte da zero (nuovi risultati, non piu' accumulo).
  useEffect(() => {
    setPage(0);
  }, [query, numberQuery, filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(page === 0);
    setLoadingMore(page > 0);

    const timer = setTimeout(() => {
      const request = numberQuery.trim()
        ? searchCardsByFilters({ query: `Number ${numberQuery.trim()}:`, lang, ...resolveCardFilters(filters) })
        : searching
          ? searchCardsByFilters({ query, lang, ...resolveCardFilters(filters) })
          : browseAllCards({ lang, num: PAGE_SIZE, offset: page * PAGE_SIZE });

      request
        .then((data) => {
          if (cancelled) return;
          const pageData = searching ? data.slice(0, PAGE_SIZE) : data;
          setResults((prev) => (page === 0 ? pageData : [...prev, ...pageData]));
        })
        .catch((err) => !cancelled && setError(err.message))
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setLoadingMore(false);
        });
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, numberQuery, filters, lang, page]);

  async function toggleOwned(card) {
    const owned = ownedIds.has(card.id);
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (owned) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
    try {
      await setCardOwned(user.id, card, !owned);
    } catch (err) {
      setOwnedIds((prev) => {
        const next = new Set(prev);
        if (owned) next.add(card.id);
        else next.delete(card.id);
        return next;
      });
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <SectionTabs
        tabs={[
          { to: '/collezione', label: 'Collezione' },
          {
            to: '/cercasi',
            label: 'Cercasi',
            badge: unreadRequests > 0 && <span className="nav-badge">{unreadRequests}</span>,
          },
        ]}
      />
      <div className="page-header">
        <h2>Collezione</h2>
      </div>

      <p className="visibility-hint">
        Sfoglia le carte e segna quelle che possiedi con il badge "+". Le carte senza badge attivo
        restano in bianco e nero.
      </p>

      <div className="visibility-toggle-row">
        <button
          type="button"
          className={`visibility-toggle ${profile?.collection_public ? 'is-on' : 'is-off'}`}
          onClick={toggleVisibility}
          disabled={visibilityBusy}
          aria-pressed={Boolean(profile?.collection_public)}
        >
          <span className="visibility-toggle-track">
            <span className="visibility-toggle-knob" />
          </span>
          {profile?.collection_public ? 'Collezione visibile' : 'Collezione non visibile'}
        </button>
      </div>

      <div className="card-filters">
        <div className="card-filters-row">
          <input
            type="text"
            placeholder="Cerca per nome..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={Boolean(numberQuery.trim())}
          />
          <input
            type="text"
            placeholder="Cerca per numero (es. 39)"
            value={numberQuery}
            onChange={(e) => setNumberQuery(e.target.value)}
          />
        </div>
      </div>
      <CardFilters value={filters} onChange={setFilters} />

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="page-message">Caricamento...</p>
      ) : results.length === 0 ? (
        <p className="page-message">Nessuna carta trovata.</p>
      ) : (
        <>
          <ul className="collection-grid">
            {results.map((card) => {
              const owned = ownedIds.has(card.id);
              return (
                <li key={card.id} className="collection-tile">
                  <button type="button" className="collection-card-image" onClick={() => setSelectedCard(card)}>
                    <img
                      className={owned ? '' : 'is-unowned'}
                      src={cardThumbnail(card)}
                      alt={card.name}
                      loading="lazy"
                    />
                  </button>
                  <button
                    type="button"
                    className={`collection-owned-badge ${owned ? 'is-owned' : ''}`}
                    title={owned ? 'Segna come non posseduta' : 'Segna come posseduta'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOwned(card);
                    }}
                  >
                    {owned ? '✓' : '+'}
                  </button>
                </li>
              );
            })}
          </ul>

          {!searching && (
            <div className="page-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={loadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {loadingMore ? 'Caricamento...' : `Carica altre ${PAGE_SIZE}`}
              </button>
            </div>
          )}
        </>
      )}

      {selectedCard && <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
