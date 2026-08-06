import { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'ygo-card-language';

// 'en' = nomi originali inglesi, 'it' = nomi italiani.
// L'id delle carte non cambia tra le lingue, quindi i deck salvati restano validi
// e i nomi vengono ritradotti al volo quando si apre un deck.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'it';
    } catch {
      return 'it';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage non disponibile (es. navigazione privata): la scelta vale solo per la sessione
    }
  }, [lang]);

  function setLang(next) {
    setLangState(next === 'it' ? 'it' : 'en');
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage deve essere usato dentro LanguageProvider');
  return ctx;
}
