import { create } from 'zustand'
import { registerSW } from 'virtual:pwa-register'

/** Une nouvelle version est installée et attend l'accord de l'utilisateur. */
export const useMiseAJour = create<{ disponible: boolean; appliquer: () => void }>(() => ({
  disponible: false,
  appliquer: () => {},
}))

export function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const maj = registerSW({
    onNeedRefresh: () => useMiseAJour.setState({ disponible: true, appliquer: () => void maj(true) }),
  })
}
