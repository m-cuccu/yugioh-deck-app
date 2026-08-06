import { registerSW } from 'virtual:pwa-register';

const ONE_HOUR = 60 * 60 * 1000;

// Aggiornamento automatico dell'app installata (PWA).
// Il service worker e' in modalita' autoUpdate: quando ne viene pubblicato uno nuovo
// prende subito il controllo, ma senza ricaricare la pagina l'utente continuerebbe a
// vedere la versione vecchia fino alla riapertura successiva. Qui forziamo il reload.
export function registerPWA() {
  if (!('serviceWorker' in navigator)) return;

  // Se al caricamento c'e' gia' un service worker attivo, un successivo cambio di
  // controller significa "e' arrivata una nuova versione" -> ricarico.
  // Alla primissima installazione il controller e' assente, quindi non ricarico inutilmente.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // controlla se c'e' una nuova versione all'avvio e poi periodicamente,
      // utile per chi tiene l'app aperta a lungo
      registration.update();
      setInterval(() => registration.update(), ONE_HOUR);
    },
  });
}
