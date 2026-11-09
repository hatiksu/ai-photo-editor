import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Относительные пути: приложение работает из любой подпапки (например, на GitHub Pages)
  base: './',
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      output: {
        // Библиотеки — в отдельные чанки: они редко меняются и дольше живут в кеше
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Фоторедактор с ИИ',
        short_name: 'Фоторедактор',
        description: 'Фоторедактор с нейросетями: удаление фона, авто-улучшение и правки текстом. Работает без интернета.',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#08090d',
        theme_color: '#08090d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Нейросеть удаления фона и SDK Claude — большие и нужны только онлайн, в офлайн-кеш их не кладём
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/bg-removal-*.js', '**/ai-*.js', '**/*.wasm'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
