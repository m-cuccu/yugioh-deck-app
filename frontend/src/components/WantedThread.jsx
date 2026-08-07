import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteWantedMessage, listWantedMessages, postWantedMessage } from '../lib/wantedApi';

// Discussione sotto un annuncio: qui ci si mette d'accordo su copie, condizioni e scambio.
export default function WantedThread({ postId, isPostAuthor }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    setLoading(true);
    return listWantedMessages(postId)
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await postWantedMessage(postId, user.id, body);
      setBody('');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(message) {
    if (!window.confirm('Eliminare questo messaggio?')) return;
    setBusy(true);
    try {
      await deleteWantedMessage(message.id);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="thread">
      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="page-message">Caricamento...</p>
      ) : messages.length === 0 ? (
        <p className="thread-empty">Nessun messaggio.</p>
      ) : (
        <ul className="thread-list">
          {messages.map((m) => (
            <li key={m.id} className={`thread-message ${m.author_id === user.id ? 'is-mine' : ''}`}>
              <div className="thread-message-head">
                <span className="thread-author">{m.profiles?.username || 'Utente'}</span>
                <span className="thread-time">{new Date(m.created_at).toLocaleString('it-IT')}</span>
                {(m.author_id === user.id || isPostAuthor) && (
                  <button
                    type="button"
                    className="btn-link thread-delete"
                    onClick={() => handleDelete(m)}
                    disabled={busy}
                  >
                    Elimina
                  </button>
                )}
              </div>
              <p className="thread-body">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="thread-form" onSubmit={handleSend}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrivi un messaggio..."
        />
        <button className="btn-primary" type="submit" disabled={busy || !body.trim()}>
          Invia
        </button>
      </form>
    </div>
  );
}
