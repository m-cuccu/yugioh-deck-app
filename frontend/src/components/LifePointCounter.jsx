import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DuelBackgroundPicker from './DuelBackgroundPicker';

const STARTING_LP = 8000;
const MAX_STAGED_DIGITS = 6;
const MAX_HISTORY = 4;
const FLASH_DURATION_MS = 500;

// Contatore Life Points stile calcolatrice: si digitano prima le cifre (nessuna azione finche'
// non si conferma), poi si preme - o + come tasto di conferma, che applica quelle cifre
// moltiplicate per 100 nella direzione scelta (es. 5 poi - -> -500, 25 poi + -> +2500).
// Il tasto 000 serve per i valori gia' esatti (es. 3 poi 000 -> 3000): in quel caso la
// conferma applica il numero cosi' com'e', senza moltiplicarlo di nuovo per 100.
export default function LifePointCounter({ label, rotated = false, storageKey, onApply }) {
  const [lp, setLp] = useState(STARTING_LP);
  const [staged, setStaged] = useState('');
  const [exact, setExact] = useState(false);
  const [history, setHistory] = useState([]);
  const [flash, setFlash] = useState(null); // null | 'up' | 'down'
  const [bgImage, setBgImage] = useState(() => (storageKey ? localStorage.getItem(storageKey) : null));
  const [pickerOpen, setPickerOpen] = useState(false);
  const flashTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(flashTimeoutRef.current), []);

  function pressDigit(d) {
    setStaged((s) => (s.length < MAX_STAGED_DIGITS ? s + d : s));
  }

  function pressTripleZero() {
    if (!staged) return;
    setStaged((s) => (s.length + 3 <= MAX_STAGED_DIGITS ? s + '000' : s));
    setExact(true);
  }

  function pressSign(sign) {
    if (!staged) return;
    const amount = exact ? Number(staged) : Number(staged) * 100;
    const resultingLp = Math.max(0, sign === '+' ? lp + amount : lp - amount);

    setHistory((h) => [...h, lp].slice(-MAX_HISTORY));
    setLp(resultingLp);
    setStaged('');
    setExact(false);
    onApply?.({ sign, amount, resultingLp });

    clearTimeout(flashTimeoutRef.current);
    setFlash(sign === '+' ? 'up' : 'down');
    flashTimeoutRef.current = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
  }

  function pressClear() {
    setStaged('');
    setExact(false);
  }

  function undo() {
    if (history.length === 0) return;
    setLp(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setStaged('');
    setExact(false);
  }

  function chooseBackground(url) {
    setBgImage(url);
    setPickerOpen(false);
    if (!storageKey) return;
    if (url) localStorage.setItem(storageKey, url);
    else localStorage.removeItem(storageKey);
  }

  return (
    <div className={`lp-counter ${rotated ? 'is-rotated' : ''}`}>
      {bgImage && <img className="lp-bg-art" src={bgImage} alt="" aria-hidden="true" />}

      <div className="lp-counter-head">
        <span className="lp-counter-label">{label}</span>
        <div className="lp-counter-head-actions">
          <button
            type="button"
            className="lp-icon-btn"
            onClick={() => setPickerOpen(true)}
            title="Scegli sfondo"
          >
            🖼️
          </button>
          <button
            type="button"
            className="lp-icon-btn"
            disabled={history.length === 0}
            onClick={undo}
            title="Annulla ultima modifica"
          >
            ↩
          </button>
        </div>
      </div>

      <div className={`lp-display ${flash ? `lp-flash-${flash}` : ''}`}>{lp}</div>

      <div className="lp-staged-row">
        <span className="lp-staged">{staged || '0'}</span>
        {staged && (
          <span className="lp-quick-preview">
            Premi − o + per {staged}
            {exact ? '' : '00'}
          </span>
        )}
      </div>

      <div className="lp-keypad">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(String(d))}>
            {d}
          </button>
        ))}
        <button type="button" disabled={!staged} onClick={pressTripleZero}>
          000
        </button>
        <button type="button" onClick={() => pressDigit('0')}>
          0
        </button>
        <button type="button" className="lp-key-clear" disabled={!staged} onClick={pressClear}>
          C
        </button>
      </div>

      <div className="lp-controls">
        <button
          type="button"
          className="lp-sign-btn lp-sign-minus"
          disabled={!staged}
          onClick={() => pressSign('-')}
        >
          −
        </button>
        <button
          type="button"
          className="lp-sign-btn lp-sign-plus"
          disabled={!staged}
          onClick={() => pressSign('+')}
        >
          +
        </button>
      </div>

      {pickerOpen &&
        // Portale su document.body: l'overlay e' position:fixed, e se restasse dentro un
        // pannello ruotato di 180 gradi (is-rotated) erediterebbe quella rotazione/posizione.
        createPortal(
          <DuelBackgroundPicker onSelect={chooseBackground} onClose={() => setPickerOpen(false)} />,
          document.body
        )}
    </div>
  );
}
