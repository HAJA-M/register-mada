import { useEffect } from 'react'
import { useStore } from '../store'
import { LIBELLES } from '../types'
import { enregistrer } from './enregistrer'

const DELAI_ANNULATION = 5000

/** Annulation du dernier changement de statut (5 s) et alertes d'enregistrement. */
export function Toast() {
  const derniere = useStore((s) => s.derniere)
  const suivi = useStore((s) => s.suivi)
  const menages = useStore((s) => s.menages)
  const alerte = useStore((s) => s.alerte)
  const annuler = useStore((s) => s.annuler)
  const oublier = useStore((s) => s.oublierAnnulation)
  const fermerAlerte = useStore((s) => s.fermerAlerte)

  useEffect(() => {
    if (!derniere) return
    const t = setTimeout(oublier, DELAI_ANNULATION)
    return () => clearTimeout(t)
  }, [derniere, oublier])

  const m = derniere && menages.find((x) => x.id === derniere.id)
  const statut = derniere && suivi[derniere.id]?.statut

  return (
    <div
      className="pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 flex flex-col gap-2"
      role="status"
    >
      {alerte && (
        <div role="alert" className="pointer-events-auto flex items-center gap-3 rounded-[10px] border border-refus bg-ardoise p-3 text-sm">
          <span className="flex-1">{alerte}</span>
          <button onClick={fermerAlerte} className="min-h-11 rounded-[10px] border border-trait px-4 font-semibold">
            OK
          </button>
        </div>
      )}
      {derniere && m && statut && (
        <div className="anim-monter pointer-events-auto flex items-center gap-3 rounded-[10px] border border-trait bg-ardoise p-2 pl-4 shadow-lg">
          <span className="min-w-0 flex-1 truncate">
            n° {m.no} · <b>{LIBELLES[statut]}</b>
          </span>
          <button
            onClick={() => void enregistrer(annuler)}
            className="min-h-11 rounded-[10px] bg-craie px-4 font-bold text-nuit"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
