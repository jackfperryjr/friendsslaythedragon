import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    // Phaser minifies to ~1.5 MB — suppress the warning for that known chunk
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Split Phaser into its own chunk so game code stays lean and the
        // Phaser bundle can be cached independently between deploys.
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Friends Slay the Dragon',
        short_name: 'Friends Slay the Dragon',
        description: 'Friends Slay the Dragon — a castle brawler with a dragon at the end',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Pre-download only the app shell. Game art, music and maps (~45 MB) are
        // cached the first time the game loads them instead of all up front —
        // precaching them made first-time players download most assets twice.
        globPatterns: ['**/*.{js,css,html,ico,webmanifest}', 'icons/*.png'],
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/(assets|maps)\//.test(url.pathname),
          // Serve from cache, refresh in the background so updated assets arrive next visit
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'game-assets',
            expiration: { maxEntries: 400 },
            cacheableResponse: { statuses: [0, 200] },
          },
        }],
      }
    })
  ]
})
