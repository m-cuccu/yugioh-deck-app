import { useState } from 'react';

// Condivisione di un annuncio. Su telefono si usa il menu di sistema (WhatsApp, Telegram,
// SMS... senza dover elencare le app una per una); dove non c'e', si ripiega sui link diretti.
export default function ShareButtons({ text, url }) {
  const [copied, setCopied] = useState(false);
  const fullText = `${text}\n${url}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleNativeShare() {
    try {
      await navigator.share({ text, url });
    } catch {
      // l'utente ha annullato: non c'e' nulla da segnalare
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share-buttons">
      {canShare && (
        <button type="button" className="btn-secondary" onClick={handleNativeShare}>
          Condividi
        </button>
      )}

      <a
        className="btn-secondary"
        href={`https://wa.me/?text=${encodeURIComponent(fullText)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>

      <a
        className="btn-secondary"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
      >
        Telegram
      </a>

      <button type="button" className="btn-link" onClick={handleCopy}>
        {copied ? 'Copiato' : 'Copia link'}
      </button>
    </div>
  );
}
