import { useEffect } from 'react'
import { Carte } from './map/Carte'
import { useStore } from './store'
import { Commandes } from './ui/Commandes'
import { Feuille } from './ui/Feuille'
import { Fiche } from './ui/Fiche'
import { HorsLigne } from './ui/HorsLigne'
import { Reglages } from './ui/Reglages'
import { Toast } from './ui/Toast'

export function App() {
  const hydrater = useStore((s) => s.hydrater)
  const pret = useStore((s) => s.pret)

  useEffect(() => {
    void hydrater()
  }, [hydrater])

  const selection = useStore((s) => s.selection)
  const soleil = useStore((s) => s.prefs.pleinSoleil)
  useEffect(() => {
    document.body.classList.toggle('sun', soleil)
  }, [soleil])

  return (
    <main className="fixed inset-0 bg-nuit">
      {!pret && (
        <p className="absolute inset-0 grid place-items-center text-xl font-bold tracking-wide text-brume">
          Fanisana
        </p>
      )}
      {pret && (
        <>
          <Carte />
          <Commandes />
          <Feuille cachee={selection != null} />
          {selection != null && <Fiche key={selection} id={selection} />}
          <HorsLigne />
          <Reglages />
          <Toast />
        </>
      )}
    </main>
  )
}
