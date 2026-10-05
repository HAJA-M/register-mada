import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/register-mada/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest : on écrit nous-mêmes le service worker (src/sw.ts) pour contrôler le cache des tuiles.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // enregistrement manuel dans src/pwa.ts
      manifest: {
        name: 'Fanisana — suivi des tokatrano',
        short_name: 'Fanisana',
        description: 'Suivi de terrain des tokatrano dénombrés (RSU), hors ligne.',
        lang: 'fr',
        // Relatifs, jamais « / » : l'application vit dans le sous-dossier /register-mada/.
        start_url: './',
        scope: './',
        id: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E141A',
        theme_color: '#0E141A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
