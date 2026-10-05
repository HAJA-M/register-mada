import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { distance } from './geo'

export type EtatGps = 'off' | 'attente' | 'on'

/** Suit la position tant que l'utilisateur ne la coupe pas. Met à jour le store, en filtrant le bruit. */
export function useGps() {
  const [etat, setEtat] = useState<EtatGps>('off')
  const [erreur, setErreur] = useState('')
  const watch = useRef<number | null>(null)
  const dernier = useRef<{ lat: number; lon: number; precision: number; t: number } | null>(null)

  const arreter = useCallback(() => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    watch.current = null
    dernier.current = null
    useStore.getState().definirPosition(null)
    setEtat('off')
  }, [])

  const demarrer = useCallback(() => {
    if (!navigator.geolocation) return setErreur('Ce téléphone ne donne pas la position.')
    setErreur('')
    setEtat('attente')
    let premiere = true
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon, accuracy: precision } = coords
        const d = dernier.current
        // On ignore les micro-variations : tout le tri et le « Suivant » se recalculent à chaque mise à jour.
        // Un changement net de précision passe quand même : le cercle sur la carte doit refléter la réalité.
        const stable =
          d && distance(d.lat, d.lon, lat, lon) < 8 && Math.abs(d.precision - precision) < 5 && Date.now() - d.t < 6000
        if (stable) return
        dernier.current = { lat, lon, precision, t: Date.now() }
        const store = useStore.getState()
        store.definirPosition({ lat, lon, precision })
        setErreur('')
        setEtat('on')
        if (premiere) {
          premiere = false
          void store.definirPref('tri', 'dist').catch(() => {})
        }
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setErreur('Autorisez la position dans le navigateur.')
          arreter()
          return
        }
        // Signal perdu (sous un toit, dans un creux) : il revient souvent seul. On continue d'écouter plutôt que
        // de tout couper ; la dernière position reste affichée, le bouton clignote pendant la recherche.
        setErreur('Signal GPS perdu, recherche en cours…')
        setEtat('attente')
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 },
    )
  }, [arreter])

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    },
    [],
  )

  const basculer = useCallback(() => {
    if (etat === 'off') return demarrer()
    arreter()
    const s = useStore.getState()
    if (s.prefs.tri === 'dist') void s.definirPref('tri', 'num').catch(() => {})
  }, [etat, demarrer, arreter])

  return { etat, erreur, basculer }
}
