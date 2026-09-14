import { useEffect, useMemo, useState } from 'react';
import { communityDeckSearchUrl, fetchArchetypeNames } from '../lib/ygoApi';
import { useNotifications } from '../context/NotificationsContext';
import SectionTabs from '../components/SectionTabs';

const MAX_SUGGESTIONS = 12;

function deckSectionTabs(unreadCount) {
  return [
    { to: '/', label: 'I miei deck' },
    { to: '/liste-community', label: 'Liste Community' },
    {
      to: '/suggerimenti',
      label: 'Suggerimenti',
      badge: unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>,
    },
  ];
}

export default function CommunityDecksPage() {
  const { unreadCount } = useNotifications();
  const [allArchetypes, setAllArchetypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetchArchetypeNames()
      .then(setAllArchetypes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allArchetypes.filter((name) => name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [query, allArchetypes]);

  function choose(name) {
    setSelected(name);
    setQuery(name);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim()) setSelected(query.trim());
  }

  return (
    <div className="page">
      <SectionTabs tabs={deckSectionTabs(unreadCount)} />
      <div className="page-header">
        <h2>Liste Community</h2>
      </div>

      <p className="visibility-hint">
        Cerca un archetipo per aprire le decklist caricate dalla community su YGOPRODeck.
      </p>

      <form className="card-filters" onSubmit={handleSubmit}>
        <div className="card-filters-row">
          <input
            type="text"
            placeholder="Cerca un archetipo (es. Invoked)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected('');
            }}
          />
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="page-message">Caricamento archetipi...</p>
      ) : (
        <>
          {suggestions.length > 0 && !selected && (
            <ul className="collection-grid">
              {suggestions.map((name) => (
                <li key={name}>
                  <button type="button" className="btn-secondary" onClick={() => choose(name)}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="page-actions">
              <a
                className="btn-primary"
                href={communityDeckSearchUrl(selected)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apri le liste di "{selected}" su YGOPRODeck ↗
              </a>
              <p className="page-message">
                Se l'archetipo non ha ancora liste caricate, YGOPRODeck mostrera' una pagina non trovata.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
