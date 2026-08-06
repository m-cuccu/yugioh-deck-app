import { sectionLabel, suggestionKindLabel, suggestionStatusLabel } from '../lib/suggestions';

// Descrizione di un suggerimento, condivisa tra la pagina Suggerimenti e l'editor del deck.
export default function SuggestionCard({ suggestion: s, showAuthor = true, showDeck = false, children }) {
  const kind = s.kind || 'replace';
  const status = s.status || 'pending';

  return (
    <li className="suggestion-item">
      <div className="suggestion-head">
        <span className={`suggestion-kind kind-${kind}`}>{suggestionKindLabel(kind)}</span>
        <span className={`suggestion-status status-${status}`}>{suggestionStatusLabel(status)}</span>
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
    </li>
  );
}
