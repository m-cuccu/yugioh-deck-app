import { useState } from 'react';
import WantedThread from './WantedThread';
import CardDetailModal from './CardDetailModal';
import ShareButtons from './ShareButtons';

export default function WantedPostCard({
  post,
  onToggleOffer,
  onEdit,
  onToggleStatus,
  onDelete,
  busy,
  highlighted = false,
}) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const closed = post.status === 'closed';
  const shareUrl = `${window.location.origin}/cercasi?post=${post.id}`;
  const shareText =
    `Cerco ${post.quantity > 1 ? `${post.quantity} copie di ` : ''}"${post.card_name}"` +
    (post.note ? ` — ${post.note}` : '');

  return (
    <li className={`wanted-post ${closed ? 'is-closed' : ''} ${highlighted ? 'is-highlighted' : ''}`}>
      <div className="wanted-post-main">
        {post.card_image && (
          <button
            type="button"
            className="wanted-post-image"
            onClick={() => setDetailOpen(true)}
            title="Vedi effetto"
          >
            <img src={post.card_image} alt={post.card_name} loading="lazy" />
          </button>
        )}

        <div className="wanted-post-info">
          <div className="wanted-post-head">
            <span className="wanted-post-name">{post.card_name}</span>
            {closed && <span className="wanted-status">Chiuso</span>}
          </div>

          <p className="wanted-post-meta">
            cercata da <strong>{post.profiles?.username || 'un utente'}</strong> ·{' '}
            {post.quantity} {post.quantity === 1 ? 'copia' : 'copie'} ·{' '}
            {new Date(post.created_at).toLocaleDateString('it-IT')}
          </p>

          {post.note && <p className="wanted-post-note">{post.note}</p>}

          {post.offerCount > 0 && (
            <p className="wanted-post-offers">
              💬 {post.offerCount} {post.offerCount === 1 ? 'persona ce l\'ha' : 'persone ce l\'hanno'}:{' '}
              {post.offers.map((o) => o.profiles?.username || 'utente').join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="wanted-post-actions">
        {!post.isMine && !closed && (
          <button
            type="button"
            className={post.iHaveIt ? 'btn-secondary' : 'btn-primary'}
            onClick={() => onToggleOffer(post)}
            disabled={busy}
          >
            {post.iHaveIt ? '✓ Ce l\'ho (annulla)' : 'Ce l\'ho'}
          </button>
        )}

        {post.isMine && (
          <>
            <button type="button" className="btn-secondary" onClick={() => onEdit(post)} disabled={busy}>
              Modifica
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onToggleStatus(post)}
              disabled={busy}
            >
              {closed ? 'Riapri' : 'Chiudi'}
            </button>
            <button type="button" className="btn-danger" onClick={() => onDelete(post)} disabled={busy}>
              Elimina
            </button>
          </>
        )}

        <button type="button" className="btn-link" onClick={() => setThreadOpen((v) => !v)}>
          {threadOpen ? 'Chiudi discussione' : 'Discussione'}
        </button>

        <button type="button" className="btn-link" onClick={() => setShareOpen((v) => !v)}>
          {shareOpen ? 'Nascondi condivisione' : 'Condividi'}
        </button>
      </div>

      {shareOpen && <ShareButtons text={shareText} url={shareUrl} />}

      {threadOpen && <WantedThread postId={post.id} isPostAuthor={post.isMine} />}

      {detailOpen && <CardDetailModal cardId={post.card_id} onClose={() => setDetailOpen(false)} />}
    </li>
  );
}
