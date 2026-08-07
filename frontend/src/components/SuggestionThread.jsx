import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  deleteSuggestionMessage,
  listSuggestionMessages,
  markThreadRead,
  postSuggestionMessage,
} from '../lib/decksApi';

// Conversazione su un suggerimento: aperta a chiunque possa vedere il deck,
// cosi' la discussione non resta limitata a chi ha proposto e al proprietario.
// onRead: la discussione e' stata aperta (serve solo ad aggiornare il contatore).
// onChanged: sono cambiati i messaggi, quindi va ricaricata anche la lista dei suggerimenti.
// Tenerli distinti evita di ricaricare tutto alla semplice apertura.
export default function SuggestionThread({ suggestionId, isDeckOwner, onRead, onChanged }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    setLoading(true);
    return listSuggestionMessages(suggestionId)
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // aprire la discussione equivale ad averla letta
    markThreadRead(suggestionId, user.id)
      .then(() => onRead?.())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await postSuggestionMessage(suggestionId, user.id, body);
      setBody('');
      await reload();
      await markThreadRead(suggestionId, user.id);
      onChanged?.();
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
      await deleteSuggestionMessage(message.id);
      await reload();
      onChanged?.();
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
        <p className="page-message">Caricamento discussione...</p>
      ) : messages.length === 0 ? (
        <p className="thread-empty">Nessun messaggio. Apri tu la discussione.</p>
      ) : (
        <ul className="thread-list">
          {messages.map((m) => (
            <li key={m.id} className={`thread-message ${m.author_id === user.id ? 'is-mine' : ''}`}>
              <div className="thread-message-head">
                <span className="thread-author">{m.profiles?.username || 'Utente'}</span>
                <span className="thread-time">{new Date(m.created_at).toLocaleString('it-IT')}</span>
                {(m.author_id === user.id || isDeckOwner) && (
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
