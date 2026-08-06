import { useEffect, useMemo, useState } from 'react';
import { useBanlist } from '../context/BanlistContext';
import { useLanguage } from '../context/LanguageContext';
import { BANLIST_FORMATS, banlistClass, banlistLabel, fetchBanlistCards, maxCopiesFor } from '../lib/banlist';
import CardDetailModal from '../components/CardDetailModal';

const GROUPS = ['Forbidden', 'Limited', 'Semi-Limited'];

export default function BanlistPage() {
  const { format, setFormat } = useBanlist();
  const { lang } = useLanguage();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    if (format === 'none') {
      setCards([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchBanlistCards(format, lang)
      .then((data) => !cancelled && setCards(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [format, lang]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? cards.filter((c) => c.name.toLowerCase().includes(q)) : cards;
    const out = { Forbidden: [], Limited: [], 'Semi-Limited': [] };
    for (const c of filtered) {
      if (out[c.status]) out[c.status].push(c);
    }
    for (const g of GROUPS) out[g].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [cards, query]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Banlist</h2>
        <div className="lang-switch">
          {BANLIST_FORMATS.filter((f) => f.key !== 'none').map((f) => (
            <button
              key={f.key}
              type="button"
              className={format === f.key ? 'active' : ''}
              onClick={() => setFormat(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="visibility-hint">
        Lista ufficiale in vigore, aggiornata automaticamente. Il formato scelto qui è lo stesso
        usato per validare i tuoi deck.
      </p>

      {format === 'none' && (
        <p className="page-message">
          Validazione banlist disattivata. Scegli TCG o OCG qui sopra per consultarla.
        </p>
      )}

      {format !== 'none' && (
        <>
          <div className="friend-search-form">
            <input
              type="text"
              placeholder="Filtra per nome..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          {loading ? (
            <p className="page-message">Caricamento banlist...</p>
          ) : (
            GROUPS.map((status) => (
              <section key={status} className="deck-section">
                <h3>
                  <span className={`ban-badge ${banlistClass(status)}`}>
                    {banlistLabel(status, lang)}
                  </span>{' '}
                  <span className="count-ok">
                    {grouped[status].length} carte · massimo {maxCopiesFor(status)}{' '}
                    {maxCopiesFor(status) === 1 ? 'copia' : 'copie'}
                  </span>
                </h3>
                {grouped[status].length === 0 ? (
                  <p className="page-message">Nessuna carta{query ? ' con questo nome' : ''}.</p>
                ) : (
                  <ul className="banlist-grid">
                    {grouped[status].map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="banlist-card"
                          onClick={() => setDetailId(c.id)}
                          title="Vedi effetto"
                        >
                          {c.image && <img src={c.image} alt={c.name} loading="lazy" />}
                          <span>{c.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </>
      )}

      {detailId && <CardDetailModal cardId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
