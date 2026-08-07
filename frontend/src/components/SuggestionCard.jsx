import { useState } from 'react';
import { sectionLabel, suggestionKindLabel, suggestionStatusLabel } from '../lib/suggestions';
import SuggestionThread from './SuggestionThread';

// Descrizione di un suggerimento, condivisa tra la pagina Suggerimenti e l'editor del deck.
export default function SuggestionCard({
  suggestion: s,
  showAuthor = true,
  showDeck = false,
  isDeckOwner = false,
  highlighted = false,
  defaultThreadOpen = false,
  onThreadRead,
  onThreadChanged,
  children,
}) {
  const kind = s.kind || 'replace';
  const status = s.status || 'pending';
  const [threadOpen, setThreadOpen] = useState(defaultThreadOpen);

  const messageCount = s.messageCount ?? 0;
  const unread = s.unreadMessages ?? 0;

  return (
    <li className={`suggestion-item ${highlighted ? 'is-highlighted' : ''}`}>
      <div className="suggestion-head">
        <span className={`suggestion-kind kind-${kind}`}>{suggestionKindLabel(kind)}</span>
        <span className={`suggestion-status status-${status}`}>{suggestionStatusLabel(status)}</span>
        {unread > 0 && <span className="suggestion-unread">{unread} nuovi</span>}
      </div>

      <div>
        {showAuthor && <span className="suggestion-author">{s.profiles?.username || 'Un utente'}</span>}
        {showAuthor && ' '}
        {kind === 'replace' && (
          <>
            propone <strong>{s.suggested_card_name}</strong> al posto di{' '}
            <strong>{s.target_card_name}</strong> ({sectionLabel(s.target_section)})
          </>
        )}
        {kind === 'add' && (
          <>
            propone di aggiungere <strong>{s.suggested_card_name}</strong>{' '}
            ({sectionLabel(s.target_section)})
          </>
        )}
        {kind === 'remove' && (
          <>
            propone di togliere 1 copia di <strong>{s.target_card_name}</strong>{' '}
            ({sectionLabel(s.target_section)})
          </>
        )}
        {showDeck && s.decks?.name && <span className="suggestion-deck"> · deck "{s.decks.name}"</span>}
      </div>

      {s.comment && <p className="suggestion-comment">"{s.comment}"</p>}

      {status !== 'pending' && s.response_comment && (
        <p className="suggestion-response">Risposta: "{s.response_comment}"</p>
      )}

      {children}

      <button
        type="button"
        className="btn-link thread-toggle"
        onClick={() => setThreadOpen((v) => !v)}
      >
        {threadOpen
          ? 'Chiudi discussione'
          : messageCount > 0
            ? `Discussione (${messageCount})`
            : 'Rispondi / apri discussione'}
      </button>

      {threadOpen && (
        <SuggestionThread
          suggestionId={s.id}
          isDeckOwner={isDeckOwner}
          onRead={onThreadRead}
          onChanged={onThreadChanged}
        />
      )}
    </li>
  );
}
