/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CACHE_TUILES, estTuile } from './lib/tuiles'

declare const self: ServiceWorkerGlobalScope

// Coque de l'application : tout ce que Vite a produit, versionné par empreinte.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Toute navigation dans le périmètre renvoie la page d'accueil (application à page unique).
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)))

// Tuiles de carte : on ne sert que ce que l'enquêteur a téléchargé (page ou réseau).
// Pas de mise en cache « au passage » : le téléphone n'accumule pas des Mo qu'il n'a pas demandés.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !estTuile(new URL(request.url))) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_TUILES)
      // ignoreVary : la tuile téléchargée par la page doit servir quelle que soit l'en-tête de la requête MapLibre.
      const trouvee = await cache.match(request.url, { ignoreVary: true })
      return trouvee ?? fetch(request)
    })(),
  )
})

// La mise à jour attend l'accord de l'utilisateur (voir MiseAJour.tsx) : pas de rechargement en pleine saisie.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
clientsClaim()
