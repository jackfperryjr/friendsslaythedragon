import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
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
                description: 'Friends Slay the Dragon — local co-op action for 2+ players',
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
                globPatterns: ['**/*.{js,css,html,png,jpg,svg,ogg,mp3,wav}'],
                // Raise the precache limit to 5 MiB to accommodate large cutscene images
                // (victory.png ≈ 2.1 MB, celery_man_down.png ≈ 1.5 MB)
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            }
        })
    ]
});
