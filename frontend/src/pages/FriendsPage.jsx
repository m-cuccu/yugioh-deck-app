import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listPublicDecksByUser, searchProfilesByUsername } from '../lib/decksApi';

export default function FriendsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSelected(null);
    setDecks([]);
    try {
      setProfiles(await searchProfilesByUsername(query, user.id));
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
      <h2>Cerca amici</h2>
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

      {!selected && profiles.length > 0 && (
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.id} className="profile-item" onClick={() => handleSelectProfile(p)}>
              {p.username}
            </li>
          ))}
        </ul>
      )}

      {!selected && profiles.length === 0 && query && (
        <p className="page-message">Nessun utente trovato.</p>
      )}

      {selected && (
        <div>
          <button className="btn-link" onClick={() => setSelected(null)} type="button">← Torna alla ricerca</button>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
