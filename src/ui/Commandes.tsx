import type { ReactNode } from 'react'
import { useGps } from '../lib/useGps'
import { useStore } from '../store'
import { enregistrer } from './enregistrer'

const icone = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

function Bouton({
  label, onClick, actif, attente, children,
}: {
  label: string
  onClick: () => void
  actif?: boolean
  attente?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={actif}
      className={`grid size-11 place-items-center rounded-[10px] border border-trait shadow-md ${
        actif ? 'bg-encours text-nuit' : 'bg-ardoise text-craie'
      } ${attente ? 'animate-pulse' : ''}`}
    >
      {children}
    </button>
  )
}

/** Colonne de boutons en haut à droite de la carte. */
export function Commandes() {
  const { etat, erreur, basculer } = useGps()
  const fond = useStore((s) => s.prefs.fond)
  const soleil = useStore((s) => s.prefs.pleinSoleil)
  const definirPref = useStore((s) => s.definirPref)
  const recadrer = useStore((s) => s.recadrer)

  return (
    <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] flex flex-col items-end gap-2">
      <Bouton
        label={etat === 'off' ? 'Afficher ma position' : 'Couper la position'}
        onClick={basculer}
        actif={etat !== 'off'}
        attente={etat === 'attente'}
      >
        {icone(<><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>)}
      </Bouton>
      <Bouton label="Voir tous les ménages" onClick={recadrer}>
        {icone(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />)}
      </Bouton>
      <Bouton
        label={fond === 'sat' ? 'Passer au plan' : 'Passer au satellite'}
        onClick={() => void enregistrer(() => definirPref('fond', fond === 'sat' ? 'osm' : 'sat'))}
      >
        {icone(<><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>)}
      </Bouton>
      <Bouton
        label="Mode plein soleil"
        actif={soleil}
        onClick={() => void enregistrer(() => definirPref('pleinSoleil', !soleil))}
      >
        {icone(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>)}
      </Bouton>
      {erreur && (
        <p role="alert" className="max-w-56 rounded-[10px] border border-trait bg-ardoise px-3 py-2 text-sm">
          {erreur}
        </p>
      )}
    </div>
  )
}
