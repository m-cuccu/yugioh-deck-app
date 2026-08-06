import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchBanlist, maxCopiesFor } from '../lib/banlist';

const BanlistContext = createContext(null);

const STORAGE_KEY = 'ygo-banlist-format';
const DEFAULT_MAX_COPIES = 3;

// Formato di gioco su cui validare i deck: 'tcg' (quello giocato in Europa), 'ocg' o 'none'.
export function BanlistProvider({ children }) {
  const [format, setFormatState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'tcg';
    } catch {
      return 'tcg';
    }
  });
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBanlist(format)
      .then((map) => !cancelled && setStatuses(map))
      .catch(() => !cancelled && setStatuses({}))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [format]);

  function setFormat(next) {
    setFormatState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // preferenza valida solo per la sessione
    }
  }

  const statusOf = useCallback((cardId) => statuses[cardId] || null, [statuses]);

  const maxCopiesForCard = useCallback(
    (cardId) => {
      const status = statuses[cardId];
      return status ? maxCopiesFor(status) : DEFAULT_MAX_COPIES;
    },
    [statuses]
  );

  return (
    <BanlistContext.Provider value={{ format, setFormat, statuses, statusOf, maxCopiesForCard, loading }}>
      {children}
    </BanlistContext.Provider>
  );
}

export function useBanlist() {
  const ctx = useContext(BanlistContext);
  if (!ctx) throw new Error('useBanlist deve essere usato dentro BanlistProvider');
  return ctx;
}
