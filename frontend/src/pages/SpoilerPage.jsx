import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUpcomingSets } from '../lib/ygoApi';

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SpoilerPage() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUpcomingSets()
      .then((data) => !cancelled && setSets(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Spoiler</h2>
      </div>

      <p className="visibility-hint">
        Set TCG non ancora usciti, con le carte gia' rivelate. Clicca su un set per vederle.
      </p>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="page-message">Caricamento...</p>
      ) : sets.length === 0 ? (
        <p className="page-message">Nessun set in uscita al momento.</p>
      ) : (
        <ul className="deck-list">
          {sets.map((set) => (
            <li key={set.set_code || set.set_name} className="deck-card">
              <Link to={`/spoiler/${encodeURIComponent(set.set_name)}`} className="deck-card-main">
                <span className="deck-card-name">{set.set_name}</span>
                <span className="deck-card-counts">
                  Uscita TCG: {formatDate(set.tcg_date)} · {set.num_of_cards} carte previste
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
