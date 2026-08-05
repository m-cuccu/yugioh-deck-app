# Yu-Gi-Oh Deck Builder

Web app (React + Vite, PWA) per costruire e condividere deck list Yu-Gi-Oh con gli amici.

## Funzionalità

- Autenticazione (registrazione/login)
- Deck multipli, privati o pubblici (visibili a chi ti cerca su "Amici")
- Ricerca carte in tempo reale (YGOPRODeck API), con scelta dell'art tra le versioni alternative
- Import/export deck in formato `.json` e `.ydk`
- Suggerimenti di carte sui deck pubblici altrui

## Sviluppo locale

```bash
npm install
cp .env.example .env.local   # compila con le credenziali Supabase del progetto
npm run dev
```

Lo schema del database (tabelle + Row Level Security) è in `../supabase-schema.sql`, da eseguire nel SQL Editor del progetto Supabase.
