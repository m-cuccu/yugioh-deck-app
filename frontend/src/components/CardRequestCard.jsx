import { useState } from 'react';
import CardDetailModal from './CardDetailModal';

const STATUS_LABEL = {
  pending: 'In attesa',
  fulfilled: 'Consegnata',
  declined: 'Rifiutata',
};

// mode: 'received' (richiesta ricevuta, io sono owner) | 'sent' (richiesta inviata, io sono requester)
export default function CardRequestCard({ request, mode, onRespond, onDelete, busy }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const counterpartUsername =
    mode === 'received' ? request.requester?.username || 'un utente' : request.owner?.username || 'un utente';

  return (
    <li className="wanted-post">
      <div className="wanted-post-main">
        {request.card_image && (
          <button
            type="button"
            className="wanted-post-image"
            onClick={() => setDetailOpen(true)}
            title="Vedi effetto"
          >
            <img src={request.card_image} alt={request.card_name} loading="lazy" />
          </button>
        )}

        <div className="wanted-post-info">
          <div className="wanted-post-head">
            <span className="wanted-post-name">{request.card_name}</span>
            <span className="wanted-status">{STATUS_LABEL[request.status]}</span>
          </div>

          <p className="wanted-post-meta">
            {mode === 'received' ? 'richiesta da' : 'richiesta a'} <strong>{counterpartUsername}</strong> ·{' '}
            {new Date(request.created_at).toLocaleDateString('it-IT')}
          </p>
        </div>
      </div>

      <div className="wanted-post-actions">
        {mode === 'received' && request.status === 'pending' && (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onRespond(request, 'fulfilled')}
              disabled={busy}
            >
              Segna come consegnata
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onRespond(request, 'declined')}
              disabled={busy}
            >
              Rifiuta
            </button>
          </>
        )}

        {mode === 'sent' && request.status === 'pending' && (
          <button type="button" className="btn-danger" onClick={() => onDelete(request)} disabled={busy}>
            Annulla richiesta
          </button>
        )}
      </div>

      {detailOpen && <CardDetailModal cardId={request.card_id} onClose={() => setDetailOpen(false)} />}
    </li>
  );
}
