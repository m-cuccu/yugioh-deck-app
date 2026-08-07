import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  createDeck,
  deleteDeck,
  duplicateDeck,
  getDeck,
  listMyDecks,
  renameDeck,
  saveDeckCards,
  setDeckVisibility,
} from '../lib/decksApi';
import { exportDeckAsJson, exportDeckAsYdk, parseJsonDeckFile, parseYdkFile } from '../lib/deckIO';

export default function DeckListPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fileInputRef = useRef(null);

  async function reload() {
    setLoading(true);
    try {
      setDecks(await listMyDecks(user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function handleCreate() {
    const deck = await createDeck(user.id, 'Nuovo Deck');
    await reload();
    return deck;
  }

  async function handleRename(deck) {
    const name = window.prompt('Nuovo nome del deck', deck.name);
    if (!name || name === deck.name) return;
    await renameDeck(deck.id, name);
    await reload();
  }

  async function handleDelete(deck) {
    if (!window.confirm(`Eliminare "${deck.name}"? L'operazione non è reversibile.`)) return;
    setBusyId(deck.id);
    try {
      await deleteDeck(deck.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(deck) {
    setBusyId(deck.id);
    try {
      await duplicateDeck(user.id, deck.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleVisibility(deck) {
    setBusyId(deck.id);
    try {
      await setDeckVisibility(deck.id, !deck.is_public);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(deck, format) {
    const full = await getDeck(deck.id);
    if (format === 'json') exportDeckAsJson(full);
    else exportDeckAsYdk(full);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    try {
      const content = await file.text();
      const baseName = file.name.replace(/\.(json|ydk)$/i, '');
      const parsed = file.name.endsWith('.ydk')
        ? await parseYdkFile(content, baseName, lang)
        : parseJsonDeckFile(content);

      const deck = await createDeck(user.id, parsed.name || baseName);
      await saveDeckCards(deck.id, parsed.cards);
      await reload();

      const unresolved = parsed.unresolvedIds || [];
      if (unresolved.length > 0) {
        setNotice(
          `Deck importato, ma ${unresolved.length} ${unresolved.length === 1 ? 'carta non è stata riconosciuta' : 'carte non sono state riconosciute'} ` +
            `(${unresolved.join(', ')}): non sono presenti nel database delle carte, probabilmente perché troppo recenti. ` +
            'Restano nel deck come segnaposto e puoi sostituirle a mano.'
        );
      }
    } catch (err) {
      setError('Import fallito: ' + err.message);
    }
  }

  if (loading) return <p className="page-message">Caricamento...</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>I miei deck</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={handleCreate} type="button">
            + Nuovo deck
          </button>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} type="button">
            Importa
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ydk"
            hidden
            onChange={handleImportFile}
          />
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && (
        <p className="import-notice">
          {notice}{' '}
          <button className="btn-link" type="button" onClick={() => setNotice('')}>
            Ho capito
          </button>
        </p>
      )}

      {decks.length > 0 && (
        <p className="visibility-hint">
          🌐 Pubblico = visibile a chi cerca il tuo username nella pagina Amici. 🔒 Privato = visibile solo a te.
        </p>
      )}

      {decks.length === 0 ? (
        <p className="page-message">Non hai ancora nessun deck. Creane uno per iniziare!</p>
      ) : (
        <ul className="deck-list">
          {decks.map((deck) => (
            <li key={deck.id} className="deck-card">
              <Link to={`/deck/${deck.id}`} className="deck-card-main">
                <span className="deck-card-name">
                  {deck.name}
                  {deck.pendingSuggestions > 0 && (
                    <span className="deck-card-suggest-badge" title="Suggerimenti da gestire">
                      {deck.pendingSuggestions} 💡
                    </span>
                  )}
                </span>
                <span className="deck-card-counts">
                  Main {deck.counts.main} · Extra {deck.counts.extra} · Side {deck.counts.side}
                </span>
              </Link>
              <div className="deck-card-actions">
                <button
                  type="button"
                  className={`visibility-toggle ${deck.is_public ? 'is-public' : 'is-private'}`}
                  onClick={() => handleToggleVisibility(deck)}
                  disabled={busyId === deck.id}
                  title={
                    deck.is_public
                      ? 'Visibile a chi cerca il tuo username. Clicca per renderlo privato.'
                      : 'Visibile solo a te. Clicca per renderlo pubblico.'
                  }
                >
                  {deck.is_public ? '🌐 Pubblico' : '🔒 Privato'}
                </button>
                <div className="deck-card-menu">
                  <button type="button" onClick={() => handleRename(deck)}>Rinomina</button>
                  <button type="button" onClick={() => handleDuplicate(deck)} disabled={busyId === deck.id}>
                    Duplica
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport(deck, 'ydk')}
                    title="Esporta in formato .ydk, compatibile con i simulatori (EDOPro, Dueling Book, YGOPRODeck)"
                  >
                    ⬇ Esporta YDK
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport(deck, 'json')}
                    title="Esporta in formato .json (backup, reimportabile in questa app)"
                  >
                    ⬇ Esporta JSON
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleDelete(deck)}
                    disabled={busyId === deck.id}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
