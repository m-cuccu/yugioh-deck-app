import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LifePointCounter from '../components/LifePointCounter';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ROLL_DURATION_MS = 700;
const ROLL_TICK_MS = 80;

export default function DuelPage() {
  const [coinResult, setCoinResult] = useState(null);
  const [diceResult, setDiceResult] = useState(null);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [log, setLog] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const logIdRef = useRef(0);
  const coinIntervalRef = useRef(null);
  const coinTimeoutRef = useRef(null);
  const rollIntervalRef = useRef(null);
  const rollTimeoutRef = useRef(null);

  // Ferma le animazioni in corso se la pagina viene lasciata a meta'.
  useEffect(() => {
    return () => {
      clearInterval(coinIntervalRef.current);
      clearTimeout(coinTimeoutRef.current);
      clearInterval(rollIntervalRef.current);
      clearTimeout(rollTimeoutRef.current);
    };
  }, []);

  // Anima la moneta alternando le due facce per un breve periodo prima di fermarsi sul
  // risultato finale: senza questo, due lanci di fila con lo stesso esito sembrerebbero un
  // solo lancio.
  function flipCoin() {
    if (isFlippingCoin) return;
    setIsFlippingCoin(true);
    coinIntervalRef.current = setInterval(() => {
      setCoinResult(Math.random() < 0.5 ? 'Testa' : 'Croce');
    }, ROLL_TICK_MS);
    coinTimeoutRef.current = setTimeout(() => {
      clearInterval(coinIntervalRef.current);
      setCoinResult(Math.random() < 0.5 ? 'Testa' : 'Croce');
      setIsFlippingCoin(false);
    }, ROLL_DURATION_MS);
  }

  // Anima il dado con facce casuali per un breve periodo prima di fermarsi sul risultato
  // finale: senza questo, due lanci di fila con lo stesso numero sembrerebbero un solo lancio.
  function rollDice() {
    if (isRolling) return;
    setIsRolling(true);
    rollIntervalRef.current = setInterval(() => {
      setDiceResult(1 + Math.floor(Math.random() * 6));
    }, ROLL_TICK_MS);
    rollTimeoutRef.current = setTimeout(() => {
      clearInterval(rollIntervalRef.current);
      setDiceResult(1 + Math.floor(Math.random() * 6));
      setIsRolling(false);
    }, ROLL_DURATION_MS);
  }

  // Registra ogni modifica confermata (non gli annullamenti) nello storico condiviso del
  // duello, piu' recente in cima.
  function addLogEntry(player, entry) {
    const id = logIdRef.current++;
    setLog((prev) => [{ id, player, ...entry }, ...prev]);
  }

  function newDuel() {
    clearInterval(coinIntervalRef.current);
    clearTimeout(coinTimeoutRef.current);
    clearInterval(rollIntervalRef.current);
    clearTimeout(rollTimeoutRef.current);
    setIsFlippingCoin(false);
    setIsRolling(false);
    setCoinResult(null);
    setDiceResult(null);
    setResetKey((k) => k + 1);
    setLog([]);
  }

  return (
    <div className="page duel-page">
      <div className="duel-floating-actions">
        <Link to="/" className="lp-icon-btn" title="Indietro">
          ←
        </Link>
        <button type="button" className="lp-icon-btn" onClick={() => setHistoryOpen(true)} title="Cronologia">
          📜
        </button>
        <button type="button" className="lp-icon-btn" onClick={newDuel} title="Nuovo duello">
          🔄
        </button>
      </div>

      <div className="duel-rotate-hint">
        🔄 Ruota il telefono in orizzontale per vedere i Life Points di entrambi i giocatori.
      </div>

      <div className="duel-board">
        <LifePointCounter
          key={`p2-${resetKey}`}
          label="Giocatore 2"
          rotated
          storageKey="duel-bg-p2"
          onApply={(entry) => addLogEntry('Giocatore 2', entry)}
        />

        <div className="duel-divider" aria-hidden="true">
          ⚔
        </div>

        <div className="duel-randomizer">
          <div className="duel-randomizer-item">
            <button type="button" className="btn-secondary" onClick={flipCoin} disabled={isFlippingCoin}>
              🪙 Moneta
            </button>
            <span className={`duel-randomizer-result ${isFlippingCoin ? 'is-rolling' : ''}`}>
              {coinResult || '—'}
            </span>
          </div>
          <div className="duel-randomizer-item">
            <button type="button" className="btn-secondary" onClick={rollDice} disabled={isRolling}>
              🎲 Dado
            </button>
            <span className={`duel-randomizer-result ${isRolling ? 'is-rolling' : ''}`}>
              {diceResult ? `${DICE_FACES[diceResult - 1]} ${diceResult}` : '—'}
            </span>
          </div>
        </div>

        <LifePointCounter
          key={`p1-${resetKey}`}
          label="Giocatore 1"
          storageKey="duel-bg-p1"
          onApply={(entry) => addLogEntry('Giocatore 1', entry)}
        />
      </div>

      {historyOpen && (
        <div className="art-picker-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="art-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="art-picker-header">
              <h3>Cronologia del duello</h3>
              <button className="btn-link" onClick={() => setHistoryOpen(false)} type="button">
                Chiudi
              </button>
            </div>
            {log.length === 0 ? (
              <p className="page-message">Nessuna modifica ancora in questo duello.</p>
            ) : (
              <ul className="duel-log-list">
                {log.map((entry) => (
                  <li key={entry.id} className="duel-log-item">
                    <span className="duel-log-player">{entry.player}</span>
                    <span className={`duel-log-amount ${entry.sign === '+' ? 'is-up' : 'is-down'}`}>
                      {entry.sign}
                      {entry.amount}
                    </span>
                    <span className="duel-log-total">→ {entry.resultingLp}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
