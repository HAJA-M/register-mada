import { create } from 'zustand'
import { registerSW } from 'virtual:pwa-register'
import { verifier, type InscriptionLike, type Verification } from './lib/miseAJour'

type Etat = {
  /** Une nouvelle version est installée et attend l'accord de l'utilisateur. */
  disponible: boolean
  appliquer: () => void
  /** Heure (ms) de la dernière vérification terminée, pour l'afficher dans Réglages. */
  derniere: number | null
}

export const useMiseAJour = create<Etat>(() => ({ disponible: false, appliquer: () => {}, derniere: null }))

let inscription: ServiceWorkerRegistration | null = null

/** Interroge le serveur maintenant. `inscription` est vide en développement et sans service worker. */
export async function verifierMiseAJour(): Promise<Verification> {
  const r = await verifier(inscription as InscriptionLike | null, navigator.onLine)
  if (r === 'a-jour' || r === 'disponible') useMiseAJour.setState({ derniere: Date.now() })
  return r
}

/**
 * Dernier recours si l'application reste bloquée sur une ancienne version : on supprime le service worker
 * et la copie de l'application, puis on recharge depuis le réseau. Les ménages saisis (IndexedDB) et la carte
 * téléchargée (cache des tuiles) ne sont pas touchés.
 */
export async function forcerRechargement(): Promise<'ok' | 'hors-ligne'> {
  // On vérifie que le serveur répond AVANT de détruire quoi que ce soit : sans réseau, l'application ne rouvrirait plus.
  try {
    const r = await fetch(import.meta.env.BASE_URL, { cache: 'no-store' })
    if (!r.ok) return 'hors-ligne'
  } catch {
    return 'hors-ligne'
  }
  const inscriptions = await navigator.serviceWorker?.getRegistrations()
  await Promise.all((inscriptions ?? []).map((i) => i.unregister()))
  const noms = await caches.keys()
  await Promise.all(noms.filter((n) => n.includes('precache')).map((n) => caches.delete(n)))
  location.reload()
  return 'ok'
}

const PAUSE_ENTRE_VERIFICATIONS = 30 * 60_000

export function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const maj = registerSW({
    onRegisteredSW: (_url, reg) => {
      inscription = reg ?? null
    },
    onNeedRefresh: () => useMiseAJour.setState({ disponible: true, appliquer: () => void maj(true) }),
  })

  // Un téléphone garde l'application ouverte des jours sans jamais la « relancer » : le navigateur ne cherche alors
  // pas de mise à jour. On le fait nous-mêmes quand l'utilisateur revient sur l'application.
  let derniereAuto = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - derniereAuto < PAUSE_ENTRE_VERIFICATIONS) return
    derniereAuto = Date.now()
    void verifierMiseAJour()
  })
}
