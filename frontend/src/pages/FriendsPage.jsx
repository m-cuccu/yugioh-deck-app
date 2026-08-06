import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeck, listPublicDecksByUser, listRecentProfiles, searchProfilesByUsername } from '../lib/decksApi';
import { exportDeckAsJson, exportDeckAsYdk } from '../lib/deckIO';

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
    try {
      setDecks(await listPublicDecksByUser(profile.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        </div>
      )}
    </div>
  );
}
