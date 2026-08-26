import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeck, listPublicDecksByUser, listRecentProfiles, searchProfilesByUsername } from '../lib/decksApi';
import { exportDeckAsJson, exportDeckAsYdk } from '../lib/deckIO';
import { listOwnedCardsForUser } from '../lib/collectionApi';
import { createCardRequest, listSentRequestsTo } from '../lib/cardRequestsApi';
import CardDetailModal from '../components/CardDetailModal';

export default function FriendsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [searched, setSearched] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ownedCards, setOwnedCards] = useState([]);
  const [requestStatusByCard, setRequestStatusByCard] = useState(new Map());
  const [selectedOwnedCard, setSelectedOwnedCard] = useState(null);

  function loadRecent() {
    setProfilesLoading(true);
    setSearched(false);
    listRecentProfiles(user.id)
      .then((data) => setProfiles(data))
      .catch((err) => setError(err.message))
      .finally(() => setProfilesLoading(false));
  }

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSelected(null);
    setDecks([]);

    if (!query.trim()) {
      loadRecent();
      return;
    }

    setProfilesLoading(true);
    try {
      setProfiles(await searchProfilesByUsername(query, user.id));
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setProfilesLoading(false);
    }
  }

  function handleClearSearch() {
    setQuery('');
    setError('');
    loadRecent();
  }

  async function handleExport(deck, format) {
    setError('');
    try {
      const full = await getDeck(deck.id);
      if (format === 'json') exportDeckAsJson(full);
      else exportDeckAsYdk(full);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSelectProfile(profile) {
    setSelected(profile);
    setLoading(true);
    setError('');
    setOwnedCards([]);
    setRequestStatusByCard(new Map());
    try {
      const [publicDecks, owned, sentRequests] = await Promise.all([
        listPublicDecksByUser(profile.id),
        profile.collection_public ? listOwnedCardsForUser(profile.id) : Promise.resolve([]),
        profile.collection_public ? listSentRequestsTo(user.id, profile.id) : Promise.resolve([]),
      ]);
      setDecks(publicDecks);
      setOwnedCards(owned);
      setRequestStatusByCard(new Map(sentRequests.map((r) => [r.card_id, r.status])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestCard(card) {
    setRequestStatusByCard((prev) => new Map(prev).set(card.card_id, 'sending'));
    try {
      await createCardRequest(user.id, selected.id, { id: card.card_id, name: card.card_name, image: card.card_image });
      setRequestStatusByCard((prev) => new Map(prev).set(card.card_id, 'pending'));
    } catch (err) {
      setRequestStatusByCard((prev) => {
        const next = new Map(prev);
        next.delete(card.card_id);
        return next;
      });
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h2>Amici</h2>
      <form onSubmit={handleSearch} className="friend-search-form">
        <input
          type="text"
          placeholder="Cerca per username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary" type="submit">Cerca</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {!selected && (
        <>
          <div className="friend-list-header">
            <h3>{searched ? `Risultati per "${query}"` : 'Utenti iscritti di recente'}</h3>
            {searched && (
              <button className="btn-link" onClick={handleClearSearch} type="button">
                Mostra tutti
              </button>
            )}
          </div>

          {profilesLoading ? (
            <p className="page-message">Caricamento...</p>
          ) : profiles.length === 0 ? (
            <p className="page-message">
              {searched ? 'Nessun utente trovato.' : 'Nessun altro utente registrato per ora.'}
            </p>
          ) : (
            <ul className="profile-list">
              {profiles.map((p) => (
                <li key={p.id} className="profile-item" onClick={() => handleSelectProfile(p)}>
                  {p.username}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected && (
        <div>
          <button className="btn-link" onClick={() => setSelected(null)} type="button">← Torna alla lista</button>
          <h3>Deck pubblici di {selected.username}</h3>
          {loading ? (
            <p className="page-message">Caricamento...</p>
          ) : decks.length === 0 ? (
            <p className="page-message">Questo utente non ha deck pubblici.</p>
          ) : (
            <ul className="deck-list">
              {decks.map((deck) => (
                <li key={deck.id} className="deck-card">
                  <Link to={`/deck/${deck.id}`} className="deck-card-main">
                    <span className="deck-card-name">{deck.name}</span>
                    <span className="deck-card-counts">
                      Main {deck.counts.main} · Extra {deck.counts.extra} · Side {deck.counts.side}
                    </span>
                  </Link>
                  <div className="deck-card-menu">
                    <button type="button" onClick={() => handleExport(deck, 'ydk')}>⬇ Esporta YDK</button>
                    <button type="button" onClick={() => handleExport(deck, 'json')}>⬇ Esporta JSON</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3>Collezione di {selected.username}</h3>
          {!selected.collection_public ? (
            <p className="page-message">Questo utente non ha reso pubblica la propria collezione.</p>
          ) : loading ? (
            <p className="page-message">Caricamento...</p>
          ) : ownedCards.length === 0 ? (
            <p className="page-message">Nessuna carta segnata come posseduta.</p>
          ) : (
            <ul className="collection-grid">
              {ownedCards.map((card) => (
                <li key={card.card_id} className="collection-tile">
                  <button
                    type="button"
                    className="collection-card-image"
                    onClick={() => setSelectedOwnedCard(card)}
                  >
                    <img src={card.card_image} alt={card.card_name} loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedOwnedCard && (
        <CardDetailModal
          cardId={selectedOwnedCard.card_id}
          onClose={() => setSelectedOwnedCard(null)}
          onRequestCard={() => handleRequestCard(selectedOwnedCard)}
          requestStatus={requestStatusByCard.get(selectedOwnedCard.card_id)}
        />
      )}
    </div>
  );
}
