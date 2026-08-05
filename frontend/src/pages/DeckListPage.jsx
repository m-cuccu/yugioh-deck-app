import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    try {
      const content = await file.text();
      const baseName = file.name.replace(/\.(json|ydk)$/i, '');
      const parsed = file.name.endsWith('.ydk')
        ? await parseYdkFile(content, baseName)
        : parseJsonDeckFile(content);

      const deck = await createDeck(user.id, parsed.name || baseName);
      await saveDeckCards(deck.id, parsed.cards);
      await reload();
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

      {decks.length === 0 ? (
        <p className="page-message">Non hai ancora nessun deck. Creane uno per iniziare!</p>
      ) : (
        <ul className="deck-list">
          {decks.map((deck) => (
            <li key={deck.id} className="deck-card">
              <Link to={`/deck/${deck.id}`} className="deck-card-main">
                <span className="deck-card-name">{deck.name}</span>
                <span className="deck-card-counts">
                  Main {deck.counts.main} · Extra {deck.counts.extra} · Side {deck.counts.side}
                </span>
              </Link>
              <div className="deck-card-actions">
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={deck.is_public}
                    disabled={busyId === deck.id}
                    onChange={() => handleToggleVisibility(deck)}
                  />
                  {deck.is_public ? 'Pubblico' : 'Privato'}
                </label>
                <div className="deck-card-menu">
                  <button type="button" onClick={() => handleRename(deck)}>Rinomina</button>
                  <button type="button" onClick={() => handleDuplicate(deck)} disabled={busyId === deck.id}>
                    Duplica
                  </button>
                  <button type="button" onClick={() => handleExport(deck, 'json')}>JSON</button>
                  <button type="button" onClick={() => handleExport(deck, 'ydk')}>YDK</button>
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
