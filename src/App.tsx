import { useEffect } from 'react'
import { Carte } from './map/Carte'
import { useStore } from './store'
import { BoutonPosition } from './ui/BoutonPosition'
import { Feuille } from './ui/Feuille'

export function App() {
  const hydrater = useStore((s) => s.hydrater)
  const pret = useStore((s) => s.pret)

  useEffect(() => {
    void hydrater()
  }, [hydrater])

  const soleil = useStore((s) => s.prefs.pleinSoleil)
  useEffect(() => {
    document.body.classList.toggle('sun', soleil)
  }, [soleil])

  return (
    <main className="fixed inset-0 bg-nuit">
      {pret && (
        <>
          <Carte />
          <BoutonPosition />
          <Feuille />
        </>
      )}
    </main>
  )
}
