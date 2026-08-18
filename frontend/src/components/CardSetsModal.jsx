import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchCardSets, rarityToClass } from '../lib/ygoApi';

// Elenco di sola consultazione delle edizioni/rarita' in cui una carta e' stata stampata.
export default function CardSetsModal({ cardName, onClose }) {
  const { lang } = useLanguage();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCardSets(cardName, lang)
      .then((data) => { if (!cancelled) setSets(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cardName, lang]);

  return (
    <div className="art-picker-overlay" onClick={onClose}>
      <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="art-picker-header">
          <h3>Edizioni di {cardName}</h3>
          <button className="btn-link" onClick={onClose} type="button">Chiudi</button>
        </div>

        {loading ? (
          <p className="page-message">Caricamento edizioni...</p>
        ) : error ? (
          <p className="page-message">{error}</p>
        ) : sets.length === 0 ? (
          <p className="page-message">Nessuna edizione trovata per questa carta.</p>
        ) : (
          <ul className="rarity-list">
            {sets.map((set, i) => (
              <li key={`${set.set_code}-${i}`} className="rarity-item">
                <span className={`rarity-swatch ${rarityToClass(set.set_rarity)}`} />
                <div className="rarity-item-text">
                  <span className="rarity-name">{set.set_rarity}</span>
                  <span className="rarity-set">{set.set_name} ({set.set_code})</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
