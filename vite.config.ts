import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import pkg from './package.json'

// Identifie la version affichée dans Réglages : on vérifie ainsi, sur le téléphone, que la mise à jour est bien arrivée.
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
})()

export default defineConfig({
  base: '/register-mada/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILD__: JSON.stringify(new Date().toISOString()),
  },
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
