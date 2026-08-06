import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchCardDetails } from '../lib/ygoApi';
import { translateAttribute, translateCardType, translateRace } from '../lib/cardI18n';

// Scheda con effetto e statistiche di una carta.
// Si puo' passare `card` gia' completo (es. dai risultati di ricerca) oppure solo `cardId`,
// nel qual caso i dati vengono recuperati al volo.
export default function CardDetailModal({ card: initialCard, cardId, onClose }) {
  const { lang } = useLanguage();
  const [card, setCard] = useState(initialCard || null);
  const [loading, setLoading] = useState(!initialCard);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialCard) {
      setCard(initialCard);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCardDetails(cardId, lang)
      .then((data) => {
        if (cancelled) return;
        if (!data) setError('Dettagli non disponibili per questa carta.');
        setCard(data);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [cardId, initialCard, lang]);

  const image = card?.card_images?.[0]?.image_url || card?.card_images?.[0]?.image_url_small;
  const isMonster = Boolean(card?.type?.includes('Monster'));
  const isLink = Boolean(card?.type?.includes('Link'));

  return (
    <div className="art-picker-overlay" onClick={onClose}>
      <div className="art-picker-modal card-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="art-picker-header">
          <h3>{card?.name || 'Dettagli carta'}</h3>
          <button className="btn-link" onClick={onClose} type="button">Chiudi</button>
        </div>

        {loading ? (
          <p className="page-message">Caricamento...</p>
        ) : error || !card ? (
          <p className="page-message">{error || 'Nessun dato disponibile.'}</p>
        ) : (
          <div className="card-detail-body">
            {image && <img className="card-detail-image" src={image} alt={card.name} />}

            <div className="card-detail-info">
              <p className="card-detail-type">
                {translateCardType(card.humanReadableCardType || card.type, lang)}
              </p>

              {!isMonster && card.race && (
                <ul className="card-detail-stats">
                  <li>
                    <span>Categoria</span>
                    <strong>{translateRace(card.race, lang)}</strong>
                  </li>
                </ul>
              )}

              {isMonster && (
                <ul className="card-detail-stats">
                  {card.attribute && (
                    <li>
                      <span>Attributo</span>
                      <strong>{translateAttribute(card.attribute, lang)}</strong>
                    </li>
                  )}
                  {card.race && (
                    <li>
                      <span>Tipo</span>
                      <strong>{translateRace(card.race, lang)}</strong>
                    </li>
                  )}
                  {isLink ? (
                    card.linkval != null && (
                      <li>
                        <span>Link</span>
                        <strong>{card.linkval}</strong>
                      </li>
                    )
                  ) : (
                    card.level != null && (
                      <li>
                        <span>Livello/Rank</span>
                        <strong>{card.level}</strong>
                      </li>
                    )
                  )}
                  {card.atk != null && (
                    <li>
                      <span>ATK</span>
                      <strong>{card.atk}</strong>
                    </li>
                  )}
                  {!isLink && card.def != null && (
                    <li>
                      <span>DEF</span>
                      <strong>{card.def}</strong>
                    </li>
                  )}
                </ul>
              )}

              {card.archetype && (
                <p className="card-detail-archetype">Archetipo: {card.archetype}</p>
              )}

              <p className="card-detail-desc">{card.desc}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
