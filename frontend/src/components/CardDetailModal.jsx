import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchCardDetails, fetchEnglishCardName } from '../lib/ygoApi';
import { fetchCardTraderPrice } from '../lib/cardtraderApi';
import { translateAttribute, translateCardType, translateRace } from '../lib/cardI18n';
import { useBanlist } from '../context/BanlistContext';
import { banlistClass, banlistLabel } from '../lib/banlist';

// Scheda con effetto e statistiche di una carta.
// Si puo' passare `card` gia' completo (es. dai risultati di ricerca) oppure solo `cardId`,
// nel qual caso i dati vengono recuperati al volo.
export default function CardDetailModal({ card: initialCard, cardId, onClose }) {
  const { lang } = useLanguage();
  const { statusOf, maxCopiesForCard, format } = useBanlist();
  const [card, setCard] = useState(initialCard || null);
  const [loading, setLoading] = useState(!initialCard);
  const [error, setError] = useState('');

  const [price, setPrice] = useState(null); // { price, currency, url } | null finche' non arriva
  const [priceLoading, setPriceLoading] = useState(false);

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

  // Il catalogo CardTrader e' in inglese: cercando col nome tradotto non si trova nulla e il
  // prezzo risulterebbe sempre non disponibile. Si usa quindi il nome inglese, recuperandolo
  // se la carta arriva dai risultati di ricerca (dove non lo portiamo dietro).
  useEffect(() => {
    if (!card?.id) return;
    let cancelled = false;
    setPriceLoading(true);

    const resolveName = card.englishName
      ? Promise.resolve(card.englishName)
      : !lang || lang === 'en'
        ? Promise.resolve(card.name)
        : fetchEnglishCardName(card.id).then((n) => n || card.name);

    resolveName
      .then((name) => fetchCardTraderPrice(name))
      .then((data) => { if (!cancelled) setPrice(data); })
      .catch(() => { if (!cancelled) setPrice(null); })
      .finally(() => { if (!cancelled) setPriceLoading(false); });

    return () => { cancelled = true; };
  }, [card?.id, card?.englishName, card?.name, lang]);

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

              <p className="card-detail-price">
                CardTrader:{' '}
                {priceLoading ? (
                  'ricerca prezzo...'
                ) : price?.price != null ? (
                  <strong>
                    {new Intl.NumberFormat('it-IT', { style: 'currency', currency: price.currency || 'EUR' }).format(
                      price.price
                    )}
                  </strong>
                ) : (
                  'prezzo non disponibile'
                )}
                {price?.url && (
                  <>
                    {' '}
                    <a href={price.url} target="_blank" rel="noopener noreferrer" className="btn-link">
                      Vedi su CardTrader ↗
                    </a>
                  </>
                )}
              </p>

              {format !== 'none' && statusOf(card.id) && (
                <p className={`card-detail-ban ${banlistClass(statusOf(card.id))}`}>
                  Banlist {format.toUpperCase()}: {banlistLabel(statusOf(card.id), lang)} · massimo{' '}
                  {maxCopiesForCard(card.id)} {maxCopiesForCard(card.id) === 1 ? 'copia' : 'copie'}
                </p>
              )}

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
