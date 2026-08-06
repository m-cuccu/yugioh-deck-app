import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  createDeckVersion,
  getDeck,
  listIncomingSuggestions,
  listSentSuggestions,
  markSuggestionsSeen,
  respondToSuggestion,
  saveDeckCards,
} from '../lib/decksApi';
import { applySuggestionToCards } from '../lib/suggestions';
import { useBanlist } from '../context/BanlistContext';
import SuggestionCard from '../components/SuggestionCard';

export default function SuggestionsPage() {
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const { maxCopiesForCard } = useBanlist();

  const [tab, setTab] = useState('received'); // 'received' | 'sent'
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [responseComment, setResponseComment] = useState('');

  function reload() {
    setLoading(true);
    Promise.all([listIncomingSuggestions(user.id), listSentSuggestions(user.id)])
      .then(([inc, out]) => {
        setIncoming(inc);
        setSent(out);
        // aprire la pagina equivale ad averli letti
        const unseen = inc.filter((s) => !s.seen_by_owner && (s.status || 'pending') === 'pending');
        if (unseen.length > 0) {
          markSuggestionsSeen(unseen.map((s) => s.id))
            .then(refreshUnread)
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function handleAccept(s) {
    setBusyId(s.id);
    setError('');
    try {
      const deck = await getDeck(s.deck_id);
      const { nextCards, error: applyError } = applySuggestionToCards(deck.cards, s, maxCopiesForCard);
      if (applyError) {
        setError(applyError);
        return;
      }
      await createDeckVersion(deck.id, deck.cards, 'Prima di applicare un suggerimento');
      await saveDeckCards(deck.id, nextCards);
      await respondToSuggestion(s.id, 'accepted', responseComment);
      setResponseComment('');
      reload();
      refreshUnread();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(s) {
    setBusyId(s.id);
    setError('');
    try {
      await respondToSuggestion(s.id, 'rejected', responseComment);
      setRejectingId(null);
      setResponseComment('');
      reload();
      refreshUnread();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const pending = incoming.filter((s) => (s.status || 'pending') === 'pending');
  const handled = incoming.filter((s) => (s.status || 'pending') !== 'pending');

  if (loading) return <p className="page-message">Caricamento suggerimenti...</p>;

  return (
    <div className="page">
      <h2>Suggerimenti</h2>

      <div className="suggest-kind-tabs">
        <button
          type="button"
          className={tab === 'received' ? 'active' : ''}
          onClick={() => setTab('received')}
        >
          Ricevuti{pending.length > 0 ? ` (${pending.length})` : ''}
        </button>
        <button type="button" className={tab === 'sent' ? 'active' : ''} onClick={() => setTab('sent')}>
          Inviati da me{sent.length > 0 ? ` (${sent.length})` : ''}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {tab === 'received' && (
        <>
          <h3 className="section-subtitle">Da gestire</h3>
          {pending.length === 0 ? (
            <p className="page-message">Nessun suggerimento in attesa.</p>
          ) : (
            <ul className="suggestion-list">
              {pending.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} showDeck>
                  {rejectingId === s.id ? (
                    <div className="suggestion-reject-form">
                      <input
                        type="text"
                        value={responseComment}
                        onChange={(e) => setResponseComment(e.target.value)}
                        placeholder="Motivo del rifiuto (opzionale)"
                      />
                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() => handleReject(s)}
                        disabled={busyId === s.id}
                      >
                        Conferma rifiuto
                      </button>
                      <button
                        className="btn-link"
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setResponseComment('');
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <div className="suggestion-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => handleAccept(s)}
                        disabled={busyId === s.id}
                      >
                        Applica
                      </button>
                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() => {
                          setRejectingId(s.id);
                          setResponseComment('');
                        }}
                        disabled={busyId === s.id}
                      >
                        Rifiuta
                      </button>
                      <Link className="btn-link" to={`/deck/${s.deck_id}`}>
                        Apri deck
                      </Link>
                    </div>
                  )}
                </SuggestionCard>
              ))}
            </ul>
          )}

          {handled.length > 0 && (
            <>
              <h3 className="section-subtitle">Già gestiti</h3>
              <ul className="suggestion-list">
                {handled.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} showDeck />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === 'sent' && (
        <>
          {sent.length === 0 ? (
            <p className="page-message">Non hai ancora inviato suggerimenti.</p>
          ) : (
            <ul className="suggestion-list">
              {sent.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} showAuthor={false} showDeck />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
