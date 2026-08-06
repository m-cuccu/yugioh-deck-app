import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // la registrazione la facciamo a mano in main.jsx, per poter ricaricare
      // la pagina appena una nuova versione prende il controllo
      injectRegister: null,
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Yu-Gi-Oh Deck Builder',
        short_name: 'Deck Builder',
        description: 'Costruisci e condividi le tue deck list Yu-Gi-Oh',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            // la banlist cambia periodicamente: si mostra subito quella in cache
            // ma si riscarica in background, invece di restare ferma una settimana
            urlPattern: /^https:\/\/db\.ygoprodeck\.com\/api\/.*banlist=/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ygoprodeck-banlist',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/db\.ygoprodeck\.com\/api\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ygoprodeck-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
